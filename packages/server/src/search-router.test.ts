/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Prove the public Search subscription remains registered.
 * 2. Prove Search queries delegate through the Manager-owned Planning-root service.
 * 3. Prove query and subscription normalize source scope at the public boundary.
 *
 * Original request (2026-07-16): "你先负责后端（内核）的开发，我让ClaudeCode先帮你吧前端相关的代码先初步做一下。"
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
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
        runReactiveOperation: vi.fn(async (operation) => operation({ searchService } as never)),
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

    expect(searchService.query).toHaveBeenCalledWith({
      query: 'auth',
      scope: 'active-root',
      limit: 5,
    })
    expect(result[0]?.documentId).toBe('spec:owned:auth')
  })

  it('delegates explicit Reference scope through the Search subscription', async () => {
    const searchService = {
      queryReactive: vi.fn().mockResolvedValue([]),
    }

    const caller = appRouter.createCaller({
      launchProjectAdapter: {} as never,
      planningRootServices: {
        runOperation: vi.fn(async (operation) => operation({ searchService } as never)),
        runReactiveOperation: vi.fn(async (operation) => operation({ searchService } as never)),
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

    const subscription = (
      await caller.search.subscribe({
        query: 'auth',
        scope: 'referenced-specs',
        limit: 3,
      })
    ).subscribe({
      next: vi.fn(),
      error: vi.fn(),
      complete: vi.fn(),
    })

    await vi.waitFor(() => {
      expect(searchService.queryReactive).toHaveBeenCalledWith({
        query: 'auth',
        scope: 'referenced-specs',
        limit: 3,
      })
    })
    subscription.unsubscribe()
  })
})
