/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Own the effective OpenSpec data-home observation lease for one runtime environment.
 * 2. Convert external data-home filesystem changes into facet invalidation identity.
 * 3. Keep Store, Workset, schema, and Context projections responsible for fresh pulls.
 * 4. Release the path subscription and root lease deterministically.
 *
 * Original request (2026-07-15): "有效 OpenSpec data home 的变化要让所有端拉取最新投影。"
 */
import type { ObservationRootOwner } from './reactive-fs/observation-environment.js'
import { acquireWatcher } from './reactive-fs/watcher-pool.js'
import {
  type RuntimeInvalidationController,
  type RuntimeInvalidationFacet,
} from './runtime-invalidation.js'

export interface OpenSpecDataHomeObserverOptions {
  dataHomePath: string
  environment: ObservationRootOwner
  invalidation: RuntimeInvalidationController
}

export const OPEN_SPEC_DATA_HOME_INVALIDATION_FACETS = [
  'stores',
  'worksets',
  'schemas',
  'context',
] as const satisfies readonly RuntimeInvalidationFacet[]

export type OpenSpecDataHomeObservationState =
  | 'idle'
  | 'starting'
  | 'active'
  | 'failed'
  | 'disposed'

/** Observe one effective OpenSpec data home without parsing or owning its domain data. */
export class OpenSpecDataHomeObserver {
  readonly dataHomePath: string
  private readonly environment: ObservationRootOwner
  private readonly invalidation: RuntimeInvalidationController
  private startPromise: Promise<void> | null = null
  private releasePathSubscription: (() => void) | null = null
  private releaseRoot: (() => Promise<void>) | null = null
  private disposed = false
  private state: OpenSpecDataHomeObservationState = 'idle'

  constructor(options: OpenSpecDataHomeObserverOptions) {
    this.dataHomePath = options.dataHomePath
    this.environment = options.environment
    this.invalidation = options.invalidation
  }

  start(): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error('Cannot start data-home observation after teardown.'))
    }
    if (this.startPromise) return this.startPromise

    this.state = 'starting'
    this.releasePathSubscription = acquireWatcher(
      this.dataHomePath,
      () => {
        this.invalidation.invalidate(OPEN_SPEC_DATA_HOME_INVALIDATION_FACETS)
      },
      { recursive: true }
    )
    const startPromise = this.environment
      .acquireRoot(this.dataHomePath)
      .then(async (releaseRoot) => {
        if (this.disposed) {
          await releaseRoot()
          return
        }
        this.releaseRoot = releaseRoot
        this.state = 'active'
      })
      .catch((error: unknown) => {
        this.releasePathSubscription?.()
        this.releasePathSubscription = null
        if (!this.disposed) this.state = 'failed'
        if (this.startPromise === startPromise) this.startPromise = null
        throw error
      })
    this.startPromise = startPromise
    return this.startPromise
  }

  /** Current lease state used by the bounded watcher-failure fallback. */
  getState(): OpenSpecDataHomeObservationState {
    return this.state
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.state = 'disposed'
    this.releasePathSubscription?.()
    this.releasePathSubscription = null
    await this.startPromise?.catch(() => {})
    const releaseRoot = this.releaseRoot
    this.releaseRoot = null
    await releaseRoot?.()
  }
}
