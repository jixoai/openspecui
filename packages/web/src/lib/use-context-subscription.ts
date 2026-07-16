/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Subscribe the project workspace to the shared CLI-owned Root Context state.
 * 2. Preserve loading, refreshing, stale-data, and failed-attempt evidence.
 * 3. Keep static mode on an explicit pending projection until snapshot parity lands.
 *
 * Original request (2026-07-15): "项目 Web surface may show Store and Reference diagnostics but must not imply that its registry is project-local."
 */
import type { RootContext, RootContextState } from '@openspecui/core'
import { trpcClient } from './trpc'
import type { SubscriptionState } from './use-subscription'
import { useSubscription } from './use-subscription'

const STATIC_PENDING_ROOT_CONTEXT: RootContextState = {
  state: 'loading',
  data: null,
  attempt: null,
  error: null,
  observedAt: 0,
}

export type ContextSubscriptionState = SubscriptionState<RootContextState>

/** Select renderable current or stale data without hiding the latest failed CLI attempt. */
export function selectRootContextSnapshot(state: RootContextState | undefined): RootContext | null {
  if (!state) return null
  if (state.state === 'loading') return null
  if (state.state === 'error') return state.data ?? state.attempt
  return state.data
}

export function useContextSubscription(): ContextSubscriptionState {
  return useSubscription<RootContextState>(
    (callbacks) =>
      trpcClient.rootContext.subscribe.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    async () => STATIC_PENDING_ROOT_CONTEXT,
    [],
    'root-context.subscribe'
  )
}
