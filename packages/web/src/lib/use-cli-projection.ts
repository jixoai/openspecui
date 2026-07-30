/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Admit one notice-free initial typed Pull, then adapt lifecycle-only CLI Push into selector-exact replacement Pulls.
 * 2. Retain settled data during revalidation while revoking mutation authority.
 * 3. Retire late Pulls and resolve explicit refresh only after terminal state commits.
 * 4. Preserve static loaders without inventing live CLI lifecycle evidence.
 * 5. Preserve typed CLI failure evidence at the public Web error boundary.
 *
 * Original request (2026-07-26): "界面上仍然可以读到缓存，但它也能知道这个缓存现在正在被更新中。"
 * Original request (2026-07-26): "public Pull retains full CliProjection failure evidence."
 * Original request (2026-07-31): "系统性地进行修复，因为List页面也有类似的问题。所有可能其它页面都有类似的问题。"
 */
import type {
  CliProjectionCommandEvidence,
  CliProjectionFailure,
  CliProjectionState,
} from '@openspecui/core'
import {
  CliProjectionNoticeSchema,
  PlanningCliProjectionSelectorSchema,
  PlanningCliProjectionStateSchema,
  type PlanningCliProjectionData,
  type PlanningCliProjectionSelector,
} from '@openspecui/core/planning-cli-projection'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import { trpcClient } from './trpc'
import {
  useAuthoritativeSubscription,
  type AuthoritativeSubscriptionCallbacks,
  type AuthoritativeSubscriptionState,
} from './use-authoritative-subscription'

interface ProjectionRefreshWaiter {
  identity: string
  workGeneration: number
  promise: Promise<void>
  resolve(): void
  reject(error: Error): void
}

interface CliProjectionLifecycleCallbacks {
  onNotice(): void
  onConnectionState(state: 'connecting' | 'pending'): void
  onError(error: unknown): void
  onStopped(): void
  onComplete(): void
}

export interface CliProjectionLifecycleSource<TProjectionData> {
  read(): Promise<unknown>
  refresh(): Promise<unknown>
  parseState(raw: unknown): CliProjectionState<TProjectionData>
  subscribe(callbacks: CliProjectionLifecycleCallbacks): { unsubscribe(): void }
}

export interface CliProjectionSubscriptionState<T> extends AuthoritativeSubscriptionState<T> {
  error: CliProjectionError | null
  isUpdating: boolean
  refreshPending: boolean
  refresh(): Promise<void>
}

export interface CliProjectionLifecycleOptions<TProjectionData, T> {
  source: CliProjectionLifecycleSource<TProjectionData>
  sourceKey: string
  selectData(data: TProjectionData): T
  staticLoader(): Promise<T>
  cacheKey: string
  enabled?: boolean
}

export interface CliProjectionSubscriptionOptions<T> {
  selector: PlanningCliProjectionSelector
  selectData(data: PlanningCliProjectionData): T
  staticLoader(): Promise<T>
  cacheKey: string
  enabled?: boolean
}

/** Typed Web error for one public CLI Projection Pull failure. */
export class CliProjectionError extends Error {
  readonly cliEvidence: CliProjectionCommandEvidence | null

  constructor(failure: CliProjectionFailure) {
    super(failure.message)
    this.name = failure.name
    this.cliEvidence = failure.cliEvidence
  }
}

function projectionError(failure: CliProjectionFailure): CliProjectionError {
  return new CliProjectionError(failure)
}

function infrastructureProjectionError(cause: unknown): CliProjectionError {
  if (cause instanceof CliProjectionError) return cause
  return new CliProjectionError({
    name: cause instanceof Error ? cause.name : 'Error',
    message: cause instanceof Error ? cause.message : String(cause),
    cliEvidence: null,
  })
}

function isTerminalProjection<T>(state: CliProjectionState<T>): boolean {
  return state.state === 'ready' || state.state === 'error' || state.state === 'refresh-error'
}

