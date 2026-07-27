/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Build observed runtime environments from backend-issued health (opaque envUri + capabilities).
 * 2. Gate Store views through objective hosted-protocol capabilities.
 * 3. Preserve grouped connected projects and source-labelled Root/Reference evidence.
 * 4. Project retained evidence and the current attempt as non-interchangeable full sources.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 * Migration (2026-07-23): wired to the backend health response (envUri/capabilities now emitted).
 * Correction request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import {
  asEnvUri,
  type HostedBackendHealthResponse,
  type HostedCliDiagnostic,
  type StoreCapability,
} from '@openspecui/core/hosted-contract'
import type { StoreCapabilitySet } from '../types/capabilities'
import type {
  HostedEnvironment,
  ProjectContextObservation,
  ProjectRootEvidence,
} from '../types/root-context'
import type {
  ConnectionObservation,
  ConnectionRootAttempt,
  ConnectionRootEvidence,
} from './connection-observation'
import { normalizeHostedApiBaseUrl } from './shell-state'

export interface EnvironmentObservation {
  /** Runtime environments grouped by envUri (observed-only). */
  environments: HostedEnvironment[]
  /** Current or retained project Context evidence, never machine-wide completeness. */
  projectContexts: ProjectContextObservation[]
  /** Whether observation is loading. */
  isLoading: boolean
  /** Most recent error. */
  error: Error | null
}

/** One current backend health observation used to derive environments. */
export interface OnlineBackendObservation {
  tabId: string
  generation: number
  apiBaseUrl: string
  health: HostedBackendHealthResponse
}

/**
 * Derive observed runtime environments from a set of online backend health responses.
 *
 * Invariants:
 *  - envUri is taken verbatim from backend health; App never constructs it.
 *  - Multiple backends sharing the same envUri remain distinct connected-project evidence.
 *  - Capabilities are compatibility facts only; they never authorize or infer workflow state.
 */
export function deriveEnvironments(observations: OnlineBackendObservation[]): HostedEnvironment[] {
  const byEnvUri = new Map<string, HostedEnvironment>()
  for (const observation of observations) {
    const envUriValue = observation.health.envUri
    if (!envUriValue) continue
    const capabilities: StoreCapabilitySet = observation.health.hostedCapabilities ?? []
    const existing = byEnvUri.get(envUriValue)
    const connectedProject = {
      tabId: observation.tabId,
      generation: observation.generation,
      apiBaseUrl: observation.apiBaseUrl,
      projectName: observation.health.projectName,
      cliVersion: observation.health.cliVersion ?? undefined,
      capabilities,
    }
    if (existing) {
      existing.observedAt = Date.now()
      const normalizedLocator = normalizeHostedApiBaseUrl(observation.apiBaseUrl)
      const duplicateIndex = existing.connectedProjects.findIndex(
        (project) => normalizeHostedApiBaseUrl(project.apiBaseUrl) === normalizedLocator
      )
      if (duplicateIndex < 0) {
        existing.connectedProjects.push(connectedProject)
      } else if (
        existing.connectedProjects[duplicateIndex] &&
        existing.connectedProjects[duplicateIndex].generation < observation.generation
      ) {
        existing.connectedProjects[duplicateIndex] = connectedProject
      }
      continue
    }
    byEnvUri.set(envUriValue, {
      envUri: asEnvUri(envUriValue),
      connectedProjects: [connectedProject],
      observedAt: Date.now(),
    })
  }
  return [...byEnvUri.values()]
}

/** One backend's Root Context used to derive its project Context observation. */
export interface BackendRootContextObservation {
  evidence: ConnectionRootEvidence | null
  attempt: ConnectionRootAttempt
  stale?: boolean
}

/** Preserve committed Root evidence provenance while a replacement observation remains pending. */
export function projectRootObservation(
  observation: ConnectionObservation
): BackendRootContextObservation {
  return {
    evidence: observation.rootEvidence,
    attempt: observation.rootAttempt,
    stale: observation.stale,
  }
}

/** Map a CLI Doctor reference diagnostic severity to a neutral Reference state. */
function referenceStateFor(diagnostics: HostedCliDiagnostic[]): {
  state: ProjectRootEvidence['references'][number]['state']
  note?: string
} {
  const state = diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    ? 'error'
    : diagnostics.some((diagnostic) => diagnostic.severity === 'warning')
      ? 'warning'
      : diagnostics.some((diagnostic) => diagnostic.severity === 'info')
        ? 'info'
        : 'observed'
  const notes = diagnostics.map((diagnostic) => diagnostic.message).filter(Boolean)
  return { state, note: notes.join('; ') || undefined }
}

/**
 * Derive current or retained project Context observations from backend Root Contexts. Observed-only:
 * never claims machine-wide completeness. Offline evidence is projected only as an explicit stale snapshot.
 */
export function deriveProjectContexts(
  observations: BackendRootContextObservation[]
): ProjectContextObservation[] {
  const contexts: ProjectContextObservation[] = []
  for (const observation of observations) {
    const { attempt, evidence } = observation
    if (!evidence?.health.envUri && !attempt.health?.envUri) continue
    const evidenceData = evidence?.rootContext.data ?? null
    const evidenceSource = evidence
      ? {
          tabId: evidence.tabId,
          sessionId: evidence.sessionId,
          generation: evidence.generation,
          apiBaseUrl: evidence.apiBaseUrl,
          tabCreatedAt: evidence.tabCreatedAt,
          health: evidence.health,
          observedAt: evidence.observedAt,
        }
      : null
    const references = evidenceSource
      ? (evidenceData?.references ?? []).map((reference) => {
          const state = referenceStateFor(reference.status ?? [])
          return {
            storeId: reference.store_id,
            root: reference.root,
            source: evidenceSource,
            diagnostics: reference.status ?? [],
            state: state.state,
            note: state.note,
          }
        })
      : []
    contexts.push({
      evidence:
        evidence && evidenceSource
          ? {
              source: evidenceSource,
              projectName: evidence.health.projectName,
              planningRoot: evidenceData?.planningRoot?.path,
              rootSource: evidenceData?.planningRoot?.source,
              storeId: evidenceData?.storeId ?? evidenceData?.planningRoot?.store_id,
              references,
              diagnostics: evidenceData?.diagnostics.root,
            }
          : null,
      attempt: {
        source: {
          tabId: attempt.tabId,
          sessionId: attempt.sessionId,
          generation: attempt.generation,
          apiBaseUrl: attempt.apiBaseUrl,
          tabCreatedAt: attempt.tabCreatedAt,
          health: attempt.health,
          observedAt: attempt.observedAt,
        },
        status: attempt.status,
        error: attempt.error ?? undefined,
      },
      stale:
        observation.stale === true ||
        (evidence !== null && evidence.generation !== attempt.generation),
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
