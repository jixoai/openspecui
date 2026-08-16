/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Own every root-scoped operation, CLI projection, and project-Schema mutation for the selected Planning root.
 * 2. Single-flight Root resolution outside traced locks, then serialize short generation-checked record commits.
 * 3. Acquire and retire observation/invalidation leases with each active root.
 * 4. Keep reactive subscriptions and current-generation snapshots bound to Root Context dependencies and selection.
 * 5. Revoke leased service capabilities, cancel retiring streams outside blocked transitions, and
 *    dispose every root resource exactly once.
 *
 * Original request (2026-07-15): "One project backend has one launch project and one CLI-selected writable planning root."
 * Original request (2026-07-16): "PlanningRootServiceResolver.mutateSchema(action) owns the entire mutation inside the manager transition lane."
 * Original request (2026-07-17): "An admitted A operation settles before A is retired and B is exposed."
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git repository bindings.
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 * Owner architecture clarification (2026-07-26): "将这些变更信息收集起来作为触发器，更新底层幂等计算的缓存结果。"
 * Built-runtime correction (2026-07-30): retiring a Planning root must retire its buffered CLI children.
 * Original request (2026-07-31): "把所有write-lock打印上时间日志和来源堆栈，使用otel来进行trace。"
 * Owner diagnosis (2026-07-31): readonly cache misses must merge before lock admission, and slow async work must remain outside write locks.
 * Full-gate correction (2026-07-31): imperative snapshots cannot become reactive replay authority before dependency-tracked validation.
 */
import {
  CliExecutor,
  getRootContextCliSelector,
  OpenSpecAdapter,
  OpsxKernel,
  type CliChangeListEntry,
  type CliStreamHandle,
  type ConfigManager,
  type ObservationRootOwner,
  type RootContext,
  type RootContextResolvedState,
  type RuntimeInvalidationReader,
  type RuntimeRootInvalidationOwner,
  type WatcherRootRelease,
} from '@openspecui/core'
import { trace, type Tracer } from '@opentelemetry/api'
import { randomUUID } from 'node:crypto'
import {
  ChangesProjectionService,
  createChangesProjectionWorkOwner,
  type ChangesProjectionServiceContract,
  type ChangesProjectionWorkOwner,
} from './changes-projection-service.js'
import { loadDashboardGitProjection } from './dashboard-git-projection.js'
import { DashboardOverviewService } from './dashboard-overview-service.js'
import { loadDashboardOverview } from './dashboard-overview.js'
import {
  createDashboardProjectionWorkOwner,
  DashboardProjectionService,
  type DashboardProjectionServiceContract,
  type DashboardProjectionWorkOwner,
} from './dashboard-projection-service.js'
import { loadDashboardSummary } from './dashboard-summary.js'
import { loadDashboardTrends } from './dashboard-trends.js'
import { DocumentService } from './document-service.js'
import { buildEntityReadOptions } from './entity-read-options.js'
import { FilePreviewService } from './file-preview-service.js'
import { createHookRuntime, type HookRuntime } from './hook-runtime.js'
import {
  createPlanningCliProjectionWorkOwner,
  PlanningCliProjectionService,
  PlanningCliRootContextState,
  type PlanningCliProjectionWorkOwner,
} from './planning-cli-projection-service.js'
import {
  createServerProjectionWorkRuntime,
  type ProjectionWorkRuntime,
} from './projection-work/runtime.js'
import { AsyncReadWriteLock, createLockTracer } from './read-write-lock.js'
import { resolveServerRootContext, trackRootContextDependencies } from './root-context-service.js'
import { SchemaMutationService, type SchemaMutationAction } from './schema-mutation-service.js'
import { SearchService } from './search-service.js'
import { readSpecCatalog } from './spec-catalog-service.js'
import type { StoreObservationReconciler } from './store-observation-service.js'
import { WorkflowInvocationService } from './workflow-invocation-service.js'

/** Revocable services available only while one Manager-owned Planning-root operation is active. */
export interface PlanningRootServices {
  /** Opaque epoch for Git operations admitted to this exact active Planning-root record. */
  gitBindingToken: string
  rootContext: RootContext
  adapter: OpenSpecAdapter
  documentService: DocumentService
  kernel: OpsxKernel
  filePreviewService: FilePreviewService
  searchService: SearchService
  dashboardOverviewService: DashboardOverviewService
  dashboardProjectionService: DashboardProjectionServiceContract
  changesProjectionService: ChangesProjectionServiceContract
  planningCliProjectionService: PlanningCliProjectionService
  workflowInvocationService: WorkflowInvocationService
}

interface PlanningRootServiceRecord extends PlanningRootServices {
  identity: string
  rootCliExecutor: CliExecutor
  schemaMutationService: SchemaMutationService
  hookRuntime: HookRuntime
  observationRelease: Promise<WatcherRootRelease | null>
  projectInvalidationRelease: () => void
  rootContextValue: PlanningCliRootContextState
  activeOperationCount: number
  activeStreams: Set<CliStreamHandle>
  operationDrainListeners: Set<() => void>
  disposePromise: Promise<void> | null
}

