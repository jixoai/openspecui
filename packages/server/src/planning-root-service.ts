/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Own every root-scoped operation and project-Schema mutation for the CLI-selected Planning root.
 * 2. Serialize replacement and issue fresh record/generation provenance without reconstructing root selection.
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
 */
import {
  CliExecutor,
  getRootContextCliSelector,
  OpenSpecAdapter,
  OpsxKernel,
  type CliStreamHandle,
  type ConfigManager,
  type ObservationRootOwner,
  type RootContext,
  type RootContextResolvedState,
  type RuntimeInvalidationReader,
  type RuntimeRootInvalidationOwner,
  type WatcherRootRelease,
} from '@openspecui/core'
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
  createServerProjectionWorkRuntime,
  type ProjectionWorkRuntime,
} from './projection-work/runtime.js'
import { resolveServerRootContext, trackRootContextDependencies } from './root-context-service.js'
import { SchemaMutationService, type SchemaMutationAction } from './schema-mutation-service.js'
import { SearchService } from './search-service.js'
import { readSpecCatalog } from './spec-catalog-service.js'
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
  workflowInvocationService: WorkflowInvocationService
}

interface PlanningRootServiceRecord extends PlanningRootServices {
  identity: string
  schemaMutationService: SchemaMutationService
  hookRuntime: HookRuntime
  observationRelease: Promise<WatcherRootRelease | null>
  projectInvalidationRelease: () => void
  rootContextRef: { current: RootContext }
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
}

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
  /** Run one complete operation while its selected Planning-root record remains alive. */
  runOperation<T>(operation: PlanningRootOperation<T>): Promise<T>
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
  /** Launch-owned Code provenance injected into every Dashboard snapshot projection. */
  codeBinding: import('./launch-git-repository-binding.js').LaunchGitRepositoryBinding
  /** Server-owned regional Dashboard registries shared across replaceable Planning-root records. */
  dashboardProjectionWorkOwner?: DashboardProjectionWorkOwner
  /** Server-owned progressive Change-row registry shared across replaceable Planning-root records. */
  changesProjectionWorkOwner?: ChangesProjectionWorkOwner
}

/** Serialized deep owner for one replaceable Planning-root service record. */
export class PlanningRootServiceManager implements PlanningRootServiceResolver {
  private activeRecord: PlanningRootServiceRecord | null = null
  private currentRootContextSnapshot: CurrentRootContextSnapshot | null = null
  private readonly retiringRecords = new Set<PlanningRootServiceRecord>()
  private transitionTail: Promise<void> = Promise.resolve()
  private disposePromise: Promise<void> | null = null
  private disposed = false
  private readonly dashboardProjectionWorkOwner: DashboardProjectionWorkOwner
  private readonly changesProjectionWorkOwner: ChangesProjectionWorkOwner
  private readonly ownedProjectionWorkRuntime: ProjectionWorkRuntime | null

