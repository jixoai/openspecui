import { describe, expect, it, vi } from 'vitest'

const dashboardGitTaskStatusState = vi.hoisted(() => ({
  lastFinishedAt: null as number | null,
}))

vi.mock('./dashboard-overview.js', () => ({
  getDashboardGitTaskStatus: () => ({
    running: false,
    inFlight: 0,
    lastStartedAt: null,
    lastFinishedAt: dashboardGitTaskStatusState.lastFinishedAt,
    lastReason: null,
    lastError: null,
  }),
}))

import { getCachedGitPanelValue } from './git-panel-cache.js'

describe('git-panel-cache', () => {
  it('dedupes concurrent snapshot loads for the same cache key and version', async () => {
    dashboardGitTaskStatusState.lastFinishedAt = null
    const load = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return { id: 'snapshot' }
    })

    const [left, right, third] = await Promise.all([
      getCachedGitPanelValue('snapshot', '/tmp/git-panel-cache-dedupe', 'uncommitted', load),
      getCachedGitPanelValue('snapshot', '/tmp/git-panel-cache-dedupe', 'uncommitted', load),
      getCachedGitPanelValue('snapshot', '/tmp/git-panel-cache-dedupe', 'uncommitted', load),
    ])

    expect(load).toHaveBeenCalledTimes(1)
    expect(left).toBe(right)
    expect(right).toBe(third)
  })

  it('keeps commit detail snapshot cache stable across dashboard refresh completions', async () => {
    dashboardGitTaskStatusState.lastFinishedAt = 1
    const load = vi.fn(async () => ({ id: 'commit-snapshot' }))

    const first = await getCachedGitPanelValue(
      'snapshot',
      '/tmp/git-panel-cache-commit',
      'commit:abc123',
      load
    )

    dashboardGitTaskStatusState.lastFinishedAt = 2

    const second = await getCachedGitPanelValue(
      'snapshot',
      '/tmp/git-panel-cache-commit',
      'commit:abc123',
      load
    )

    expect(load).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('still invalidates mutable git cache entries after refresh version changes', async () => {
    dashboardGitTaskStatusState.lastFinishedAt = 10
    const load = vi
      .fn<() => Promise<{ generation: number }>>()
      .mockResolvedValueOnce({ generation: 1 })
      .mockResolvedValueOnce({ generation: 2 })

    const first = await getCachedGitPanelValue(
      'snapshot',
      '/tmp/git-panel-cache-uncommitted',
      'uncommitted',
      load
    )

    dashboardGitTaskStatusState.lastFinishedAt = 20

    const second = await getCachedGitPanelValue(
      'snapshot',
      '/tmp/git-panel-cache-uncommitted',
      'uncommitted',
      load
    )

    expect(load).toHaveBeenCalledTimes(2)
    expect(first).not.toBe(second)
    expect(second.generation).toBe(2)
  })
})