/** A successful Root Context can only replay while its complete runtime invalidation identity remains current. */
interface CurrentRootContextSnapshot {
  invalidationKey: string
  state: Extract<RootContextResolvedState, { state: 'ready' }>
  services: PlanningRootServiceRecord
  reactiveReplayEligible: boolean
}

type PlanningRootTransitionResult =
  | {
      status: 'current'
      state: RootContextResolvedState
      services: PlanningRootServiceRecord | null
    }
  | { status: 'stale' }

interface PlanningRootOperationLease {
  services: PlanningRootServices
  release(): Promise<void>
}

/** Async work admitted against one current Planning-root service record. */
export type PlanningRootOperation<T> = (services: PlanningRootServices) => Promise<T> | T

/** Stream startup admitted against one current Planning-root service record. */
export type PlanningRootStreamOperation = (services: PlanningRootServices) => CliStreamHandle

/** Public operation, stream, Root Context, and preview boundary used by the Server runtime. */
export interface PlanningRootServiceResolver {
  /** Resolve Root Context only after the matching active-record transition settles. */
  resolveRootContext(): Promise<RootContextResolvedState>
  /** Resolve and track reactive Root Context dependencies inside the same serialized transition. */
  resolveRootContextReactive(): Promise<RootContextResolvedState>
  /** Resolve one uncached Root Context attempt for the external Projection Work owner. */
  resolveRootContextProjection?(): Promise<RootContextResolvedState>
  /** Run one complete operation while its selected Planning-root record remains alive. */
  runOperation<T>(operation: PlanningRootOperation<T>, allowStaleCache?: boolean): Promise<T>
  /** Run one complete reactive operation while tracking current root dependencies. */
  runReactiveOperation<T>(operation: PlanningRootOperation<T>): Promise<T>
  /** Retain one operation lease until its settlement-aware stream handle confirms termination. */
  startOperationStream(operation: PlanningRootStreamOperation): Promise<CliStreamHandle>
  /** Mutate one project Schema inside a Manager-owned operation lease. */
  mutateSchema(
    action: SchemaMutationAction
  ): Promise<Awaited<ReturnType<SchemaMutationService['mutate']>>>
  readPreviewRequest(
    hash: string,
    requestPath: string
  ): ReturnType<FilePreviewService['readPreviewRequest']>
  dispose(): Promise<void>
}

/** Root resolution failure that retains the complete failed Root Context state. */
export class PlanningRootUnavailableError extends Error {
  readonly state: Extract<RootContextResolvedState, { state: 'error' }>

  constructor(state: Extract<RootContextResolvedState, { state: 'error' }>) {
    super(state.error.message)
    this.name = 'PlanningRootUnavailableError'
    this.state = state
  }
}

/** Runtime dependencies required to own one serialized active Planning root. */
export interface PlanningRootServiceManagerOptions {
  launchProjectDir: string
  previewAssetsDir: string
  configManager: ConfigManager
  cliExecutor: CliExecutor
  observationEnvironment: ObservationRootOwner
  projectInvalidation: RuntimeRootInvalidationOwner
  runtimeInvalidation: RuntimeInvalidationReader
  storeObservation: Pick<StoreObservationReconciler, 'subscribe'>
  /** Launch-owned Code provenance injected into every Dashboard snapshot projection. */
  codeBinding: import('./launch-git-repository-binding.js').LaunchGitRepositoryBinding
  /** Server-owned regional Dashboard registries shared across replaceable Planning-root records. */
  dashboardProjectionWorkOwner?: DashboardProjectionWorkOwner
  /** Server-owned progressive Change-row registry shared across replaceable Planning-root records. */
  changesProjectionWorkOwner?: ChangesProjectionWorkOwner
  /** Server-owned selector-exact Planning CLI registry shared across replaceable root records. */
  planningCliProjectionWorkOwner?: PlanningCliProjectionWorkOwner
  /** Server tracer used to connect lock waits to their parent tRPC/projection trace. */
  tracer?: Tracer
}

/** Serialized deep owner for one replaceable Planning-root service record. */
/** Read CLI Change-list task facts once per call; failures degrade to an empty index. */
function readCliChangeListEntriesFor(
  service: PlanningCliProjectionService
): () => Promise<Map<string, CliChangeListEntry>> {
  return async () => {
    try {
      const data = await service.getCurrent({ kind: 'opsx-change-list' })
      if (data.kind !== 'opsx-change-list') return new Map()
      return new Map(data.entries.map((entry) => [entry.name, entry]))
    } catch {
      return new Map()
    }
  }
}

