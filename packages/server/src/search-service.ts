/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Own one Planning-root search provider and its rebuild lifecycle.
 * 2. Rebuild from processed owned documents plus direct Referenced Spec metadata.
 * 3. Dispose scheduled and worker resources with the owning Planning root.
 * 4. Keep document dependencies caller-local while serializing provider snapshots.
 * 5. Consume the CLI-derived namespace-name set (OpenSpec 1.13.1) when collecting change
 *    documents; an unavailable set keeps indexing the full local listing (degradation).
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 * Derived requirement (2026-07-19): Warmup and overlapping subscribers cannot steal Search freshness or dependencies.
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — change-list nested/warnings projection (update-openspec-cli-1131 Slice 2).
 */
import type { OpenSpecAdapter, OpenSpecWatcher } from '@openspecui/core'
import type { ReferencedSpecCatalogEntry } from '@openspecui/core/spec-catalog'
import {
  parseProjectSearchHits,
  ProjectSearchDocumentSchema,
  ProjectSearchQuerySchema,
  type ProjectSearchDocument,
  type ProjectSearchHit,
  type SearchProvider,
  type SearchQuery,
} from '@openspecui/search'
import { NodeWorkerSearchProvider } from '@openspecui/search/node'
import type { DocumentService } from './document-service.js'
import { collectSearchDocuments, type EntityReadOptionsResolver } from './search-documents.js'

const REBUILD_DEBOUNCE_MS = 250

/** Search index lifecycle owned by one active Planning-root service record. */
export class SearchService {
  private provider: SearchProvider
  private initialized = false
  private initPromise: Promise<void> | null = null
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null
  private providerOperationTail: Promise<void> = Promise.resolve()
  private activeCalls = new Set<Promise<unknown>>()
  private lifecycle: 'active' | 'disposing' | 'disposed' = 'active'
  private disposePromise: Promise<void> | null = null
  private watcher?: OpenSpecWatcher
  private readonly handleWatcherChange = () => this.scheduleRebuild()

  constructor(
    private adapter: OpenSpecAdapter,
    watcher?: OpenSpecWatcher,
    provider: SearchProvider = new NodeWorkerSearchProvider(),
    private documentService?: DocumentService,
    private resolveEntityReadOptions?: EntityReadOptionsResolver,
    private getReferencedSpecs: () =>
      | readonly ReferencedSpecCatalogEntry[]
      | Promise<readonly ReferencedSpecCatalogEntry[]> = () => [],
    /**
     * OpenSpec 1.13.1: the CLI-derived namespace-name set for the current planning root.
     * Resolves empty (never rejects) when the CLI change list is unavailable so search
     * keeps indexing the full local listing instead of gating on the CLI projection.
     */
    private getNamespaceNames: () => readonly string[] | Promise<readonly string[]> = () => []
  ) {
    this.provider = provider
    this.watcher = watcher
    watcher?.on('change', this.handleWatcherChange)
  }

  /** Initialize the backing provider exactly once from current Planning-root truth. */
  async init(): Promise<void> {
    this.assertAcceptingCalls()
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    const initPromise = this.runTrackedCall(async () => {
      const documents = await this.collectCurrentDocuments()
      await this.runProviderOperation(async () => {
        await this.applyDocuments(documents)
      })
    })
    this.initPromise = initPromise

    try {
      await initPromise
    } finally {
      if (this.initPromise === initPromise) this.initPromise = null
    }
  }

  /** Query a caller-local current document snapshot. */
  async query(input: SearchQuery): Promise<ProjectSearchHit[]> {
    const parsed = ProjectSearchQuerySchema.parse(input)
    return this.runTrackedCall(() => this.queryCurrentDocuments(parsed))
  }

  /** Query current documents while retaining dependencies in this reactive invocation. */
  async queryReactive(input: SearchQuery): Promise<ProjectSearchHit[]> {
    const parsed = ProjectSearchQuerySchema.parse(input)
    return this.runTrackedCall(() => this.queryCurrentDocuments(parsed))
  }

  /** Stop admission, settle admitted calls, and dispose the backing provider once. */
  async dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise

    this.lifecycle = 'disposing'
    this.cancelRebuild()
    this.watcher?.off('change', this.handleWatcherChange)
    this.watcher = undefined
    const admittedCalls = [...this.activeCalls]
    this.disposePromise = (async () => {
      try {
        await Promise.allSettled(admittedCalls)
        await this.providerOperationTail
        await this.provider.dispose()
      } finally {
        this.lifecycle = 'disposed'
      }
    })()
    return this.disposePromise
  }

  private scheduleRebuild(): void {
    if (this.lifecycle !== 'active') return
    this.cancelRebuild()
    this.rebuildTimer = setTimeout(() => {
      this.rebuildTimer = null
      this.refreshCurrentDocuments().catch(() => {
        // ignore background refresh failure
      })
    }, REBUILD_DEBOUNCE_MS)
  }

  private cancelRebuild(): void {
    if (!this.rebuildTimer) return
    clearTimeout(this.rebuildTimer)
    this.rebuildTimer = null
  }

  private refreshCurrentDocuments(): Promise<void> {
    return this.runTrackedCall(async () => {
      const documents = await this.collectCurrentDocuments()
      await this.runProviderOperation(async () => {
        await this.applyDocuments(documents)
      })
    })
  }

  private async queryCurrentDocuments(
    query: ReturnType<typeof ProjectSearchQuerySchema.parse>
  ): Promise<ProjectSearchHit[]> {
    const documents = await this.collectCurrentDocuments()
    return this.runProviderOperation(async () => {
      await this.applyDocuments(documents)
      return parseProjectSearchHits(await this.provider.search(query), query.scope)
    })
  }

  private async collectCurrentDocuments() {
    const [referencedSpecs, namespaceNames] = await Promise.all([
      this.getReferencedSpecs(),
      this.getNamespaceNames(),
    ])
    return ProjectSearchDocumentSchema.array().parse(
      await collectSearchDocuments(
        this.adapter,
        this.documentService,
        this.resolveEntityReadOptions,
        referencedSpecs,
        { namespaceNames: new Set(namespaceNames) }
      )
    )
  }

  private async applyDocuments(documents: ProjectSearchDocument[]): Promise<void> {
    if (this.initialized) {
      await this.provider.replaceAll(documents)
      return
    }
    await this.provider.init(documents)
    this.initialized = true
  }

  private runProviderOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.providerOperationTail.then(operation)
    this.providerOperationTail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private runTrackedCall<T>(operation: () => Promise<T>): Promise<T> {
    this.assertAcceptingCalls()
    const call = operation()
    this.activeCalls.add(call)
    void call.then(
      () => this.activeCalls.delete(call),
      () => this.activeCalls.delete(call)
    )
    return call
  }

  private assertAcceptingCalls(): void {
    if (this.lifecycle !== 'active') {
      throw new Error(`Search service is ${this.lifecycle}.`)
    }
  }
}
