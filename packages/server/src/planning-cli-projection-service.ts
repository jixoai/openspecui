/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Own selector-exact OPSX Status/Instructions and Spec Projection Work for one Planning-root record.
 * 2. Execute typed Kernel/CLI readers against one reactive Manager-owned Root Context value per Work generation.
 * 3. Expose immediate Pull, lifecycle-only Push, explicit refresh, and settled compatibility reads.
 * 4. Share one bounded typed registry across replaceable Planning-root records.
 * 5. Retire every config-dependent CLI Work generation before Active Root mutation settlement escapes its lease.
 *
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 * Owner architecture clarification (2026-07-26): "将这些变更信息收集起来作为触发器，更新底层幂等计算的缓存结果。"
 */
import {
  PlanningCliProjectionDataSchema,
  PlanningCliProjectionSelectorSchema,
  ReactiveState,
  requireCanonicalOpenSpecEntityId,
  type CliProjectionNotice,
  type CliProjectionState,
  type OpenSpecCliContractExecutor,
  type OpsxKernel,
  type PlanningCliProjectionData,
  type PlanningCliProjectionSelector,
  type RootContext,
  type RuntimeInvalidationReader,
} from '@openspecui/core'
import { Buffer } from 'node:buffer'
import { match } from 'ts-pattern'
import type { DocumentService } from './document-service.js'
import {
  projectionWorkIdentityKey,
  type ProjectionWorkIdentity,
  type ProjectionWorkRegistry,
  type ProjectionWorkRequest,
  type ProjectionWorkRuntime,
  type ProjectionWorkSubscription,
} from './projection-work/index.js'
import { readSpecCatalog, readSpecDocument } from './spec-catalog-service.js'
import type {
  StoreObservationChange,
  StoreObservationReconciler,
} from './store-observation-service.js'

/** Manager-wide typed registry shared by every replaceable Planning-root record. */
export interface PlanningCliProjectionWorkOwner {
  registry: ProjectionWorkRegistry<PlanningCliProjectionData>
}

/** Manager-owned Root Context value that wakes exact subscribed Planning CLI Work identities. */
export class PlanningCliRootContextState {
  private readonly state: ReactiveState<RootContext>

  constructor(rootContext: RootContext) {
    this.state = new ReactiveState(rootContext)
  }

  get(): RootContext {
    return this.state.get()
  }

  set(rootContext: RootContext): void {
    this.state.set(rootContext)
  }
}

export function createPlanningCliProjectionWorkOwner(
  runtime: ProjectionWorkRuntime
): PlanningCliProjectionWorkOwner {
  return { registry: runtime.createRegistry<PlanningCliProjectionData>() }
}

export interface PlanningCliProjectionServiceOptions {
  rootContext: RootContext | PlanningCliRootContextState
  gitBindingToken: string
  kernel: Pick<
    OpsxKernel,
    | 'readStatusProjection'
    | 'readChangeListProjection'
    | 'readStatusListProjection'
    | 'readInstructionsProjection'
    | 'readApplyInstructionsProjection'
    | 'readArchiveInstructionsProjection'
    | 'readConfigBundleProjection'
    | 'readTemplatesProjection'
    | 'readTemplateContentsProjection'
  >
  documentService: Pick<DocumentService, 'readSpec' | 'readSpecRaw'>
  contracts: Pick<OpenSpecCliContractExecutor, 'listSpecs' | 'showSpec'>
  invalidation: RuntimeInvalidationReader
  storeObservation: Pick<StoreObservationReconciler, 'subscribe'>
  workOwner: PlanningCliProjectionWorkOwner
}

function estimateSnapshotBytes(data: PlanningCliProjectionData): number {
  return Buffer.byteLength(JSON.stringify(data) ?? '', 'utf8')
}

/** Planning-root owner for all normal-path CLI-backed OPSX and Spec live projections. */
export class PlanningCliProjectionService {
  private readonly releaseStoreObservation: () => void

  constructor(private readonly options: PlanningCliProjectionServiceOptions) {
    this.releaseStoreObservation = options.storeObservation.subscribe((change) =>
      this.invalidateSpecObservation(change)
    )
  }

  dispose(): void {
    this.releaseStoreObservation()
  }

  read(rawSelector: PlanningCliProjectionSelector): CliProjectionState<PlanningCliProjectionData> {
    const selector = this.selector(rawSelector)
    return (
      this.options.workOwner.registry.read(this.identity(selector)) ?? this.initialState(selector)
    )
  }

  refresh(
    rawSelector: PlanningCliProjectionSelector
  ): CliProjectionState<PlanningCliProjectionData> {
    const selector = this.selector(rawSelector)
    this.options.workOwner.registry.invalidate(this.identity(selector))
    return this.read(selector)
  }