export class PlanningRootServiceManager implements PlanningRootServiceResolver {
  private activeRecord: PlanningRootServiceRecord | null = null
  private currentRootContextSnapshot: CurrentRootContextSnapshot | null = null
  private readonly retiringRecords = new Set<PlanningRootServiceRecord>()
  private readonly rootTransitionFlights = new Map<string, Promise<PlanningRootTransitionResult>>()
  private rootTransitionCommitTail: Promise<void> = Promise.resolve()
  private readonly transitionLock: AsyncReadWriteLock
  private disposePromise: Promise<void> | null = null
  private disposed = false
  private readonly dashboardProjectionWorkOwner: DashboardProjectionWorkOwner
  private readonly changesProjectionWorkOwner: ChangesProjectionWorkOwner
  private readonly planningCliProjectionWorkOwner: PlanningCliProjectionWorkOwner
  private readonly ownedProjectionWorkRuntime: ProjectionWorkRuntime | null

  constructor(private readonly options: PlanningRootServiceManagerOptions) {
    this.transitionLock = new AsyncReadWriteLock({
      name: 'planning-root-transition',
      tracer: createLockTracer(options.tracer ?? trace.getTracer('openspecui-server')),
    })
    if (
      options.dashboardProjectionWorkOwner &&
      options.changesProjectionWorkOwner &&
      options.planningCliProjectionWorkOwner
    ) {
      this.dashboardProjectionWorkOwner = options.dashboardProjectionWorkOwner
      this.changesProjectionWorkOwner = options.changesProjectionWorkOwner
      this.planningCliProjectionWorkOwner = options.planningCliProjectionWorkOwner
      this.ownedProjectionWorkRuntime = null
    } else {
      const runtime = createServerProjectionWorkRuntime()
      this.dashboardProjectionWorkOwner =
        options.dashboardProjectionWorkOwner ?? createDashboardProjectionWorkOwner(runtime)
      this.changesProjectionWorkOwner =
        options.changesProjectionWorkOwner ?? createChangesProjectionWorkOwner(runtime)
      this.planningCliProjectionWorkOwner =
        options.planningCliProjectionWorkOwner ?? createPlanningCliProjectionWorkOwner(runtime)
      this.ownedProjectionWorkRuntime = runtime
    }
  }

  /** Track every generation that can change the CLI-selected Root Context and serialize it as a cache key. */
  private currentRootContextInvalidationKey(): string {
    return this.options.runtimeInvalidation
      .track('project', 'stores', 'context')
      .map(({ facet, generation }) => `${facet}:${generation}`)
      .join('|')
  }

