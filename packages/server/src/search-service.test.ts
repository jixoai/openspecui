/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify Planning-root Search lifecycle, processed reads, and reactive rebuilds.
 * 2. Verify source-scoped documents and normalized project queries reach the provider.
 * 3. Verify duplicate Spec ids preserve Owned and Store-qualified Reference identity.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import { createDocumentChecklistSummary, createTrackedTaskProgress } from '@openspecui/core'
import type { SearchDocument, SearchHit, SearchProvider, SearchQuery } from '@openspecui/search'
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
        trackedTaskProgress: createTrackedTaskProgress([]),
        documentChecklistSummary: createDocumentChecklistSummary([]),
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
    readEntityDetail: vi.fn().mockResolvedValue({
      stage: 'archive',
      id: 'old-auth',
      exists: true,
      files: [{ path: 'summary.md', type: 'file', content: 'Archived summary' }],
      artifacts: [],
      ungroupedFiles: [{ path: 'summary.md', type: 'file', content: 'Archived summary' }],
      diagnostics: [],
    }),
  }
}

class FakeProvider implements SearchProvider {
  readonly initCalls: SearchDocument[][] = []
  readonly replaceCalls: SearchDocument[][] = []
  readonly searchCalls: SearchQuery[] = []
  searchResults: SearchHit[] = [
    {
      documentId: 'spec:owned:auth',
      kind: 'spec',
      scope: 'active-root',
      title: 'Auth',
      href: '/specs/owned/auth',
      path: 'owned:openspec/specs/auth/spec.md',
      score: 42,
      snippet: 'Auth',
      updatedAt: 10,
    },
  ]

  async init(docs: SearchDocument[]): Promise<void> {
    this.initCalls.push(docs)
  }

  async replaceAll(docs: SearchDocument[]): Promise<void> {
    this.replaceCalls.push(docs)
  }

