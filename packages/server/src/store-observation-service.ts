/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Reconcile observed Store roots only from successful typed CLI list truth.
 * 2. Expose separate per-Store Doctor and Spec-content generations without broad Store-facet invalidation.
 * 3. Acquire and release environment/Doctor/Spec dependency leases as Store ids appear, move, or disappear.
 * 4. Expose desired-root observation gaps for the bounded failure fallback.
 * 5. Preserve no registry parser or health inference; serialize reconciliation and teardown.
 *
 * Original request (2026-07-15): "Registered Store roots are added/removed from observation as registry truth changes."
 */
import type {
  ObservationRootOwner,
  RuntimeInvalidationController,
  WatcherRootRelease,
} from '@openspecui/core'
import { acquireWatcher } from '@openspecui/core'
import type { StoreListEntry } from '@openspecui/core/store-types'
import { join, resolve } from 'node:path'
import {
  createStoreDoctorDependencyObservation,
  type StoreDoctorDependencyObservation,
  type StoreDoctorDependencyObservationFactory,
} from './store-doctor-dependency-observer.js'

interface ObservedStoreRecord {
  storeId: string
  rootPath: string
  release: WatcherRootRelease
  doctorDependencies: StoreDoctorDependencyObservation
  releaseSpecDependencies: () => void
}

interface StoreObservationGeneration {
  generation: number
}

/** Data-free Store observation invalidation; CLI results remain the only Store business truth. */
export type StoreObservationChange =
  | { kind: 'doctor-root'; storeId: string; generation: number }
  | { kind: 'spec-root'; storeId: string; generation: number }
  | { kind: 'inventory'; storeIds: readonly string[]; generation: number }

export type StoreObservationListener = (change: StoreObservationChange) => void

/** One CLI-listed Store identity and canonical root currently under observation. */
export interface ObservedStoreRoot {
  storeId: string
  rootPath: string
}

/** Reconcile/dispose surface for CLI-owned registered Store observation. */
export interface StoreObservationReconciler {
  reconcile(stores: readonly StoreListEntry[]): Promise<void>
  subscribe(listener: StoreObservationListener): () => void
  dispose(): Promise<void>
}

/** Own Store observation leases while leaving registry and Store meaning to the CLI. */
export class StoreObservationService implements StoreObservationReconciler {
  private readonly records = new Map<string, ObservedStoreRecord>()
  private readonly doctorGenerations = new Map<string, StoreObservationGeneration>()
  private readonly specGenerations = new Map<string, StoreObservationGeneration>()
  private readonly listeners = new Set<StoreObservationListener>()
  private inventoryGeneration = 0
  private desiredStores = new Map<string, ObservedStoreRoot>()
  private reconciliation = Promise.resolve()
  private disposed = false

  constructor(
    private readonly environment: ObservationRootOwner,
    private readonly invalidation: RuntimeInvalidationController,
    private readonly observeDoctorDependencies: StoreDoctorDependencyObservationFactory = createStoreDoctorDependencyObservation
  ) {}

  reconcile(stores: readonly StoreListEntry[]): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const desired = stores.map((entry) => ({ storeId: entry.id, rootPath: resolve(entry.root) }))
    this.reconciliation = this.reconciliation.then(() => this.applyDesiredStores(desired))
    return this.reconciliation
  }

  private async applyDesiredStores(desired: ObservedStoreRoot[]): Promise<void> {
    if (this.disposed) return
    const previousDesiredStores = this.desiredStores
    const nextDesiredStores = new Map(desired.map((entry) => [entry.storeId, entry]))
    const changedStoreIds = new Set<string>()
    for (const storeId of new Set([...previousDesiredStores.keys(), ...nextDesiredStores.keys()])) {
      if (
        previousDesiredStores.get(storeId)?.rootPath !== nextDesiredStores.get(storeId)?.rootPath
      ) {
        changedStoreIds.add(storeId)
      }
    }
    this.desiredStores = nextDesiredStores
    const desiredIds = new Set(desired.map((entry) => entry.storeId))

    for (const [storeId, current] of this.records) {
      const next = desired.find((entry) => entry.storeId === storeId)
      if (!next || next.rootPath !== current.rootPath) {
        this.records.delete(storeId)
        current.releaseSpecDependencies()
        await current.doctorDependencies.dispose()
        await current.release()
      }
    }

    for (const next of desired) {
      if (this.records.has(next.storeId)) continue
      let release: WatcherRootRelease | null = null
      let releaseSpecDependencies: (() => void) | null = null
      let doctorDependencies: StoreDoctorDependencyObservation | null = null
      try {
        release = await this.environment.acquireRoot(next.rootPath)
        if (this.disposed || !desiredIds.has(next.storeId)) {
          await release()
          continue
        }
        releaseSpecDependencies = acquireWatcher(
          join(next.rootPath, 'openspec', 'specs'),
          () => {
            if (this.records.get(next.storeId)?.rootPath !== next.rootPath) return
            this.bumpStoreGeneration(next.storeId, 'spec-root')
          },
          { recursive: true }
        )
        doctorDependencies = await this.observeDoctorDependencies({
          rootPath: next.rootPath,
          onChange: () => {
            if (this.records.get(next.storeId)?.rootPath !== next.rootPath) return
            this.bumpStoreGeneration(next.storeId, 'doctor-root')
            this.invalidation.invalidate(['context'])
          },
          onError: (error) => {
            console.error(
              `Store Doctor dependency observation failed for '${next.storeId}' at ${next.rootPath}:`,
              error
            )
          },
        })
        this.records.set(next.storeId, {
          ...next,
          release,
          doctorDependencies,
          releaseSpecDependencies,
        })
      } catch (error) {
        await doctorDependencies?.dispose()
        releaseSpecDependencies?.()
        await release?.()
        console.error(`Store observation failed for '${next.storeId}' at ${next.rootPath}:`, error)
      }
    }

    if (changedStoreIds.size > 0) {
      for (const storeId of changedStoreIds) {
        this.bumpStoreGeneration(storeId, 'doctor-root', false)
        this.bumpStoreGeneration(storeId, 'spec-root', false)
      }
      this.inventoryGeneration += 1
      this.emit({
        kind: 'inventory',
        storeIds: [...changedStoreIds].sort(),
        generation: this.inventoryGeneration,
      })
    }
  }

  /** Subscribe to data-free per-Store/inventory generations. */
  subscribe(listener: StoreObservationListener): () => void {
    if (this.disposed) return () => {}
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
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
    this.doctorGenerations.clear()
    this.specGenerations.clear()
    this.listeners.clear()
    await Promise.all(
      records.map((record) => {
        record.releaseSpecDependencies()
        return Promise.all([record.doctorDependencies.dispose(), record.release()]).then(
          () => undefined
        )
      })
    )
  }

  private getStoreGeneration(
    storeId: string,
    kind: 'doctor-root' | 'spec-root'
  ): StoreObservationGeneration {
    const generations = kind === 'doctor-root' ? this.doctorGenerations : this.specGenerations
    let record = generations.get(storeId)
    if (!record) {
      record = { generation: 0 }
      generations.set(storeId, record)
    }
    return record
  }

  private bumpStoreGeneration(
    storeId: string,
    kind: 'doctor-root' | 'spec-root',
    emit = true
  ): void {
    const record = this.getStoreGeneration(storeId, kind)
    record.generation += 1
    if (emit) this.emit({ kind, storeId, generation: record.generation })
  }

  private emit(change: StoreObservationChange): void {
    for (const listener of this.listeners) {
      try {
        listener(change)
      } catch (error) {
        console.error('Store observation listener failed:', error)
      }
    }
  }
}
