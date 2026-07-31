/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Admit Dashboard Summary through a notice-free initial Pull before independently delivering objective Kanban, trends, and Code Git projections.
 * 2. Execute readonly Dashboard Git refreshes and domain mutations against the stable Launch-owned Code binding.
 * 3. Translate current and stale Projection Work snapshots into honest region display and updating state.
 * 4. Retire late initial or replacement Summary v2 Pulls and require current wake identity/generation for replacements.
 * 5. Render Server-retained Summary data as display-only in a fresh browser Document.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git bindings.
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-23): "在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
 * Original request (2026-07-27): "Dashboard页面每次页面刷新的时候，它仍然要加载很多？"
 * Original request (2026-07-28): replace Dashboard Workflow Progress with ReadonlyKanban.
 * Original request (2026-07-31): "所有可能其它页面都有类似的问题。"
 * Owner correction (2026-07-31): Observation refresh is readonly even when it maintains an internal stamp.
 */
import type {
  DashboardGitSnapshot,
  DashboardOverview,
  DashboardSummaryProjection,
  DashboardTrendsProjection,
} from '@openspecui/core'
import type {
  DashboardSummaryInvalidation,
  DashboardSummaryProjectionState,
} from '@openspecui/core/dashboard-summary-transport'
import { useCallback, useMemo } from 'react'
import * as StaticProvider from './static-data-provider'
import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'
import {
  useReactiveProjectionSubscription,
  useSubscription,
  type ReactiveProjectionEvent,
  type ReactiveProjectionSubscriptionState,
  type SubscriptionState,
} from './use-subscription'

interface Unsubscribable {
  unsubscribe(): void
}

interface DashboardProjectionSnapshot<T> {
  data: T
  freshness: 'current' | 'stale-display-only'
}

type DashboardProjectionTransportEvent<T> =
  | { type: 'snapshot'; snapshot: DashboardProjectionSnapshot<T> }
  | { type: 'stage'; phase: string }
  | {
      type: 'batch'
      progress: { completed: number; total: number | 'unknown' }
      identity: unknown
    }
  | { type: 'complete'; snapshot: DashboardProjectionSnapshot<T> }
  | { type: 'failed'; error: unknown; retainedSnapshot: DashboardProjectionSnapshot<T> | null }

interface DashboardProjectionTransportCallbacks<T> {
  onData(event: DashboardProjectionTransportEvent<T>): void
  onError(error: Error): void
}

interface DashboardProjectionCallbacks<T> {
  onEvent(event: ReactiveProjectionEvent<T>): void
  onError(error: Error): void
}

interface DashboardSummaryInvalidationCallbacks {
  onData(event: DashboardSummaryInvalidation): void
  onError(error: Error): void
}

type DashboardProjectionTransport<T> = (
  callbacks: DashboardProjectionTransportCallbacks<T>
) => Unsubscribable

type DashboardSummaryInvalidationTransport = (
  callbacks: DashboardSummaryInvalidationCallbacks
) => Unsubscribable

/** Regional states preserve stable data while unrelated Dashboard leaves remain pending or fail. */
export interface DashboardOverviewSubscriptionState extends SubscriptionState<DashboardOverview> {
  regions: {
    summary: ReactiveProjectionSubscriptionState<DashboardSummaryProjection>
    trends: ReactiveProjectionSubscriptionState<DashboardTrendsProjection>
    git: ReactiveProjectionSubscriptionState<DashboardGitSnapshot>
  }
}

function normalizeProjectionError(cause: unknown): Error {
  if (cause instanceof Error) return cause
  if (typeof cause === 'object' && cause !== null && 'message' in cause) {
    const message = cause.message
    if (typeof message === 'string') return new Error(message)
  }
  return new Error(String(cause))
}

