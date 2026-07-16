/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Own the dynamic observation-root set for one backend runtime environment.
 * 2. Reference-count repeated logical acquisition inside that environment.
 * 3. Share physical root watchers through the process-level watcher pool.
 * 4. Release every root deterministically during environment teardown.
 *
 * Original request (2026-07-15): "Reactive observation supports a reference-counted dynamic set of roots per runtime environment."
 */
import { resolveRealPathThroughExistingAncestor } from './path-realpath.js'
import { acquireWatcherRoot, type WatcherRootRelease } from './watcher-pool.js'

interface EnvironmentRootRecord {
  rootPath: string
  referenceCount: number
  lease: Promise<WatcherRootRelease>
}

export interface ObservationEnvironmentRoot {
  rootPath: string
  referenceCount: number
}

export interface ObservationRootOwner {
  acquireRoot(rootPath: string): Promise<WatcherRootRelease>
}

/** Runtime-environment owner for all roots observed by one backend process. */
export class ReactiveObservationEnvironment implements ObservationRootOwner {
  private readonly roots = new Map<string, EnvironmentRootRecord>()
  private disposed = false

  async acquireRoot(rootPath: string): Promise<WatcherRootRelease> {
    if (this.disposed) {
      throw new Error('Cannot acquire an observation root after environment teardown.')
    }

    const normalizedRoot = resolveRealPathThroughExistingAncestor(rootPath)
    let record = this.roots.get(normalizedRoot)
    if (!record) {
      record = {
        rootPath: normalizedRoot,
        referenceCount: 0,
        lease: acquireWatcherRoot(normalizedRoot),
      }
      this.roots.set(normalizedRoot, record)
    }
    record.referenceCount += 1

    try {
      await record.lease
    } catch (error) {
      record.referenceCount -= 1
      if (record.referenceCount === 0 && this.roots.get(normalizedRoot) === record) {
        this.roots.delete(normalizedRoot)
      }
      throw error
    }

    let released = false
    return async () => {
      if (released) return
      released = true
      const current = this.roots.get(normalizedRoot)
      if (current !== record || current.referenceCount === 0) return
      current.referenceCount -= 1
      if (current.referenceCount > 0) return

      this.roots.delete(normalizedRoot)
      const releasePhysicalRoot = await current.lease
      await releasePhysicalRoot()
    }
  }

  getRoots(): ObservationEnvironmentRoot[] {
    return [...this.roots.values()]
      .map(({ rootPath, referenceCount }) => ({ rootPath, referenceCount }))
      .sort((left, right) => left.rootPath.localeCompare(right.rootPath))
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    const records = [...this.roots.values()]
    this.roots.clear()
    await Promise.all(
      records.map(async (record) => {
        const releasePhysicalRoot = await record.lease
        await releasePhysicalRoot()
      })
    )
  }
}
