/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Verify Planning-root Search lifecycle, processed reads, and reactive rebuilds.
 * 2. Verify source-scoped documents and normalized project queries reach the provider.
 * 3. Verify duplicate and recursive Spec ids preserve Owned and Store-qualified Reference identity.
 * 4. Prove each buffered/reactive caller owns current physical document dependencies.
 * 5. Prove a failed provider operation cannot poison later queue work or disposal.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 * Derived requirement (2026-07-19): Warmup and overlapping subscribers cannot steal Search freshness or dependencies.
 * Derived requirement (2026-07-19): Provider queue rejection recovery needs exact mutation-resistant evidence.
 * Original request (2026-08-01): adapt OpenSpec 1.7 nested Spec ids such as `platform/auth`.
 */
import {
  clearCache,
  createDocumentChecklistSummary,
  createTrackedTaskProgress,
  OpenSpecAdapter,
  OpenSpecWatcher,
  ReactiveContext,
} from '@openspecui/core'
import type { SearchDocument, SearchHit, SearchProvider, SearchQuery } from '@openspecui/search'
import { NodeWorkerSearchProvider } from '@openspecui/search/node'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocumentService } from './document-service.js'
import { createHookRuntime } from './hook-runtime.js'
import { SearchService } from './search-service.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}

const tempDirs: string[] = []

function createDeferred<T>(): Deferred<T> {
  let complete: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    complete = resolve
  })
  return {
    promise,
    resolve(value) {
      if (!complete) throw new Error('Deferred resolver was not initialized.')
      complete(value)
    },
  }
}

async function createPhysicalAdapter(
  specId = 'auth',
  marker = 'initial marker'
): Promise<{ adapter: OpenSpecAdapter; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'openspecui-search-service-'))
  tempDirs.push(root)
  const adapter = new OpenSpecAdapter(root)
  await adapter.writeSpec(specId, createSpecMarkdown(marker))
  return { adapter, root }
}

function createSpecMarkdown(marker: string): string {
  return `# Auth Specification

## Purpose

${marker}

## Requirements

### Requirement: Authenticate

The system SHALL authenticate a user.

#### Scenario: Authentication succeeds

- **WHEN** valid credentials are supplied
- **THEN** the system SHALL authenticate the user
`
}

