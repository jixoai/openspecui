/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Own the final selected-tab and observation-generation check for every App-native Store mutation.
 * 2. Dispatch accepted inputs through the locator-scoped backend client.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import { useCallback } from 'react'
import {
  mutateBackendStore,
  type BackendStoreMutateInput,
  type BackendStoreMutationRecord,
} from './backend-client'
import { useConnectionObservationOwner } from './connection-observation'
import { getConnectionsSnapshot } from './use-connections'

/** Minimum current-generation authority required by an environment-scoped Store mutation. */
export interface StoreActionAuthority {
  tabId: string
  sessionId: string
  apiBaseUrl: string
  tabCreatedAt: number
  observationGeneration: number
}

export type StoreMutationDispatcher = (
  authority: StoreActionAuthority | null,
  input: BackendStoreMutateInput
) => Promise<BackendStoreMutationRecord | null>

/** Create the route-level dispatcher that rechecks the real selection and observation owners. */
export function useStoreMutationDispatcher(): StoreMutationDispatcher {
  const observationOwner = useConnectionObservationOwner()
  return useCallback(
    async (authority, input) => {
      if (!authority) return null
      const connections = getConnectionsSnapshot()
      const selectedTab = connections.tabs.find((tab) => tab.id === authority.tabId)
      if (
        connections.activeTabId !== authority.tabId ||
        !selectedTab ||
        selectedTab.sessionId !== authority.sessionId ||
        selectedTab.apiBaseUrl !== authority.apiBaseUrl ||
        selectedTab.createdAt !== authority.tabCreatedAt
      ) {
        return null
      }
      if (
        !observationOwner.isCurrentAuthority({
          tabId: authority.tabId,
          apiBaseUrl: authority.apiBaseUrl,
          generation: authority.observationGeneration,
        })
      ) {
        return null
      }
      return mutateBackendStore({ apiBaseUrl: authority.apiBaseUrl }, input)
    },
    [observationOwner]
  )
}

/** Compare captured action provenance without granting authority. */
export function isSameStoreActionAuthority(
  left: StoreActionAuthority | null | undefined,
  right: StoreActionAuthority | null | undefined
): boolean {
  return Boolean(
    left &&
      right &&
      left.tabId === right.tabId &&
      left.sessionId === right.sessionId &&
      left.apiBaseUrl === right.apiBaseUrl &&
      left.tabCreatedAt === right.tabCreatedAt &&
      left.observationGeneration === right.observationGeneration
  )
}