  private createRecord(rootContext: RootContext): PlanningRootServiceRecord {
    const planningRoot = rootContext.planningRoot
    if (!planningRoot) {
      throw new Error('Cannot create planning-root services without a resolved root.')
    }

    const projectDir = planningRoot.path
    const rootContextValue = new PlanningCliRootContextState(rootContext)
    const adapter = new OpenSpecAdapter(projectDir)
    // Schema CLI commands resolve project-local schema paths from cwd and accept no Store selector.
    const rootCliExecutor = new CliExecutor(this.options.configManager, projectDir)
    const hookRuntime = createHookRuntime(projectDir)
    const rootCliSelector = getRootContextCliSelector(rootContext)
    const gitBindingToken = rootContext.generation ?? randomUUID()
    const kernel = new OpsxKernel(
      projectDir,
      rootCliExecutor,
      this.options.runtimeInvalidation,
      rootCliSelector
    )
    const documentService = new DocumentService(projectDir, adapter, hookRuntime)
    const entityReadOptionsContext = { adapter, kernel }
    const searchService = new SearchService(
      adapter,
      undefined,
      undefined,
      documentService,
      (stage, id) => buildEntityReadOptions(entityReadOptionsContext, stage, id),
      async () => {
        const catalog = await readSpecCatalog({
          rootContext: rootContextValue.get(),
          documentService,
          contracts: this.options.cliExecutor.contracts,
        })
        return catalog.entries.filter((entry) => entry.source === 'referenced')
      }
    )
    const dashboardOverviewService = new DashboardOverviewService((reason) =>
      loadDashboardOverview(
        {
          adapter,
          configManager: this.options.configManager,
          projectDir: this.options.launchProjectDir,
          codeBindingToken: this.options.codeBinding.bindingToken,
        },
        reason
      )
    )
    const dashboardProjectionService = new DashboardProjectionService({
      workOwner: this.dashboardProjectionWorkOwner,
      root: {
        path: projectDir,
        source: planningRoot.source,
        storeSelector: rootCliSelector.store ?? null,
        generation: gitBindingToken,
      },
      codeGitBindingToken: this.options.codeBinding.bindingToken,
      loaders: {
        loadSummary: () =>
          loadDashboardSummary({
            adapter,
            readCliChangeListEntries: readCliChangeListEntriesFor(planningCliProjectionService),
          }),
        loadTrends: () =>
          loadDashboardTrends({ adapter, configManager: this.options.configManager }),
        loadGit: (signal) =>
          loadDashboardGitProjection(
            {
              projectDir: this.options.launchProjectDir,
              codeBindingToken: this.options.codeBinding.bindingToken,
            },
            'projection-work',
            signal
          ),
      },
    })
    const planningCliProjectionService = new PlanningCliProjectionService({
      rootContext: rootContextValue,
      gitBindingToken,
      kernel,
      documentService,
      contracts: this.options.cliExecutor.contracts,
      invalidation: this.options.runtimeInvalidation,
      storeObservation: this.options.storeObservation,
      workOwner: this.planningCliProjectionWorkOwner,
    })
    const changesProjectionService = new ChangesProjectionService({
      workOwner: this.changesProjectionWorkOwner,
      root: {
        path: projectDir,
        source: planningRoot.source,
        storeSelector: rootCliSelector.store ?? null,
        generation: gitBindingToken,
      },
      // The CLI list projection is the task-count authority for list rows; it is read once
      // per projection load and a missing CLI list leaves rows null, never backfilled.
      adapter: {
        listChanges: () => adapter.listChanges(),
        readChangeMeta: (id: string) => adapter.readChangeMeta(id),
        readCliChangeListEntries: async () => {
          try {
            const data = await planningCliProjectionService.getCurrent({
              kind: 'opsx-change-list',
            })
            if (data.kind !== 'opsx-change-list') return new Map()
            return new Map(data.entries.map((entry) => [entry.name, entry]))
          } catch {
            return new Map()
          }
        },
      },
    })
    const filePreviewService = new FilePreviewService(projectDir, this.options.previewAssetsDir)
    const schemaMutationService = new SchemaMutationService({
      planningRoot: projectDir,
      cliExecutor: rootCliExecutor,
      kernel,
    })
    const workflowInvocationService = new WorkflowInvocationService({
      getRootContext: () => rootContextValue.get(),
      rootGeneration: gitBindingToken,
      hookRuntime,
      contracts: this.options.cliExecutor.contracts,
    })
    const projectInvalidationRelease = this.options.projectInvalidation.acquireRoot(projectDir)
    const observationRelease = Promise.resolve()
      .then(() => this.options.observationEnvironment.acquireRoot(projectDir))
      .catch((error: unknown) => {
        console.error(`Planning-root observation failed for ${projectDir}:`, error)
        return null
      })

    return {
      identity: this.rootIdentity(rootContext),
      rootCliExecutor,
      gitBindingToken,
      schemaMutationService,
      rootContext,
      adapter,
      documentService,
      kernel,
      hookRuntime,
      observationRelease,
      projectInvalidationRelease,
      filePreviewService,
      searchService,
      dashboardOverviewService,
      dashboardProjectionService,
      changesProjectionService,
      planningCliProjectionService,
      workflowInvocationService,
      rootContextValue,
      activeOperationCount: 0,
      activeStreams: new Set(),
      operationDrainListeners: new Set(),
      disposePromise: null,
    }
  }

  /** Run one short state commit under the exclusive transition lock. */
  private runWriteTransition<T>(source: string, task: () => Promise<T> | T): Promise<T> {
    return this.transitionLock.withWriteLock(
      { source, stack: new Error(`Write lock source: ${source}`).stack ?? source },
      task
    )
  }

  /**
   * Run `task` under a shared (read) lock. Used for cache-hit fast paths where only
   * `activeRecord` and `currentRootContextSnapshot` are read. Multiple read transitions
   * run concurrently; a pending writer blocks new readers.
   */
  private runReadTransition<T>(source: string, task: () => Promise<T> | T): Promise<T> {
    return this.transitionLock.withReadLock(
      { source, stack: new Error(`Read lock source: ${source}`).stack ?? source },
      task
    )
  }

  private async disposeRecord(record: PlanningRootServiceRecord): Promise<void> {
    if (record.disposePromise) return record.disposePromise
    record.disposePromise = (async () => {
      const results = await Promise.allSettled([
        Promise.resolve().then(() => record.filePreviewService.dispose()),
        Promise.resolve().then(() => record.projectInvalidationRelease()),
        Promise.resolve().then(() => record.kernel.dispose()),
        Promise.resolve().then(() => record.dashboardOverviewService.dispose()),
        Promise.resolve().then(() => record.dashboardProjectionService.dispose()),
        Promise.resolve().then(() => record.changesProjectionService.dispose()),
        Promise.resolve().then(() => record.planningCliProjectionService.dispose()),
        Promise.resolve().then(() => record.rootCliExecutor.dispose()),
        record.hookRuntime.dispose(),
        record.searchService.dispose(),
        record.observationRelease.then((releaseObservationRoot) => releaseObservationRoot?.()),
      ])
      const failures = results.flatMap((result) =>
        result.status === 'rejected' ? [result.reason] : []
      )
      if (failures.length > 0) {
        throw new AggregateError(failures, 'Planning-root service teardown failed.')
      }
    })()
    return record.disposePromise
  }