function useDashboardProjectionRegion<T>(
  subscribe: DashboardProjectionTransport<T>,
  staticLoader: () => Promise<T>,
  cacheKey: string,
  enabled = true
): ReactiveProjectionSubscriptionState<T> {
  const adaptedSubscribe = useCallback(
    (callbacks: DashboardProjectionCallbacks<T>) => {
      if (!enabled) return { unsubscribe() {} }
      let hasDisplayData = false
      return subscribe({
        onData(event) {
          if (event.type === 'snapshot' || event.type === 'complete') {
            hasDisplayData = true
            if (event.snapshot.freshness === 'current') {
              callbacks.onEvent({ type: 'data', data: event.snapshot.data })
            } else {
              callbacks.onEvent({ type: 'display-stale', data: event.snapshot.data })
            }
            return
          }
          if (event.type === 'stage') {
            if (event.phase === 'start' && hasDisplayData) {
              callbacks.onEvent({ type: 'recompute-started' })
            }
            return
          }
          if (event.type === 'failed') {
            callbacks.onError(normalizeProjectionError(event.error))
          }
        },
        onError: callbacks.onError,
      })
    },
    [enabled, subscribe]
  )

  return useReactiveProjectionSubscription(adaptedSubscribe, staticLoader, [enabled], cacheKey)
}

function isCurrentSummaryState(
  activeWake: DashboardSummaryInvalidation,
  state: DashboardSummaryProjectionState
): boolean {
  return (
    state.identity === activeWake.identity && state.workGeneration === activeWake.workGeneration
  )
}

/**
 * Migrate only Summary to the v2 wake-up/pull transport. The subscription never contains business data;
 * an active opaque identity plus work generation must match before a typed query may commit.
 */
function useDashboardSummaryProjectionRegion(
  subscribe: DashboardSummaryInvalidationTransport,
  staticLoader: () => Promise<DashboardSummaryProjection>
): ReactiveProjectionSubscriptionState<DashboardSummaryProjection> {
  const adaptedSubscribe = useCallback(
    (
      callbacks: DashboardProjectionCallbacks<DashboardSummaryProjection>,
      lifecycle: { hasCached: boolean }
    ) => {
      let active = true
      let pullEpoch = 0
      let hasDisplayData = lifecycle.hasCached
      let activeWake: DashboardSummaryInvalidation | null = null
      let wakeObservedDuringAdmission = false
      const isActiveWake = (wake: DashboardSummaryInvalidation) =>
        active &&
        activeWake !== null &&
        activeWake.identity === wake.identity &&
        activeWake.workGeneration === wake.workGeneration &&
        activeWake.snapshotGeneration === wake.snapshotGeneration &&
        activeWake.state === wake.state
      const pull = async (wake?: DashboardSummaryInvalidation) => {
        const epoch = ++pullEpoch
        try {
          const state = await trpcClient.dashboard.getSummary.query()
          if (!active || epoch !== pullEpoch) return
          if (wake && (!isActiveWake(wake) || !isCurrentSummaryState(wake, state))) return
          if (state.data) {
            hasDisplayData = true
            callbacks.onEvent({
              type: state.freshness === 'current' ? 'data' : 'display-stale',
              data: state.data,
            })
          }
          if (state.error) callbacks.onError(normalizeProjectionError(state.error))
        } catch (cause: unknown) {
          if (!active || epoch !== pullEpoch || (wake && !isActiveWake(wake))) return
          callbacks.onError(normalizeProjectionError(cause))
        }
      }
      const subscription = subscribe({
        onData(wake) {
          wakeObservedDuringAdmission = true
          const wasDisplaying = hasDisplayData
          activeWake = wake
          if (wasDisplaying && wake.state !== 'ready') {
            callbacks.onEvent({ type: 'recompute-started' })
          }
          void pull(wake)
        },
        onError: callbacks.onError,
      })
      if (!wakeObservedDuringAdmission) void pull()
      return {
        unsubscribe() {
          active = false
          pullEpoch += 1
          subscription.unsubscribe()
        },
      }
    },
    [subscribe]
  )

  return useReactiveProjectionSubscription(
    adaptedSubscribe,
    staticLoader,
    [],
    'dashboard.subscribeSummary.v2'
  )
}

async function loadStaticDashboardSummary(): Promise<DashboardSummaryProjection> {
  const overview = await StaticProvider.getDashboardOverview()
  return {
    summary: overview.summary,
    specifications: overview.specifications,
    activeChanges: overview.activeChanges,
    trackedTaskPhaseCounts: overview.trackedTaskPhaseCounts,
    recentArchives: overview.recentArchives,
  }
}

