/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Subscribe the project workspace to the shared CLI-owned Root Context state.
 * 2. Keep cached Root Context display separate from current root-mutation authority.
 * 3. Preserve loading, refreshing, stale-data, failed-attempt, and transport lifecycle evidence.
 * 4. Keep static mode on an explicit pending projection until snapshot parity lands.
 *
 * Original request (2026-07-15): "项目 Web surface may show Store and Reference diagnostics but must not imply that its registry is project-local."
 * Owner-reported debt (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等。"
 */
import type { RootContext, RootContextState } from '@openspecui/core'
import { trpcClient } from './trpc'
import {
  useAuthoritativeSubscription,
  type AuthoritativeSubscriptionState,
} from './use-subscription'

const STATIC_PENDING_ROOT_CONTEXT: RootContextState = {
  state: 'loading',
  data: null,
  attempt: null,
  error: null,
  observedAt: 0,
}

/** Root Context subscription lifecycle consumed by project workspace views. */
export type ContextSubscriptionState = AuthoritativeSubscriptionState<RootContextState>

/** Select renderable current or stale data without hiding the latest failed CLI attempt. */
export function selectRootContextSnapshot(state: RootContextState | undefined): RootContext | null {
  if (!state) return null
  if (state.state === 'loading') return null
  if (state.state === 'error') return state.data ?? state.attempt
  return state.data
}

/** Subscribe to live Root Context or hydrate the equivalent static projection. */
export function useContextSubscription(): ContextSubscriptionState {
  return useAuthoritativeSubscription<RootContextState>(
    (callbacks) =>
      trpcClient.rootContext.subscribe.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
        onConnectionStateChange: (state) =>
          callbacks.onConnectionStateChange({ state: state.state, error: state.error }),
        onStopped: callbacks.onStopped,
        onComplete: callbacks.onComplete,
      }),
    async () => STATIC_PENDING_ROOT_CONTEXT,
    [],
    'root-context.subscribe'
  )
}
