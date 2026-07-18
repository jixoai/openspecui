/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Prove system status projects watcher and recovery state.
 * 2. Keep system-router fixtures type-safe across the Planning-root resolver contract.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from './router.js'
import { createUnavailablePlanningRootServices } from './test-support/planning-root-services.js'

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
    launchProjectAdapter: {} as Context['launchProjectAdapter'],
    planningRootServices: createUnavailablePlanningRootServices(),
    configManager: {} as Context['configManager'],
    cliExecutor: {} as Context['cliExecutor'],
    projectRecoveryService:
      partial.projectRecoveryService ??
      ({
        getCurrent: () => ({ state: 'idle' }),
        subscribe: () => () => {},
        dispose: () => {},
      } as Context['projectRecoveryService']),
    notificationService: {} as Context['notificationService'],
    customSoundService: {} as Context['customSoundService'],
    globalSettingsManager: {} as Context['globalSettingsManager'],
    translationCacheService: {} as Context['translationCacheService'],
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
      initialized: true,
      rootCount: 1,
      subscriptionCount: 2,
      roots: [
        {
          rootPath: '/tmp/opsx-project',
          referenceCount: 1,
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
          projectResidency: { state: 'active' },
        },
      ],
    })

    const caller = createCaller({ watcher: undefined })
    const status = await caller.system.status()

    expect(status.watcherEnabled).toBe(true)
    expect(status.watcherRootCount).toBe(1)
    expect(status.watcherSubscriptionCount).toBe(2)
    expect(status.watcherRoots[0]).toMatchObject({
      rootPath: '/tmp/opsx-project',
      generation: 4,
      reinitializeCount: 1,
      lastReinitializeReason: 'project-dir-replaced',
    })
    expect(status.projectRecovery).toEqual({ state: 'idle' })
  })

  it('reports watcher disabled when runtime status is missing', async () => {
    getWatcherRuntimeStatusMock.mockReturnValue(null)

    const caller = createCaller({ watcher: {} as Context['watcher'] })
    const status = await caller.system.status()

    expect(status.watcherEnabled).toBe(false)
    expect(status.watcherRootCount).toBe(0)
    expect(status.watcherRoots).toEqual([])
  })
})