/** Consume one CLI projection lifecycle in live or static Project Web. */
export function useCliProjectionLifecycle<TProjectionData, T>(
  options: CliProjectionLifecycleOptions<TProjectionData, T>
): CliProjectionSubscriptionState<T> {
  const enabled = options.enabled ?? true
  const pullEpochRef = useRef(0)
  const publishRef = useRef<((state: CliProjectionState<TProjectionData>) => void) | null>(null)
  const refreshWaiterRef = useRef<ProjectionRefreshWaiter | null>(null)
  const [refreshPending, setRefreshPending] = useState(false)
  const [committedRefresh, setCommittedRefresh] = useState<{
    identity: string
    workGeneration: number
  } | null>(null)

  const rejectRefresh = useCallback((error: Error) => {
    const waiter = refreshWaiterRef.current
    if (!waiter) return
    refreshWaiterRef.current = null
    setRefreshPending(false)
    waiter.reject(error)
  }, [])

  const observeRefreshSettlement = useCallback((state: CliProjectionState<TProjectionData>) => {
    const waiter = refreshWaiterRef.current
    if (!waiter || !isTerminalProjection(state)) return
    if (state.identity !== waiter.identity || state.workGeneration < waiter.workGeneration) return
    setCommittedRefresh({ identity: state.identity, workGeneration: state.workGeneration })
  }, [])

  const subscribe = useCallback(
    (callbacks: AuthoritativeSubscriptionCallbacks<T>) => {
      if (!enabled) {
        callbacks.onConnectionStateChange({ state: 'idle', error: null })
        return { unsubscribe() {} }
      }
      let retired = false
      let noticeObservedDuringAdmission = false
      const reportTransportError = (cause: unknown): void => {
        const error = infrastructureProjectionError(cause)
        callbacks.onError(error)
        rejectRefresh(error)
      }
      const publish = (projection: CliProjectionState<TProjectionData>): void => {
        try {
          match(projection)
            .with({ state: 'loading' }, () =>
              callbacks.onConnectionStateChange({ state: 'pending', error: null })
            )
            .with({ state: 'ready' }, ({ data }) => callbacks.onData(options.selectData(data)))
            .with({ state: 'revalidating' }, ({ data }) =>
              callbacks.onStaleData(options.selectData(data))
            )
            .with({ state: 'error' }, ({ error }) => callbacks.onError(projectionError(error)))
            .with({ state: 'refresh-error' }, ({ data, error }) =>
              callbacks.onStaleData(options.selectData(data), projectionError(error))
            )
            .exhaustive()
          observeRefreshSettlement(projection)
        } catch (cause) {
          reportTransportError(cause)
        }
      }
      publishRef.current = publish

      const pull = async (): Promise<void> => {
        const epoch = ++pullEpochRef.current
        try {
          const projection = options.source.parseState(await options.source.read())
          if (retired || epoch !== pullEpochRef.current) return
          publish(projection)
        } catch (cause) {
          if (retired || epoch !== pullEpochRef.current) return
          reportTransportError(cause)
        }
      }

      const subscription = options.source.subscribe({
        onNotice() {
          noticeObservedDuringAdmission = true
          callbacks.onConnectionStateChange({ state: 'pending', error: null })
          void pull()
        },
        onConnectionState: (state) => callbacks.onConnectionStateChange({ state, error: null }),
        onError: reportTransportError,
        onStopped() {
          callbacks.onStopped()
          rejectRefresh(new Error('CLI projection subscription stopped during refresh.'))
        },
        onComplete() {
          callbacks.onComplete()
          rejectRefresh(new Error('CLI projection subscription completed during refresh.'))
        },
      })
      if (!noticeObservedDuringAdmission) void pull()

      return {
        unsubscribe() {
          retired = true
          pullEpochRef.current += 1
          if (publishRef.current === publish) publishRef.current = null
          subscription.unsubscribe()
        },
      }
    },
    [enabled, observeRefreshSettlement, options, rejectRefresh]
  )

  const state = useAuthoritativeSubscription<T>(
    subscribe,
    options.staticLoader,
    [enabled, options.sourceKey],
    options.cacheKey
  )

  useEffect(() => {
    const waiter = refreshWaiterRef.current
    if (
      !waiter ||
      !committedRefresh ||
      committedRefresh.identity !== waiter.identity ||
      committedRefresh.workGeneration < waiter.workGeneration
    ) {
      return
    }
    refreshWaiterRef.current = null
    setRefreshPending(false)
    setCommittedRefresh(null)
    waiter.resolve()
  }, [committedRefresh, state.authority, state.data, state.error])

  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled) return
    const active = refreshWaiterRef.current
    if (active) return active.promise

    let resolveWaiter!: () => void
    let rejectWaiter!: (error: Error) => void
    const promise = new Promise<void>((resolve, reject) => {
      resolveWaiter = resolve
      rejectWaiter = reject
    })
    setRefreshPending(true)
    try {
      const projection = options.source.parseState(await options.source.refresh())
      refreshWaiterRef.current = {
        identity: projection.identity,
        workGeneration: projection.workGeneration,
        promise,
        resolve: resolveWaiter,
        reject: rejectWaiter,
      }
      publishRef.current?.(projection)
      observeRefreshSettlement(projection)
      if (!isTerminalProjection(projection)) {
        const current = options.source.parseState(await options.source.read())
        publishRef.current?.(current)
        observeRefreshSettlement(current)
      }
      return promise
    } catch (cause) {
      const error = infrastructureProjectionError(cause)
      refreshWaiterRef.current = null
      setRefreshPending(false)
      rejectWaiter(error)
      return promise
    }
  }, [enabled, observeRefreshSettlement, options.source])

  useEffect(
    () => () => {
      const waiter = refreshWaiterRef.current
      if (!waiter) return
      refreshWaiterRef.current = null
      setRefreshPending(false)
      waiter.reject(new Error('CLI projection refresh was retired by a source rebind.'))
    },
    [options.sourceKey]
  )

  useEffect(
    () => () => {
      const waiter = refreshWaiterRef.current
      refreshWaiterRef.current = null
      waiter?.reject(new Error('CLI projection refresh was retired.'))
    },
    []
  )

  const error = state.error === null ? null : infrastructureProjectionError(state.error)
  const authority =
    state.authority.state === 'failed' && error
      ? { state: 'failed' as const, error }
      : state.authority

  return {
    ...state,
    error,
    authority,
    isUpdating: state.data !== undefined && authority.state !== 'current',
    refreshPending,
    refresh,
  }
}

