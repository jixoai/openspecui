/**
 * Orthogonal intents (created 2026-07-17 Asia/Shanghai):
 * 1. Prove the public Search subscription remains registered.
 * 2. Prove Search queries delegate through the Manager-owned Planning-root service.
 *
 * Original request (2026-07-16): "你先负责后端（内核）的开发，我让ClaudeCode先帮你吧前端相关的代码先初步做一下。"
 */
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
        runOperation: vi.fn(async (operation) => operation({ searchService } as never)),
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
