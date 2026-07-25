/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Prove Summary admission precedes lower-priority Trends and Git subscriptions.
 * 2. Prove a later backend binding cannot relabel an already captured refresh or removal intent.
 * 3. Prove a stale Dashboard region is display-only while its current replacement is pending.
 * 4. Prove a late Summary A pull cannot overwrite the matching root-rebind B pull.
 * 5. Prove cached Summary A becomes display-only on the first B wake through a typed mocked callback boundary.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 binds Dashboard mutations to snapshot provenance.
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-23): "在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
 */
import type { DashboardSummaryProjection } from '@openspecui/core'
import type {
  DashboardSummaryInvalidation,
  DashboardSummaryRead,
} from '@openspecui/core/dashboard-summary-transport'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DashboardSummaryMockSubscriber,
  DashboardSummaryMockSubscriberContract,
} from './dashboard-summary-test-fixture'
import { primeSubscriptionCache } from './subscription-lifecycle'
import {
  refreshDashboardGitSnapshot,
  removeDetachedDashboardWorktree,
  useDashboardOverviewSubscription,
} from './use-dashboard'

interface LegacyProjectionSubscriber {
  onData(event: unknown): void
  onError(error: Error): void
}

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function createDeferred<T>(): Deferred<T> {
  const deferred = Promise.withResolvers<T>()
  return { promise: deferred.promise, resolve: deferred.resolve, reject: deferred.reject }
}

function createSummary(specifications: number): DashboardSummaryProjection {
  return {
    summary: {
      specifications,
      requirements: 2,
      activeChanges: 0,
      inProgressChanges: 0,
      completedChanges: 0,
      archivedTasksCompleted: 0,
      tasksTotal: 0,
      tasksCompleted: 0,
      taskCompletionPercent: null,
    },
    specifications: [],
    activeChanges: [],
  }
}

function createSummaryRead(
  data: DashboardSummaryProjection,
  identity: string,
  workGeneration: number
): DashboardSummaryRead {
  return { identity, workGeneration, freshness: 'current', data }
}

function createSummaryWake(
  identity: DashboardSummaryInvalidation['identity'],
  workGeneration: number,
  cause: DashboardSummaryInvalidation['cause']
): DashboardSummaryInvalidation {
  return { identity, workGeneration, cause }
}

const {
  codeQueryMock,
  refreshMock,
  removeMock,
  staticModeMock,
  summarySubscribers,
  trendsSubscribers,
  gitSubscribers,
  subscribeSummaryMock,
  subscribeTrendsMock,
  subscribeGitMock,
  getSummaryQueryMock,
} = vi.hoisted(() => {
  const summarySubscribers: DashboardSummaryMockSubscriber[] = []
  const trendsSubscribers: LegacyProjectionSubscriber[] = []
  const gitSubscribers: LegacyProjectionSubscriber[] = []
  const createLegacySubscribe = (subscribers: LegacyProjectionSubscriber[]) =>
    vi.fn((_input: undefined, callbacks: LegacyProjectionSubscriber) => {
      subscribers.push(callbacks)
      return { unsubscribe: vi.fn() }
    })
  const createSummarySubscribe = (subscribers: DashboardSummaryMockSubscriber[]) =>
    vi.fn((_input: undefined, callbacks: DashboardSummaryMockSubscriber) => {
      subscribers.push(callbacks)
      return { unsubscribe: vi.fn() }
    })

  return {
    codeQueryMock: vi.fn(async () => ({ bindingToken: 'code-binding-b' })),
    refreshMock: vi.fn(),
    removeMock: vi.fn(),
    staticModeMock: vi.fn(() => false),
    summarySubscribers,
    trendsSubscribers,
    gitSubscribers,
    subscribeSummaryMock: createSummarySubscribe(summarySubscribers),
    subscribeTrendsMock: createLegacySubscribe(trendsSubscribers),
    subscribeGitMock: createLegacySubscribe(gitSubscribers),
    getSummaryQueryMock: vi.fn(),
  }
})

vi.mock('./static-mode', () => ({ isStaticMode: staticModeMock }))
vi.mock('./trpc', () => ({
  trpcClient: {
    git: { code: { query: codeQueryMock } },
    dashboard: {
      subscribeSummary: { subscribe: subscribeSummaryMock },
      getSummary: { query: getSummaryQueryMock },
      subscribeTrends: { subscribe: subscribeTrendsMock },
      subscribeGit: { subscribe: subscribeGitMock },
      refreshGitSnapshot: { mutate: refreshMock },
      removeDetachedWorktree: { mutate: removeMock },
    },
  },
}))

