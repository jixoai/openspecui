/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Map dynamic filesystem roots to selected runtime invalidation facets.
 * 2. Share one recursive path subscription for repeated normalized roots.
 * 3. Release root subscriptions after their final logical owner or registry teardown.
 *
 * Original request (2026-07-15): "Launch-project and connected planning-root changes invalidate their project/context facets."
 */
import { resolveRealPathThroughExistingAncestor } from './reactive-fs/path-realpath.js'
import { acquireWatcher } from './reactive-fs/watcher-pool.js'
import type {
  RuntimeInvalidationController,
  RuntimeInvalidationFacet,
} from './runtime-invalidation.js'

interface RootInvalidationRecord {
  rootPath: string
  referenceCount: number
  releasePath: () => void
}

/** One physical root mapped to the runtime facets it can invalidate. */
export interface RuntimeInvalidationRoot {
  rootPath: string
  referenceCount: number
}

/** Reference-counted physical-root to runtime-facet invalidation owner. */
export interface RuntimeRootInvalidationOwner {
  acquireRoot(rootPath: string): () => void
}

/** Reference-counted path-to-facet mapping; physical watcher roots remain separately owned. */
export class RuntimeRootInvalidationRegistry implements RuntimeRootInvalidationOwner {
  private readonly records = new Map<string, RootInvalidationRecord>()

  constructor(
    private readonly invalidation: RuntimeInvalidationController,
    private readonly facets: readonly RuntimeInvalidationFacet[]
  ) {}

  acquireRoot(rootPath: string): () => void {
    const normalizedRoot = resolveRealPathThroughExistingAncestor(rootPath)
    let record = this.records.get(normalizedRoot)
    if (!record) {
      record = {
        rootPath: normalizedRoot,
        referenceCount: 0,
        releasePath: acquireWatcher(
          normalizedRoot,
          () => this.invalidation.invalidate(this.facets),
          { recursive: true }
        ),
      }
      this.records.set(normalizedRoot, record)
    }
    record.referenceCount += 1

    let released = false
    return () => {
      if (released) return
      released = true
      const current = this.records.get(normalizedRoot)
      if (current !== record || current.referenceCount === 0) return
      current.referenceCount -= 1
      if (current.referenceCount > 0) return
      current.releasePath()
      this.records.delete(normalizedRoot)
    }
  }

  getRoots(): RuntimeInvalidationRoot[] {
    return [...this.records.values()]
      .map(({ rootPath, referenceCount }) => ({ rootPath, referenceCount }))
      .sort((left, right) => left.rootPath.localeCompare(right.rootPath))
  }

  dispose(): void {
    const records = [...this.records.values()]
    this.records.clear()
    for (const record of records) record.releasePath()
  }
}