afterEach(async () => {
  clearCache()
  await Promise.all(tempDirs.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function createAdapterMock() {
  const adapter = new OpenSpecAdapter('/tmp/openspecui-search-service-fixture')
  vi.spyOn(adapter, 'listSpecsWithMeta').mockResolvedValue([
    { id: 'auth', name: 'Auth', createdAt: 1, updatedAt: 10 },
  ])
  vi.spyOn(adapter, 'readSpecRaw').mockResolvedValue('# Auth spec')
  vi.spyOn(adapter, 'listChangesWithMeta').mockResolvedValue([
    {
      id: 'add-auth',
      name: 'Add Auth',
      trackedTaskProgress: createTrackedTaskProgress([]),
      documentChecklistSummary: createDocumentChecklistSummary([]),
      createdAt: 1,
      updatedAt: 20,
    },
  ])
  vi.spyOn(adapter, 'readChangeRaw').mockResolvedValue({
    proposal: 'Proposal text',
    tasks: 'Tasks text',
    design: 'Design text',
    deltaSpecs: [{ specId: 'auth', content: 'Delta content' }],
  })
  vi.spyOn(adapter, 'listArchivedChangesWithMeta').mockResolvedValue([
    {
      id: 'old-auth',
      name: 'Old Auth',
      trackedTaskProgress: createTrackedTaskProgress([]),
      documentChecklistSummary: createDocumentChecklistSummary([]),
      createdAt: 1,
      updatedAt: 5,
    },
  ])
  vi.spyOn(adapter, 'readEntityDetail').mockResolvedValue({
    stage: 'archive',
    id: 'old-auth',
    exists: true,
    files: [{ path: 'summary.md', type: 'file', content: 'Archived summary' }],
    artifacts: [],
    ungroupedFiles: [{ path: 'summary.md', type: 'file', content: 'Archived summary' }],
    diagnostics: [],
  })
  return adapter
}

function createDocumentServiceMock(adapter: OpenSpecAdapter) {
  return new DocumentService(
    '/tmp/openspecui-search-service-fixture',
    adapter,
    createHookRuntime('/tmp/openspecui-search-service-fixture')
  )
}

const activeRootSearchHit = {
  documentId: 'spec:owned:auth',
  kind: 'spec',
  scope: 'active-root',
  title: 'Auth',
  href: '/specs/owned/auth',
  path: 'owned:openspec/specs/auth/spec.md',
  score: 42,
  snippet: 'Auth',
  updatedAt: 10,
} satisfies SearchHit

class FakeProvider implements SearchProvider {
  readonly initCalls: SearchDocument[][] = []
  readonly replaceCalls: SearchDocument[][] = []
  readonly searchCalls: SearchQuery[] = []
  searchResults: SearchHit[] = [activeRootSearchHit]

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

class SnapshotProvider implements SearchProvider {
  readonly firstSearchStarted = createDeferred<void>()
  readonly releaseFirstSearch = createDeferred<void>()
  readonly lifecycle: string[] = []
  private documents: SearchDocument[] = []
  private searchCount = 0

  async init(docs: SearchDocument[]): Promise<void> {
    this.lifecycle.push('init')
    this.documents = docs
  }

  async replaceAll(docs: SearchDocument[]): Promise<void> {
    const content = docs[0]?.content ?? ''
    const snapshot = content.includes('firstproof')
      ? 'firstproof'
      : content.includes('secondproof')
        ? 'secondproof'
        : 'other'
    this.lifecycle.push(`replace:${snapshot}`)
    this.documents = docs
  }

  async search(query: SearchQuery): Promise<SearchHit[]> {
    this.searchCount += 1
    this.lifecycle.push(`search:start:${query.query}`)
    if (this.searchCount === 1) {
      this.firstSearchStarted.resolve()
      await this.releaseFirstSearch.promise
    }
    const hits = this.documents
      .filter((document) => document.content.includes(query.query))
      .map(
        (document): SearchHit => ({
          documentId: document.id,
          kind: document.kind,
          scope: document.scope,
          title: document.title,
          href: document.href,
          path: document.path,
          score: 1,
          snippet: document.content,
          updatedAt: document.updatedAt,
        })
      )
    this.lifecycle.push(`search:end:${query.query}`)
    return hits
  }

  async dispose(): Promise<void> {
    this.lifecycle.push('dispose')
  }
}

class BlockingInitProvider extends FakeProvider {
  readonly initStarted = createDeferred<void>()
  readonly releaseInit = createDeferred<void>()
  readonly lifecycle: string[] = []
  disposeCalls = 0

  override async init(docs: SearchDocument[]): Promise<void> {
    this.lifecycle.push('init:start')
    this.initStarted.resolve()
    await this.releaseInit.promise
    await super.init(docs)
    this.lifecycle.push('init:end')
  }

  override async replaceAll(docs: SearchDocument[]): Promise<void> {
    this.lifecycle.push('replace')
    await super.replaceAll(docs)
  }

  override async search(query: SearchQuery): Promise<SearchHit[]> {
    this.lifecycle.push(`search:${query.query}`)
    return super.search(query)
  }

  override async dispose(): Promise<void> {
    this.disposeCalls += 1
    this.lifecycle.push('dispose')
  }
}

class FailFirstInitProvider extends FakeProvider {
  readonly firstInitStarted = createDeferred<void>()
  readonly releaseFirstInit = createDeferred<void>()
  readonly lifecycle: string[] = []
  disposeCalls = 0
  private initCount = 0

  override async init(docs: SearchDocument[]): Promise<void> {
    this.initCount += 1
    this.lifecycle.push(`init:start:${this.initCount}`)
    if (this.initCount === 1) {
      this.firstInitStarted.resolve()
      await this.releaseFirstInit.promise
      this.lifecycle.push('init:fail:1')
      throw new Error('fail-first provider init')
    }
    await super.init(docs)
    this.lifecycle.push(`init:end:${this.initCount}`)
  }

  override async replaceAll(docs: SearchDocument[]): Promise<void> {
    this.lifecycle.push('replace')
    await super.replaceAll(docs)
  }

  override async search(query: SearchQuery): Promise<SearchHit[]> {
    this.lifecycle.push(`search:${query.query}`)
    return super.search(query)
  }

  override async dispose(): Promise<void> {
    this.disposeCalls += 1
    this.lifecycle.push('dispose')
  }
}

describe('SearchService', () => {
  it('keeps a warmup waiter subscribed through its own physical document collection', async () => {
    const { adapter } = await createPhysicalAdapter()
    const provider = new FakeProvider()
    const service = new SearchService(adapter, undefined, provider)
    const warmupStarted = createDeferred<void>()
    const releaseWarmup = createDeferred<void>()
    const listSpecsWithMeta = adapter.listSpecsWithMeta.bind(adapter)
    let collectionCount = 0
    vi.spyOn(adapter, 'listSpecsWithMeta').mockImplementation(async () => {
      collectionCount += 1
      if (collectionCount === 1) {
        warmupStarted.resolve()
        await releaseWarmup.promise
      }
      return listSpecsWithMeta()
    })

    const warmup = service.init()
    await warmupStarted.promise

    const context = new ReactiveContext()
    const stream = context.stream(() => service.queryReactive({ query: 'auth' }))
    const firstEmission = stream.next()
    releaseWarmup.resolve()

    await expect(firstEmission).resolves.toMatchObject({ done: false })
    await warmup
    const secondEmission = stream.next()
    await adapter.writeSpec('auth', createSpecMarkdown('warmup caller marker'))

    await expect(secondEmission).resolves.toMatchObject({ done: false })
    expect(collectionCount).toBe(3)

    await stream.return(undefined)
    await service.dispose()
  })

  it('keeps two overlapping ReactiveContexts subscribed to the same physical invalidation', async () => {
    const { adapter } = await createPhysicalAdapter()
    const provider = new FakeProvider()
    const service = new SearchService(adapter, undefined, provider)
    await service.init()

    const firstCollectionStarted = createDeferred<void>()
    const releaseFirstCollection = createDeferred<void>()
    const listSpecsWithMeta = adapter.listSpecsWithMeta.bind(adapter)
    let collectionCount = 0
    vi.spyOn(adapter, 'listSpecsWithMeta').mockImplementation(async () => {
      collectionCount += 1
      if (collectionCount === 1) {
        firstCollectionStarted.resolve()
        await releaseFirstCollection.promise
      }
      return listSpecsWithMeta()
    })

    const firstContext = new ReactiveContext()
    const secondContext = new ReactiveContext()
    const firstStream = firstContext.stream(() => service.queryReactive({ query: 'auth' }))
    const secondStream = secondContext.stream(() => service.queryReactive({ query: 'auth' }))
    const firstEmission = firstStream.next()
    await firstCollectionStarted.promise
    const secondEmission = secondStream.next()
    releaseFirstCollection.resolve()

    await expect(Promise.all([firstEmission, secondEmission])).resolves.toEqual([
      expect.objectContaining({ done: false }),
      expect.objectContaining({ done: false }),
    ])

    const firstUpdate = firstStream.next()
    const secondUpdate = secondStream.next()
    await adapter.writeSpec('auth', createSpecMarkdown('shared invalidation marker'))

    await expect(Promise.all([firstUpdate, secondUpdate])).resolves.toEqual([
      expect.objectContaining({ done: false }),
      expect.objectContaining({ done: false }),
    ])
    expect(collectionCount).toBe(4)

    await firstStream.return(undefined)
    await secondStream.return(undefined)
    await service.dispose()
  })

  it('refreshes a buffered query from a physical Owned Spec edit without a subscription', async () => {
    const { adapter } = await createPhysicalAdapter()
    const service = new SearchService(adapter, undefined, new NodeWorkerSearchProvider())

    await expect(service.query({ query: 'bufferedproof' })).resolves.toEqual([])
    await adapter.writeSpec('auth', createSpecMarkdown('bufferedproof'))

    await expect(service.query({ query: 'bufferedproof' })).resolves.toEqual([
      expect.objectContaining({
        documentId: 'spec:owned:auth',
        scope: 'active-root',
      }),
    ])

    await service.dispose()
  })

  it('serializes each collected snapshot through replace and search without interleaving', async () => {
    const { adapter } = await createPhysicalAdapter()
    const provider = new SnapshotProvider()
    const service = new SearchService(adapter, undefined, provider)
    await service.init()

    await adapter.writeSpec('auth', createSpecMarkdown('firstproof'))
    const firstQuery = service.query({ query: 'firstproof' })
    await provider.firstSearchStarted.promise

    await adapter.writeSpec('auth', createSpecMarkdown('secondproof'))
    const secondQuery = service.query({ query: 'secondproof' })
    provider.releaseFirstSearch.resolve()

    await expect(firstQuery).resolves.toEqual([
      expect.objectContaining({ documentId: 'spec:owned:auth' }),
    ])
    await expect(secondQuery).resolves.toEqual([
      expect.objectContaining({ documentId: 'spec:owned:auth' }),
    ])
    expect(provider.lifecycle).toEqual([
      'init',
      'replace:firstproof',
      'search:start:firstproof',
      'search:end:firstproof',
      'replace:secondproof',
      'search:start:secondproof',
      'search:end:secondproof',
    ])

    await service.dispose()
  })

  it('settles admitted init and queries before one disposal without leaking later work', async () => {
    const { adapter } = await createPhysicalAdapter()
    const provider = new BlockingInitProvider()
    const service = new SearchService(adapter, undefined, provider)

    const initialization = service.init()
    await provider.initStarted.promise
    const bufferedQuery = service.query({ query: 'auth' })
    const reactiveQuery = service.queryReactive({ query: 'auth' })
    const disposal = service.dispose()
    let disposalSettled = false
    void disposal.then(() => {
      disposalSettled = true
    })

    await Promise.resolve()
    expect(disposalSettled).toBe(false)
    await expect(service.query({ query: 'auth' })).rejects.toThrow(/disposing/i)

    provider.releaseInit.resolve()
    await expect(
      Promise.all([initialization, bufferedQuery, reactiveQuery, disposal])
    ).resolves.toEqual([undefined, [activeRootSearchHit], [activeRootSearchHit], undefined])
    expect(provider.disposeCalls).toBe(1)
    expect(provider.lifecycle).toEqual([
      'init:start',
      'init:end',
      'replace',
      'search:auth',
      'replace',
      'search:auth',
      'dispose',
    ])

    await service.dispose()
    expect(provider.disposeCalls).toBe(1)
  })

  it('recovers queued buffered and reactive work after provider initialization rejects', async () => {
    const { adapter } = await createPhysicalAdapter()
    const provider = new FailFirstInitProvider()
    const service = new SearchService(adapter, undefined, provider)

    const initialization = service.init()
    const expectedInitializationFailure = expect(initialization).rejects.toThrow(
      'fail-first provider init'
    )
    await provider.firstInitStarted.promise
    const bufferedQuery = service.query({ query: 'buffered-recovery' })
    const reactiveQuery = service.queryReactive({ query: 'reactive-recovery' })
    const disposal = service.dispose()

    provider.releaseFirstInit.resolve()

    await expectedInitializationFailure
    await expect(bufferedQuery).resolves.toEqual([activeRootSearchHit])
    await expect(reactiveQuery).resolves.toEqual([activeRootSearchHit])
    await expect(disposal).resolves.toBeUndefined()
    expect(provider.disposeCalls).toBe(1)
    expect(provider.lifecycle).toEqual([
      'init:start:1',
      'init:fail:1',
      'init:start:2',
      'init:end:2',
      'search:buffered-recovery',
      'replace',
      'search:reactive-recovery',
      'dispose',
    ])

    await service.dispose()
    expect(provider.disposeCalls).toBe(1)
    await expect(service.query({ query: 'after-disposal' })).rejects.toThrow(/disposed/i)
  })

  it('initializes provider with collected documents and answers queries', async () => {
    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    const service = new SearchService(adapter, undefined, provider)

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
    const watcher = new OpenSpecWatcher('/tmp/openspecui-search-service-fixture')
    const service = new SearchService(adapter, watcher, provider)

    await service.init()
    watcher.emit('change', { type: 'spec' })

    await vi.advanceTimersByTimeAsync(300)

    expect(provider.replaceCalls).toHaveLength(1)
    await service.dispose()
    expect(watcher.listenerCount('change')).toBe(0)

    vi.useRealTimers()
  })

  it('queryReactive refreshes index before searching', async () => {
    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    const service = new SearchService(adapter, undefined, provider)

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
    vi.mocked(adapter.listSpecsWithMeta).mockImplementationOnce(async () => {
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
    const service = new SearchService(adapter, undefined, provider)

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
    provider.searchResults = [{ ...activeRootSearchHit, scope }]
    const service = new SearchService(adapter, undefined, provider)

    await expect(service.query({ query: 'auth', scope: 'active-root' })).rejects.toThrow(/scope/i)
  })

  it('indexes processed documents when a document service is provided', async () => {
    const adapter = createAdapterMock()
    const provider = new FakeProvider()
    const documentService = createDocumentServiceMock(adapter)
    vi.spyOn(documentService, 'readSpecRaw').mockResolvedValue({
      markdown: '# Enriched Auth spec',
      sourceMarkdown: '# Auth spec',
    })
    vi.spyOn(documentService, 'readChangeRaw').mockResolvedValue({
      proposal: { markdown: 'Enriched proposal', sourceMarkdown: 'Proposal text' },
      tasks: { markdown: 'Enriched tasks', sourceMarkdown: 'Tasks text' },
      design: { markdown: 'Enriched design', sourceMarkdown: 'Design text' },
      deltaSpecs: [{ specId: 'auth', content: 'Delta content' }],
    })
    vi.spyOn(documentService, 'readEntityDetail').mockResolvedValue({
      stage: 'archive',
      id: 'old-auth',
      exists: true,
      files: [{ path: 'summary.md', type: 'file', content: 'Enriched archived summary' }],
      artifacts: [],
      ungroupedFiles: [{ path: 'summary.md', type: 'file', content: 'Enriched archived summary' }],
      diagnostics: [],
    })
    const service = new SearchService(adapter, undefined, provider, documentService)

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
    const service = new SearchService(adapter, undefined, provider, undefined, undefined, () => [
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
    ])

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
        path: 'referenced:platform-a:specs/auth/spec.md',
      },
      {
        id: 'spec:referenced:platform-b:auth',
        scope: 'referenced-specs',
        href: '/specs/referenced/platform-b/auth',
        path: 'referenced:platform-b:specs/auth/spec.md',
      },
    ])
  })

  it('indexes a physical recursive owned Spec with complete identity and path', async () => {
    const { adapter } = await createPhysicalAdapter('platform/auth', 'nested marker')
    const provider = new FakeProvider()
    const service = new SearchService(adapter, undefined, provider)

    await service.init()

    expect(
      provider.initCalls[0]
        ?.filter((document) => document.kind === 'spec')
        .map(({ id, href, path, content }) => ({ id, href, path, content }))
    ).toEqual([
      {
        id: 'spec:owned:platform%2Fauth',
        href: '/specs/owned/platform%2Fauth',
        path: 'owned:openspec/specs/platform/auth/spec.md',
        content: expect.stringContaining('nested marker'),
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
    const documentService = createDocumentServiceMock(adapter)
    vi.spyOn(documentService, 'readSpecRaw').mockResolvedValue({
      markdown: '# Enriched Auth spec',
      sourceMarkdown: '# Auth spec',
    })
    vi.spyOn(documentService, 'readChangeRaw').mockResolvedValue({
      proposal: { markdown: 'Enriched proposal', sourceMarkdown: 'Proposal text' },
      tasks: { markdown: 'Enriched tasks', sourceMarkdown: 'Tasks text' },
      design: undefined,
      deltaSpecs: [],
    })
    vi.spyOn(documentService, 'readEntityDetail').mockResolvedValue({
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
    })
    const service = new SearchService(
      adapter,
      undefined,
      provider,
      documentService,
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