describe('Dashboard Git mutation provenance', () => {
  beforeEach(() => {
    codeQueryMock.mockClear()
    refreshMock.mockReset()
    removeMock.mockReset()
    staticModeMock.mockReturnValue(false)
    summarySubscribers.length = 0
    trendsSubscribers.length = 0
    gitSubscribers.length = 0
    subscribeSummaryMock.mockClear()
    subscribeTrendsMock.mockClear()
    subscribeGitMock.mockClear()
    getSummaryQueryMock.mockReset()
  })

  it('keeps the mocked Summary callback input equal to the public v2 wake contract', () => {
    const samePublicWake: DashboardSummaryMockSubscriberContract = true
    expect(samePublicWake).toBe(true)
  })

  it('rejects a late Summary A pull after root-rebind wake B commits through the mocked tRPC callback boundary', async () => {
    const summaryA = createSummary(1)
    const summaryB = createSummary(2)
    const identityA = 'dashboard-summary-v2:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const identityB = 'dashboard-summary-v2:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
    const pullA = createDeferred<DashboardSummaryRead>()
    const pullB = createDeferred<DashboardSummaryRead>()
    getSummaryQueryMock.mockImplementationOnce(() => pullA.promise)
    getSummaryQueryMock.mockImplementationOnce(() => pullB.promise)
    const { result } = renderHook(() => useDashboardOverviewSubscription())

    expect(subscribeSummaryMock).toHaveBeenCalledOnce()
    expect(subscribeTrendsMock).not.toHaveBeenCalled()
    expect(subscribeGitMock).not.toHaveBeenCalled()

    act(() => {
      summarySubscribers[0]?.onData(createSummaryWake(identityA, 1, 'initial'))
    })
    await vi.waitFor(() => expect(getSummaryQueryMock).toHaveBeenCalledTimes(1))

    act(() => {
      summarySubscribers[0]?.onData(createSummaryWake(identityB, 1, 'root-rebind'))
    })
    await vi.waitFor(() => expect(getSummaryQueryMock).toHaveBeenCalledTimes(2))

    await act(async () => {
      pullB.resolve(createSummaryRead(summaryB, identityB, 1))
    })
    await vi.waitFor(() => expect(result.current.regions.summary.data).toEqual(summaryB))
    expect(result.current.regions.summary).toEqual({
      data: summaryB,
      isLoading: false,
      isUpdating: false,
      error: null,
    })

    await act(async () => {
      pullA.resolve(createSummaryRead(summaryA, identityA, 1))
    })
    await vi.waitFor(() => expect(result.current.regions.summary.data).toEqual(summaryB))
    expect(subscribeTrendsMock).toHaveBeenCalledOnce()
    expect(subscribeGitMock).toHaveBeenCalledOnce()
  })

  it('keeps Summary B current when the late A pull rejects', async () => {
    const summaryB = createSummary(2)
    const identityA = 'dashboard-summary-v2:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const identityB = 'dashboard-summary-v2:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
    const pullA = createDeferred<DashboardSummaryRead>()
    const pullB = createDeferred<DashboardSummaryRead>()
    getSummaryQueryMock.mockImplementationOnce(() => pullA.promise)
    getSummaryQueryMock.mockImplementationOnce(() => pullB.promise)
    const { result } = renderHook(() => useDashboardOverviewSubscription())

    act(() => {
      summarySubscribers[0]?.onData(createSummaryWake(identityA, 1, 'initial'))
      summarySubscribers[0]?.onData(createSummaryWake(identityB, 1, 'root-rebind'))
    })
    await vi.waitFor(() => expect(getSummaryQueryMock).toHaveBeenCalledTimes(2))

    await act(async () => {
      pullB.resolve(createSummaryRead(summaryB, identityB, 1))
    })
    await vi.waitFor(() => expect(result.current.regions.summary.data).toEqual(summaryB))

    await act(async () => {
      pullA.reject(new Error('late A failure'))
    })
    await vi.waitFor(() =>
      expect(result.current.regions.summary).toEqual({
        data: summaryB,
        isLoading: false,
        isUpdating: false,
        error: null,
      })
    )
  })

  it('keeps snapshot A on refresh after the backend publishes binding B', async () => {
    refreshMock.mockRejectedValueOnce(new Error('The code repository binding changed.'))

    await expect(refreshDashboardGitSnapshot('manual-button', 'code-binding-a')).rejects.toThrow(
      'binding changed'
    )

    expect(refreshMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding-a',
      reason: 'manual-button',
    })
    expect(codeQueryMock).not.toHaveBeenCalled()
  })

  it('keeps snapshot A on detached-worktree removal after binding B exists', async () => {
    removeMock.mockRejectedValueOnce(new Error('The code repository binding changed.'))

    await expect(
      removeDetachedDashboardWorktree('/worktrees/detached', 'code-binding-a')
    ).rejects.toThrow('binding changed')

    expect(removeMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding-a',
      path: '/worktrees/detached',
    })
    expect(codeQueryMock).not.toHaveBeenCalled()
  })

  it('keeps cached Summary A display-only while the first root-rebind B pull is deferred', async () => {
    const summaryA = createSummary(1)
    const summaryB = createSummary(2)
    const identityB = 'dashboard-summary-v2:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
    const pullB = createDeferred<DashboardSummaryRead>()
    getSummaryQueryMock.mockImplementationOnce(() => pullB.promise)
    primeSubscriptionCache('dashboard.subscribeSummary.v2', summaryA)
    const { result } = renderHook(() => useDashboardOverviewSubscription())

    expect(result.current.regions.summary).toEqual({
      data: summaryA,
      isLoading: false,
      isUpdating: false,
      error: null,
    })

    act(() => {
      summarySubscribers[0]?.onData(createSummaryWake(identityB, 1, 'root-rebind'))
    })
    await vi.waitFor(() => expect(getSummaryQueryMock).toHaveBeenCalledOnce())
    expect(result.current.regions.summary).toEqual({
      data: summaryA,
      isLoading: false,
      isUpdating: true,
      error: null,
    })

    await act(async () => {
      pullB.resolve(createSummaryRead(summaryB, identityB, 1))
    })
    await vi.waitFor(() =>
      expect(result.current.regions.summary).toEqual({
        data: summaryB,
        isLoading: false,
        isUpdating: false,
        error: null,
      })
    )
  })
})
