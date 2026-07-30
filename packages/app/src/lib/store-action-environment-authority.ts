/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Integrate the Environment authority owner into the Store mutation dispatch boundary (8.4/5.7).
 * 2. Revalidate pinned authority against current observations before any Store mutation dispatch.
 * 3. Retire the global activeTabId selection in favor of Environment-scoped exact authority (5.10).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-environment-delivery › "Credential-Scoped Reachability and Explicit Environment Selection".
 *
 * This composes the existing `useStoreMutationDispatcher` (which rechecks the connection-observation authority)
 * with the Environment authority owner: a mutation may dispatch only when the pinned authority is still the
 * current exact source inside the selected Environment. Iframe continuity and observation bindings are unchanged.
 */
import { useCallback } from 'react'
import {
  mutateBackendStore,
  type BackendStoreMutateInput,
  type BackendStoreMutationRecord,
} from './backend-client'
import { useConnectionObservationOwner } from './connection-observation'
import {
  pinEnvironmentActionAuthority,
  resolveEnvironmentAuthority,
  revalidateEnvironmentAuthority,
  selectEnvironment,
  type EnvironmentActionAuthority,
  type EnvironmentAuthorityRevalidation,
  type EnvironmentSelectionState,
  type EnvironmentSourceObservation,
} from './environment-authority'
import type { HostedShellTab } from './shell-state'
import { getConnectionsSnapshot } from './use-connections'

export interface StoreEnvironmentAuthorityContext {
  /** Current selection state (selected envUri). */
  selection: EnvironmentSelectionState
  /** Current compatible source observations grouped by envUri. */
  observations: readonly EnvironmentSourceObservation[]
}

/** Match a pinned Environment action to its exact open tab without requiring that tab to be active. */
export function hasExactEnvironmentAuthorityTab(
  authority: EnvironmentActionAuthority,
  tabs: readonly HostedShellTab[]
): boolean {
  return tabs.some(
    (tab) =>
      tab.id === authority.tabId &&
      tab.sessionId === authority.sessionId &&
      tab.apiBaseUrl === authority.apiBaseUrl &&
      tab.createdAt === authority.tabCreatedAt
  )
}

/** Resolve the current Environment authority for the Store action dispatch boundary. */
export function resolveStoreEnvironmentAuthority(context: StoreEnvironmentAuthorityContext):
  | {
      kind: 'authority'
      authority: EnvironmentActionAuthority
      source: EnvironmentSourceObservation
    }
  | { kind: 'no-authority'; reason: string } {
  const resolution = resolveEnvironmentAuthority(context.selection, context.observations)
  if (resolution.kind !== 'authority') {
    return {
      kind: 'no-authority',
      reason: `No current Environment authority (${resolution.kind}).`,
    }
  }
  return {
    kind: 'authority',
    authority: pinEnvironmentActionAuthority(resolution.source),
    source: resolution.source,
  }
}

/**
 * Create a Store mutation dispatcher that revalidates BOTH the Environment authority (selected envUri + exact
 * source) and the connection-observation authority (tab/session/generation) at dispatch time. A mutation dispatches
 * only when both gates pass.
 */
export function useStoreEnvironmentMutationDispatcher(
  environmentAuthority: () => StoreEnvironmentAuthorityContext
) {
  const observationOwner = useConnectionObservationOwner()
  return useCallback(
    async (
      authority: EnvironmentActionAuthority | null,
      input: BackendStoreMutateInput
    ): Promise<BackendStoreMutationRecord | null> => {
      if (!authority) return null
      // Gate 1: Environment authority revalidation against the current observations at dispatch time.
      const context = environmentAuthority()
      const revalidation: EnvironmentAuthorityRevalidation = revalidateEnvironmentAuthority(
        authority,
        context.observations
      )
      if (revalidation.kind !== 'valid') return null
      // Gate 2: connection-observation full-identity revalidation (existing boundary, unchanged).
      const connections = getConnectionsSnapshot()
      if (!hasExactEnvironmentAuthorityTab(authority, connections.tabs)) {
        return null
      }
      if (
        !observationOwner.isCurrentAuthority({
          tabId: authority.tabId,
          sessionId: authority.sessionId,
          apiBaseUrl: authority.apiBaseUrl,
          tabCreatedAt: authority.tabCreatedAt,
          generation: authority.generation,
        })
      ) {
        return null
      }
      return mutateBackendStore({ apiBaseUrl: authority.apiBaseUrl }, input)
    },
    [environmentAuthority, observationOwner]
  )
}

/** Select an Environment by envUri for the Store views (credential-free; may persist). */
export function useEnvironmentSelectionActions() {
  // Direct state-free helpers; callers persist selection through their own store.
  return { selectEnvironment, resolveStoreEnvironmentAuthority }
}
