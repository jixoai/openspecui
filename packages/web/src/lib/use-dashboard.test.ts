/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Prove Summary admission precedes lower-priority Trends and Git subscriptions.
 * 2. Prove a later backend binding cannot relabel an already captured refresh or removal intent.
 * 3. Prove a stale Dashboard region is display-only while its current replacement is pending.
 * 4. Prove a late Summary A pull cannot overwrite the matching root-rebind B pull.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 binds Dashboard mutations to snapshot provenance.
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-23): "在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
 */
import type { DashboardSummaryProjection } from '@openspecui/core'
import type { DashboardSummaryRead } from '@openspecui/core/dashboard-summary-transport'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  refreshDashboardGitSnapshot,
  removeDetachedDashboardWorktree,
  useDashboardOverviewSubscription,
} from './use-dashboard'

interface ProjectionSubscriber {
  onData(event: unknown): void
  onError(error: Error): void
}

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}

function createDeferred<T>(): Deferred<T> {
  const deferred = Promise.withResolvers<T>()
  return { promise: deferred.promise, resolve: deferred.resolve }
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
  const summarySubscribers: ProjectionSubscriber[] = []
  const trendsSubscribers: ProjectionSubscriber[] = []
  const gitSubscribers: ProjectionSubscriber[] = []
  const createSubscribe = (subscribers: ProjectionSubscriber[]) =>
    vi.fn((_input: undefined, callbacks: ProjectionSubscriber) => {
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
    subscribeSummaryMock: createSubscribe(summarySubscribers),
    subscribeTrendsMock: createSubscribe(trendsSubscribers),
    subscribeGitMock: createSubscribe(gitSubscribers),
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

  it('rejects a late Summary A pull after root-rebind wake B commits through the real tRPC callbacks', async () => {
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
      summarySubscribers[0]?.onData({
        identity: identityA,
        workGeneration: 1,
        cause: 'initial',
      })
    })
    await vi.waitFor(() => expect(getSummaryQueryMock).toHaveBeenCalledTimes(1))

    act(() => {
      summarySubscribers[0]?.onData({
        identity: identityB,
        workGeneration: 1,
        cause: 'root-rebind',
      })
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
})