async function loadStaticDashboardTrends(): Promise<DashboardTrendsProjection> {
  const overview = await StaticProvider.getDashboardOverview()
  return {
    trends: overview.trends,
    triColorTrends: overview.triColorTrends,
    trendKinds: overview.trendKinds,
    cardAvailability: overview.cardAvailability,
    trendMeta: overview.trendMeta,
  }
}

async function loadStaticDashboardGit(): Promise<DashboardGitSnapshot> {
  return (await StaticProvider.getDashboardOverview()).git
}

/** Subscribe to independently owned Dashboard regions and expose an aggregate compatibility snapshot. */
export function useDashboardOverviewSubscription(): DashboardOverviewSubscriptionState {
  const subscribeSummary = useCallback(
    (callbacks: DashboardSummaryInvalidationCallbacks) =>
      trpcClient.dashboard.subscribeSummary.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )
  const subscribeTrends = useCallback(
    (callbacks: DashboardProjectionTransportCallbacks<DashboardTrendsProjection>) =>
      trpcClient.dashboard.subscribeTrends.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )
  const subscribeGit = useCallback(
    (callbacks: DashboardProjectionTransportCallbacks<DashboardGitSnapshot>) =>
      trpcClient.dashboard.subscribeGit.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )

  const summary = useDashboardSummaryProjectionRegion(subscribeSummary, loadStaticDashboardSummary)
  const admitSecondaryRegions = summary.data !== undefined
  const trends = useDashboardProjectionRegion(
    subscribeTrends,
    loadStaticDashboardTrends,
    'dashboard.subscribeTrends',
    admitSecondaryRegions
  )
  const git = useDashboardProjectionRegion(
    subscribeGit,
    loadStaticDashboardGit,
    'dashboard.subscribeGit',
    admitSecondaryRegions
  )

  const data = useMemo<DashboardOverview | undefined>(() => {
    if (!summary.data || !trends.data || !git.data) return undefined
    return { ...summary.data, ...trends.data, git: git.data }
  }, [git.data, summary.data, trends.data])

  return {
    data,
    isLoading: summary.isLoading,
    error: summary.error,
    regions: { summary, trends, git },
  }
}

/** Observable status for background Dashboard Git snapshot work. */
export interface DashboardGitTaskStatus {
  running: boolean
  inFlight: number
  lastStartedAt: number | null
  lastFinishedAt: number | null
  lastReason: string | null
  lastError: string | null
}

function getDefaultGitTaskStatus(): DashboardGitTaskStatus {
  return {
    running: false,
    inFlight: 0,
    lastStartedAt: null,
    lastFinishedAt: null,
    lastReason: null,
    lastError: null,
  }
}

/** Subscribe to Dashboard Git snapshot task lifecycle. */
export function useDashboardGitTaskStatusSubscription(): SubscriptionState<DashboardGitTaskStatus> {
  const subscribe = useCallback(
    (callbacks: {
      onData: (data: DashboardGitTaskStatus) => void
      onError: (err: Error) => void
    }) =>
      trpcClient.dashboard.subscribeGitTaskStatus.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )

  return useSubscription<DashboardGitTaskStatus>(
    subscribe,
    async () => getDefaultGitTaskStatus(),
    [],
    'dashboard.subscribeGitTaskStatus'
  )
}

/** Refresh Launch-owned Code Git and request a current Dashboard projection update. */
export async function refreshDashboardGitSnapshot(
  reason: string,
  expectedBindingToken: string
): Promise<void> {
  if (isStaticMode()) return
  await trpcClient.dashboard.refreshGitSnapshot.query({
    scope: 'code',
    expectedBindingToken,
    reason,
  })
}

/** Remove one detached Code worktree through the current backend-issued Code binding. */
export async function removeDetachedDashboardWorktree(
  path: string,
  expectedBindingToken: string
): Promise<void> {
  if (isStaticMode()) return
  await trpcClient.dashboard.removeDetachedWorktree.mutate({
    scope: 'code',
    expectedBindingToken,
    path,
  })
}
