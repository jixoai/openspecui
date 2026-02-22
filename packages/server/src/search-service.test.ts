import type { SearchDocument, SearchHit, SearchProvider } from '@openspecui/search'
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { SearchService } from './search-service.js'

function createAdapterMock() {
  return {
    listSpecsWithMeta: vi
      .fn()
      .mockResolvedValue([{ id: 'auth', name: 'Auth', createdAt: 1, updatedAt: 10 }]),
    readSpecRaw: vi.fn().mockResolvedValue('# Auth spec'),
    listChangesWithMeta: vi.fn().mockResolvedValue([
      {
        id: 'add-auth',
        name: 'Add Auth',
        progress: { total: 0, completed: 0 },
        createdAt: 1,
        updatedAt: 20,
      },
    ]),
    readChangeRaw: vi.fn().mockResolvedValue({
      proposal: 'Proposal text',
      tasks: 'Tasks text',
      design: 'Design text',
      deltaSpecs: [{ specId: 'auth', content: 'Delta content' }],
    }),
    listArchivedChangesWithMeta: vi
      .fn()
      .mockResolvedValue([{ id: 'old-auth', name: 'Old Auth', createdAt: 1, updatedAt: 5 }]),
    readArchivedChangeRaw: vi.fn().mockResolvedValue({
      proposal: 'Archived proposal',
      tasks: '',
      design: undefined,
      deltaSpecs: [],
    }),
  }
}

class FakeProvider implements SearchProvider {
  readonly initCalls: SearchDocument[][] = []
  readonly replaceCalls: SearchDocument[][] = []
  readonly searchCalls: Array<{ query: string; limit?: number }> = []

  async init(docs: SearchDocument[]): Promise<void> {
    this.initCalls.push(docs)
  }

  async replaceAll(docs: SearchDocument[]): Promise<void> {
    this.replaceCalls.push(docs)
  }

  async search(query: { query: string; limit?: number }): Promise<SearchHit[]> {
    this.searchCalls.push(query)
    return [
      {
        documentId: 'spec:auth',
        kind: 'spec',
        title: 'Auth',
        href: '/specs/auth',
        path: 'openspec/specs/auth/spec.md',
        score: 42,
        snippet: 'Auth',
        updatedAt: 10,
      },
    ]
  }

  async dispose(): Promise<void> {}
}

describe('SearchService', () => {
  it('initializes provider with collected documents and answers queries', async () => {
    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    const service = new SearchService(adapter as never, undefined, provider)

    await service.init()
    const hits = await service.query({ query: 'auth' })

    expect(provider.initCalls).toHaveLength(1)
    expect(provider.initCalls[0]?.length).toBe(3)
    expect(provider.searchCalls).toEqual([{ query: 'auth' }])
    expect(hits[0]?.documentId).toBe('spec:auth')
  })

  it('rebuilds index when watcher emits change after initialization', async () => {
    vi.useFakeTimers()

    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    const watcher = new EventEmitter()
    const service = new SearchService(adapter as never, watcher as never, provider)

    await service.init()
    watcher.emit('change', { type: 'spec' })

    await vi.advanceTimersByTimeAsync(300)

    expect(provider.replaceCalls).toHaveLength(1)

    vi.useRealTimers()
  })

  it('queryReactive refreshes index before searching', async () => {
    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    const service = new SearchService(adapter as never, undefined, provider)

    await service.init()
    await service.queryReactive({ query: 'auth', limit: 5 })

    expect(provider.initCalls).toHaveLength(1)
    expect(provider.replaceCalls).toHaveLength(1)
    expect(provider.searchCalls).toEqual([{ query: 'auth', limit: 5 }])
  })
})
