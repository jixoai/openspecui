/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Project current connection observations into Environment-scoped Store sources.
 * 2. Project observed Environment evidence without turning locators into product identity.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-environment-delivery > "Credential-Scoped Reachability and Explicit Environment Selection".
 */
import type { EnvironmentEvidenceEntry } from '../components/stores-environment-evidence'
import type { ConnectionObservation } from './connection-observation'
import type { EnvironmentSourceObservation } from './environment-authority'

/** Preserve backend-issued envUri and full connection identity at the Store authority boundary. */
export function projectEnvironmentSources(
  observations: readonly ConnectionObservation[]
): EnvironmentSourceObservation[] {
  return observations.flatMap((observation) => {
    const envUri = observation.health?.envUri ?? observation.rootAttempt.health?.envUri
    if (!envUri) return []
    const capabilities = observation.health?.hostedCapabilities ?? []
    return [
      {
        envUri,
        tabId: observation.tabId,
        sessionId: observation.sessionId,
        apiBaseUrl: observation.apiBaseUrl,
        tabCreatedAt: observation.tabCreatedAt,
        generation: observation.generation,
        reachability: observation.reachability,
        compatible: capabilities.includes('stores.inspect'),
      },
    ]
  })
}

/** Present connected-project evidence grouped by opaque Environment identity. */
export function projectStoresEnvironmentEvidence(
  observations: readonly ConnectionObservation[]
): EnvironmentEvidenceEntry[] {
  const grouped = new Map<string, EnvironmentEvidenceEntry>()
  for (const observation of observations) {
    const health = observation.health ?? observation.rootAttempt.health
    const envUri = health?.envUri
    if (!envUri || !health) continue
    const current = grouped.get(envUri)
    const project = {
      sourceId: observation.tabId,
      label: health.projectName,
      ...(health.cliVersion ? { cliVersion: health.cliVersion } : {}),
      capabilities: health.hostedCapabilities ?? [],
    }
    if (current) {
      grouped.set(envUri, {
        ...current,
        observedAt: Math.max(current.observedAt, observation.observedAt),
        projects: [...current.projects, project],
      })
    } else {
      grouped.set(envUri, {
        envUri,
        observedAt: observation.observedAt,
        projects: [project],
      })
    }
  }
  return [...grouped.values()].sort((left, right) => left.envUri.localeCompare(right.envUri))
}
