/**
 * Orthogonal intents (updated 2026-11-04 Asia/Shanghai):
 * 1. Own the dynamic observation-root set for one backend runtime environment.
 * 2. Reference-count repeated logical acquisition inside that environment.
 * 3. Share physical root watchers through the process-level watcher pool.
 * 4. Release every root deterministically during environment teardown.
 * 5. Settle a root on the memoized attach branch, which is the real "first attach after boot":
 *    repeated logical acquisition never reaches the pool, so the pool cannot see it.
 *
 * Original request (2026-07-15): "Reactive observation supports a reference-counted dynamic set of roots per runtime environment."
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 */
import { resolveRealPathThroughExistingAncestor } from './path-realpath.js'
import { requestSettlement } from './settlement-coordinator.js'
import { acquireWatcherRoot, type WatcherRootRelease } from './watcher-pool.js'

interface EnvironmentRootRecord {
  rootPath: string
  referenceCount: number
  lease: Promise<WatcherRootRelease>
}

/** One observed root and its reference count inside an environment. */
export interface ObservationEnvironmentRoot {
  rootPath: string
  referenceCount: number
}

/** Reference-counted root acquisition boundary for reactive observation. */
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
    const attachedToExistingRecord = record !== undefined
    if (!record) {
      record = {
        rootPath: normalizedRoot,
        referenceCount: 0,
        lease: acquireWatcherRoot(normalizedRoot),
      }
      this.roots.set(normalizedRoot, record)
    }
    record.referenceCount += 1

    if (attachedToExistingRecord) {
      // Trigger 2 of fix-reactive-fs-settlement S1: this environment already holds the root, so the
      // pool is never called again for it (`acquireWatcherRoot`'s 0 -> 1 trigger cannot fire) and
      // this is the only signal a late logical attach produces. Fire-and-forget with a rejection
      // guard: the attach must not be delayed by, nor fail with, a recovery pass. Requests issued
      // while a pass is still reading are served by a trailing pass of the shared coordinator.
      void requestSettlement(normalizedRoot).catch((error) => {
        console.error(
          `[observation-environment] Attach settlement failed for ${normalizedRoot}:`,
          error
        )
      })
    }

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
