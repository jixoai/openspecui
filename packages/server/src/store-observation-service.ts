/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Reconcile observed Store roots only from successful typed CLI list truth.
 * 2. Acquire and release environment root leases as Store ids appear, move, or disappear.
 * 3. Expose desired-root observation gaps for the bounded failure fallback.
 * 4. Preserve no registry parser, health inference, or filesystem discovery.
 * 5. Serialize reconciliation and release every lease on teardown.
 *
 * Original request (2026-07-15): "Registered Store roots are added/removed from observation as registry truth changes."
 */
import type {
  ObservationRootOwner,
  RuntimeRootInvalidationOwner,
  WatcherRootRelease,
} from '@openspecui/core'
import type { StoreListEntry } from '@openspecui/core/store-types'
import { resolve } from 'node:path'

interface ObservedStoreRecord {
  storeId: string
  rootPath: string
  release: WatcherRootRelease
  releaseInvalidation: () => void
}

export interface ObservedStoreRoot {
  storeId: string
  rootPath: string
}

export interface StoreObservationReconciler {
  reconcile(stores: readonly StoreListEntry[]): Promise<void>
  dispose(): Promise<void>
}

/** Own Store observation leases while leaving registry and Store meaning to the CLI. */
export class StoreObservationService implements StoreObservationReconciler {
  private readonly records = new Map<string, ObservedStoreRecord>()
  private desiredStores = new Map<string, ObservedStoreRoot>()
  private reconciliation = Promise.resolve()
  private disposed = false

  constructor(
    private readonly environment: ObservationRootOwner,
    private readonly invalidation: RuntimeRootInvalidationOwner
  ) {}

  reconcile(stores: readonly StoreListEntry[]): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const desired = stores.map((entry) => ({ storeId: entry.id, rootPath: resolve(entry.root) }))
    this.reconciliation = this.reconciliation.then(() => this.applyDesiredStores(desired))
    return this.reconciliation
  }

  private async applyDesiredStores(desired: ObservedStoreRoot[]): Promise<void> {
    if (this.disposed) return
    this.desiredStores = new Map(desired.map((entry) => [entry.storeId, entry]))
    const desiredIds = new Set(desired.map((entry) => entry.storeId))

    for (const [storeId, current] of this.records) {
      const next = desired.find((entry) => entry.storeId === storeId)
      if (!next || next.rootPath !== current.rootPath) {
        this.records.delete(storeId)
        current.releaseInvalidation()
        await current.release()
      }
    }

    for (const next of desired) {
      if (this.records.has(next.storeId)) continue
      try {
        const release = await this.environment.acquireRoot(next.rootPath)
        if (this.disposed || !desiredIds.has(next.storeId)) {
          await release()
          continue
        }
        const releaseInvalidation = this.invalidation.acquireRoot(next.rootPath)
        this.records.set(next.storeId, { ...next, release, releaseInvalidation })
      } catch (error) {
        console.error(`Store observation failed for '${next.storeId}' at ${next.rootPath}:`, error)
      }
    }
  }

  getObservedStores(): ObservedStoreRoot[] {
    return [...this.records.values()]
      .map(({ storeId, rootPath }) => ({ storeId, rootPath }))
      .sort((left, right) => left.storeId.localeCompare(right.storeId))
  }

  /** True when successful CLI truth contains a Store root whose watcher lease is unavailable. */
  hasObservationGaps(): boolean {
    for (const [storeId, desired] of this.desiredStores) {
      if (this.records.get(storeId)?.rootPath !== desired.rootPath) return true
    }
    return false
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    await this.reconciliation
    const records = [...this.records.values()]
    this.records.clear()
    this.desiredStores.clear()
    await Promise.all(
      records.map((record) => {
        record.releaseInvalidation()
        return record.release()
      })
    )
  }
}
