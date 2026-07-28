/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove Dashboard overview warming, refresh, and watcher-driven notification behavior.
 * 2. Keep service fixtures aligned with live Code Git and objective Kanban summary contracts.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 carries Code binding provenance in Dashboard snapshots.
 * Original request (2026-07-28): replace Dashboard Workflow Progress with ReadonlyKanban.
 */
import type { DashboardOverview, OpenSpecWatcher } from '@openspecui/core'
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardOverviewService } from './dashboard-overview-service.js'

function createOverview(specifications: number): DashboardOverview {
  return {
    summary: {
      specifications,
      requirements: specifications,
      activeChanges: 0,
      inProgressChanges: 0,
      completedChanges: 0,
      archivedTasksCompleted: 0,
      tasksTotal: 0,
      tasksCompleted: 0,
      taskCompletionPercent: null,
    },
    trends: {
      specifications: [],
      requirements: [],
      activeChanges: [],
      inProgressChanges: [],
      completedChanges: [],
      taskCompletionPercent: [],
    },
    triColorTrends: {
      specifications: [],
      requirements: [],
      activeChanges: [],
      inProgressChanges: [],
      completedChanges: [],
      taskCompletionPercent: [],
    },
    trendKinds: {
      specifications: 'monotonic',
      requirements: 'monotonic',
      activeChanges: 'bidirectional',
      inProgressChanges: 'bidirectional',
      completedChanges: 'monotonic',
      taskCompletionPercent: 'bidirectional',
    },
    cardAvailability: {
      specifications: { state: 'ok' },
      requirements: { state: 'ok' },
      activeChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
      inProgressChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
      completedChanges: { state: 'ok' },
      taskCompletionPercent: { state: 'invalid', reason: 'semantic-uncomputable' },
    },
    trendMeta: {
      pointLimit: 20,
      lastUpdatedAt: 1,
    },
    specifications: [],
    activeChanges: [],
    trackedTaskPhaseCounts: { 'no-tasks': 0, 'in-progress': 0, complete: 0 },
    recentArchives: [],
    git: {
      bindingToken: 'code-binding',
      defaultBranch: 'main',
      worktrees: [],
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('DashboardOverviewService', () => {
  it('reuses the warmed overview across repeated getCurrent calls', async () => {
    const loadOverview = vi.fn(async (_reason: string) => createOverview(1))
    const service = new DashboardOverviewService(loadOverview)

    await service.getCurrent()
    await service.getCurrent()

    expect(loadOverview).toHaveBeenCalledTimes(1)
  })

  it('emits refreshed snapshots after watcher-driven rebuilds', async () => {
    vi.useFakeTimers()
    const watcher = new EventEmitter()
    const loadOverview = vi
      .fn(async (_reason: string) => createOverview(1))
      .mockResolvedValueOnce(createOverview(1))
      .mockResolvedValueOnce(createOverview(2))
    const service = new DashboardOverviewService(
      loadOverview,
      watcher as unknown as OpenSpecWatcher
    )
    const updates: number[] = []

    const unsubscribe = service.subscribe(
      (overview) => {
        updates.push(overview.summary.specifications)
      },
      { emitCurrent: true }
    )

    await vi.runAllTimersAsync()
    watcher.emit('change')
    await vi.advanceTimersByTimeAsync(250)

    expect(loadOverview).toHaveBeenCalledTimes(2)
    expect(updates).toEqual([1, 2])

    unsubscribe()
    service.dispose()
  })
})