  async search(query: SearchQuery): Promise<SearchHit[]> {
    this.searchCalls.push(query)
    return this.searchResults
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
    expect(provider.initCalls[0]?.map(({ kind, scope }) => ({ kind, scope }))).toEqual([
      { kind: 'spec', scope: 'active-root' },
      { kind: 'change', scope: 'active-root' },
      { kind: 'archive', scope: 'active-root' },
    ])
    expect(provider.searchCalls).toEqual([{ query: 'auth', scope: 'active-root' }])
    expect(hits[0]?.documentId).toBe('spec:owned:auth')
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
    expect(provider.searchCalls).toEqual([{ query: 'auth', scope: 'active-root', limit: 5 }])
  })

  it('initializes current documents before the first reactive search', async () => {
    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    const lifecycle: string[] = []
    adapter.listSpecsWithMeta.mockImplementationOnce(async () => {
      lifecycle.push('collect')
      return [{ id: 'auth', name: 'Auth', createdAt: 1, updatedAt: 10 }]
    })
    const init = provider.init.bind(provider)
    provider.init = async (docs) => {
      lifecycle.push('init')
      await init(docs)
    }
    const search = provider.search.bind(provider)
    provider.search = async (query) => {
      lifecycle.push('search')
      return search(query)
    }
    const service = new SearchService(adapter as never, undefined, provider)

    const hits = await service.queryReactive({ query: 'auth', limit: 5 })

    expect(provider.initCalls).toHaveLength(1)
    expect(provider.replaceCalls).toHaveLength(0)
    expect(provider.searchCalls).toEqual([{ query: 'auth', scope: 'active-root', limit: 5 }])
    expect(hits[0]?.documentId).toBe('spec:owned:auth')
    expect(lifecycle).toEqual(['collect', 'init', 'search'])
  })

  it.each([
    ['missing', undefined],
    ['wrong', 'referenced-specs' as const],
  ])('rejects a project hit with %s scope provenance', async (_kind, scope) => {
    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    provider.searchResults = [{ ...provider.searchResults[0]!, scope }]
    const service = new SearchService(adapter as never, undefined, provider)

    await expect(service.query({ query: 'auth', scope: 'active-root' })).rejects.toThrow(/scope/i)
  })

  it('indexes processed documents when a document service is provided', async () => {
    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    const documentService = {
      readSpecRaw: vi.fn().mockResolvedValue({ markdown: '# Enriched Auth spec' }),
      readChangeRaw: vi.fn().mockResolvedValue({
        proposal: { markdown: 'Enriched proposal' },
        tasks: { markdown: 'Enriched tasks' },
        design: { markdown: 'Enriched design' },
        deltaSpecs: [{ specId: 'auth', content: 'Delta content' }],
      }),
      readEntityDetail: vi.fn().mockResolvedValue({
        stage: 'archive',
        id: 'old-auth',
        exists: true,
        files: [{ path: 'summary.md', type: 'file', content: 'Enriched archived summary' }],
        artifacts: [],
        ungroupedFiles: [
          { path: 'summary.md', type: 'file', content: 'Enriched archived summary' },
        ],
        diagnostics: [],
      }),
    }
    const service = new SearchService(
      adapter as never,
      undefined,
      provider,
      documentService as never
    )

    await service.init()

    expect(provider.initCalls[0]?.find((doc) => doc.id === 'spec:owned:auth')?.content).toBe(
      '# Enriched Auth spec'
    )
    expect(provider.initCalls[0]?.find((doc) => doc.id === 'change:add-auth')?.content).toContain(
      'Enriched proposal'
    )
    expect(provider.initCalls[0]?.find((doc) => doc.id === 'archive:old-auth')?.content).toContain(
      'Enriched archived summary'
    )
    expect(documentService.readSpecRaw).toHaveBeenCalledWith('auth', 'search', 'processed')
    expect(documentService.readEntityDetail).toHaveBeenCalledWith(
      'archive',
      'old-auth',
      'search',
      'processed',
      undefined
    )
  })

  it('indexes duplicate owned and referenced Spec ids with complete source identity', async () => {
    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    const service = new SearchService(
      adapter as never,
      undefined,
      provider,
      undefined,
      undefined,
      () => [
        {
          identity: { kind: 'referenced', storeId: 'platform-a', specId: 'auth' },
          source: 'referenced',
          readOnly: true,
          name: 'auth',
          summary: null,
          requirementCount: 1,
          updatedAt: 0,
        },
        {
          identity: { kind: 'referenced', storeId: 'platform-b', specId: 'auth' },
          source: 'referenced',
          readOnly: true,
          name: 'auth',
          summary: null,
          requirementCount: 2,
          updatedAt: 0,
        },
      ]
    )

    await service.init()

    expect(
      provider.initCalls[0]
        ?.filter((document) => document.kind === 'spec')
        .map(({ id, scope, href, path }) => ({ id, scope, href, path }))
    ).toEqual([
      {
        id: 'spec:owned:auth',
        scope: 'active-root',
        href: '/specs/owned/auth',
        path: 'owned:openspec/specs/auth/spec.md',
      },
      {
        id: 'spec:referenced:platform-a:auth',
        scope: 'referenced-specs',
        href: '/specs/referenced/platform-a/auth',
        path: 'referenced:platform-a:specs/auth',
      },
      {
        id: 'spec:referenced:platform-b:auth',
        scope: 'referenced-specs',
        href: '/specs/referenced/platform-b/auth',
        path: 'referenced:platform-b:specs/auth',
      },
    ])
  })

  it('passes resolved schema-aware entity read options to archive search indexing', async () => {
    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    const entityReadOptions = {
      schemas: {
        'custom-audit': {
          name: 'custom-audit',
          artifacts: [{ id: 'summary', outputPath: 'summary.md', requires: [] }],
          applyRequires: [],
        },
      },
    }
    const resolveEntityReadOptions = vi.fn().mockResolvedValue(entityReadOptions)
    const documentService = {
      readSpecRaw: vi.fn().mockResolvedValue({ markdown: '# Enriched Auth spec' }),
      readChangeRaw: vi.fn().mockResolvedValue({
        proposal: { markdown: 'Enriched proposal' },
        tasks: { markdown: 'Enriched tasks' },
        design: undefined,
        deltaSpecs: [],
      }),
      readEntityDetail: vi.fn().mockResolvedValue({
        stage: 'archive',
        id: 'old-auth',
        exists: true,
        schemaName: 'custom-audit',
        files: [{ path: 'summary.md', type: 'file', content: 'Schema-aware archive' }],
        artifacts: [
          {
            id: 'summary',
            outputPath: 'summary.md',
            files: [{ path: 'summary.md', type: 'file', content: 'Schema-aware archive' }],
          },
        ],
        ungroupedFiles: [],
        diagnostics: [],
      }),
    }
    const service = new SearchService(
      adapter as never,
      undefined,
      provider,
      documentService as never,
      resolveEntityReadOptions
    )

    await service.init()

    expect(resolveEntityReadOptions).toHaveBeenCalledWith('archive', 'old-auth')
    expect(documentService.readEntityDetail).toHaveBeenCalledWith(
      'archive',
      'old-auth',
      'search',
      'processed',
      entityReadOptions
    )
    expect(provider.initCalls[0]?.find((doc) => doc.id === 'archive:old-auth')?.content).toContain(
      'Schema-aware archive'
    )
  })
})
