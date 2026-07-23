/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Own the final selected-authority check for every App-native Store mutation.
 * 2. Dispatch accepted inputs through the locator-scoped backend client.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import {
  mutateBackendStore,
  type BackendStoreMutateInput,
  type BackendStoreMutationRecord,
} from './backend-client'

/** Minimum current-generation authority required by an environment-scoped Store mutation. */
export interface StoreActionAuthority {
  apiBaseUrl: string
  isCurrent(): boolean
}

/** Dispatch through the real Store client only while the captured authority remains current. */
export async function dispatchStoreMutation(
  authority: StoreActionAuthority | null,
  input: BackendStoreMutateInput
): Promise<BackendStoreMutationRecord | null> {
  if (!authority?.isCurrent()) return null
  return mutateBackendStore({ apiBaseUrl: authority.apiBaseUrl }, input)
}
