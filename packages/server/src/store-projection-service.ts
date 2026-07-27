/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Own Store list and Doctor as environment-scoped CLI Projection Work.
 * 2. Keep Store-list registry/mutation evidence distinct from per-Store Doctor root evidence.
 * 3. Reconcile and track dynamic Store roots only from successful typed CLI list results.
 * 4. Expose legacy settled reads plus immediate lifecycle Pull and data-free Push.
 * 5. Hold one Server-runtime list lease so CLI-listed Store roots stay observed without browser subscribers.
 *
 * Original request (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。"
 */
import {
  classifyStoreCliResult,
  StoreDoctorResultSchema,
  StoreListResultSchema,
  toStoreFeatureResult,
  type CliExecutor,
  type CliProjectionNotice,
  type CliProjectionState,
  type RuntimeInvalidationReader,
  type StoreDoctorStore,
  type StoreFeatureResult,
  type StoreListEntry,
} from '@openspecui/core'
import { Buffer } from 'node:buffer'
import {
  projectionWorkIdentityKey,
  type ProjectionWorkIdentity,
  type ProjectionWorkRegistry,
  type ProjectionWorkRequest,
  type ProjectionWorkRuntime,
  type ProjectionWorkSubscription,
} from './projection-work/index.js'
import type {
  StoreObservationChange,
  StoreObservationReconciler,
} from './store-observation-service.js'

export type StoreListProjection = StoreFeatureResult<StoreListEntry[]>
export type StoreDoctorProjection = StoreFeatureResult<StoreDoctorStore[]>

type StoreProjectionData =
  | { kind: 'list'; value: StoreListProjection }
  | { kind: 'doctor'; value: StoreDoctorProjection }

/** Server-local discriminated registry for selector-exact Store environment projections. */
export interface StoreProjectionWorkOwner {
  registry: ProjectionWorkRegistry<StoreProjectionData>
}

export function createStoreProjectionWorkOwner(
  runtime: ProjectionWorkRuntime
): StoreProjectionWorkOwner {
  return { registry: runtime.createRegistry<StoreProjectionData>() }
}

export interface StoreProjectionServiceOptions {
  dataScopePath: string
  cliExecutor: {
    checkAvailability: CliExecutor['checkAvailability']
    contracts: Pick<CliExecutor['contracts'], 'listStores' | 'doctorStores'>
  }
  invalidation: RuntimeInvalidationReader
  storeObservation: StoreObservationReconciler
  workOwner: StoreProjectionWorkOwner
}

function estimateSnapshotBytes(data: StoreProjectionData): number {
  return Buffer.byteLength(JSON.stringify(data) ?? '', 'utf8')
}

/** Environment-scoped CLI owner for Store list/Doctor Pull and lifecycle-only Push. */
export class StoreProjectionService {
  private listLifecycleLease: ProjectionWorkSubscription | null = null
  private readonly releaseStoreObservation: () => void
  private readonly releaseRuntimeInvalidation: () => void
  private disposed = false

  constructor(private readonly options: StoreProjectionServiceOptions) {
    this.releaseStoreObservation = options.storeObservation.subscribe((change) =>
      this.invalidateDoctorObservation(change)
    )
    this.releaseRuntimeInvalidation = options.invalidation.subscribe(['stores'], () =>
      this.invalidateStoreFacet()
    )
  }

  /** Start the Server-owned Store-list lease that keeps dynamic Store-root observation current. */
  start(): void {
    if (this.disposed || this.listLifecycleLease) return
    this.listLifecycleLease = this.subscribeList(() => {})
  }

  /** Release the Server-owned lease before Projection Work and filesystem observation teardown. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.releaseStoreObservation()
    this.releaseRuntimeInvalidation()
    this.listLifecycleLease?.unsubscribe()
    this.listLifecycleLease = null
  }

  getListCurrent(): Promise<StoreListProjection> {
    return this.getCurrent(this.listRequest(), 'list')
  }

  getDoctorCurrent(storeId?: string): Promise<StoreDoctorProjection> {
    return this.getCurrent(this.doctorRequest(storeId), 'doctor')
  }

  readList(): CliProjectionState<StoreListProjection> {
    const request = this.listRequest()
    return this.selectState(
      this.options.workOwner.registry.read(request.identity) ?? this.loadingState(request.identity),
      'list'
    )
  }

  readDoctor(storeId?: string): CliProjectionState<StoreDoctorProjection> {
    const request = this.doctorRequest(storeId)
    return this.selectState(
      this.options.workOwner.registry.read(request.identity) ?? this.loadingState(request.identity),
      'doctor'
    )
  }

  subscribeList(listener: (notice: CliProjectionNotice) => void): ProjectionWorkSubscription {
    return this.options.workOwner.registry.subscribeLifecycle(this.listRequest(), listener)
  }

  subscribeDoctor(
    storeId: string | undefined,
    listener: (notice: CliProjectionNotice) => void
  ): ProjectionWorkSubscription {
    return this.options.workOwner.registry.subscribeLifecycle(this.doctorRequest(storeId), listener)
  }

  refreshList(): CliProjectionState<StoreListProjection> {
    this.options.workOwner.registry.invalidate(this.listIdentity())
    return this.readList()
  }

  refreshDoctor(storeId?: string): CliProjectionState<StoreDoctorProjection> {
    this.options.workOwner.registry.invalidate(this.doctorIdentity(storeId))
    return this.readDoctor(storeId)
  }

  private identity(projectionKind: string, selector: string): ProjectionWorkIdentity {
    return {
      projectionKind,
      planningRoot: {
        identity: this.options.dataScopePath,
        source: 'environment-data-home',
        storeSelector: null,
      },
      owner: { generation: null, gitBindingToken: null },
      selector,
      inputFingerprint: 'openspec-cli-1.6:stores-facet',
      protocolVersion: 1,
    }
  }

  private listIdentity(): ProjectionWorkIdentity {
    return this.identity('store-list', 'stores:list')
  }

  private doctorIdentity(storeId?: string): ProjectionWorkIdentity {
    return this.identity(
      'store-doctor',
      JSON.stringify({ command: 'stores:doctor', storeId: storeId ?? null })
    )
  }

  private listRequest(): ProjectionWorkRequest<StoreProjectionData, never> {
    return {
      identity: this.listIdentity(),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes,
      load: async ({ reportStage }) => {
        reportStage('root-ready')
        const cliVersion = await this.resolveCliVersion()
        const result = await this.options.cliExecutor.contracts.listStores()
        const classification = classifyStoreCliResult({
          result,
          schema: StoreListResultSchema,
          cliVersion,
        })
        const projection = toStoreFeatureResult(classification, {
          fromData: (data) => data.stores,
          fallback: [],
          cliVersion,
        })
        if (projection.available) {
          await this.options.storeObservation.reconcile(projection.stores)
        }
        reportStage('leaf-settled')
        return { kind: 'list', value: projection }
      },
    }
  }

  private doctorRequest(storeId?: string): ProjectionWorkRequest<StoreProjectionData, never> {
    return {
      identity: this.doctorIdentity(storeId),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes,
      load: async ({ reportStage }) => {
        reportStage('root-ready')
        const cliVersion = await this.resolveCliVersion()
        const result = await this.options.cliExecutor.contracts.doctorStores(storeId)
        const classification = classifyStoreCliResult({
          result,
          schema: StoreDoctorResultSchema,
          cliVersion,
        })
        const projection = toStoreFeatureResult(classification, {
          fromData: (data) => data.stores,
          fallback: [],
          cliVersion,
        })
        reportStage('leaf-settled')
        return { kind: 'doctor', value: projection }
      },
    }
  }

  private async resolveCliVersion(): Promise<string | undefined> {
    try {
      const availability = await this.options.cliExecutor.checkAvailability()
      return availability.available ? availability.version : undefined
    } catch {
      return undefined
    }
  }

  private invalidateDoctorObservation(change: StoreObservationChange): void {
    if (change.kind === 'spec-root') return
    this.options.workOwner.registry.invalidate(this.doctorIdentity(), 'dependency')
    const storeIds = change.kind === 'doctor-root' ? [change.storeId] : change.storeIds
    for (const storeId of storeIds) {
      this.options.workOwner.registry.invalidate(this.doctorIdentity(storeId), 'dependency')
    }
  }

  private invalidateStoreFacet(): void {
    this.options.workOwner.registry.invalidate(this.listIdentity(), 'dependency')
    this.options.workOwner.registry.invalidateMatching(
      (identity) => identity.projectionKind === 'store-doctor',
      'dependency'
    )
  }

  private loadingState(identity: ProjectionWorkIdentity): CliProjectionState<StoreProjectionData> {
    return {
      state: 'loading',
      identity: projectionWorkIdentityKey(identity),
      workGeneration: 0,
      invalidationCause: 'initial',
      data: null,
      freshness: null,
      snapshotGeneration: null,
      error: null,
    }
  }

  private getCurrent(
    request: ProjectionWorkRequest<StoreProjectionData, never>,
    kind: 'list'
  ): Promise<StoreListProjection>
  private getCurrent(
    request: ProjectionWorkRequest<StoreProjectionData, never>,
    kind: 'doctor'
  ): Promise<StoreDoctorProjection>
  private getCurrent(
    request: ProjectionWorkRequest<StoreProjectionData, never>,
    kind: StoreProjectionData['kind']
  ): Promise<StoreListProjection | StoreDoctorProjection> {
    return new Promise((resolve, reject) => {
      let settled = false
      let subscription: ProjectionWorkSubscription | null = null
      const settle = (callback: () => void) => {
        if (settled) return
        settled = true
        try {
          callback()
        } finally {
          subscription?.unsubscribe()
        }
      }
      subscription = this.options.workOwner.registry.subscribe(request, (event) => {
        if (event.type === 'snapshot' && event.snapshot.freshness === 'current') {
          const data = event.snapshot.data
          if (data.kind !== kind) {
            settle(() => reject(new Error(`Unexpected Store projection kind: ${data.kind}`)))
            return
          }
          settle(() => resolve(data.value))
          return
        }
        if (event.type === 'failed') settle(() => reject(event.error))
      })
      if (settled) subscription.unsubscribe()
    })
  }

  private selectState(
    state: CliProjectionState<StoreProjectionData>,
    kind: 'list'
  ): CliProjectionState<StoreListProjection>
  private selectState(
    state: CliProjectionState<StoreProjectionData>,
    kind: 'doctor'
  ): CliProjectionState<StoreDoctorProjection>
  private selectState(
    state: CliProjectionState<StoreProjectionData>,
    kind: StoreProjectionData['kind']
  ): CliProjectionState<StoreListProjection | StoreDoctorProjection> {
    if (state.data === null) return state
    if (state.data.kind !== kind) {
      throw new Error(`Unexpected Store projection kind: ${state.data.kind}`)
    }
    return { ...state, data: state.data.value }
  }
}
