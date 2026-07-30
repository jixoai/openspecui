/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Own Store Specs and active Changes as demand-driven CLI Projection Work (6.4/6.5).
 * 2. Call the official CLI contract with an explicit Store selector; never parse files or reparse stdout (6.6).
 * 3. Keep Specs and active Changes regions independent for load/refresh/error/recovery (6.7).
 * 4. Key Projection Work by composite (envUri, Store id, kind) identity; reject stale/cross-Store completion (6.8).
 * 5. Reuse Store-root observation invalidation and data-free Push -> Pull transport (6.9).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-environment-delivery › "Environment-Scoped Store Content Projection".
 *
 * This service mirrors `store-projection-service.ts` but projects typed Spec/active-Change lists for one selected
 * composite identity. It is demand-driven: only a subscribed Store Detail starts work (6.12).
 */
import {
  classifyStoreCliResult,
  toStoreFeatureResult,
  type CliExecutor,
  type CliProjectionNotice,
  type CliProjectionState,
  type RuntimeInvalidationReader,
  type StoreFeatureResult,
} from '@openspecui/core'
import {
  StoreContentChangeListSchema,
  StoreContentSpecListSchema,
  type StoreContentChangeEntry,
  type StoreContentSpecEntry,
} from '@openspecui/core/store-content-projection'
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

/** One readonly Store content kind: Specs or active Changes. */
export type StoreContentKind = 'specs' | 'changes'

export type StoreContentSpecsProjection = StoreFeatureResult<StoreContentSpecEntry[]>
export type StoreContentChangesProjection = StoreFeatureResult<StoreContentChangeEntry[]>

type StoreContentEntry = StoreContentSpecEntry | StoreContentChangeEntry
type StoreContentProjection = StoreFeatureResult<StoreContentEntry[]>

type StoreContentData =
  | { kind: 'specs'; value: StoreContentSpecsProjection }
  | { kind: 'changes'; value: StoreContentChangesProjection }

/** Composite identity for one Store-content Work item: envUri + Store id + kind. */
export interface StoreContentIdentity {
  readonly envUri: string
  readonly storeId: string
  readonly kind: StoreContentKind
}

/** Server-local discriminated registry for Store-content projections. */
export interface StoreContentProjectionWorkOwner {
  registry: ProjectionWorkRegistry<StoreContentData>
}

export function createStoreContentProjectionWorkOwner(
  runtime: ProjectionWorkRuntime
): StoreContentProjectionWorkOwner {
  return { registry: runtime.createRegistry<StoreContentData>() }
}

export interface StoreContentProjectionServiceOptions {
  /** Effective OpenSpec data-home path owning the Store registry (environment scope). */
  dataScopePath: string
  cliExecutor: {
    checkAvailability: CliExecutor['checkAvailability']
    contracts: Pick<CliExecutor['contracts'], 'listSpecs' | 'listChanges'>
  }
  invalidation: RuntimeInvalidationReader
  storeObservation: StoreObservationReconciler
  workOwner: StoreContentProjectionWorkOwner
}

function estimateSnapshotBytes(data: StoreContentData): number {
  return Buffer.byteLength(JSON.stringify(data) ?? '', 'utf8')
}

/** Demand-driven, Store-selected Spec/active-Change CLI Projection Work owner. */
export class StoreContentProjectionService {
  private readonly releaseStoreObservation: (() => void) | null = null
  private readonly releaseRuntimeInvalidation: (() => void) | null = null
  private disposed = false

  constructor(private readonly options: StoreContentProjectionServiceOptions) {
    // Reuse Store-root observation invalidation: a root change invalidates content for that Store.
    this.releaseStoreObservation = options.storeObservation.subscribe((change) =>
      this.invalidateStoreContent(change)
    )
    this.releaseRuntimeInvalidation = options.invalidation.subscribe(['stores'], () =>
      this.invalidateAllStoreContent()
    )
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.releaseStoreObservation?.()
    this.releaseRuntimeInvalidation?.()
  }

  /** Subscribe to one composite Store-content Work item (demand-driven; only a Detail starts it). */
  subscribeContent(
    identity: StoreContentIdentity,
    listener: (notice: CliProjectionNotice) => void
  ): ProjectionWorkSubscription {
    return this.options.workOwner.registry.subscribeLifecycle(
      this.contentRequest(identity),
      listener
    )
  }