  /** Retire every current-root CLI Work item whose result depends on Active Root configuration. */
  invalidateConfigDependentWork(): void {
    const rootContext = this.currentRootContext()
    const planningRoot = rootContext.planningRoot
    if (!planningRoot) return
    const generation = rootContext.generation ?? this.options.gitBindingToken
    this.options.workOwner.registry.invalidateMatching(
      (identity) =>
        identity.projectionKind === 'planning-cli' &&
        identity.planningRoot.identity === planningRoot.path &&
        identity.owner.generation === generation &&
        (identity.selector === 'opsx-status' ||
          identity.selector === 'opsx-change-list' ||
          identity.selector === 'opsx-status-list' ||
          identity.selector === 'opsx-instructions' ||
          identity.selector === 'opsx-apply-instructions' ||
          identity.selector === 'opsx-archive-instructions' ||
          identity.selector === 'opsx-config-bundle' ||
          identity.selector === 'opsx-templates' ||
          identity.selector === 'opsx-template-contents'),
      'dependency'
    )
  }

  subscribe(
    rawSelector: PlanningCliProjectionSelector,
    listener: (notice: CliProjectionNotice) => void
  ): ProjectionWorkSubscription {
    const selector = this.selector(rawSelector)
    return this.options.workOwner.registry.subscribeLifecycle(this.request(selector), listener)
  }

