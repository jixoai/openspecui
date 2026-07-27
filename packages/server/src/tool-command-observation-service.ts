/**
 * Orthogonal intents (created 2026-07-20 Asia/Shanghai):
 * 1. Own the runtime observation lease for the external Codex command directory.
 * 2. Start observation before command projections read external artifacts, including when the command
 *    directory does not exist yet.
 * 3. Release successful or still-settling observation ownership on teardown.
 *
 * Original request (2026-07-15): "我们刻意开发了一个响应式内核，这是 openspecui 对 openspec 最大的增强。"
 * Independent review correction (2026-07-20): Official Codex commands are environment-global and
 * require a production-owned observation lease separate from launch-project skills.
 */
import type { ObservationRootOwner, WatcherRootRelease } from '@openspecui/core'

/** Server-owned lifecycle for non-project tool command artifact observation. */
export class ToolCommandObservationService {
  private startPromise: Promise<void> | null = null
  private releaseRoot: WatcherRootRelease | null = null
  private disposed = false

  constructor(
    private readonly environment: ObservationRootOwner,
    private readonly root: string
  ) {}

  /** Acquire the Codex command directory, using missing-root watcher ownership when necessary. */
  start(): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error('Cannot start tool command observation after teardown.'))
    }
    if (this.startPromise) return this.startPromise

    const startPromise = this.environment
      .acquireRoot(this.root)
      .then(async (releaseRoot) => {
        if (this.disposed) {
          await releaseRoot()
          return
        }
        this.releaseRoot = releaseRoot
      })
      .finally(() => {
        if (this.startPromise === startPromise && this.releaseRoot === null) {
          this.startPromise = null
        }
      })
    this.startPromise = startPromise
    return startPromise
  }

  /** Release external command observation, including a startup that is still settling. */
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    await this.startPromise?.catch(() => {})
    const releaseRoot = this.releaseRoot
    this.releaseRoot = null
    await releaseRoot?.()
  }
}
