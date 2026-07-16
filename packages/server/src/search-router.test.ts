import { describe, expect, it, vi } from 'vitest'
import { appRouter } from './router.js'

describe('search router', () => {
  it('registers search.subscribe procedure', () => {
    const procedures = (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })
      ._def.procedures
    expect(procedures['search.subscribe']).toBeDefined()
  })

  it('delegates search query to search service', async () => {
    const searchService = {
      query: vi.fn().mockResolvedValue([
        {
          documentId: 'spec:owned:auth',
          kind: 'spec',
          title: 'Auth',
          href: '/specs/owned/auth',
          path: 'owned:openspec/specs/auth/spec.md',
          score: 99,
          snippet: 'Auth snippet',
          updatedAt: 1,
        },
      ]),
    }

    const caller = appRouter.createCaller({
      launchProjectAdapter: {} as never,
      planningRootServices: {
        resolve: vi.fn().mockResolvedValue({ searchService }),
      } as never,
      configManager: {} as never,
      cliExecutor: {} as never,
      projectRecoveryService: {
        getCurrent: () => ({ state: 'idle' }),
        subscribe: () => () => {},
        dispose: () => {},
      } as never,
      notificationService: {} as never,
      customSoundService: {} as never,
      globalSettingsManager: {} as never,
      translationCacheService: {} as never,
      projectDir: '/tmp/project',
    })

    const result = await caller.search.query({ query: 'auth', limit: 5 })

    expect(searchService.query).toHaveBeenCalledWith({ query: 'auth', limit: 5 })
    expect(result[0]?.documentId).toBe('spec:owned:auth')
  })
})
