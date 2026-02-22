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
          documentId: 'spec:auth',
          kind: 'spec',
          title: 'Auth',
          href: '/specs/auth',
          path: 'openspec/specs/auth/spec.md',
          score: 99,
          snippet: 'Auth snippet',
          updatedAt: 1,
        },
      ]),
    }

    const caller = appRouter.createCaller({
      adapter: {} as never,
      configManager: {} as never,
      cliExecutor: {} as never,
      kernel: {} as never,
      searchService: searchService as never,
      projectDir: '/tmp/project',
    })

    const result = await caller.search.query({ query: 'auth', limit: 5 })

    expect(searchService.query).toHaveBeenCalledWith({ query: 'auth', limit: 5 })
    expect(result[0]?.documentId).toBe('spec:auth')
  })
})
