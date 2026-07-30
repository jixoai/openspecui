/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Admit one notice-free initial Root Context Pull, then wake replacement Pulls from lifecycle-only Projection Work notices.
 * 2. Keep cached Root Context display separate from current root-mutation authority.
 * 3. Preserve loading, revalidating, refresh-error, failed-attempt, and transport lifecycle evidence.
 * 4. Keep static mode on an explicit pending projection until snapshot parity lands.
 *
 * Original request (2026-07-15): "项目 Web surface may show Store and Reference diagnostics but must not imply that its registry is project-local."
 * Owner-reported debt (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等。"
 * Original request (2026-07-31): "所有可能其它页面都有类似的问题。"
 */
import type { RootContext, RootContextState } from '@openspecui/core'
import {
  HostedCliProjectionNoticeSchema,
  HostedRootContextProjectionStateSchema,
  type HostedRootContextProjectionState,
} from '@openspecui/core/hosted-contract'
import { match } from 'ts-pattern'
import { trpcClient } from './trpc'
import {
  useAuthoritativeSubscription,
  type AuthoritativeSubscriptionCallbacks,
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

function projectionError(error: { name: string; message: string }): Error {
  const result = new Error(error.message)
  result.name = error.name
  return result
}

function publishRootProjection(
  projection: HostedRootContextProjectionState,
  callbacks: AuthoritativeSubscriptionCallbacks<RootContextState>
): void {
  match(projection)
    .with({ state: 'loading' }, () => {
      callbacks.onConnectionStateChange({ state: 'pending', error: null })
    })
    .with({ state: 'ready' }, ({ data }) => callbacks.onData(data))
    .with({ state: 'revalidating' }, ({ data }) => callbacks.onStaleData(data))
    .with({ state: 'error' }, ({ error }) => callbacks.onError(projectionError(error)))
    .with({ state: 'refresh-error' }, ({ data, error }) =>
      callbacks.onStaleData(data, projectionError(error))
    )
    .exhaustive()
}

function subscribeRootProjection(callbacks: AuthoritativeSubscriptionCallbacks<RootContextState>): {
  unsubscribe(): void
} {
  let retired = false
  let pullEpoch = 0
  let noticeObservedDuringAdmission = false

  const pull = async (): Promise<void> => {
    const epoch = ++pullEpoch
    try {
      const raw = await trpcClient.rootContext.readProjection.query()
      if (retired || epoch !== pullEpoch) return
      const decoded = HostedRootContextProjectionStateSchema.safeParse(raw)
      if (!decoded.success) {
        callbacks.onError(new Error(`Malformed Root Context projection: ${decoded.error.message}`))
        return
      }
      publishRootProjection(decoded.data, callbacks)
    } catch (cause) {
      if (retired || epoch !== pullEpoch) return
      callbacks.onError(cause instanceof Error ? cause : new Error(String(cause)))
    }
  }

  const subscription = trpcClient.rootContext.subscribeProjection.subscribe(undefined, {
    onData(raw) {
      const decoded = HostedCliProjectionNoticeSchema.safeParse(raw)
      if (!decoded.success) {
        callbacks.onError(new Error(`Malformed Root Context notice: ${decoded.error.message}`))
        return
      }
      noticeObservedDuringAdmission = true
      callbacks.onConnectionStateChange({ state: 'pending', error: null })
      void pull()
    },
    onError: callbacks.onError,
    onConnectionStateChange: (state) =>
      callbacks.onConnectionStateChange({ state: state.state, error: state.error }),
    onStopped: callbacks.onStopped,
    onComplete: callbacks.onComplete,
  })
  if (!noticeObservedDuringAdmission) void pull()

  return {
    unsubscribe() {
      retired = true
      pullEpoch += 1
      subscription.unsubscribe()
    },
  }
}

/** Subscribe to live Root Context or hydrate the equivalent static projection. */
export function useContextSubscription(): ContextSubscriptionState {
  return useAuthoritativeSubscription<RootContextState>(
    subscribeRootProjection,
    async () => STATIC_PENDING_ROOT_CONTEXT,
    [],
    'root-context.projection'
  )
}
