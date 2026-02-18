import type { OpenSpecAdapter, OpenSpecWatcher } from '@openspecui/core'
import {
  SearchQuerySchema,
  type SearchHit,
  type SearchProvider,
  type SearchQuery,
} from '@openspecui/search'
import { NodeWorkerSearchProvider } from '@openspecui/search/node'
import { collectSearchDocuments } from './search-documents.js'

const REBUILD_DEBOUNCE_MS = 250

export class SearchService {
  private provider: SearchProvider
  private initialized = false
  private initPromise: Promise<void> | null = null
  private rebuildPromise: Promise<void> | null = null
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private adapter: OpenSpecAdapter,
    watcher?: OpenSpecWatcher,
    provider: SearchProvider = new NodeWorkerSearchProvider()
  ) {
    this.provider = provider

    watcher?.on('change', () => {
      this.scheduleRebuild()
    })
  }

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

  async query(input: SearchQuery): Promise<SearchHit[]> {
    const parsed = SearchQuerySchema.parse(input)
    await this.init()
    return this.provider.search(parsed)
  }

  async queryReactive(input: SearchQuery): Promise<SearchHit[]> {
    const parsed = SearchQuerySchema.parse(input)
    await this.rebuildIndex()
    return this.provider.search(parsed)
  }

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
      const docs = await collectSearchDocuments(this.adapter)
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
