/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Own every root-scoped service and project-Schema mutation for the CLI-selected Planning root.
 * 2. Serialize one active-root replacement lifecycle without reconstructing root selection.
 * 3. Acquire and retire observation/invalidation leases with each active root.
 * 4. Keep reactive subscriptions bound to Root Context dependencies and current root selection.
 * 5. Dispose Kernel, hooks, Search, Dashboard, and preview resources exactly once.
 *
 * Original request (2026-07-15): "One project backend has one launch project and one CLI-selected writable planning root."
 * Original request (2026-07-16): "PlanningRootServiceResolver.mutateSchema(action) owns the entire mutation inside the manager transition lane."
 */
import {
  CliExecutor,
  getRootContextCliSelector,
  OpenSpecAdapter,
  OpsxKernel,
  type ConfigManager,
  type ObservationRootOwner,
  type RootContext,
  type RootContextResolvedState,
  type RuntimeInvalidationReader,
  type RuntimeRootInvalidationOwner,
  type WatcherRootRelease,
} from '@openspecui/core'
import { DashboardOverviewService } from './dashboard-overview-service.js'
import { loadDashboardOverview } from './dashboard-overview.js'
import { DocumentService } from './document-service.js'
import { buildEntityReadOptions } from './entity-read-options.js'
import { FilePreviewService } from './file-preview-service.js'
import { createHookRuntime, type HookRuntime } from './hook-runtime.js'
import { resolveServerRootContext, trackRootContextDependencies } from './root-context-service.js'
import { SchemaMutationService, type SchemaMutationAction } from './schema-mutation-service.js'
import { SearchService } from './search-service.js'
import { readSpecCatalog } from './spec-catalog-service.js'
import { WorkflowInvocationService } from './workflow-invocation-service.js'

/** Services whose filesystem meaning belongs to the currently selected Planning root. */
export interface PlanningRootServices {
  rootContext: RootContext
  adapter: OpenSpecAdapter
  documentService: DocumentService
  kernel: OpsxKernel
  filePreviewService: FilePreviewService
  searchService: SearchService
  dashboardOverviewService: DashboardOverviewService
  workflowInvocationService: WorkflowInvocationService
}

interface PlanningRootServiceRecord extends PlanningRootServices {
  identity: string
  schemaMutationService: SchemaMutationService
  hookRuntime: HookRuntime
  observationRelease: Promise<WatcherRootRelease | null>
  projectInvalidationRelease: () => void
  rootContextRef: { current: RootContext }
  disposePromise: Promise<void> | null
}

/** Public active-root resolver and preview lifecycle boundary used by the Server router. */
export interface PlanningRootServiceResolver {
  /** Resolve Root Context only after the matching active-record transition settles. */
  resolveRootContext(): Promise<RootContextResolvedState>
  /** Resolve and track reactive Root Context dependencies inside the same serialized transition. */
  resolveRootContextReactive(): Promise<RootContextResolvedState>
  resolve(): Promise<PlanningRootServices>
  resolveReactive(): Promise<PlanningRootServices>
  /** Mutate one project Schema while the selected Planning-root transition remains exclusively owned. */
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
}

/** Serialized deep owner for one replaceable Planning-root service record. */
export class PlanningRootServiceManager implements PlanningRootServiceResolver {
  private activeRecord: PlanningRootServiceRecord | null = null
  private transitionTail: Promise<void> = Promise.resolve()
  private disposePromise: Promise<void> | null = null
  private disposed = false

  constructor(private readonly options: PlanningRootServiceManagerOptions) {}

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
    const kernel = new OpsxKernel(
      projectDir,
      rootCliExecutor,
      this.options.runtimeInvalidation,
      getRootContextCliSelector(rootContext)
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
        },
        reason
      )
    )
    const filePreviewService = new FilePreviewService(projectDir, this.options.previewAssetsDir)
    const schemaMutationService = new SchemaMutationService({
      planningRoot: projectDir,
      cliExecutor: rootCliExecutor,
      kernel,
    })
    const workflowInvocationService = new WorkflowInvocationService({
      getRootContext: () => rootContextRef.current,
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
      workflowInvocationService,
      rootContextRef,
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
      if (previous) await this.disposeRecord(previous)
      return null
    }

    if (!state.data.planningRoot) {
      throw new Error('Root Context reached ready state without a planning root.')
    }

    const active = this.activeRecord
    if (active?.identity === this.rootIdentity(state.data)) {
      active.rootContext = state.data
      active.rootContextRef.current = state.data
      return active
    }

    this.activeRecord = null
    if (active) await this.disposeRecord(active)
    const created = this.createRecord(state.data)
    this.activeRecord = created
    return created
  }

  private async resolveActiveTransition(reactive: boolean): Promise<{
    state: RootContextResolvedState
    services: PlanningRootServiceRecord | null
  }> {
    if (this.disposed) throw new Error('Planning-root service manager is disposed.')
    if (reactive) {
      this.options.runtimeInvalidation.track('project', 'context')
    }
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
      return { state, services: await this.activate(state) }
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

  /** Resolve Root Context only after the active Planning-root lifecycle has converged. */
  async resolveRootContext(): Promise<RootContextResolvedState> {
    return (await this.resolveTransition(false)).state
  }

  /** Resolve reactive Root Context through the same serialized active-record lifecycle. */
  async resolveRootContextReactive(): Promise<RootContextResolvedState> {
    return (await this.resolveTransition(true)).state
  }

  async resolve(): Promise<PlanningRootServices> {
    const result = await this.resolveTransition(false)
    return this.requireActiveServices(result)
  }

  async resolveReactive(): Promise<PlanningRootServices> {
    const result = await this.resolveTransition(true)
    return this.requireActiveServices(result)
  }

  /** Run one Schema action while no Root Context replacement can expose another physical owner. */
  mutateSchema(
    action: SchemaMutationAction
  ): Promise<Awaited<ReturnType<SchemaMutationService['mutate']>>> {
    return this.runTransition(async () => {
      const services = this.requireActiveServices(await this.resolveActiveTransition(false))
      return services.schemaMutationService.mutate(action)
    })
  }

  readPreviewRequest(
    hash: string,
    requestPath: string
  ): ReturnType<FilePreviewService['readPreviewRequest']> {
    return this.activeRecord?.filePreviewService.readPreviewRequest(hash, requestPath) ?? null
  }

  dispose(): Promise<void> {
    this.disposePromise ??= this.runTransition(async () => {
      if (this.disposed) return
      this.disposed = true
      const active = this.activeRecord
      this.activeRecord = null
      if (active) await this.disposeRecord(active)
    })
    return this.disposePromise
  }
}
