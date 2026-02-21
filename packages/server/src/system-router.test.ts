import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from './router.js'

vi.mock('@openspecui/core', async () => {
  const actual = await vi.importActual<typeof import('@openspecui/core')>('@openspecui/core')
  return {
    ...actual,
    getWatcherRuntimeStatus: vi.fn(),
  }
})

import { getWatcherRuntimeStatus } from '@openspecui/core'
import { appRouter } from './router.js'

const getWatcherRuntimeStatusMock = vi.mocked(getWatcherRuntimeStatus)

function createCaller(partial: Partial<Context> = {}) {
  return appRouter.createCaller({
    adapter: {} as Context['adapter'],
    configManager: {} as Context['configManager'],
    cliExecutor: {} as Context['cliExecutor'],
    kernel: {} as Context['kernel'],
    searchService: {} as Context['searchService'],
    watcher: partial.watcher,
    projectDir: partial.projectDir ?? '/tmp/opsx-project',
  })
}

describe('systemRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses reactive watcher runtime status for watcherEnabled', async () => {
    getWatcherRuntimeStatusMock.mockReturnValue({
      projectDir: '/tmp/opsx-project',
      initialized: true,
      subscriptionCount: 2,
      generation: 4,
      reinitializeCount: 1,
      lastReinitializeReason: 'project-dir-replaced',
      reinitializeReasonCounts: {
        'drop-events': 0,
        'watcher-error': 0,
        'missing-project-dir': 0,
        'project-dir-replaced': 1,
        manual: 0,
      },
    })

    const caller = createCaller({ watcher: undefined })
    const status = await caller.system.status()

    expect(status.watcherEnabled).toBe(true)
    expect(status.watcherGeneration).toBe(4)
    expect(status.watcherReinitializeCount).toBe(1)
    expect(status.watcherLastReinitializeReason).toBe('project-dir-replaced')
  })

  it('reports watcher disabled when runtime status is missing', async () => {
    getWatcherRuntimeStatusMock.mockReturnValue(null)

    const caller = createCaller({ watcher: {} as Context['watcher'] })
    const status = await caller.system.status()

    expect(status.watcherEnabled).toBe(false)
    expect(status.watcherGeneration).toBe(0)
  })
})
