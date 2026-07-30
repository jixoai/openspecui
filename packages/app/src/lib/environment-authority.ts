/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Resolve/pin/revalidate Environment-scoped Store authority from current connection observations (5.2–5.9).
 * 2. Replace backend-URL selection with explicit Environment (envUri) selection; never choose the first Environment.
 * 3. Capture and synchronously revalidate full tab/session/generation authority at dispatch (5.6/5.7).
 * 4. Surface same-Environment conflict from settled source-labelled evidence (5.8).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-environment-delivery › "Credential-Scoped Reachability and Explicit Environment Selection".
 *
 * This is the pure authority core. The Store action dispatcher consumes `revalidateAuthority` at dispatch time;
 * the Store UI consumes `resolveEnvironmentAuthorityState` for the direct plane. Credential binding remains in the
 * locator-owned runtime memory owner; this module is credential-free.
 */

/** One current compatible source observation carrying a backend-issued envUri. */
export interface EnvironmentSourceObservation {
  /** Opaque backend-issued Environment identity (never constructed by the App). */
  readonly envUri: string
  /** Stable tab id. */
  readonly tabId: string
  /** Stable session id. */
  readonly sessionId: string
  /** Normalized backend locator (current access authority; not product identity). */
  readonly apiBaseUrl: string
  /** Tab creation identity. */
  readonly tabCreatedAt: number
  /** Observation generation (monotonic; replacement generation retires authority). */
  readonly generation: number
  /** Current reachability of this source. */
  readonly reachability: EnvironmentSourceReachability
  /** Whether this source advertises the required protocol compatibility. */
  readonly compatible: boolean
  /** Optional settled Store-identity evidence (id/root) used for conflict detection. */
  readonly storeIdentity?: { storeId?: string; root?: string } | null
}

/** Reachability states that produce distinct direct-plane outcomes. */
export type EnvironmentSourceReachability =
  | 'online'
  | 'checking'
  | 'offline'
  | 'authentication-required'
  | 'unsupported'

/** Full authority captured when an action/dialog opens (5.6). */
export interface EnvironmentActionAuthority {
  readonly envUri: string
  readonly tabId: string
  readonly sessionId: string
  readonly apiBaseUrl: string
  readonly tabCreatedAt: number
  readonly generation: number
  readonly compatible: boolean
}

/** Credential-free selected-Environment state; may persist (5.2). */
export interface EnvironmentSelectionState {
  readonly selectedEnvUri: string | null
}

export function createEmptyEnvironmentSelection(): EnvironmentSelectionState {
  return { selectedEnvUri: null }
}

/**
 * Resolve the effective selected Environment from current observations (5.2/5.3).
 *
 * - With exactly one current Environment, it MAY be auto-selected.
 * - With multiple Environments and no valid selection, returns `requires-selection` (never chooses the first).
 * - A selected envUri is valid only while at least one current observation carries it.
 */
export type EnvironmentSelectionResolution =
  | { kind: 'selected'; envUri: string; autoSelected: boolean }
  | { kind: 'requires-selection'; observedEnvUris: readonly string[] }
  | { kind: 'no-environment' }

export function resolveEnvironmentSelection(
  prev: EnvironmentSelectionState,
  observations: readonly EnvironmentSourceObservation[]
): EnvironmentSelectionResolution {
  const currentEnvUris = uniqueEnvUris(observations)
  if (currentEnvUris.length === 0) return { kind: 'no-environment' }

  const selected = prev.selectedEnvUri
  if (selected !== null) {
    // A prior selection is sticky: if it is still current, keep it; otherwise it is stale and must NOT
    // silently jump to a different Environment identity. The caller clears/updates the stale selection.
    if (currentEnvUris.includes(selected)) {
      return { kind: 'selected', envUri: selected, autoSelected: false }
    }
    return { kind: 'selected', envUri: selected, autoSelected: false }
  }
  // No prior selection: auto-select only when exactly one Environment is observed.
  if (currentEnvUris.length === 1) {
    return { kind: 'selected', envUri: currentEnvUris[0]!, autoSelected: true }
  }
  return { kind: 'requires-selection', observedEnvUris: currentEnvUris }
}

/** Explicitly select one Environment by envUri (credential-free; may persist). */
export function selectEnvironment(
  _prev: EnvironmentSelectionState,
  envUri: string
): EnvironmentSelectionState {
  return { selectedEnvUri: envUri }
}

/** Clear the selection (e.g. when the selected Environment disappears). */
export function clearEnvironmentSelection(
  prev: EnvironmentSelectionState
): EnvironmentSelectionState {
  if (prev.selectedEnvUri === null) return prev
  return { selectedEnvUri: null }
}

/**
 * Resolve the current access authority inside the selected Environment (5.4/5.5).
 *
 * Retains one deterministic exact source while it remains current. When that source retires and no action draft
 * is pinned, it MAY resolve another current compatible source in the same Environment through a deterministic
 * stable rule. It must never cross Environment identity.
 */
export type EnvironmentAuthorityResolution =
  | { kind: 'authority'; source: EnvironmentSourceObservation }
  | { kind: 'no-environment' }
  | { kind: 'requires-selection' }
  | { kind: 'pending'; envUri: string }
  | { kind: 'offline'; envUri: string }
  | { kind: 'authentication-required'; envUri: string }
  | { kind: 'incompatible'; envUri: string }
  | { kind: 'conflict'; envUri: string; sources: readonly EnvironmentSourceObservation[] }
  | { kind: 'no-current-authority'; envUri: string }