  getCurrent(rawSelector: PlanningCliProjectionSelector): Promise<PlanningCliProjectionData> {
    const selector = this.selector(rawSelector)
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
      try {
        subscription = this.options.workOwner.registry.subscribe(
          this.request(selector),
          (event) => {
            if (event.type === 'snapshot' && event.snapshot.freshness === 'current') {
              settle(() => resolve(PlanningCliProjectionDataSchema.parse(event.snapshot.data)))
              return
            }
            if (event.type === 'failed') settle(() => reject(event.error))
          }
        )
      } catch (error) {
        reject(error)
        return
      }
      if (settled) subscription.unsubscribe()
    })
  }

  private initialState(
    selector: PlanningCliProjectionSelector
  ): CliProjectionState<PlanningCliProjectionData> {
    return {
      identity: projectionWorkIdentityKey(this.identity(selector)),
      workGeneration: 0,
      invalidationCause: 'initial',
      state: 'loading',
      data: null,
      freshness: null,
      snapshotGeneration: null,
      error: null,
    }
  }

  private selector(rawSelector: PlanningCliProjectionSelector): PlanningCliProjectionSelector {
    const selector = PlanningCliProjectionSelectorSchema.parse(rawSelector)
    return match(selector)
      .with({ kind: 'opsx-status' }, (value) => ({
        ...value,
        change: requireCanonicalOpenSpecEntityId(value.change, 'changeId'),
      }))
      .with({ kind: 'opsx-instructions' }, (value) => ({
        ...value,
        change: requireCanonicalOpenSpecEntityId(value.change, 'changeId'),
      }))
      .with({ kind: 'opsx-apply-instructions' }, (value) => ({
        ...value,
        change: requireCanonicalOpenSpecEntityId(value.change, 'changeId'),
      }))
      .with({ kind: 'opsx-archive-instructions' }, (value) => ({
        ...value,
        change: requireCanonicalOpenSpecEntityId(value.change, 'changeId'),
      }))
      .otherwise((value) => value)
  }

  private identity(selector: PlanningCliProjectionSelector): ProjectionWorkIdentity {
    const rootContext = this.currentRootContext()
    const planningRoot = rootContext.planningRoot
    if (!planningRoot) throw new Error('Planning CLI projection requires a resolved Planning root.')
    return {
      projectionKind: 'planning-cli',
      planningRoot: {
        identity: planningRoot.path,
        source: planningRoot.source,
        storeSelector: rootContext.storeId,
      },
      owner: {
        generation: rootContext.generation ?? this.options.gitBindingToken,
        gitBindingToken: null,
      },
      selector: selector.kind,
      inputFingerprint: JSON.stringify(selector),
      protocolVersion: 1,
    }
  }

  private request(
    selector: PlanningCliProjectionSelector
  ): ProjectionWorkRequest<PlanningCliProjectionData, never> {
    return {
      identity: this.identity(selector),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes,
      load: async ({ reportStage }) => {
        const rootContext = this.currentRootContext()
        this.trackDependencies(selector)
        reportStage('root-ready')
        const data = await this.load(selector, rootContext)
        reportStage('leaf-settled')
        return PlanningCliProjectionDataSchema.parse(data)
      },
    }
  }

  private trackDependencies(selector: PlanningCliProjectionSelector): void {
    match(selector)
      .with({ kind: 'spec-catalog' }, { kind: 'spec-document' }, () => {})
      .with(
        { kind: 'opsx-status' },
        { kind: 'opsx-change-list' },
        { kind: 'opsx-status-list' },
        () => this.options.invalidation.track('schemas')
      )
      .with(
        { kind: 'opsx-instructions' },
        { kind: 'opsx-apply-instructions' },
        { kind: 'opsx-archive-instructions' },
        () => this.options.invalidation.track('schemas')
      )
      .with(
        { kind: 'opsx-config-bundle' },
        { kind: 'opsx-templates' },
        { kind: 'opsx-template-contents' },
        () => this.options.invalidation.track('schemas')
      )
      .exhaustive()
  }

  private invalidateSpecObservation(change: StoreObservationChange): void {
    if (change.kind === 'doctor-root') return
    const rootContext = this.currentRootContext()
    const relevantStoreIds = new Set([
      ...(rootContext.storeId ? [rootContext.storeId] : []),
      ...rootContext.references.map((reference) => reference.store_id),
    ])
    const changedStoreIds = change.kind === 'spec-root' ? [change.storeId] : change.storeIds
    if (!changedStoreIds.some((storeId) => relevantStoreIds.has(storeId))) return

    const planningRoot = rootContext.planningRoot
    if (!planningRoot) return
    const generation = rootContext.generation ?? this.options.gitBindingToken
    this.options.workOwner.registry.invalidateMatching(
      (identity) =>
        identity.projectionKind === 'planning-cli' &&
        identity.planningRoot.identity === planningRoot.path &&
        identity.owner.generation === generation &&
        (identity.selector === 'spec-catalog' ||
          identity.selector === 'spec-document' ||
          identity.selector === 'opsx-instructions' ||
          identity.selector === 'opsx-apply-instructions' ||
          identity.selector === 'opsx-archive-instructions'),
      'dependency'
    )
  }

  private currentRootContext(): RootContext {
    return this.options.rootContext instanceof PlanningCliRootContextState
      ? this.options.rootContext.get()
      : this.options.rootContext
  }

  private load(
    selector: PlanningCliProjectionSelector,
    rootContext: RootContext
  ): Promise<PlanningCliProjectionData> {
    const specSource = {
      rootContext,
      documentService: this.options.documentService,
      contracts: this.options.contracts,
    }
    return match(selector)
      .with({ kind: 'opsx-status' }, async ({ change, schema }) => ({
        kind: 'opsx-status' as const,
        value: await this.options.kernel.readStatusProjection(change, schema),
      }))
      .with({ kind: 'opsx-change-list' }, async () => ({
        kind: 'opsx-change-list' as const,
        ...(await this.options.kernel.readChangeListProjection()),
      }))
      .with({ kind: 'opsx-status-list' }, async () => ({
        kind: 'opsx-status-list' as const,
        ...(await this.options.kernel.readStatusListProjection()),
      }))
      .with({ kind: 'opsx-instructions' }, async ({ change, artifact, schema }) => ({
        kind: 'opsx-instructions' as const,
        value: await this.options.kernel.readInstructionsProjection(change, artifact, schema),
      }))
      .with({ kind: 'opsx-apply-instructions' }, async ({ change, schema }) => ({
        kind: 'opsx-apply-instructions' as const,
        value: await this.options.kernel.readApplyInstructionsProjection(change, schema),
      }))
      .with({ kind: 'opsx-archive-instructions' }, async ({ change, schema }) => ({
        kind: 'opsx-archive-instructions' as const,
        rootGeneration: rootContext.generation ?? this.options.gitBindingToken,
        value: await this.options.kernel.readArchiveInstructionsProjection(change, schema),
      }))
      .with({ kind: 'opsx-config-bundle' }, async () => ({
        kind: 'opsx-config-bundle' as const,
        ...(await this.options.kernel.readConfigBundleProjection()),
      }))
      .with({ kind: 'opsx-templates' }, async ({ schema }) => ({
        kind: 'opsx-templates' as const,
        ...(await this.options.kernel.readTemplatesProjection(schema)),
      }))
      .with({ kind: 'opsx-template-contents' }, async ({ schema }) => ({
        kind: 'opsx-template-contents' as const,
        ...(await this.options.kernel.readTemplateContentsProjection(schema)),
      }))
      .with({ kind: 'spec-catalog' }, async () => ({
        kind: 'spec-catalog' as const,
        value: await readSpecCatalog(specSource),
      }))
      .with({ kind: 'spec-document' }, async ({ identity }) => ({
        kind: 'spec-document' as const,
        value: await readSpecDocument(specSource, identity),
      }))
      .exhaustive()
  }
}
