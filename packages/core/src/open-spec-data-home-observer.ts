/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Own the effective OpenSpec data-home observation lease for one runtime environment.
 * 2. Map registry, Workset, and schema paths to their objective invalidation facets.
 * 3. Keep Store, Workset, schema, and Context projections responsible for fresh pulls.
 * 4. Release the path subscription and root lease deterministically.
 * 5. Settle initially missing official targets from bounded ancestor creation without invalidating unrelated content.
 *
 * Original request (2026-07-15): "有效 OpenSpec data home 的变化要让所有端拉取最新投影。"
 * Original request (2026-07-26): "真正基于文件、甚至是文件内容结构的变更去拉取更新。"
 * Remote CI fixed point (2026-07-28): data-home Schema creation may arrive as an ancestor event on Linux.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ObservationRootOwner } from './reactive-fs/observation-environment.js'
import { acquireWatcher } from './reactive-fs/watcher-pool.js'
import {
  type RuntimeInvalidationController,
  type RuntimeInvalidationFacet,
} from './runtime-invalidation.js'

/** Dependencies required to observe the effective OpenSpec data home. */
export interface OpenSpecDataHomeObserverOptions {
  dataHomePath: string
  environment: ObservationRootOwner
  invalidation: RuntimeInvalidationController
}

/** Official OpenSpec 1.6 data-home paths and the projections whose inputs they can change. */
export const OPEN_SPEC_DATA_HOME_OBSERVATION_TARGETS = [
  {
    relativePath: 'stores/registry.yaml',
    recursive: false,
    facets: ['stores', 'context'],
  },
  { relativePath: 'worksets', recursive: true, facets: ['worksets'] },
  { relativePath: 'schemas', recursive: true, facets: ['schemas', 'context'] },
] as const satisfies readonly {
  relativePath: string
  recursive: boolean
  facets: readonly RuntimeInvalidationFacet[]
}[]

/** Lifecycle state of effective OpenSpec data-home observation. */
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
  private releasePathSubscriptions: Array<() => void> = []
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
    this.releasePathSubscriptions = OPEN_SPEC_DATA_HOME_OBSERVATION_TARGETS.map((target) => {
      const targetPath = join(this.dataHomePath, target.relativePath)
      let wasPresent = existsSync(targetPath)
      return acquireWatcher(
        targetPath,
        () => {
          const isPresent = existsSync(targetPath)
          if (wasPresent || isPresent) {
            this.invalidation.invalidate(target.facets)
          }
          wasPresent = isPresent
        },
        { recursive: target.recursive, watchAncestorsWhileMissing: true }
      )
    })
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
        this.releasePathSubscriptions.forEach((release) => release())
        this.releasePathSubscriptions = []
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
    this.releasePathSubscriptions.forEach((release) => release())
    this.releasePathSubscriptions = []
    await this.startPromise?.catch(() => {})
    const releaseRoot = this.releaseRoot
    this.releaseRoot = null
    await releaseRoot?.()
  }
}
