import type { DashboardOverview, OpenSpecWatcher } from '@openspecui/core'
import { EventEmitter } from 'node:events'

const REBUILD_DEBOUNCE_MS = 250

export class DashboardOverviewService {
  private current: DashboardOverview | null = null
  private initialized = false
  private initPromise: Promise<DashboardOverview> | null = null
  private refreshPromise: Promise<DashboardOverview> | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private pendingRefreshReason: string | null = null
  private emitter = new EventEmitter()

  constructor(
    private loadOverview: (reason: string) => Promise<DashboardOverview>,
    watcher?: OpenSpecWatcher
  ) {
    this.emitter.setMaxListeners(200)
    watcher?.on('change', () => {
      this.scheduleRefresh('watcher-change')
    })
  }

  async init(): Promise<DashboardOverview> {
    if (this.initialized && this.current) {
      return this.current
    }
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.refresh('init')

    try {
      return await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  async getCurrent(): Promise<DashboardOverview> {
    if (this.current) {
      return this.current
    }
    return this.init()
  }

  subscribe(
    listener: (overview: DashboardOverview) => void,
    options?: { emitCurrent?: boolean; onError?: (error: Error) => void }
  ): () => void {
    this.emitter.on('change', listener)

    if (options?.emitCurrent) {
      if (this.current) {
        listener(this.current)
      } else {
        void this.init().catch((error) => {
          options?.onError?.(error instanceof Error ? error : new Error(String(error)))
        })
      }
    }

    return () => {
      this.emitter.off('change', listener)
    }
  }

  scheduleRefresh(reason = 'scheduled-refresh'): void {
    this.cancelScheduledRefresh()
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null
      void this.refresh(reason).catch(() => {
        // Ignore background refresh failures and keep serving the last good snapshot.
      })
    }, REBUILD_DEBOUNCE_MS)
  }

  async refresh(reason = 'manual-refresh'): Promise<DashboardOverview> {
    this.cancelScheduledRefresh()

    if (this.refreshPromise) {
      this.pendingRefreshReason = reason
      return this.refreshPromise
    }

    this.refreshPromise = (async () => {
      const next = await this.loadOverview(reason)
      this.current = next
      this.initialized = true
      this.emitter.emit('change', next)
      return next
    })()

    try {
      return await this.refreshPromise
    } finally {
      this.refreshPromise = null
      if (this.pendingRefreshReason) {
        const pendingReason = this.pendingRefreshReason
        this.pendingRefreshReason = null
        void this.refresh(pendingReason).catch(() => {
          // Ignore queued background refresh failures.
        })
      }
    }
  }

  dispose(): void {
    this.cancelScheduledRefresh()
    this.emitter.removeAllListeners()
  }

  private cancelScheduledRefresh(): void {
    if (!this.refreshTimer) {
      return
    }
    clearTimeout(this.refreshTimer)
    this.refreshTimer = null
  }
}