  constructor(private readonly options: PlanningRootServiceManagerOptions) {
    if (options.dashboardProjectionWorkOwner && options.changesProjectionWorkOwner) {
      this.dashboardProjectionWorkOwner = options.dashboardProjectionWorkOwner
      this.changesProjectionWorkOwner = options.changesProjectionWorkOwner
      this.ownedProjectionWorkRuntime = null
    } else {
      const runtime = createServerProjectionWorkRuntime()
      this.dashboardProjectionWorkOwner =
        options.dashboardProjectionWorkOwner ?? createDashboardProjectionWorkOwner(runtime)
      this.changesProjectionWorkOwner =
        options.changesProjectionWorkOwner ?? createChangesProjectionWorkOwner(runtime)
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
    const rootContextRef = { current: rootContext }
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
          rootContext: rootContextRef.current,
          adapter,
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
        loadSummary: () => loadDashboardSummary({ adapter }),
        loadTrends: () =>
          loadDashboardTrends({ adapter, configManager: this.options.configManager }),
        loadGit: () =>
          loadDashboardGitProjection(
            {
              projectDir: this.options.launchProjectDir,
              codeBindingToken: this.options.codeBinding.bindingToken,
            },
            'projection-work'
          ),
      },
    })
    const changesProjectionService = new ChangesProjectionService({
      workOwner: this.changesProjectionWorkOwner,
      root: {
        path: projectDir,
        source: planningRoot.source,
        storeSelector: rootCliSelector.store ?? null,
        generation: gitBindingToken,
      },
      adapter,
    })
    const filePreviewService = new FilePreviewService(projectDir, this.options.previewAssetsDir)
    const schemaMutationService = new SchemaMutationService({
      planningRoot: projectDir,
      cliExecutor: rootCliExecutor,
      kernel,
    })
    const workflowInvocationService = new WorkflowInvocationService({
      getRootContext: () => rootContextRef.current,
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
      workflowInvocationService,
      rootContextRef,
      activeOperationCount: 0,
      activeStreams: new Set(),
      operationDrainListeners: new Set(),
      disposePromise: null,
    }
  }

  private runTransition<T>(task: () => Promise<T>): Promise<T> {
    const result = this.transitionTail.then(task, task)
    this.transitionTail = result.then(
      () => undefined,
      () => undefined
    )
    return result
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

  private async activate(
    state: RootContextResolvedState
  ): Promise<PlanningRootServiceRecord | null> {
    if (state.state === 'error') {
      const previous = this.activeRecord
      this.activeRecord = null
      if (previous) {
        await this.retireRecord(previous)
      }
      return null
    }

    if (!state.data.planningRoot) {
      throw new Error('Root Context reached ready state without a planning root.')
    }

    const active = this.activeRecord
    if (active?.identity === this.rootIdentity(state.data)) {
      const currentRootContext = { ...state.data, generation: active.gitBindingToken }
      active.rootContext = currentRootContext
      active.rootContextRef.current = currentRootContext
      return active
    }

    this.activeRecord = null
    if (active) {
      await this.retireRecord(active)
    }
    if (this.disposed) throw new Error('Planning-root service manager is disposed.')
    const created = this.createRecord({
      ...state.data,
      generation: state.data.generation ?? randomUUID(),
    })
    this.activeRecord = created
    return created
  }

  private async resolveActiveTransition(reactive: boolean): Promise<{
    state: RootContextResolvedState
    services: PlanningRootServiceRecord | null
  }> {
    if (this.disposed) throw new Error('Planning-root service manager is disposed.')
    const invalidationKey = this.currentRootContextInvalidationKey()
    const cached = this.currentRootContextSnapshot

    // Only reactive display work can replay a validated Root snapshot. Imperative queries, mutations, and
    // PTY operations must re-confirm upstream CLI root selection because that selection can change outside
    // the reactive filesystem invalidation graph.
    if (
      reactive &&
      cached?.invalidationKey === invalidationKey &&
      cached.services === this.activeRecord
    ) {
      if (reactive) {
        await trackRootContextDependencies(
          {
            projectDir: this.options.launchProjectDir,
            cliExecutor: this.options.cliExecutor,
          },
          cached.state
        )
      }
      return { state: cached.state, services: cached.services }
    }

    // A new Root/Store/context generation must never reuse or authorize the prior Root snapshot.
    this.currentRootContextSnapshot = null
    const state = await resolveServerRootContext({
      projectDir: this.options.launchProjectDir,
      cliExecutor: this.options.cliExecutor,
    })
    if (reactive) {
      await trackRootContextDependencies(
        {
          projectDir: this.options.launchProjectDir,
          cliExecutor: this.options.cliExecutor,
        },
        state
      )
    }
    try {
      const services = await this.activate(state)
      if (state.state === 'ready' && services) {
        const resolvedState: Extract<RootContextResolvedState, { state: 'ready' }> = {
          ...state,
          data: services.rootContext,
        }
        // If a dependency changed while CLI resolution or record retirement was in flight, the reactive caller
        // will recompute B. Do not write an A result under B's identity.
        if (reactive && this.currentRootContextInvalidationKey() === invalidationKey) {
          this.currentRootContextSnapshot = {
            invalidationKey,
            state: resolvedState,
            services,
          }
        }
        return {
          state: resolvedState,
          services,
        }
      }
      return { state, services }
    } catch (error) {
      return { state: this.lifecycleErrorState(state, error), services: null }
    }
  }

  private resolveTransition(reactive: boolean): Promise<{
    state: RootContextResolvedState
    services: PlanningRootServiceRecord | null
  }> {
    return this.runTransition(() => this.resolveActiveTransition(reactive))
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

  private acquireOperation(reactive: boolean): Promise<{
    lease: PlanningRootOperationLease
    record: PlanningRootServiceRecord
  }> {
    return this.runTransition(async () => {
      if (this.disposed) throw new Error('Planning-root service manager is disposed.')
      const record = this.requireActiveServices(await this.resolveActiveTransition(reactive))
      if (this.disposed) throw new Error('Planning-root service manager is disposed.')
      return { lease: this.createOperationLease(record), record }
    })
  }

  /** Resolve Root Context only after the active Planning-root lifecycle has converged. */
  async resolveRootContext(): Promise<RootContextResolvedState> {
    return (await this.resolveTransition(false)).state
  }

  /** Resolve reactive Root Context through the same serialized active-record lifecycle. */
  async resolveRootContextReactive(): Promise<RootContextResolvedState> {
    return (await this.resolveTransition(true)).state
  }

  /** Run one complete operation without exposing a durable service handle. */
  async runOperation<T>(operation: PlanningRootOperation<T>): Promise<T> {
    const { lease } = await this.acquireOperation(false)
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
  startOperationStream(operation: PlanningRootStreamOperation): Promise<CliStreamHandle> {
    return this.runTransition(async () => {
      if (this.disposed) throw new Error('Planning-root service manager is disposed.')
      const record = this.requireActiveServices(await this.resolveActiveTransition(false))
      if (this.disposed) throw new Error('Planning-root service manager is disposed.')
      const lease = this.createOperationLease(record)
      try {
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
    })
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
    // A replacement may be waiting on A's lease in transitionTail. Cancel before queuing teardown.
    const cancellation = this.cancelRetiringStreams()
    void cancellation.catch(() => {})
    const teardown = this.runTransition(async () => {
      await cancellation
      for (const record of this.retiringRecords) await this.retireRecord(record)
      this.ownedProjectionWorkRuntime?.clear()
    })
    void teardown.catch(() => {})
    this.disposePromise = cancellation.then(() => teardown)
    return this.disposePromise
  }
}
