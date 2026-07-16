/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Own every service whose filesystem meaning is scoped to the CLI-selected planning root.
 * 2. Cache service bundles by resolved root without reconstructing root selection.
 * 3. Acquire one environment-owned observation lease for each resolved planning root.
 * 4. Map each connected planning root to project/context invalidation facets.
 * 5. Keep reactive subscriptions bound to Root Context dependencies and current root selection.
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
import { WorkflowInvocationService } from './workflow-invocation-service.js'

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
}

export interface PlanningRootServiceResolver {
  resolve(): Promise<PlanningRootServices>
  resolveReactive(): Promise<PlanningRootServices>
  readPreviewRequest(
    hash: string,
    requestPath: string
  ): ReturnType<FilePreviewService['readPreviewRequest']>
  dispose(): Promise<void>
}

export class PlanningRootUnavailableError extends Error {
  readonly state: Extract<RootContextResolvedState, { state: 'error' }>

  constructor(state: Extract<RootContextResolvedState, { state: 'error' }>) {
    super(state.error.message)
    this.name = 'PlanningRootUnavailableError'
    this.state = state
  }
}

export interface PlanningRootServiceManagerOptions {
  launchProjectDir: string
  previewAssetsDir: string
  configManager: ConfigManager
  cliExecutor: CliExecutor
  observationEnvironment: ObservationRootOwner
  projectInvalidation: RuntimeRootInvalidationOwner
  runtimeInvalidation: RuntimeInvalidationReader
}

/** Deep owner for planning-root filesystem services. */
export class PlanningRootServiceManager implements PlanningRootServiceResolver {
  private readonly records = new Map<string, PlanningRootServiceRecord>()

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
      () => rootContextRef.current.references
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
    }
  }

  private servicesFor(state: RootContextResolvedState): PlanningRootServices {
    if (state.state === 'error') {
      throw new PlanningRootUnavailableError(state)
    }

    const rootPath = state.data.planningRoot?.path
    if (!rootPath) {
      throw new Error('Root Context reached ready state without a planning root.')
    }

    const existing = this.records.get(rootPath)
    if (existing) {
      existing.rootContext = state.data
      existing.rootContextRef.current = state.data
      return existing
    }

    const created = this.createRecord(state.data)
    this.records.set(rootPath, created)
    return created
  }

  async resolve(): Promise<PlanningRootServices> {
    const state = await resolveServerRootContext({
      projectDir: this.options.launchProjectDir,
      cliExecutor: this.options.cliExecutor,
    })
    return this.servicesFor(state)
  }

  async resolveReactive(): Promise<PlanningRootServices> {
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
    return this.servicesFor(state)
  }

  readPreviewRequest(
    hash: string,
    requestPath: string
  ): ReturnType<FilePreviewService['readPreviewRequest']> {
    for (const record of this.records.values()) {
      const result = record.filePreviewService.readPreviewRequest(hash, requestPath)
      if (result) return result
    }
    return null
  }

  async dispose(): Promise<void> {
    const records = [...this.records.values()]
    this.records.clear()
    await Promise.all(
      records.map(async (record) => {
        record.projectInvalidationRelease()
        record.kernel.dispose()
        record.dashboardOverviewService.dispose()
        const releaseObservationRoot = await record.observationRelease
        await Promise.all([
          record.hookRuntime.dispose(),
          record.searchService.dispose(),
          releaseObservationRoot?.(),
        ])
      })
    )
  }
}
