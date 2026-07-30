/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Join Store list/Doctor/Usage/content/mutation facts by composite (envUri, Store id) identity (7.4).
 * 2. Compose the Store Detail direct plane: identity, usability, observed Usage, readonly content, lifecycle (7.5/7.8).
 * 3. Keep Specs and Changes content regions independent; label observed-only Usage honestly (7.9/7.10).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-app-distribution › "Open Store Detail" and "Store Detail loads readonly content".
 *
 * Pure presentation composition: the caller supplies already-typed regional facts (joined by composite identity);
 * this module never acquires subscriptions or invents health/completeness/ownership. Errors and blockers stay direct;
 * healthy raw evidence and repository facts are secondary.
 */

/** Composite Store Detail identity (decoded from the route). */
export interface StoreDetailIdentity {
  readonly envUri: string
  readonly storeId: string
}

/** Health/usability of one Store, observed-only. */
export type StoreDetailHealth = 'healthy' | 'unhealthy' | 'unknown'

/** One observed Workspace usage relationship (Root for / Referenced by). Observed-only, not a machine index. */
export interface StoreDetailUsageEntry {
  readonly kind: 'root-for' | 'referenced-by'
  /** Stable id of the connected Workspace/project source. */
  readonly sourceId: string
  /** Optional display label for the source. */
  readonly label?: string
}

/** Readonly Specs-content region state (independent loading/error/recovery). */
export interface StoreDetailSpecsRegion {
  readonly state: 'loading' | 'ready' | 'error' | 'empty'
  readonly entries?: readonly { id: string; requirementCount: number }[]
  /** Retained entries remain visible while replacement work settles. */
  readonly refreshing?: boolean
  readonly error?: string
}

/** Readonly active-Changes-content region state (independent). */
export interface StoreDetailChangesRegion {
  readonly state: 'loading' | 'ready' | 'error' | 'empty'
  readonly entries?: readonly {
    name: string
    completedTasks: number
    totalTasks: number
    lastModified: string
    status: 'no-tasks' | 'complete' | 'in-progress'
  }[]
  /** Retained entries remain visible while replacement work settles. */
  readonly refreshing?: boolean
  readonly error?: string
}

/** Active/failed/indeterminate mutation state. */
export type StoreDetailMutationState = 'idle' | 'running' | 'succeeded' | 'failed' | 'indeterminate'

/** Repository/Git/metadata facts (secondary evidence). */
export interface StoreDetailRepositoryFacts {
  readonly root?: string
  readonly metadataPath?: string
  readonly gitRemote?: string | null
  readonly isRepository?: boolean | null
}

/** Inputs to the Store Detail projection, all already-typed and joined by composite identity. */
export interface StoreDetailProjectionInput {
  readonly identity: StoreDetailIdentity
  readonly health: StoreDetailHealth
  /** Blocking diagnostics promoted to the direct plane. */
  readonly blockingDiagnostics?: readonly { severity: string; message: string }[]
  readonly usage: readonly StoreDetailUsageEntry[]
  readonly specs: StoreDetailSpecsRegion
  readonly changes: StoreDetailChangesRegion
  readonly mutation: StoreDetailMutationState
  readonly mutationError?: string
  readonly repository: StoreDetailRepositoryFacts
  /** Successful typed Doctor command evidence; collapsed by default. */
  readonly evidence?: unknown
  /** Whether the current Environment authority is valid for destructive actions. */
  readonly hasAuthority: boolean
}

/** The composed Store Detail direct plane. */
export interface StoreDetailProjection {
  readonly identity: StoreDetailIdentity
  readonly health: StoreDetailHealth
  readonly hasBlockingDiagnostics: boolean
  readonly blockingDiagnostics: readonly { severity: string; message: string }[]
  /** Observed-only usage summary. */
  readonly rootForCount: number
  readonly referencedByCount: number
  readonly usage: readonly StoreDetailUsageEntry[]
  readonly specs: StoreDetailSpecsRegion
  readonly changes: StoreDetailChangesRegion
  readonly mutation: StoreDetailMutationState
  readonly mutationError?: string
  readonly repository: StoreDetailRepositoryFacts
  readonly evidence?: unknown
  readonly hasAuthority: boolean
  /** Whether unregister/remove can start with current authority and no unsettled mutation. */
  readonly canCleanUp: boolean
}

/**
 * Compose the Store Detail projection from already-typed regional facts (7.4/7.5/7.8).
 *
 * The direct plane answers: what the Store is, whether it is usable, which Workspaces currently use/reference it,
 * what Specs/active Changes it contains, and which lifecycle actions are valid. Observed-only Usage never claims
 * machine-wide completeness; Specs/Changes regions stay independent; blocking diagnostics promote to the direct plane.
 */
export function selectStoreDetailProjection(
  input: StoreDetailProjectionInput
): StoreDetailProjection {
  const rootForCount = input.usage.filter((entry) => entry.kind === 'root-for').length
  const referencedByCount = input.usage.filter((entry) => entry.kind === 'referenced-by').length
  const blockingDiagnostics = input.blockingDiagnostics ?? []
  const canCleanUp =
    input.hasAuthority && input.mutation !== 'running' && input.mutation !== 'indeterminate'
  return {
    identity: input.identity,
    health: input.health,
    hasBlockingDiagnostics: blockingDiagnostics.length > 0,
    blockingDiagnostics,
    rootForCount,
    referencedByCount,
    usage: input.usage,
    specs: input.specs,
    changes: input.changes,
    mutation: input.mutation,
    ...(input.mutationError !== undefined ? { mutationError: input.mutationError } : {}),
    repository: input.repository,
    ...(input.evidence !== undefined ? { evidence: input.evidence } : {}),
    hasAuthority: input.hasAuthority,
    canCleanUp,
  }
}

/** Honest observed-only Usage label (7.9): never "all references" or "unreferenced". */
export function usageCompletenessLabel(projection: StoreDetailProjection): string {
  const total = projection.rootForCount + projection.referencedByCount
  if (total === 0) return 'No reference currently observed.'
  return `${total} observed relationship${total === 1 ? '' : 's'}.`
}
