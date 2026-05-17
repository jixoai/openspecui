import { describe, expect, it, vi } from 'vitest'
import { appRouter, type Context } from './router.js'

function createCaller(partial: Partial<Context> = {}) {
  return appRouter.createCaller({
    adapter: {} as Context['adapter'],
    configManager: {} as Context['configManager'],
    documentService: {} as Context['documentService'],
    cliExecutor: {} as Context['cliExecutor'],
    kernel: {} as Context['kernel'],
    workflowInvocationService: {} as Context['workflowInvocationService'],
    searchService: {} as Context['searchService'],
    dashboardOverviewService: {} as Context['dashboardOverviewService'],
    projectRecoveryService: {
      getCurrent: () => ({ state: 'idle' }),
      subscribe: () => () => {},
      dispose: () => {},
    } as Context['projectRecoveryService'],
    notificationService: {} as Context['notificationService'],
    customSoundService: {} as Context['customSoundService'],
    globalSettingsManager: {
      readSettings: vi.fn(async () => ({ translationCache: { entryLimit: 10000 } })),
      writeSettings: vi.fn(),
    } as unknown as Context['globalSettingsManager'],
    translationCacheService: {
      getStats: vi.fn(async () => ({ enabled: true, entryLimit: 10000, entries: 1 })),
      read: vi.fn(async () => null),
      write: vi.fn(async () => ({ accepted: true })),
      clean: vi.fn(async () => ({ before: 1, after: 1, deleted: 0 })),
      clear: vi.fn(async () => ({ deleted: 1 })),
      close: vi.fn(),
    } as unknown as Context['translationCacheService'],
    projectDir: '/tmp/project',
    ...partial,
  })
}

describe('translation cache routers', () => {
  it('updates user-level global translation cache settings', async () => {
    const globalSettingsManager = {
      readSettings: vi.fn(),
      writeSettings: vi.fn(),
    }
    const caller = createCaller({
      globalSettingsManager: globalSettingsManager as unknown as Context['globalSettingsManager'],
    })

    await expect(
      caller.globalSettings.update({ translationCache: { entryLimit: 15000 } })
    ).resolves.toEqual({ success: true })
    expect(globalSettingsManager.writeSettings).toHaveBeenCalledWith({
      translationCache: { entryLimit: 15000 },
    })
  })

  it('delegates cache management actions to the shared service', async () => {
    const translationCacheService = {
      getStats: vi.fn(async () => ({ enabled: true, entryLimit: 10000, entries: 3 })),
      read: vi.fn(async () => null),
      write: vi.fn(async () => ({ accepted: true })),
      clean: vi.fn(async () => ({ before: 3, after: 3, deleted: 0 })),
      clear: vi.fn(async () => ({ deleted: 3 })),
      close: vi.fn(),
    }
    const caller = createCaller({
      translationCacheService:
        translationCacheService as unknown as Context['translationCacheService'],
    })

    await expect(caller.translationCache.stats()).resolves.toEqual({
      enabled: true,
      entryLimit: 10000,
      entries: 3,
    })
    await expect(caller.translationCache.clean()).resolves.toEqual({
      before: 3,
      after: 3,
      deleted: 0,
    })
    await expect(caller.translationCache.clear()).resolves.toEqual({ deleted: 3 })
    expect(translationCacheService.getStats).toHaveBeenCalledTimes(1)
    expect(translationCacheService.clean).toHaveBeenCalledTimes(1)
    expect(translationCacheService.clear).toHaveBeenCalledTimes(1)
  })
})
