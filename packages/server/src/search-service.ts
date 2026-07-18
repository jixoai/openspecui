/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Own one Planning-root search provider and its rebuild lifecycle.
 * 2. Rebuild from processed owned documents plus direct Referenced Spec metadata.
 * 3. Dispose scheduled and worker resources with the owning Planning root.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import type { OpenSpecAdapter, OpenSpecWatcher } from '@openspecui/core'
import type { ReferencedSpecCatalogEntry } from '@openspecui/core/spec-catalog'
import {
  ProjectSearchQuerySchema,
  type SearchHit,
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
  private rebuildPromise: Promise<void> | null = null
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private adapter: OpenSpecAdapter,
    watcher?: OpenSpecWatcher,
    provider: SearchProvider = new NodeWorkerSearchProvider(),
    private documentService?: DocumentService,
    private resolveEntityReadOptions?: EntityReadOptionsResolver,
    private getReferencedSpecs: () =>
      | readonly ReferencedSpecCatalogEntry[]
      | Promise<readonly ReferencedSpecCatalogEntry[]> = () => []
  ) {
    this.provider = provider

    watcher?.on('change', () => {
      this.scheduleRebuild()
    })
  }

  /** Initialize the backing provider exactly once from current Planning-root truth. */
  async init(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.rebuildIndex(true)

    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  /** Query the initialized index without forcing a rebuild. */
  async query(input: SearchQuery): Promise<SearchHit[]> {
    const parsed = ProjectSearchQuerySchema.parse(input)
    await this.init()
    return this.provider.search(parsed)
  }

  /** Rebuild an initialized index before running a reactive query. */
  async queryReactive(input: SearchQuery): Promise<SearchHit[]> {
    const parsed = ProjectSearchQuerySchema.parse(input)
    await this.rebuildIndex()
    return this.provider.search(parsed)
  }

  /** Stop scheduled rebuilds and dispose the backing provider. */
  async dispose(): Promise<void> {
    this.cancelRebuild()
    await this.provider.dispose()
  }

  private scheduleRebuild(): void {
    this.cancelRebuild()
    this.rebuildTimer = setTimeout(() => {
      this.rebuildTimer = null
      this.rebuildIndex().catch(() => {
        // ignore background refresh failure
      })
    }, REBUILD_DEBOUNCE_MS)
  }

  private cancelRebuild(): void {
    if (!this.rebuildTimer) return
    clearTimeout(this.rebuildTimer)
    this.rebuildTimer = null
  }

  private async rebuildIndex(forceInit = false): Promise<void> {
    if (!forceInit && !this.initialized) return
    if (this.rebuildPromise) return this.rebuildPromise

    this.rebuildPromise = (async () => {
      const docs = await collectSearchDocuments(
        this.adapter,
        this.documentService,
        this.resolveEntityReadOptions,
        await this.getReferencedSpecs()
      )
      if (this.initialized) {
        await this.provider.replaceAll(docs)
      } else {
        await this.provider.init(docs)
        this.initialized = true
      }
    })()

    try {
      await this.rebuildPromise
    } finally {
      this.rebuildPromise = null
    }
  }
}
