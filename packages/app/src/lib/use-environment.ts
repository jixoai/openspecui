/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Build observed runtime environments from backend-issued health (opaque envUri + capabilities).
 * 2. Gate Store views through objective hosted-protocol capabilities.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 * Migration (2026-07-23): wired to the backend health response (envUri/capabilities now emitted).
 */
import { asEnvUri, type HostedBackendHealthResponse, type StoreCapability } from '@openspecui/core'
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

/** Read the current backend-issued environment observation. With no online backends, returns empty. */
export function useEnvironmentObservation(
  observations: OnlineBackendObservation[] = []
): EnvironmentObservation {
  return {
    environments: deriveEnvironments(observations),
    projectContexts: [],
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