  private async waitForOperations(record: PlanningRootServiceRecord): Promise<void> {
    if (record.activeOperationCount === 0) return
    await new Promise<void>((resolve) => {
      record.operationDrainListeners.add(resolve)
    })
  }

  private async retireRecord(record: PlanningRootServiceRecord): Promise<void> {
    this.retiringRecords.add(record)
    await this.waitForOperations(record)
    await this.disposeRecord(record)
    this.retiringRecords.delete(record)
  }

  private cancelRetiringStreams(): Promise<void> {
    const streams = new Set<CliStreamHandle>()
    for (const record of this.retiringRecords) {
      for (const stream of record.activeStreams) streams.add(stream)
    }
    const active = this.activeRecord
    if (active) {
      for (const stream of active.activeStreams) streams.add(stream)
    }

    return Promise.allSettled([...streams].map((stream) => stream.cancel())).then((results) => {
      const failures = results.flatMap((result) =>
        result.status === 'rejected' ? [result.reason] : []
      )
      if (failures.length > 0) {
        throw new AggregateError(failures, 'Planning-root stream termination failed.')
      }
    })
  }

  private createOperationLease(record: PlanningRootServiceRecord): PlanningRootOperationLease {
    record.activeOperationCount += 1
    let acceptingCalls = true
    let releasePromise: Promise<void> | null = null
    const pendingCalls = new Set<Promise<unknown>>()

    const assertActive = () => {
      if (!acceptingCalls) {
        throw new Error('Planning-root operation capability is no longer active.')
      }
    }
    const trackCall = (value: unknown): unknown => {
      if (
        !value ||
        (typeof value !== 'object' && typeof value !== 'function') ||
        typeof (value as PromiseLike<unknown>).then !== 'function'
      ) {
        return value
      }
      const tracked = Promise.resolve(value).finally(() => pendingCalls.delete(tracked))
      pendingCalls.add(tracked)
      void tracked.catch(() => {})
      return tracked
    }
    const guardCapability = <T extends object>(capability: T): T =>
      new Proxy(capability, {
        get(target, property) {
          assertActive()
          const value = Reflect.get(target, property, target)
          if (typeof value !== 'function') return value
          return (...args: unknown[]) => {
            assertActive()
            return trackCall(Reflect.apply(value, target, args))
          }
        },
      })

    const services: PlanningRootServices = {
      gitBindingToken: record.gitBindingToken,
      rootContext: record.rootContext,
      adapter: guardCapability(record.adapter),
      documentService: guardCapability(record.documentService),
      kernel: guardCapability(record.kernel),
      filePreviewService: guardCapability(record.filePreviewService),
      searchService: guardCapability(record.searchService),
      dashboardOverviewService: guardCapability(record.dashboardOverviewService),
      dashboardProjectionService: guardCapability(record.dashboardProjectionService),
      changesProjectionService: guardCapability(record.changesProjectionService),
      planningCliProjectionService: guardCapability(record.planningCliProjectionService),
      workflowInvocationService: guardCapability(record.workflowInvocationService),
    }

    return {
      services,
      release: () => {
        if (releasePromise) return releasePromise
        acceptingCalls = false
        const finish = () => {
          record.activeOperationCount -= 1
          if (record.activeOperationCount !== 0) return
          for (const listener of record.operationDrainListeners) listener()
          record.operationDrainListeners.clear()
        }
        if (pendingCalls.size === 0) {
          finish()
          releasePromise = Promise.resolve()
          return releasePromise
        }
        releasePromise = Promise.allSettled(pendingCalls).then(finish)
        return releasePromise
      },
    }
  }

  private rootIdentity(rootContext: RootContext): string {
    const planningRoot = rootContext.planningRoot
    if (!planningRoot) {
      throw new Error('Cannot identify planning-root services without a resolved root.')
    }
    return JSON.stringify({
      path: planningRoot.path,
      source: planningRoot.source,
      storeId: rootContext.storeId,
      dataScopePath: rootContext.dataScope.path,
      dataScopeSource: rootContext.dataScope.source,
    })
  }

  private lifecycleErrorState(
    state: RootContextResolvedState,
    error: unknown
  ): Extract<RootContextResolvedState, { state: 'error' }> {
    const attempt = state.state === 'ready' ? state.data : state.attempt
    const message = error instanceof Error ? error.message : String(error)
    return {
      state: 'error',
      data: null,
      attempt,
      error: {
        code: 'resolver-failed',
        message: `Planning-root lifecycle transition failed: ${message}`,
      },
      observedAt: attempt.observedAt,
    }
  }

  private traceRootContextCacheHit(): void {
    const tracer = this.options.tracer ?? trace.getTracer('openspecui-server')
    tracer.startActiveSpan('planningRoot.resolveRootContext', (span) => {
      span.setAttribute('rootContext.cacheHit', true)
      span.end()
    })
  }

