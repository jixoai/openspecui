/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove the loading benchmark rejects a Dashboard Summary read with another identity or work generation.
 * 2. Preserve the benchmark's typed v2 wake-to-pull correlation boundary in the checked Server test lane.
 *
 * Original request (2026-07-23): "在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
 */
import type {
  DashboardSummaryInvalidation,
  DashboardSummaryProjection,
  DashboardSummaryProjectionState,
} from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { assertMatchingDashboardSummaryState } from '../bench/live-projection-loading-summary.js'

function createSummary(): DashboardSummaryProjection {
  return {
    summary: {
      specifications: 0,
      requirements: 0,
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

describe('live projection loading Summary pair', () => {
  it('rejects a typed read whose identity differs from the wake', () => {
    const wake: DashboardSummaryInvalidation = {
      identity: 'dashboard-summary-v2:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      workGeneration: 1,
      snapshotGeneration: null,
      state: 'loading',
      cause: 'initial',
    }
    const read: DashboardSummaryProjectionState = {
      state: 'ready',
      identity: 'dashboard-summary-v2:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      workGeneration: wake.workGeneration,
      invalidationCause: 'initial',
      freshness: 'current',
      snapshotGeneration: wake.workGeneration,
      data: createSummary(),
      error: null,
    }

    expect(() => assertMatchingDashboardSummaryState(wake, read)).toThrow('identity mismatch')
  })

  it('rejects a typed read whose work generation differs from the wake', () => {
    const wake: DashboardSummaryInvalidation = {
      identity: 'dashboard-summary-v2:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      workGeneration: 1,
      snapshotGeneration: null,
      state: 'loading',
      cause: 'initial',
    }
    const read: DashboardSummaryProjectionState = {
      state: 'ready',
      identity: wake.identity,
      workGeneration: 2,
      invalidationCause: 'initial',
      freshness: 'current',
      snapshotGeneration: 2,
      data: createSummary(),
      error: null,
    }

    expect(() => assertMatchingDashboardSummaryState(wake, read)).toThrow('generation mismatch')
  })
})
