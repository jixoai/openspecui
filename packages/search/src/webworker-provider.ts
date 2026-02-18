import { SearchHitSchema, SearchWorkerResponseSchema } from './protocol.js'
import type { SearchDocument, SearchHit, SearchProvider, SearchQuery } from './types.js'
import { buildWebWorkerSource } from './worker-source.js'

interface PendingRequest {
  resolve: (value: SearchHit[] | undefined) => void
  reject: (error: Error) => void
}

function requestId(): string {
  return Math.random().toString(36).slice(2)
}

export class WebWorkerSearchProvider implements SearchProvider {
  private worker: Worker | null = null
  private workerUrl: string | null = null
  private pending = new Map<string, PendingRequest>()

  async init(docs: SearchDocument[]): Promise<void> {
    await this.ensureWorker()
    await this.sendRequest({ id: requestId(), type: 'init', docs })
  }

  async replaceAll(docs: SearchDocument[]): Promise<void> {
    await this.ensureWorker()
    await this.sendRequest({ id: requestId(), type: 'replaceAll', docs })
  }

  async search(query: SearchQuery): Promise<SearchHit[]> {
    await this.ensureWorker()
    const result = await this.sendRequest({ id: requestId(), type: 'search', query })
    return result ?? []
  }

  async dispose(): Promise<void> {
    if (this.worker) {
      await this.sendRequest({ id: requestId(), type: 'dispose' }).catch(() => {})
      this.worker.terminate()
      this.worker = null
    }

    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl)
      this.workerUrl = null
    }

    this.failPending(new Error('Worker disposed'))
  }

  private async ensureWorker(): Promise<void> {
    if (this.worker) return

    const source = buildWebWorkerSource()
    const blob = new Blob([source], { type: 'text/javascript' })
    this.workerUrl = URL.createObjectURL(blob)
    this.worker = new Worker(this.workerUrl, { type: 'module' })

    this.worker.onmessage = (event: MessageEvent<unknown>) => {
      const parsed = SearchWorkerResponseSchema.safeParse(event.data)
      if (!parsed.success) {
        this.failPending(new Error('Invalid worker response payload'))
        return
      }

      const response = parsed.data
      const pending = this.pending.get(response.id)
      if (!pending) return
      this.pending.delete(response.id)

      if (response.type === 'error') {
        pending.reject(new Error(response.message))
        return
      }

      if (response.type === 'results') {
        pending.resolve(response.hits.map((hit: unknown) => SearchHitSchema.parse(hit)))
        return
      }

      pending.resolve(undefined)
    }

    this.worker.onerror = (event) => {
      const message = event.message || 'Web worker runtime error'
      this.failPending(new Error(message))
    }
  }

  private sendRequest(payload: {
    id: string
    type: 'init' | 'replaceAll' | 'search' | 'dispose'
    docs?: SearchDocument[]
    query?: SearchQuery
  }): Promise<SearchHit[] | undefined> {
    const worker = this.worker
    if (!worker) {
      return Promise.reject(new Error('Web worker is not initialized'))
    }

    return new Promise((resolve, reject) => {
      this.pending.set(payload.id, { resolve, reject })
      worker.postMessage(payload)
    })
  }

  private failPending(error: Error): void {
    this.pending.forEach(({ reject }) => reject(error))
    this.pending.clear()
  }
}
