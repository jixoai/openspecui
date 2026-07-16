/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Own one bounded Store/Context fallback timer per backend runtime environment.
 * 2. Emit fallback invalidation only for data-home, Store-root, or watcher observation gaps.
 * 3. Retry failed data-home observation without parsing registry or projected Store truth.
 * 4. Prevent overlapping checks and release the timer deterministically.
 *
 * Original request (2026-07-15): "Polling is only a watcher-failure or missing-path fallback."
 */
import {
  getWatcherRuntimeStatus,
  type ObservationEnvironmentRoot,
  type OpenSpecDataHomeObservationState,
  type RuntimeInvalidationController,
  type WatcherRuntimeStatus,
} from '@openspecui/core'

const DEFAULT_FALLBACK_INTERVAL_MS = 5_000

export interface StoreObservationFallbackOptions {
  invalidation: RuntimeInvalidationController
  dataHomeObservation: {
    start(): Promise<void>
    getState(): OpenSpecDataHomeObservationState
  }
  storeObservation: {
    hasObservationGaps(): boolean
  }
  observationEnvironment: {
    getRoots(): ObservationEnvironmentRoot[]
  }
  getWatcherStatus?: () => WatcherRuntimeStatus | null
  intervalMs?: number
}

function hasDegradedRoot(
  expectedRoots: readonly ObservationEnvironmentRoot[],
  status: WatcherRuntimeStatus | null
): boolean {
  if (expectedRoots.length === 0) return false
  const runtimeRoots = new Map(status?.roots.map((root) => [root.rootPath, root]) ?? [])
  return expectedRoots.some((expected) => {
    const runtime = runtimeRoots.get(expected.rootPath)
    return !runtime || !runtime.initialized || runtime.projectResidency.state === 'evicted'
  })
}

/** Environment-owned fallback that remains inert while watcher observation is healthy. */
export class StoreObservationFallbackService {
  private readonly getWatcherStatus: () => WatcherRuntimeStatus | null
  private readonly intervalMs: number
  private timer: NodeJS.Timeout | null = null
  private checkPromise: Promise<void> | null = null
  private disposed = false

  constructor(private readonly options: StoreObservationFallbackOptions) {
    this.getWatcherStatus = options.getWatcherStatus ?? getWatcherRuntimeStatus
    this.intervalMs = options.intervalMs ?? DEFAULT_FALLBACK_INTERVAL_MS
  }

  /** Start the single environment timer. Healthy checks emit no invalidation. */
  start(): void {
    if (this.disposed || this.timer) return
    this.timer = setInterval(() => {
      if (this.checkPromise) return
      this.checkPromise = this.runCheck().finally(() => {
        this.checkPromise = null
      })
    }, this.intervalMs)
    this.timer.unref()
  }

  private async runCheck(): Promise<void> {
    if (this.disposed) return
    let degraded = false
    const previousDataHomeState = this.options.dataHomeObservation.getState()
    if (previousDataHomeState !== 'active' && previousDataHomeState !== 'disposed') {
      try {
        await this.options.dataHomeObservation.start()
        if (previousDataHomeState === 'failed') degraded = true
      } catch (error) {
        degraded = true
        console.warn('OpenSpec data-home observation retry failed:', error)
      }
    }

    degraded ||= this.options.dataHomeObservation.getState() !== 'active'
    degraded ||= this.options.storeObservation.hasObservationGaps()
    degraded ||= hasDegradedRoot(
      this.options.observationEnvironment.getRoots(),
      this.getWatcherStatus()
    )

    if (!this.disposed && degraded) {
      this.options.invalidation.invalidate(['stores', 'context'])
    }
  }

  /** Stop future fallback checks. */
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    await this.checkPromise
  }
}
