/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Own every service whose filesystem meaning is scoped to the CLI-selected planning root.
 * 2. Serialize one active-root replacement lifecycle without reconstructing root selection.
 * 3. Acquire and retire observation/invalidation leases with each active root.
 * 4. Keep reactive subscriptions bound to Root Context dependencies and current root selection.
 * 5. Dispose Kernel, hooks, Search, Dashboard, and preview resources exactly once.
 *
 * Original request (2026-07-15): "One project backend has one launch project and one CLI-selected writable planning root."
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
  hookRuntime: HookRuntime
  observationRelease: Promise<WatcherRootRelease | null>
  projectInvalidationRelease: () => void
  rootContextRef: { current: RootContext }
  disposePromise: Promise<void> | null
}

/** Public active-root resolver and preview lifecycle boundary used by the Server router. */
export interface PlanningRootServiceResolver {
  resolve(): Promise<PlanningRootServices>
  resolveReactive(): Promise<PlanningRootServices>
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
  private disposed = false

  constructor(private readonly options: PlanningRootServiceManagerOptions) {}

  private createRecord(rootContext: RootContext): PlanningRootServiceRecord {
    const planningRoot = rootContext.planningRoot
    if (!planningRoot) {
      throw new Error('Cannot create planning-root services without a resolved root.')
    }

    const projectDir = planningRoot.path
    const rootContextRef = { current: rootContext }
    const observationRelease = this.options.observationEnvironment
      .acquireRoot(projectDir)
      .catch((error: unknown) => {
        console.error(`Planning-root observation failed for ${projectDir}:`, error)
        return null
      })
    const adapter = new OpenSpecAdapter(projectDir)
    const hookRuntime = createHookRuntime(projectDir)
    const kernel = new OpsxKernel(
      projectDir,
      this.options.cliExecutor,
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
    const projectInvalidationRelease = this.options.projectInvalidation.acquireRoot(projectDir)

    return {
      rootContext,
      adapter,
      documentService,
      kernel,
      hookRuntime,
      observationRelease,
      projectInvalidationRelease,
      filePreviewService: new FilePreviewService(projectDir, this.options.previewAssetsDir),
      searchService,
      dashboardOverviewService,
      workflowInvocationService: new WorkflowInvocationService({
        getRootContext: () => rootContextRef.current,
        hookRuntime,
        contracts: this.options.cliExecutor.contracts,
      }),
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
      record.filePreviewService.dispose()
      const releaseObservationRoot = await record.observationRelease
      const results = await Promise.allSettled([
        Promise.resolve().then(() => record.projectInvalidationRelease()),
        Promise.resolve().then(() => record.kernel.dispose()),
        Promise.resolve().then(() => record.dashboardOverviewService.dispose()),
        record.hookRuntime.dispose(),
        record.searchService.dispose(),
        Promise.resolve().then(() => releaseObservationRoot?.()),
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

  private async activate(state: RootContextResolvedState): Promise<PlanningRootServices> {
    if (state.state === 'error') {
      const previous = this.activeRecord
      this.activeRecord = null
      if (previous) await this.disposeRecord(previous)
      throw new PlanningRootUnavailableError(state)
    }

    const rootPath = state.data.planningRoot?.path
    if (!rootPath) {
      throw new Error('Root Context reached ready state without a planning root.')
    }

    const active = this.activeRecord
    if (active?.rootContext.planningRoot?.path === rootPath) {
      active.rootContext = state.data
      active.rootContextRef.current = state.data
      return active
    }

    const created = this.createRecord(state.data)
    this.activeRecord = created
    if (active) await this.disposeRecord(active)
    return created
  }

  async resolve(): Promise<PlanningRootServices> {
    return this.runTransition(async () => {
      if (this.disposed) throw new Error('Planning-root service manager is disposed.')
      const state = await resolveServerRootContext({
        projectDir: this.options.launchProjectDir,
        cliExecutor: this.options.cliExecutor,
      })
      return this.activate(state)
    })
  }

  async resolveReactive(): Promise<PlanningRootServices> {
    return this.runTransition(async () => {
      if (this.disposed) throw new Error('Planning-root service manager is disposed.')
      this.options.runtimeInvalidation.track('project', 'context')
      const state = await resolveServerRootContext({
        projectDir: this.options.launchProjectDir,
        cliExecutor: this.options.cliExecutor,
      })
      await trackRootContextDependencies(
        {
          projectDir: this.options.launchProjectDir,
          cliExecutor: this.options.cliExecutor,
        },
        state
      )
      return this.activate(state)
    })
  }

  readPreviewRequest(
    hash: string,
    requestPath: string
  ): ReturnType<FilePreviewService['readPreviewRequest']> {
    return this.activeRecord?.filePreviewService.readPreviewRequest(hash, requestPath) ?? null
  }

  async dispose(): Promise<void> {
    await this.runTransition(async () => {
      if (this.disposed) return
      this.disposed = true
      const active = this.activeRecord
      this.activeRecord = null
      if (active) await this.disposeRecord(active)
    })
  }
}