/** Planning-root specialization of the generic CLI lifecycle adapter. */
export function useCliProjectionSubscription<T>(
  options: CliProjectionSubscriptionOptions<T>
): CliProjectionSubscriptionState<T> {
  const selectorKey = useMemo(() => JSON.stringify(options.selector), [options.selector])
  const selector = useMemo(
    () => PlanningCliProjectionSelectorSchema.parse(JSON.parse(selectorKey)),
    [selectorKey]
  )
  const source = useMemo<CliProjectionLifecycleSource<PlanningCliProjectionData>>(
    () => ({
      read: () => trpcClient.planningCliProjection.read.query(selector),
      refresh: () => trpcClient.planningCliProjection.refresh.mutate(selector),
      parseState: (raw) => PlanningCliProjectionStateSchema.parse(raw),
      subscribe(callbacks) {
        return trpcClient.planningCliProjection.subscribe.subscribe(selector, {
          onData(raw) {
            const decoded = CliProjectionNoticeSchema.safeParse(raw)
            if (!decoded.success) {
              callbacks.onError(
                new Error(`Malformed Planning CLI notice: ${decoded.error.message}`)
              )
              return
            }
            callbacks.onNotice()
          },
          onError: callbacks.onError,
          onConnectionStateChange(connection) {
            if (connection.error) {
              callbacks.onError(connection.error)
              return
            }
            if (connection.state === 'connecting' || connection.state === 'pending') {
              callbacks.onConnectionState(connection.state)
            }
          },
          onStopped: callbacks.onStopped,
          onComplete: callbacks.onComplete,
        })
      },
    }),
    [selector]
  )

  return useCliProjectionLifecycle({
    source,
    sourceKey: selectorKey,
    selectData: options.selectData,
    staticLoader: options.staticLoader,
    cacheKey: options.cacheKey,
    enabled: options.enabled,
  })
}