  /** Read the current Pull state for one composite Store-content Work item. */
  readContent(identity: StoreContentIdentity): CliProjectionState<StoreContentProjection> {
    const request = this.contentRequest(identity)
    const state =
      this.options.workOwner.registry.read(request.identity) ?? this.loadingState(request.identity)
    return this.selectState(state, identity.kind)
  }

  /** Explicitly invalidate one composite Store-content Work item (e.g. after a Store mutation). */
  refreshContent(identity: StoreContentIdentity): CliProjectionState<StoreContentProjection> {
    this.options.workOwner.registry.invalidate(this.contentIdentity(identity), 'explicit-refresh')
    return this.readContent(identity)
  }

  private contentIdentity(identity: StoreContentIdentity): ProjectionWorkIdentity {
    return {
      projectionKind: `store-content-${identity.kind}`,
      planningRoot: {
        identity: this.options.dataScopePath,
        source: 'environment-data-home',
        storeSelector: identity.storeId,
      },
      owner: { generation: null, gitBindingToken: null },
      // Composite selector: envUri + Store id + kind. Store id alone is never a sufficient key (6.8).
      selector: JSON.stringify({
        envUri: identity.envUri,
        storeId: identity.storeId,
        kind: identity.kind,
      }),
      inputFingerprint: `openspec-cli-1.6:store-content:${identity.kind}`,
      protocolVersion: 1,
    }
  }

  private contentRequest(
    identity: StoreContentIdentity
  ): ProjectionWorkRequest<StoreContentData, never> {
    return {
      identity: this.contentIdentity(identity),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes,
      load: async ({ reportStage }) => {
        reportStage('root-ready')
        const cliVersion = await this.resolveCliVersion()
        // Official CLI contract with the explicit Store selector; never parse files or reparse stdout (6.6).
        if (identity.kind === 'specs') {
          const result = await this.options.cliExecutor.contracts.listSpecs({
            store: identity.storeId,
          })
          const classification = classifyStoreCliResult({
            result,
            schema: StoreContentSpecListSchema,
            cliVersion,
          })
          const projection = toStoreFeatureResult(classification, {
            fromData: (data) => data.specs,
            fallback: [],
            cliVersion,
          })
          reportStage('leaf-settled')
          return { kind: 'specs', value: projection as StoreContentSpecsProjection }
        }
        const result = await this.options.cliExecutor.contracts.listChanges({
          store: identity.storeId,
        })
        const classification = classifyStoreCliResult({
          result,
          schema: StoreContentChangeListSchema,
          cliVersion,
        })
        const projection = toStoreFeatureResult(classification, {
          fromData: (data) => data.changes,
          fallback: [],
          cliVersion,
        })
        reportStage('leaf-settled')
        return { kind: 'changes', value: projection as StoreContentChangesProjection }
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

  private invalidateStoreContent(change: StoreObservationChange): void {
    if (change.kind === 'spec-root') return
    const storeIds = change.kind === 'doctor-root' ? [change.storeId] : change.storeIds
    for (const storeId of storeIds) {
      for (const kind of ['specs', 'changes'] as const) {
        this.options.workOwner.registry.invalidate(
          this.contentIdentity({ envUri: '', storeId, kind }),
          'dependency'
        )
      }
    }
  }

  private invalidateAllStoreContent(): void {
    this.options.workOwner.registry.invalidateMatching(
      (identity) =>
        identity.projectionKind === 'store-content-specs' ||
        identity.projectionKind === 'store-content-changes',
      'dependency'
    )
  }

  private loadingState(identity: ProjectionWorkIdentity): CliProjectionState<StoreContentData> {
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

  private selectState(
    state: CliProjectionState<StoreContentData>,
    kind: StoreContentKind
  ): CliProjectionState<StoreContentProjection> {
    if (state.data === null) {
      // Loading/error states carry no business data; pass through as a generic content projection shell.
      return { ...state, data: null } as CliProjectionState<StoreContentProjection>
    }
    if (state.data.kind !== kind) {
      throw new Error(`Unexpected Store content kind: ${state.data.kind}`)
    }
    return { ...state, data: state.data.value as StoreContentProjection }
  }
}