  private resolvedStateForRecord(
    state: Extract<RootContextResolvedState, { state: 'ready' }>,
    record: PlanningRootServiceRecord
  ): Extract<RootContextResolvedState, { state: 'ready' }> {
    return { ...state, data: record.rootContext }
  }

  private enqueueRootTransitionCommit<T>(task: () => Promise<T>): Promise<T> {
    const result = this.rootTransitionCommitTail.then(task, task)
    this.rootTransitionCommitTail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private getRootTransition(invalidationKey: string): {
    transition: Promise<PlanningRootTransitionResult>
    joined: boolean
  } {
    const existing = this.rootTransitionFlights.get(invalidationKey)
    if (existing) return { transition: existing, joined: true }

    const transition = this.resolveAndCommitRootTransition(invalidationKey)
    this.rootTransitionFlights.set(invalidationKey, transition)
    const clear = () => {
      if (this.rootTransitionFlights.get(invalidationKey) === transition) {
        this.rootTransitionFlights.delete(invalidationKey)
      }
    }
    void transition.then(clear, clear)
    return { transition, joined: false }
  }

  private awaitRootTransition(invalidationKey: string): Promise<PlanningRootTransitionResult> {
    const tracer = this.options.tracer ?? trace.getTracer('openspecui-server')
    return tracer.startActiveSpan('planningRoot.transition.wait', async (span) => {
      const { transition, joined } = this.getRootTransition(invalidationKey)
      span.setAttribute('rootContext.invalidationKey', invalidationKey)
      span.setAttribute('rootContext.singleFlight.joined', joined)
      try {
        const result = await transition
        span.setAttribute('rootContext.transition.status', result.status)
        return result
      } finally {
        span.end()
      }
    })
  }

  private async resolveAndCommitRootTransition(
    invalidationKey: string
  ): Promise<PlanningRootTransitionResult> {
    if (this.disposed) throw new Error('Planning-root service manager is disposed.')
    const tracer = this.options.tracer ?? trace.getTracer('openspecui-server')
    const state = await tracer.startActiveSpan('planningRoot.resolveRootContext', async (span) => {
      span.setAttribute('rootContext.cacheHit', false)
      span.setAttribute('rootContext.invalidationKey', invalidationKey)
      try {
        return await resolveServerRootContext({
          projectDir: this.options.launchProjectDir,
          cliExecutor: this.options.cliExecutor,
        })
      } finally {
        span.end()
      }
    })
    try {
      return await this.enqueueRootTransitionCommit(() =>
        this.commitRootTransition(invalidationKey, state)
      )
    } catch (error) {
      return {
        status: 'current',
        state: this.lifecycleErrorState(state, error),
        services: null,
      }
    }
  }

  private async commitRootTransition(
    invalidationKey: string,
    state: RootContextResolvedState
  ): Promise<PlanningRootTransitionResult> {
    if (this.disposed) throw new Error('Planning-root service manager is disposed.')
    if (this.currentRootContextInvalidationKey() !== invalidationKey) return { status: 'stale' }

    if (state.state === 'error') {
      const detached = await this.runWriteTransition('root-transition.commit', () => {
        if (this.disposed) throw new Error('Planning-root service manager is disposed.')
        if (this.currentRootContextInvalidationKey() !== invalidationKey) {
          return { status: 'stale' as const, record: null }
        }
        const record = this.activeRecord
        this.activeRecord = null
        this.currentRootContextSnapshot = null
        if (record) this.retiringRecords.add(record)
        return { status: 'current' as const, record }
      })
      if (detached.status === 'stale') return detached
      if (detached.record) await this.retireRecord(detached.record)
      if (this.currentRootContextInvalidationKey() !== invalidationKey) return { status: 'stale' }
      return { status: 'current', state, services: null }
    }

    if (!state.data.planningRoot) {
      return {
        status: 'current',
        state: this.lifecycleErrorState(
          state,
          'Root Context reached ready state without a planning root.'
        ),
        services: null,
      }
    }

    const identity = this.rootIdentity(state.data)
    const active = this.activeRecord
    if (active?.identity === identity) {
      return this.runWriteTransition('root-transition.commit', () => {
        if (this.disposed) throw new Error('Planning-root service manager is disposed.')
        if (this.currentRootContextInvalidationKey() !== invalidationKey) {
          return { status: 'stale' as const }
        }
        if (this.activeRecord !== active) return { status: 'stale' as const }
        const currentRootContext = { ...state.data, generation: active.gitBindingToken }
        active.rootContext = currentRootContext
        active.rootContextValue.set(currentRootContext)
        const resolvedState = this.resolvedStateForRecord(state, active)
        this.currentRootContextSnapshot = {
          invalidationKey,
          state: resolvedState,
          services: active,
          reactiveReplayEligible: false,
        }
        return { status: 'current' as const, state: resolvedState, services: active }
      })
    }

    if (active) {
      const detached = await this.runWriteTransition('root-transition.detach', () => {
        if (this.disposed) throw new Error('Planning-root service manager is disposed.')
        if (this.currentRootContextInvalidationKey() !== invalidationKey) return false
        if (this.activeRecord !== active) return false
        this.activeRecord = null
        this.currentRootContextSnapshot = null
        this.retiringRecords.add(active)
        return true
      })
      if (!detached) return { status: 'stale' }
      await this.retireRecord(active)
      if (this.currentRootContextInvalidationKey() !== invalidationKey) return { status: 'stale' }
    }

    if (this.disposed) throw new Error('Planning-root service manager is disposed.')
    let created: PlanningRootServiceRecord
    try {
      created = this.createRecord({
        ...state.data,
        generation: state.data.generation ?? randomUUID(),
      })
    } catch (error) {
      return { status: 'current', state: this.lifecycleErrorState(state, error), services: null }
    }

    let committed: boolean
    try {
      committed = await this.runWriteTransition('root-transition.commit', () => {
        if (this.disposed) throw new Error('Planning-root service manager is disposed.')
        if (this.currentRootContextInvalidationKey() !== invalidationKey) return false
        if (this.activeRecord !== null) return false
        this.activeRecord = created
        const resolvedState = this.resolvedStateForRecord(state, created)
        this.currentRootContextSnapshot = {
          invalidationKey,
          state: resolvedState,
          services: created,
          reactiveReplayEligible: false,
        }
        return true
      })
    } catch (error) {
      await this.retireRecord(created)
      throw error
    }
    if (!committed) {
      await this.retireRecord(created)
      return { status: 'stale' }
    }
    return {
      status: 'current',
      state: this.resolvedStateForRecord(state, created),
      services: created,
    }
  }

  private readCurrentSnapshot(invalidationKey: string): Promise<CurrentRootContextSnapshot | null> {
    return this.runReadTransition('root-transition.cache-check', () => {
      if (this.disposed) throw new Error('Planning-root service manager is disposed.')
      const cached = this.currentRootContextSnapshot
      if (cached?.invalidationKey !== invalidationKey || cached.services !== this.activeRecord) {
        return null
      }
      return cached
    })
  }

  private async trackReactiveRootContext(state: RootContextResolvedState): Promise<void> {
    await trackRootContextDependencies({ projectDir: this.options.launchProjectDir }, state)
  }

  private promoteReactiveSnapshot(
    invalidationKey: string,
    services: PlanningRootServiceRecord | null
  ): void {
    const snapshot = this.currentRootContextSnapshot
    if (
      !services ||
      snapshot?.invalidationKey !== invalidationKey ||
      snapshot.services !== services ||
      this.activeRecord !== services
    ) {
      return
    }
    snapshot.reactiveReplayEligible = true
  }

  private async resolveTransition(
    reactive: boolean,
    useRuntimeInvalidationCache = true,
    allowStaleCache = false
  ): Promise<{
    state: RootContextResolvedState
    services: PlanningRootServiceRecord | null
  }> {
    const cacheEligible = reactive || allowStaleCache
    while (true) {
      if (this.disposed) throw new Error('Planning-root service manager is disposed.')
      const invalidationKey = this.currentRootContextInvalidationKey()
      if (useRuntimeInvalidationCache && cacheEligible) {
        const cached = await this.readCurrentSnapshot(invalidationKey)
        if (cached && (!reactive || cached.reactiveReplayEligible)) {
          this.traceRootContextCacheHit()
          if (reactive) await this.trackReactiveRootContext(cached.state)
          return { state: cached.state, services: cached.services }
        }
      }

      const transition = await this.awaitRootTransition(invalidationKey)
      if (transition.status === 'stale') continue
      if (reactive) {
        await this.trackReactiveRootContext(transition.state)
        this.promoteReactiveSnapshot(invalidationKey, transition.services)
      }
      return transition
    }
  }

  private requireActiveServices(result: {
    state: RootContextResolvedState
    services: PlanningRootServiceRecord | null
  }): PlanningRootServiceRecord {
    if (result.state.state === 'error' || !result.services) {
      throw new PlanningRootUnavailableError(
        result.state.state === 'error'
          ? result.state
          : this.lifecycleErrorState(result.state, 'Planning-root services are unavailable.')
      )
    }
    return result.services
  }

  private async acquireOperation(
    reactive: boolean,
    allowStaleCache = false
  ): Promise<{
    lease: PlanningRootOperationLease
    record: PlanningRootServiceRecord
  }> {
    const cacheEligible = reactive || allowStaleCache
    let acceptNewerSnapshot = false
    while (true) {
      const invalidationKey = this.currentRootContextInvalidationKey()
      const cached =
        cacheEligible || acceptNewerSnapshot
          ? await this.runReadTransition('acquire-operation.cache-check', () => {
              if (this.disposed) throw new Error('Planning-root service manager is disposed.')
              const snapshot = this.currentRootContextSnapshot
              if (
                snapshot?.invalidationKey !== invalidationKey ||
                snapshot.services !== this.activeRecord ||
                (reactive && !snapshot.reactiveReplayEligible)
              ) {
                return null
              }
              return {
                state: snapshot.state,
                lease: this.createOperationLease(snapshot.services),
                record: snapshot.services,
              }
            })
          : null
      if (cached) {
        try {
          this.traceRootContextCacheHit()
          if (reactive) await this.trackReactiveRootContext(cached.state)
          return { lease: cached.lease, record: cached.record }
        } catch (error) {
          await cached.lease.release()
          throw error
        }
      }

      const transition = await this.awaitRootTransition(invalidationKey)
      if (transition.status === 'stale') {
        acceptNewerSnapshot = true
        continue
      }
      const admitted = await this.runReadTransition('acquire-operation.commit', () => {
        if (this.disposed) throw new Error('Planning-root service manager is disposed.')
        if (this.currentRootContextInvalidationKey() !== invalidationKey) return null
        const record = this.requireActiveServices(transition)
        if (this.activeRecord !== record) return null
        return { lease: this.createOperationLease(record), record }
      })
      if (!admitted) continue
      try {
        if (reactive) {
          await this.trackReactiveRootContext(transition.state)
          this.promoteReactiveSnapshot(invalidationKey, admitted.record)
        }
        return admitted
      } catch (error) {
        await admitted.lease.release()
        throw error
      }
    }
  }

  /** Resolve Root Context only after the active Planning-root lifecycle has converged. */
  async resolveRootContext(): Promise<RootContextResolvedState> {
    return (await this.resolveTransition(false)).state
  }

  /** Resolve reactive Root Context through the same serialized active-record lifecycle. */
  async resolveRootContextReactive(): Promise<RootContextResolvedState> {
    return (await this.resolveTransition(true)).state
  }

  /** Resolve one exact attempt; Projection Work owns sharing, retention, and replacement. */
  async resolveRootContextProjection(): Promise<RootContextResolvedState> {
    return (await this.resolveTransition(true, false)).state
  }

  /** Run one complete operation without exposing a durable service handle. */
  async runOperation<T>(operation: PlanningRootOperation<T>, allowStaleCache = false): Promise<T> {
    const { lease } = await this.acquireOperation(false, allowStaleCache)
    try {
      return await operation(lease.services)
    } finally {
      await lease.release()
    }
  }

  /** Run one complete reactive operation without exposing a durable service handle. */
  async runReactiveOperation<T>(operation: PlanningRootOperation<T>): Promise<T> {
    const { lease } = await this.acquireOperation(true)
    try {
      return await operation(lease.services)
    } finally {
      await lease.release()
    }
  }

  /** Retain a revocable operation capability until the child process actually settles. */
  async startOperationStream(operation: PlanningRootStreamOperation): Promise<CliStreamHandle> {
    const { lease, record } = await this.acquireOperation(false)
    try {
      if (this.disposed) throw new Error('Planning-root service manager is disposed.')
      const stream = operation(lease.services)
      let managedStream: CliStreamHandle
      const settled = stream.settled.then(async (settlement) => {
        await lease.release()
        record.activeStreams.delete(managedStream)
        return settlement
      })
      let cancelRequested = false
      managedStream = {
        settled,
        cancel: () => {
          if (!cancelRequested) {
            cancelRequested = true
            void stream.cancel().catch(() => {})
          }
          return settled
        },
      }
      record.activeStreams.add(managedStream)
      void settled.catch(() => {})
      return managedStream
    } catch (error) {
      await lease.release()
      throw error
    }
  }

  /** Run one Schema action inside the same operation-lifetime contract as every Router caller. */
  async mutateSchema(
    action: SchemaMutationAction
  ): Promise<Awaited<ReturnType<SchemaMutationService['mutate']>>> {
    const { lease, record } = await this.acquireOperation(false)
    try {
      return await record.schemaMutationService.mutate(action)
    } finally {
      await lease.release()
    }
  }

  readPreviewRequest(
    hash: string,
    requestPath: string
  ): ReturnType<FilePreviewService['readPreviewRequest']> {
    return this.activeRecord?.filePreviewService.readPreviewRequest(hash, requestPath) ?? null
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise
    this.disposed = true
    this.currentRootContextSnapshot = null
    const active = this.activeRecord
    if (active) {
      this.activeRecord = null
      this.retiringRecords.add(active)
    }
    // Cancel admitted children first; pending Root resolution and record retirement never hold the lock.
    const cancellation = this.cancelRetiringStreams()
    void cancellation.catch(() => {})
    const teardown = cancellation.then(async () => {
      await Promise.allSettled(this.rootTransitionFlights.values())
      await this.rootTransitionCommitTail
      for (const record of this.retiringRecords) await this.retireRecord(record)
      this.ownedProjectionWorkRuntime?.clear()
    })
    void teardown.catch(() => {})
    this.disposePromise = cancellation.then(() => teardown)
    return this.disposePromise
  }
}
