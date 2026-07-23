/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Build observed runtime environments from backend-issued health (opaque envUri + capabilities).
 * 2. Gate Store views through objective hosted-protocol capabilities.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 * Migration (2026-07-23): wired to the backend health response (envUri/capabilities now emitted).
 */
import {
  asEnvUri,
  type HostedBackendHealthResponse,
  type RootContextState,
  type StoreCapability,
} from '@openspecui/core'
import type { StoreCapabilitySet } from '../types/capabilities'
import type { HostedEnvironment, ProjectContextObservation } from '../types/root-context'

export interface EnvironmentObservation {
  /** Runtime environments grouped by envUri (observed-only). */
  environments: HostedEnvironment[]
  /** Per-online-project Context observations (observed references, never machine-wide completeness). */
  projectContexts: ProjectContextObservation[]
  /** Whether observation is loading. */
  isLoading: boolean
  /** Most recent error. */
  error: Error | null
}

/** One online backend health observation used to derive environments. */
export interface OnlineBackendObservation {
  apiBaseUrl: string
  health: HostedBackendHealthResponse
}

/**
 * Derive observed runtime environments from a set of online backend health responses.
 *
 * Invariants:
 *  - envUri is taken verbatim from backend health; App never constructs it.
 *  - Multiple backends sharing the same envUri collapse into one environment entry (one apiBaseUrl
 *    is retained as the representative locator; App must not expose raw host/data-home values).
 *  - Capabilities are compatibility facts only; they never authorize or infer workflow state.
 */
export function deriveEnvironments(observations: OnlineBackendObservation[]): HostedEnvironment[] {
  const byEnvUri = new Map<string, HostedEnvironment>()
  for (const observation of observations) {
    const envUriValue = observation.health.envUri
    if (!envUriValue) continue
    const capabilities = (observation.health.hostedCapabilities ?? []) as StoreCapabilitySet
    const existing = byEnvUri.get(envUriValue)
    if (existing) {
      // Same envUri: keep the first representative locator, refresh observed time/capabilities.
      existing.observedAt = Date.now()
      existing.capabilities = capabilities
      continue
    }
    byEnvUri.set(envUriValue, {
      envUri: asEnvUri(envUriValue),
      apiBaseUrl: observation.apiBaseUrl,
      cliVersion: observation.health.cliVersion ?? undefined,
      capabilities,
      observedAt: Date.now(),
    })
  }
  return [...byEnvUri.values()]
}

/** One backend's Root Context used to derive its project Context observation. */
export interface BackendRootContextObservation extends OnlineBackendObservation {
  rootContext: RootContextState | null
}

/** Map a CLI Doctor reference diagnostic severity to a neutral Reference state. */
function referenceStateFor(diagnostics: { severity: string }[]): {
  state: ProjectContextObservation['references'][number]['state']
  note?: string
} {
  const hasError = diagnostics.some((d) => d.severity === 'error')
  if (hasError) {
    const notes = diagnostics
      .map((d) => ('message' in d && typeof d.message === 'string' ? d.message : ''))
      .filter(Boolean)
    return { state: 'unhealthy', note: notes.join('; ') || undefined }
  }
  return { state: 'healthy' }
}

/**
 * Derive observed project Context observations from online backends' Root Contexts. Observed-only:
 * never claims machine-wide completeness. An offline backend is unknown unless a stale snapshot is shown.
 */
export function deriveProjectContexts(
  observations: BackendRootContextObservation[]
): ProjectContextObservation[] {
  const contexts: ProjectContextObservation[] = []
  for (const observation of observations) {
    const envUriValue = observation.health.envUri
    if (!envUriValue) continue
    const root = observation.rootContext
    const ready = root?.state === 'ready' && root.data ? true : false
    const data = ready
      ? (
          root as {
            data: {
              planningRoot?: { source?: string; store_id?: string } | null
              storeId?: string | null
              references?: { store_id: string; status?: { severity: string; message?: string }[] }[]
            }
          }
        ).data
      : null
    const references = (data?.references ?? []).map((reference) => {
      const state = referenceStateFor(reference.status ?? [])
      return {
        storeId: reference.store_id,
        state: state.state,
        note: state.note,
      }
    })
    contexts.push({
      envUri: asEnvUri(envUriValue),
      apiBaseUrl: observation.apiBaseUrl,
      projectName: observation.health.projectName,
      planningRoot: undefined,
      rootSource: data?.planningRoot?.source as ProjectContextObservation['rootSource'] | undefined,
      storeId: data?.storeId ?? data?.planningRoot?.store_id ?? undefined,
      references,
      observedAt: Date.now(),
    })
  }
  return contexts
}

/** Read the current backend-issued environment observation. With no online backends, returns empty. */
export function useEnvironmentObservation(
  observations: OnlineBackendObservation[] = [],
  rootContextObservations: BackendRootContextObservation[] = []
): EnvironmentObservation {
  return {
    environments: deriveEnvironments(observations),
    projectContexts: deriveProjectContexts(rootContextObservations),
    isLoading: false,
    error: null,
  }
}

/**
 * Capability visibility: whether a Store Manager view should render.
 *
 * Invariant (AGENTS.md): capabilities are compatibility facts, not permissions. Absence hides the
 * view; presence allows rendering, but operation applicability still comes from CLI results.
 */
export function canRenderStoreInspector(capabilities: StoreCapabilitySet | undefined): boolean {
  return Boolean(capabilities?.includes('stores.inspect' satisfies StoreCapability))
}