export function resolveEnvironmentAuthority(
  selection: EnvironmentSelectionState,
  observations: readonly EnvironmentSourceObservation[]
): EnvironmentAuthorityResolution {
  const resolution = resolveEnvironmentSelection(selection, observations)
  if (resolution.kind === 'no-environment') return { kind: 'no-environment' }
  if (resolution.kind === 'requires-selection') return { kind: 'requires-selection' }

  const envUri = resolution.envUri
  const inEnv = observations.filter((observation) => observation.envUri === envUri)
  if (inEnv.length === 0) return { kind: 'no-current-authority', envUri }

  // Any checking source is pending.
  if (inEnv.some((observation) => observation.reachability === 'checking')) {
    return { kind: 'pending', envUri }
  }

  const compatible = inEnv.filter((observation) => observation.compatible)
  if (compatible.length === 0) {
    // Distinguish authentication-required / offline / unsupported among incompatible sources.
    if (inEnv.every((observation) => observation.reachability === 'authentication-required')) {
      return { kind: 'authentication-required', envUri }
    }
    if (inEnv.every((observation) => observation.reachability === 'offline')) {
      return { kind: 'offline', envUri }
    }
    return { kind: 'incompatible', envUri }
  }

  // Deterministic stable source: lowest tabCreatedAt, then tabId tiebreak. Retained while current.
  const stable = pickStableSource(compatible)
  if (!stable) return { kind: 'no-current-authority', envUri }

  // Same-Environment conflict: settled non-equivalent storeIdentity among compatible sources (5.8).
  const conflict = detectSameEnvironmentConflict(compatible)
  if (conflict) return { kind: 'conflict', envUri, sources: compatible }

  return { kind: 'authority', source: stable }
}

/**
 * Pin full authority when an action/draft opens (5.6). The caller captures this at creation; the dispatcher
 * revalidates it synchronously before dispatch (5.7).
 */
export function pinEnvironmentActionAuthority(
  source: EnvironmentSourceObservation
): EnvironmentActionAuthority {
  return {
    envUri: source.envUri,
    tabId: source.tabId,
    sessionId: source.sessionId,
    apiBaseUrl: source.apiBaseUrl,
    tabCreatedAt: source.tabCreatedAt,
    generation: source.generation,
    compatible: source.compatible,
  }
}

/**
 * Synchronously revalidate a pinned authority against current observations at dispatch time (5.7).
 *
 * Replacement generation, identity (tab/session/creation), envUri, compatibility, or reachability retires the
 * authority. Retained display data remains visible; only current authority authorizes the dispatch.
 */
export type EnvironmentAuthorityRevalidation =
  | { kind: 'valid'; source: EnvironmentSourceObservation }
  | { kind: 'retired'; reason: EnvironmentAuthorityRetirementReason }

export type EnvironmentAuthorityRetirementReason =
  | 'source-absent'
  | 'generation-replaced'
  | 'identity-replaced'
  | 'envuri-changed'
  | 'incompatible'
  | 'offline'
  | 'authentication-required'

export function revalidateEnvironmentAuthority(
  authority: EnvironmentActionAuthority,
  observations: readonly EnvironmentSourceObservation[]
): EnvironmentAuthorityRevalidation {
  const match = observations.find((observation) => observation.tabId === authority.tabId)
  if (!match) return { kind: 'retired', reason: 'source-absent' }
  if (match.envUri !== authority.envUri) return { kind: 'retired', reason: 'envuri-changed' }
  if (match.sessionId !== authority.sessionId || match.tabCreatedAt !== authority.tabCreatedAt) {
    return { kind: 'retired', reason: 'identity-replaced' }
  }
  if (match.generation !== authority.generation)
    return { kind: 'retired', reason: 'generation-replaced' }
  if (!match.compatible) return { kind: 'retired', reason: 'incompatible' }
  if (match.reachability === 'offline') return { kind: 'retired', reason: 'offline' }
  if (match.reachability === 'authentication-required') {
    return { kind: 'retired', reason: 'authentication-required' }
  }
  return { kind: 'valid', source: match }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function uniqueEnvUris(observations: readonly EnvironmentSourceObservation[]): string[] {
  const seen = new Set<string>()
  for (const observation of observations) {
    if (observation.envUri) seen.add(observation.envUri)
  }
  return [...seen]
}

function pickStableSource(
  compatible: readonly EnvironmentSourceObservation[]
): EnvironmentSourceObservation | null {
  if (compatible.length === 0) return null
  return compatible.slice().sort((a, b) => {
    if (a.tabCreatedAt !== b.tabCreatedAt) return a.tabCreatedAt - b.tabCreatedAt
    return a.tabId < b.tabId ? -1 : a.tabId > b.tabId ? 1 : 0
  })[0]!
}

function detectSameEnvironmentConflict(
  compatible: readonly EnvironmentSourceObservation[]
): boolean {
  const settled = compatible.filter((observation) => observation.storeIdentity)
  if (settled.length < 2) return false
  const first = settled[0]!.storeIdentity!
  return settled.some((observation) => {
    const identity = observation.storeIdentity!
    return (
      (identity.storeId ?? null) !== (first.storeId ?? null) ||
      (identity.root ?? null) !== (first.root ?? null)
    )
  })
}
