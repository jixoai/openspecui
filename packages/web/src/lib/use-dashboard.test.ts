/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Prove Summary admission precedes lower-priority Trends and Git subscriptions.
 * 2. Prove a later backend binding cannot relabel an already captured refresh or removal intent.
 * 3. Prove a stale Dashboard region is display-only while its current replacement is pending.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 binds Dashboard mutations to snapshot provenance.
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import type { DashboardSummaryProjection } from '@openspecui/core'
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
  }
})

vi.mock('./static-mode', () => ({ isStaticMode: staticModeMock }))
vi.mock('./trpc', () => ({
  trpcClient: {
    git: { code: { query: codeQueryMock } },
    dashboard: {
      subscribeSummary: { subscribe: subscribeSummaryMock },
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
  })

  it('keeps a stale Summary visible as an updating regional display until current data arrives', () => {
    const summary: DashboardSummaryProjection = {
      summary: {
        specifications: 1,
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
    const { result } = renderHook(() => useDashboardOverviewSubscription())

    expect(subscribeSummaryMock).toHaveBeenCalledOnce()
    expect(subscribeTrendsMock).not.toHaveBeenCalled()
    expect(subscribeGitMock).not.toHaveBeenCalled()

    act(() => {
      summarySubscribers[0]?.onData({
        type: 'snapshot',
        snapshot: { data: summary, freshness: 'stale-display-only' },
      })
    })
    expect(result.current.regions.summary).toEqual({
      data: summary,
      isLoading: false,
      isUpdating: true,
      error: null,
    })
    expect(subscribeTrendsMock).toHaveBeenCalledOnce()
    expect(subscribeGitMock).toHaveBeenCalledOnce()

    act(() => {
      summarySubscribers[0]?.onData({
        type: 'snapshot',
        snapshot: { data: summary, freshness: 'current' },
      })
    })
    expect(result.current.regions.summary).toEqual({
      data: summary,
      isLoading: false,
      isUpdating: false,
      error: null,
    })
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
