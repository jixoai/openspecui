/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Register lease-scoped planning-root document, OPSX, regional Dashboard, and archive procedures.
 * 2. Register CLI, Root Context, reactive launch-tool initialization, configuration, Store, and terminal-result projections.
 * 3. Register binding-safe Git, terminal, system, notification, and recovery procedures.
 * 4. Register translation runtime, model, asset, and cache procedures.
 * 5. Compose the public tRPC application router and shared procedure schemas.
 *
 * Compromise: tRPC router inference currently requires one composition module; splitting its
 * established 2,600-line registration surface is outside the OpenSpec 1.6 contract slice.
 *
 * Original request (2026-07-15): "你先负责后端（内核）的开发。"
 * Original request (2026-07-17): "Do not return a mutable Planning-root service capability that can outlive its admitted operation."
 * Original request (2026-07-18): "Remove duplicated profile/drift parsing and preserve the pinned Core workflow contract."
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git repository bindings.
 * Derived requirement (2026-07-19): Project Binding mutation returns launch-write and convergence evidence.
 * Derived requirement (2026-07-22): Archive retains its current rows while a reactive replacement is running.
 */
import type {
  ChangeFile,
  ChangeProjectionBatch,
  ChangeProjectionData,
  CliExecutor,
  CliStreamEvent,
  CliStreamHandle,
  ConfigManager,
  DashboardGitSnapshot,
  DashboardSummaryProjection,
  DashboardTrendsProjection,
  FileChangeEvent,
  GitEntriesPage,
  GitEntryFiles,
  GitEntryPatch,
  GitRepositoryScope,
  GitRepositoryScopeDescriptor,
  GitRepositoryScopes,
  GitWorktreeHandoff,
  GitWorktreeOverview,
  GlobalSettingsManager,
  OpenSpecAdapter,
  OpenSpecWatcher,
} from '@openspecui/core'
import {
  BatchTranslateInputSchema,
  classifyStoreCliResult,
  CodeEditorThemeSchema,
  DashboardConfigSchema,
  DashboardGitSnapshotSchema,
  DashboardSummaryProjectionSchema,
  DashboardTrendsProjectionSchema,
  DocumentTranslationConfigUpdateSchema,
  EnvironmentGlobalConfigValueSchema,
  getAllTools,
  getAvailableTools,
  getConfiguredTools,
  getDefaultCliCommandString,
  getDetectedProjectTools,
  getRootContextCliSelector,
  getToolInitStates,
  getWatcherRuntimeStatus,
  GitConfigSchema,
  NotificationSettingsSchema,
  OpenSpecUIGlobalSettingsUpdateSchema,
  OPSX_ARTIFACT_INPUT_ACTIONS,
  OPSX_CHANGE_INPUT_ACTIONS,
  OPSX_TEXT_INPUT_ACTIONS,
  OpsxConfigSchema,
  OwnedSpecIdentitySchema,
  ProjectBindingUpdateSchema,
  ReactiveContext,
  requireCanonicalOpenSpecEntityId,
  requireOpenSpecEntityRelativePath,
  resolveTerminalShellDefaults,
  RUNTIME_INVALIDATION_FACETS,
  ServiceTranslationEngineIdSchema,
  sniffGlobalCli,
  SpecIdentitySchema,
  StoreDoctorResultSchema,
  StoreListResultSchema,
  subscribeWatcherRuntimeStatus,
  TerminalConfigSchema,
  TerminalRendererEngineSchema,
  toStoreFeatureResult,
  TranslationCacheReadInputSchema,
  TranslationCacheWriteInputSchema,
  TranslationEngineIdSchema,
  TranslationEngineLifecycleStatusSchema,
  type AIToolOption,
  type ApplyInstructions,
  type ArtifactInstructions,
  type ChangeStatus,
  type ProjectBindingUpdate,
  type ProjectBindingUpdateResult,
  type ProjectRecoveryStatus,
  type RuntimeInvalidationController,
  type RuntimeInvalidationFacet,
  type RuntimeInvalidationToken,
  type RunWorkflowInputV1,
  type RunWorkflowResultV2,
  type SchemaDetail,
  type SchemaInfo,
  type SchemaResolution,
  type StoreDoctorStore,
  type StoreFeatureResult,
  type StoreListEntry,
  type TemplateContentMap,
  type TemplatesMap,
  type WorkflowRequestedModeV1,
} from '@openspecui/core'
import {
  NotificationGroupKeySchema,
  NotificationPublishInputSchema,
  type NotificationRecord,
} from '@openspecui/core/notifications'
import { CustomSoundIdSchema } from '@openspecui/core/sounds'
import {
  parseProjectSearchHits,
  ProjectSearchHitSchema,
  ProjectSearchQuerySchema,
} from '@openspecui/search'
import { initTRPC, TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { CliMutationInvalidator } from './cli-mutation-invalidator.js'
import { createCliStreamObservable } from './cli-stream-observable.js'
import type { Ct2ModelAssetService } from './ct2-model-asset-service.js'
import type { CustomSoundService } from './custom-sound-service.js'
import { removeDetachedDashboardGitWorktree } from './dashboard-git-snapshot.js'
import {
  getDashboardGitTaskStatus,
  subscribeDashboardGitTaskStatus,
  touchDashboardGitRefreshStamp,
  type DashboardGitTaskStatus,
} from './dashboard-overview.js'
import { buildEntityReadOptions } from './entity-read-options.js'
import { invalidateGitPanelCache } from './git-panel-cache.js'
import {
  buildGitWorktreeOverview,
  getCurrentWorktreeGitEntryFiles,
  getCurrentWorktreeGitEntryMeta,
  getCurrentWorktreeGitEntryPatch,
  listCurrentWorktreeGitEntries,
  resolveGitWorktreeSwitchTarget,
} from './git-panel-data.js'
import {
  GitRepositoryBindingConflictError,
  type GitRepositoryBindingResolver,
} from './git-repository-binding-service.js'
import type { LlamaModelAssetService } from './llama-model-asset-service.js'
import type { LocalModelAssetService } from './local-model-asset-service.js'
import type { NotificationService } from './notification-service.js'
import { getOpenSpecMutationFacets } from './open-spec-mutation-facets.js'
import {
  dataScopeFromRootPreview,
  readActiveRootConfig,
  readEnvironmentGlobalConfig,
  readProjectBindingConfig,
  writeActiveRootConfig,
  writeEnvironmentGlobalConfig,
  writeProjectBindingConfig,
} from './planning-config-service.js'
import type { PlanningRootServiceResolver, PlanningRootServices } from './planning-root-service.js'
import type { ProjectRecoveryService } from './project-recovery-service.js'
import type { ProjectionWorkEvent, ProjectionWorkSubscription } from './projection-work/index.js'
import { reactiveKV } from './reactive-kv.js'
import {
  createReactiveProjectionSubscription,
  createReactiveSubscription,
} from './reactive-subscription.js'
import { createRootContextSubscription, resolveServerRootContext } from './root-context-service.js'
import { parseSchemaMutationAction, type SchemaMutationAction } from './schema-mutation-service.js'
import {
  readSpecCatalog,
  readSpecDocument,
  SpecCatalogIdentityNotFoundError,
} from './spec-catalog-service.js'
import type { StoreObservationReconciler } from './store-observation-service.js'
import {
  StoreMutationService,
  storeMutationEnvUri,
  type StartStoreMutationInput,
} from './store-mutation-service.js'
import { startStrictArchiveStream } from './strict-archive-stream.js'
import type { ToolCommandObservationService } from './tool-command-observation-service.js'
import { setTrackedTaskCompletion } from './tracked-task-mutation.js'
import type { TranslationCacheService } from './translation-cache-service.js'
import type { TranslationEngineService } from './translation-engine-service.js'

/** Dependencies injected into every OpenSpecUI Server tRPC procedure. */
export interface Context {
  /** Launch-project adapter; only launch-scoped operations such as init may use it. */
  launchProjectAdapter: OpenSpecAdapter
  /** Lazy owner of all CLI-selected planning-root filesystem services. */
  planningRootServices: PlanningRootServiceResolver
  /** Backend-owned Code/Planning Git binding epochs and operation leases. */
  gitRepositoryBindings: GitRepositoryBindingResolver
  /** Runtime-environment invalidation identity; projections pull their own authoritative data. */
  runtimeInvalidation: RuntimeInvalidationController
  /** CLI-truth reconciler for dynamic registered Store observation roots. */
  storeObservation: StoreObservationReconciler
  /** Runtime owner for environment-global tool command watcher leases. */
  toolCommandObservation: ToolCommandObservationService
  configManager: ConfigManager
  cliExecutor: CliExecutor
  projectRecoveryService: ProjectRecoveryService
  notificationService: NotificationService
  customSoundService: CustomSoundService
  globalSettingsManager: GlobalSettingsManager
  translationCacheService: TranslationCacheService
  translationEngineService: TranslationEngineService
  localModelAssetService: LocalModelAssetService
  localCt2ModelAssetService: Ct2ModelAssetService
  localLlamaModelAssetService: LlamaModelAssetService
  gitWorktreeHandoff?: GitWorktreeHandoffService
  watcher?: OpenSpecWatcher
  projectDir: string
}

/** Launch-scoped handoff owner used to start a backend for one Git worktree. */
export interface GitWorktreeHandoffService {
  ensureWorktreeServer(input: { targetPath: string }): Promise<GitWorktreeHandoff>
}

const t = initTRPC.context<Context>().create()

/** Typed tRPC router factory bound to the OpenSpecUI Server context. */
export const router = t.router
/** Typed public tRPC procedure factory bound to the OpenSpecUI Server context. */
export const publicProcedure = t.procedure

function runPlanningRoot<T>(
  ctx: Context,
  task: (services: PlanningRootServices) => Promise<T> | T,
  options: { reactive?: boolean } = {}
): Promise<T> {
  return options.reactive
    ? ctx.planningRootServices.runReactiveOperation(task)
    : ctx.planningRootServices.runOperation(task)
}

function createPlanningRootSubscription<T>(
  ctx: Context,
  task: (services: PlanningRootServices) => Promise<T>
) {
  return createReactiveSubscription(() => runPlanningRoot(ctx, task, { reactive: true }))
}

function createPlanningRootProjectionSubscription<T>(
  ctx: Context,
  task: (services: PlanningRootServices) => Promise<T>
) {
  return createReactiveProjectionSubscription(() => runPlanningRoot(ctx, task, { reactive: true }))
}

/**
 * Bind one regional Projection Work stream to the current Planning-root record. Root replacement retires the
 * old regional listener before the next record is exposed; the Work identity still protects shared A/B caches.
 */
function createPlanningRootProjectionWorkSubscription<T, TBatch = never>(
  ctx: Context,
  subscribe: (
    services: PlanningRootServices,
    listener: (event: ProjectionWorkEvent<T, TBatch>) => void
  ) => ProjectionWorkSubscription,
  parseEvent: (event: ProjectionWorkEvent<T, TBatch>) => ProjectionWorkEvent<T, TBatch>
) {
  return observable<ProjectionWorkEvent<T, TBatch>>((emit) => {
    const reactiveContext = new ReactiveContext()
    const controller = new AbortController()
    let regionalSubscription: ProjectionWorkSubscription | null = null
    let active = true

    const retireRegionalSubscription = () => {
      regionalSubscription?.unsubscribe()
      regionalSubscription = null
    }

    void (async () => {
      try {
        for await (const _ of reactiveContext.stream(
          () => {
            retireRegionalSubscription()
            return ctx.planningRootServices.runReactiveOperation((services) => {
              regionalSubscription = subscribe(services, (event) => {
                if (!active) return
                try {
                  emit.next(parseEvent(event))
                } catch (error: unknown) {
                  emit.error(error instanceof Error ? error : new Error(String(error)))
                }
              })
            })
          },
          controller.signal,
          { onRecomputeStarted: retireRegionalSubscription }
        )) {
          // The inner regional subscription owns all meaningful payload events.
        }
      } catch (error: unknown) {
        if (active && !controller.signal.aborted) {
          emit.error(error instanceof Error ? error : new Error(String(error)))
        }
      }
    })()

    return () => {
      active = false
      controller.abort()
      retireRegionalSubscription()
    }
  })
}

const projectionWorkIdentitySchema = z.object({
  projectionKind: z.string(),
  planningRoot: z.object({
    identity: z.string(),
    source: z.string(),
    storeSelector: z.string().nullable(),
  }),
  owner: z.object({
    generation: z.string().nullable(),
    gitBindingToken: z.string().nullable(),
  }),
  selector: z.string(),
  inputFingerprint: z.string(),
  protocolVersion: z.number().int(),
})

function dashboardProjectionEventSchema<TData>(
  dataSchema: z.ZodType<TData>
): z.ZodType<ProjectionWorkEvent<TData, never>> {
  const snapshotSchema = z.object({
    data: dataSchema,
    freshness: z.enum(['current', 'stale-display-only']),
    identity: projectionWorkIdentitySchema,
    workGeneration: z.number().int(),
  })
  const rawSchema = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('snapshot'),
      snapshot: snapshotSchema,
    }),
    z.object({
      type: z.literal('stage'),
      phase: z.enum([
        'request',
        'transport-start',
        'root-ready',
        'cache-hit',
        'join',
        'start',
        'leaf-settled',
        'first-stable-payload',
        'complete',
        'error',
        'cancel',
      ]),
      workGeneration: z.number().int(),
    }),
    z.object({
      type: z.literal('complete'),
      snapshot: snapshotSchema,
    }),
    z.object({
      type: z.literal('failed'),
      error: z.unknown(),
      retainedSnapshot: snapshotSchema.nullable(),
      workGeneration: z.number().int(),
    }),
  ])
  return z.custom<ProjectionWorkEvent<TData, never>>(
    (value: unknown) => rawSchema.safeParse(value).success,
    { message: 'Invalid Dashboard projection Work event.' }
  )
}

const changeProjectionRowErrorSchema = z.object({
  changeId: z.string(),
  message: z.string(),
})

const changeProjectionTaskSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  section: z.string().optional(),
  location: z.object({
    filePath: z.string(),
    taskIndex: z.number().int().positive(),
  }),
})

const changeProjectionSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('artifact'),
    artifactId: z.string(),
    outputPath: z.string(),
    filePaths: z.array(z.string()),
  }),
  z.object({
    kind: z.literal('top-level-fallback'),
    artifactId: z.null(),
    outputPath: z.literal('tasks.md'),
    filePaths: z.tuple([z.literal('tasks.md')]),
  }),
  z.object({
    kind: z.literal('none'),
    artifactId: z.null(),
    outputPath: z.null(),
    filePaths: z.tuple([]),
  }),
])

const changeProjectionTaskProgressSchema = z.object({
  tasks: z.array(changeProjectionTaskSchema),
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  phase: z.enum(['no-tasks', 'in-progress', 'complete']),
  source: changeProjectionSourceSchema,
})

const changeProjectionChecklistTaskSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  section: z.string().optional(),
})

const changeProjectionDataSchema = z.object({
  rows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      trackedTaskProgress: changeProjectionTaskProgressSchema,
      documentChecklistSummary: z.object({
        groups: z.array(
          z.object({
            artifactIds: z.array(z.string()),
            filePath: z.string(),
            tasks: z.array(changeProjectionChecklistTaskSchema),
            total: z.number().int().nonnegative(),
            completed: z.number().int().nonnegative(),
            remaining: z.number().int().nonnegative(),
          })
        ),
        total: z.number().int().nonnegative(),
        completed: z.number().int().nonnegative(),
        remaining: z.number().int().nonnegative(),
      }),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
  ),
  errors: z.array(changeProjectionRowErrorSchema),
})

const changeProjectionBatchSchema = z.object({
  rows: changeProjectionDataSchema.shape.rows,
  errors: z.array(changeProjectionRowErrorSchema),
  progress: z.object({
    completed: z.number().int().nonnegative(),
    total: z.union([z.number().int().nonnegative(), z.literal('unknown')]),
  }),
})

function changeProjectionEventSchema(): z.ZodType<
  ProjectionWorkEvent<ChangeProjectionData, ChangeProjectionBatch>
> {
  const snapshotSchema = z.object({
    data: changeProjectionDataSchema,
    freshness: z.enum(['current', 'stale-display-only']),
    identity: projectionWorkIdentitySchema,
    workGeneration: z.number().int(),
  })
  const rawSchema = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('snapshot'),
      snapshot: snapshotSchema,
    }),
    z.object({
      type: z.literal('stage'),
      phase: z.enum([
        'request',
        'transport-start',
        'root-ready',
        'cache-hit',
        'join',
        'start',
        'leaf-settled',
        'first-stable-payload',
        'complete',
        'error',
        'cancel',
      ]),
      workGeneration: z.number().int(),
    }),
    z.object({
      type: z.literal('batch'),
      batch: changeProjectionBatchSchema,
      progress: z.object({
        completed: z.number().int().nonnegative(),
        total: z.union([z.number().int().nonnegative(), z.literal('unknown')]),
      }),
      identity: projectionWorkIdentitySchema,
      workGeneration: z.number().int(),
    }),
    z.object({
      type: z.literal('complete'),
      snapshot: snapshotSchema,
    }),
    z.object({
      type: z.literal('failed'),
      error: z.unknown(),
      retainedSnapshot: snapshotSchema.nullable(),
      workGeneration: z.number().int(),
    }),
  ])
  return z.custom<ProjectionWorkEvent<ChangeProjectionData, ChangeProjectionBatch>>(
    (value: unknown) => rawSchema.safeParse(value).success,
    { message: 'Invalid Change projection Work event.' }
  )
}

function createPlanningRootCliStreamObservable(
  ctx: Context,
  startStream: (
    services: PlanningRootServices,
    onEvent: (event: CliStreamEvent) => void
  ) => CliStreamHandle
) {
  return createCliStreamObservable((onEvent) =>
    startPlanningRootCliStream(ctx, startStream, onEvent)
  )
}

function startPlanningRootCliStream(
  ctx: Context,
  startStream: (
    services: PlanningRootServices,
    onEvent: (event: CliStreamEvent) => void
  ) => CliStreamHandle,
  onEvent: (event: CliStreamEvent) => void
) {
  return ctx.planningRootServices.startOperationStream((services) => startStream(services, onEvent))
}

async function mutatePlanningSchema(ctx: Context, action: SchemaMutationAction) {
  const parsedAction = parseSchemaMutationAction(action)
  try {
    return await ctx.planningRootServices.mutateSchema(parsedAction)
  } finally {
    // Direct filesystem mutations and schema CLI commands both change these Planning-root facets.
    ctx.runtimeInvalidation.invalidate(['project', 'context', 'schemas'])
  }
}

function runOpenSpecCliMutation<T>(
  ctx: Context,
  args: readonly string[],
  execute: () => Promise<T>
): Promise<T> {
  const facets = getOpenSpecMutationFacets(args)
  if (!facets) return execute()
  return new CliMutationInvalidator(ctx.runtimeInvalidation).run(facets, execute)
}

function streamOpenSpecCliMutation(
  ctx: Context,
  args: readonly string[],
  start: (onEvent: (event: CliStreamEvent) => void) => CliStreamHandle,
  onEvent: (event: CliStreamEvent) => void
): CliStreamHandle {
  const facets = getOpenSpecMutationFacets(args)
  if (!facets) return start(onEvent)
  return new CliMutationInvalidator(ctx.runtimeInvalidation).stream(facets, start, onEvent)
}

/** Project-backend notification query, subscription, and mutation procedures. */
export const notificationsRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.notificationService.list()
  }),

  subscribe: publicProcedure.subscription(({ ctx }) => {
    return observable<NotificationRecord[]>((emit) => {
      const unsubscribe = ctx.notificationService.subscribe((notifications) => {
        emit.next(notifications)
      })
      return () => {
        unsubscribe()
      }
    })
  }),

  publish: publicProcedure.input(NotificationPublishInputSchema).mutation(({ ctx, input }) => {
    return ctx.notificationService.publish(input)
  }),

  markRead: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      ctx.notificationService.markRead(input.id)
      return { success: true }
    }),

  markManyRead: publicProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).default([]) }))
    .mutation(({ ctx, input }) => {
      ctx.notificationService.markManyRead(input.ids)
      return { success: true }
    }),

  clearGroup: publicProcedure
    .input(z.object({ groupKey: NotificationGroupKeySchema }))
    .mutation(({ ctx, input }) => {
      ctx.notificationService.clearGroup(input.groupKey)
      return { success: true }
    }),

  clearTerminalSession: publicProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      ctx.notificationService.clearTerminalSession(input.sessionId)
      return { success: true }
    }),

  clearAll: publicProcedure.mutation(({ ctx }) => {
    ctx.notificationService.clearAll()
    return { success: true }
  }),
})

/** Custom notification-sound query and mutation procedures. */
export const soundsRouter = router({
  listCustom: publicProcedure.query(({ ctx }) => {
    return ctx.customSoundService.listAvailable()
  }),

  renameCustom: publicProcedure
    .input(z.object({ id: CustomSoundIdSchema, name: z.string().min(1).max(160) }))
    .mutation(({ ctx, input }) => {
      return ctx.customSoundService.rename(input.id, input.name)
    }),

  deleteCustom: publicProcedure
    .input(z.object({ id: CustomSoundIdSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.customSoundService.remove(input.id)
      return { success: true }
    }),
})

/** Process-global OpenSpecUI settings query and mutation procedures. */
export const globalSettingsRouter = router({
  get: publicProcedure.query(({ ctx }) => {
    return ctx.globalSettingsManager.readSettings()
  }),

  update: publicProcedure
    .input(OpenSpecUIGlobalSettingsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.globalSettingsManager.writeSettings(input)
      return { success: true }
    }),

  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.globalSettingsManager.readSettings())
  }),
})

/** Translation-cache inspection and maintenance procedures. */
export const translationCacheRouter = router({
  stats: publicProcedure.query(({ ctx }) => {
    return ctx.translationCacheService.getStats()
  }),

  read: publicProcedure.input(TranslationCacheReadInputSchema).query(({ ctx, input }) => {
    return ctx.translationCacheService.read(input.keyHash)
  }),

  write: publicProcedure.input(TranslationCacheWriteInputSchema).mutation(({ ctx, input }) => {
    return ctx.translationCacheService.write(input)
  }),

  clean: publicProcedure.mutation(({ ctx }) => {
    return ctx.translationCacheService.clean()
  }),

  clear: publicProcedure.mutation(({ ctx }) => {
    return ctx.translationCacheService.clear()
  }),
})

/** Translation-engine selection and diagnostic procedures. */
export const translationEnginesRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.translationEngineService.listEngines()
  }),

  getLifecycle: publicProcedure
    .input(z.object({ engineId: TranslationEngineIdSchema }))
    .output(TranslationEngineLifecycleStatusSchema)
    .query(({ ctx, input }) => {
      return ctx.translationEngineService.getLifecycle(input.engineId)
    }),

  install: publicProcedure
    .input(z.object({ engineId: TranslationEngineIdSchema }))
    .output(TranslationEngineLifecycleStatusSchema)
    .mutation(({ ctx, input }) => {
      return ctx.translationEngineService.installEngine(input.engineId)
    }),

  installStream: publicProcedure
    .input(z.object({ engineId: TranslationEngineIdSchema }))
    .subscription(({ ctx, input }) => {
      return ctx.translationEngineService.installEngineStream(input.engineId)
    }),

  searchModels: publicProcedure
    .input(
      z.object({
        engineId: ServiceTranslationEngineIdSchema,
        query: z.string().optional(),
        sourceLanguage: z.string().optional(),
        targetLanguage: z.string().optional(),
        limit: z.number().int().positive().max(20).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(({ ctx, input }) => {
      return ctx.translationEngineService.searchModels(input)
    }),

  getModelDownloadPlan: publicProcedure
    .input(
      z.object({
        engineId: ServiceTranslationEngineIdSchema,
        model: z.string().min(1),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .query(({ ctx, input }) => {
      return ctx.translationEngineService.getModelDownloadPlan(input)
    }),

  select: publicProcedure
    .input(z.object({ engineId: TranslationEngineIdSchema }))
    .mutation(({ ctx, input }) => {
      return ctx.translationEngineService.selectEngine(input.engineId)
    }),

  batchTranslate: publicProcedure
    .input(BatchTranslateInputSchema)
    .subscription(({ ctx, input }) => {
      return ctx.translationEngineService.batchTranslate(input)
    }),
})

/** Local NMT model catalog and lifecycle procedures. */
export const localModelsRouter = router({
  listLocal: publicProcedure.query(({ ctx }) => {
    return ctx.localModelAssetService.listLocalCatalog()
  }),

  searchRemote: publicProcedure
    .input(
      z.object({
        requestId: z.string().min(1).optional(),
        query: z.string().optional(),
        sourceLanguage: z.string().optional(),
        targetLanguage: z.string().optional(),
        limit: z.number().int().positive().max(20).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(({ ctx, input }) => {
      return ctx.localModelAssetService.searchRemoteCatalog({
        engineId: 'local',
        ...input,
      })
    }),

  searchRemoteStream: publicProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        query: z.string().optional(),
        sourceLanguage: z.string().optional(),
        targetLanguage: z.string().optional(),
        limit: z.number().int().positive().max(20).optional(),
        cursor: z.string().optional(),
      })
    )
    .subscription(({ ctx, input }) => {
      return ctx.localModelAssetService.subscribeRemoteCatalog({
        engineId: 'local',
        ...input,
      })
    }),

  state: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .query(({ ctx, input }) => {
      return ctx.localModelAssetService.readSelectedModelState(input.modelId, input.selectedGroupId)
    }),

  panelState: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const asset = await ctx.localModelAssetService.readSelectedModelState(
        input.modelId,
        input.selectedGroupId
      )
      return {
        modelId: input.modelId,
        selectedGroupId: asset.selectedGroupId ?? asset.plan?.selectedGroupId,
        asset,
        downloadPlan: asset.plan ?? null,
      }
    }),

  subscribeLogs: publicProcedure.subscription(({ ctx }) => {
    return ctx.localModelAssetService.subscribeLogs()
  }),

  markSelected: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.localModelAssetService.markSelectedModel(input.modelId)
      return {
        modelId: input.modelId,
        selectedGroupId: asset.selectedGroupId ?? asset.plan?.selectedGroupId,
        asset,
        downloadPlan: asset.plan ?? null,
      }
    }),

  download: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.localModelAssetService.startDownload(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  pause: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.localModelAssetService.pauseDownload(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  resume: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.localModelAssetService.resumeDownload(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  delete: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.localModelAssetService.deleteModel(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  refreshProfiles: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.localModelAssetService.refreshProfiles(input.modelId)
      return {
        modelId: asset.modelId,
        selectedGroupId: asset.selectedGroupId ?? asset.plan?.selectedGroupId,
        asset,
        downloadPlan: asset.plan ?? null,
      }
    }),

  refreshArtifacts: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.localModelAssetService.refreshProfiles(input.modelId)
      return {
        modelId: asset.modelId,
        selectedGroupId: asset.selectedGroupId ?? asset.plan?.selectedGroupId,
        asset,
        downloadPlan: asset.plan ?? null,
      }
    }),
})

/** Local CTranslate2 model catalog and lifecycle procedures. */
export const localCt2ModelsRouter = router({
  listLocal: publicProcedure.query(({ ctx }) => {
    return ctx.localCt2ModelAssetService.listLocalCatalog()
  }),

  searchRemote: publicProcedure
    .input(
      z.object({
        requestId: z.string().min(1).optional(),
        query: z.string().optional(),
        sourceLanguage: z.string().optional(),
        targetLanguage: z.string().optional(),
        limit: z.number().int().positive().max(20).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(({ ctx, input }) => {
      return ctx.localCt2ModelAssetService.searchRemoteCatalog({
        engineId: 'local-ct2',
        ...input,
      })
    }),

  searchRemoteStream: publicProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        query: z.string().optional(),
        sourceLanguage: z.string().optional(),
        targetLanguage: z.string().optional(),
        limit: z.number().int().positive().max(20).optional(),
        cursor: z.string().optional(),
      })
    )
    .subscription(({ ctx, input }) => {
      return ctx.localCt2ModelAssetService.subscribeRemoteCatalog({
        engineId: 'local-ct2',
        ...input,
      })
    }),

  state: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .query(({ ctx, input }) => {
      return ctx.localCt2ModelAssetService.readSelectedModelState(
        input.modelId,
        input.selectedGroupId
      )
    }),

  panelState: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const asset = await ctx.localCt2ModelAssetService.readSelectedModelState(
        input.modelId,
        input.selectedGroupId
      )
      return {
        modelId: input.modelId,
        selectedGroupId: asset.selectedGroupId ?? asset.plan?.selectedGroupId,
        asset,
        downloadPlan: asset.plan ?? null,
      }
    }),

  subscribeLogs: publicProcedure.subscription(({ ctx }) => {
    return ctx.localCt2ModelAssetService.subscribeLogs()
  }),

  markSelected: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.localCt2ModelAssetService.markSelectedModel(input.modelId)
      return {
        modelId: input.modelId,
        selectedGroupId: asset.selectedGroupId ?? asset.plan?.selectedGroupId,
        asset,
        downloadPlan: asset.plan ?? null,
      }
    }),

  download: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.localCt2ModelAssetService.startDownload(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  pause: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.localCt2ModelAssetService.pauseDownload(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  resume: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.localCt2ModelAssetService.resumeDownload(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  delete: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.localCt2ModelAssetService.deleteModel(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  refreshArtifacts: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.localCt2ModelAssetService.refreshArtifacts(input.modelId)
      return {
        modelId: asset.modelId,
        selectedGroupId: asset.selectedGroupId ?? asset.plan?.selectedGroupId,
        asset,
        downloadPlan: asset.plan ?? null,
      }
    }),
})

/** Local Llama model catalog and lifecycle procedures. */
export const localLlamaModelsRouter = router({
  listLocal: publicProcedure.query(({ ctx }) => {
    return ctx.localLlamaModelAssetService.listLocalCatalog()
  }),

  searchRemote: publicProcedure
    .input(
      z.object({
        requestId: z.string().min(1).optional(),
        query: z.string().optional(),
        sourceLanguage: z.string().optional(),
        targetLanguage: z.string().optional(),
        limit: z.number().int().positive().max(20).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(({ ctx, input }) => {
      return ctx.localLlamaModelAssetService.searchRemoteCatalog({
        engineId: 'local-llama',
        ...input,
      })
    }),

  searchRemoteStream: publicProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        query: z.string().optional(),
        sourceLanguage: z.string().optional(),
        targetLanguage: z.string().optional(),
        limit: z.number().int().positive().max(20).optional(),
        cursor: z.string().optional(),
      })
    )
    .subscription(({ ctx, input }) => {
      return ctx.localLlamaModelAssetService.subscribeRemoteCatalog({
        engineId: 'local-llama',
        ...input,
      })
    }),

  state: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .query(({ ctx, input }) => {
      return ctx.localLlamaModelAssetService.readSelectedModelState(
        input.modelId,
        input.selectedGroupId
      )
    }),

  panelState: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const asset = await ctx.localLlamaModelAssetService.readSelectedModelState(
        input.modelId,
        input.selectedGroupId
      )
      return {
        modelId: input.modelId,
        selectedGroupId: asset.selectedGroupId ?? asset.plan?.selectedGroupId,
        asset,
        downloadPlan: asset.plan ?? null,
      }
    }),

  subscribeLogs: publicProcedure.subscription(({ ctx }) => {
    return ctx.localLlamaModelAssetService.subscribeLogs()
  }),

  markSelected: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.localLlamaModelAssetService.markSelectedModel(input.modelId)
      return {
        modelId: input.modelId,
        selectedGroupId: asset.selectedGroupId ?? asset.plan?.selectedGroupId,
        asset,
        downloadPlan: asset.plan ?? null,
      }
    }),

  download: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.localLlamaModelAssetService.startDownload(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  pause: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.localLlamaModelAssetService.pauseDownload(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  resume: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.localLlamaModelAssetService.resumeDownload(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  delete: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        groupId: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.localLlamaModelAssetService.deleteModel(
        input.modelId,
        input.groupId ?? input.selectedGroupId
      )
    }),

  refreshArtifacts: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.localLlamaModelAssetService.refreshArtifacts(input.modelId)
      return {
        modelId: asset.modelId,
        selectedGroupId: asset.selectedGroupId ?? asset.plan?.selectedGroupId,
        asset,
        downloadPlan: asset.plan ?? null,
      }
    }),
})

const gitEntrySelectorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('uncommitted') }),
  z.object({ type: z.literal('commit'), hash: z.string().min(1) }),
])
const gitRepositoryScopeSchema = z.enum(['code', 'planning'])
const gitBindingTokenSchema = z.string().min(1)

const workflowRequestedModeSchema = z.enum(['compose', 'command', 'direct'])
const runWorkflowInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(OPSX_TEXT_INPUT_ACTIONS), text: z.string() }),
  z.object({
    action: z.literal('new'),
    changeId: z.string(),
    schema: z.string().optional(),
    description: z.string().optional(),
    extraArgs: z.array(z.string()).default([]),
  }),
  z.object({
    action: z.enum(OPSX_ARTIFACT_INPUT_ACTIONS),
    changeId: z.string(),
    artifactId: z.string(),
    schema: z.string().optional(),
  }),
  z.object({
    action: z.enum(OPSX_CHANGE_INPUT_ACTIONS),
    changeId: z.string(),
    schema: z.string().optional(),
    strict: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('bulk-archive'),
    changeIds: z.array(z.string()).optional(),
    schema: z.string().optional(),
  }),
  z.object({ action: z.literal('onboard') }),
])

function requireChangeId(changeId: string | undefined): string {
  if (!changeId) {
    throw new Error('change is required')
  }
  return requireCanonicalOpenSpecEntityId(changeId, 'changeId')
}

function requireOpsxArtifactLocation(input: { changeId: string; outputPath: string }) {
  return {
    changeId: requireCanonicalOpenSpecEntityId(input.changeId, 'changeId'),
    outputPath: requireOpenSpecEntityRelativePath(input.outputPath, 'outputPath'),
  }
}

async function fetchOpsxStatus(
  ctx: Context,
  input: { change?: string; schema?: string },
  reactive = false
): Promise<ChangeStatus> {
  const changeId = requireChangeId(input.change)
  return runPlanningRoot(
    ctx,
    async ({ kernel }) => {
      await kernel.ensureStatus(changeId, input.schema)
      return kernel.getStatus(changeId, input.schema)
    },
    { reactive }
  )
}

async function fetchOpsxStatusList(ctx: Context, reactive = false): Promise<ChangeStatus[]> {
  return runPlanningRoot(
    ctx,
    async ({ kernel }) => {
      await kernel.ensureStatusList()
      return kernel.getStatusList()
    },
    { reactive }
  )
}

async function fetchOpsxInstructions(
  ctx: Context,
  input: { change?: string; artifact: string; schema?: string },
  reactive = false
): Promise<ArtifactInstructions> {
  const changeId = requireChangeId(input.change)
  return runPlanningRoot(
    ctx,
    async ({ kernel }) => {
      await kernel.ensureInstructions(changeId, input.artifact, input.schema)
      return kernel.getInstructions(changeId, input.artifact, input.schema)
    },
    { reactive }
  )
}

async function fetchOpsxApplyInstructions(
  ctx: Context,
  input: { change?: string; schema?: string },
  reactive = false
): Promise<ApplyInstructions> {
  const changeId = requireChangeId(input.change)
  return runPlanningRoot(
    ctx,
    async ({ kernel }) => {
      await kernel.ensureApplyInstructions(changeId, input.schema)
      return kernel.getApplyInstructions(changeId, input.schema)
    },
    { reactive }
  )
}

async function fetchOpsxConfigBundle(
  ctx: Context,
  reactive = false
): Promise<{
  schemas: SchemaInfo[]
  schemaDetails: Record<string, SchemaDetail | null>
  schemaResolutions: Record<string, SchemaResolution | null>
}> {
  return runPlanningRoot(
    ctx,
    async ({ kernel }) => {
      await kernel.ensureSchemas()
      const schemas = kernel.getSchemas()

      await Promise.allSettled(
        schemas.flatMap((schema) => [
          kernel.ensureSchemaDetail(schema.name),
          kernel.ensureSchemaResolution(schema.name),
        ])
      )

      const schemaDetails: Record<string, SchemaDetail | null> = {}
      const schemaResolutions: Record<string, SchemaResolution | null> = {}
      for (const schema of schemas) {
        schemaDetails[schema.name] = kernel.peekSchemaDetail(schema.name)
        schemaResolutions[schema.name] = kernel.peekSchemaResolution(schema.name)
      }

      return { schemas, schemaDetails, schemaResolutions }
    },
    { reactive }
  )
}

async function fetchOpsxTemplates(
  ctx: Context,
  schema?: string,
  reactive = false
): Promise<TemplatesMap> {
  return runPlanningRoot(
    ctx,
    async ({ kernel }) => {
      await kernel.ensureTemplates(schema)
      return kernel.getTemplates(schema)
    },
    { reactive }
  )
}

async function fetchOpsxTemplateContents(
  ctx: Context,
  schema?: string,
  reactive = false
): Promise<TemplateContentMap> {
  return runPlanningRoot(
    ctx,
    async ({ kernel }) => {
      await kernel.ensureTemplateContents(schema)
      return kernel.getTemplateContents(schema)
    },
    { reactive }
  )
}

interface SystemStatusPayload {
  projectDir: string
  watcherEnabled: boolean
  watcherRootCount: number
  watcherSubscriptionCount: number
  watcherRoots: NonNullable<ReturnType<typeof getWatcherRuntimeStatus>>['roots']
  projectRecovery: ProjectRecoveryStatus
}

function buildSystemStatus(ctx: Context): SystemStatusPayload {
  const runtime = getWatcherRuntimeStatus()
  return {
    projectDir: ctx.projectDir,
    watcherEnabled: runtime?.initialized ?? false,
    watcherRootCount: runtime?.rootCount ?? 0,
    watcherSubscriptionCount: runtime?.subscriptionCount ?? 0,
    watcherRoots: runtime?.roots ?? [],
    projectRecovery: ctx.projectRecoveryService.getCurrent(),
  }
}

function specCatalogSource(ctx: Context, services: PlanningRootServices) {
  return {
    rootContext: services.rootContext,
    adapter: services.adapter,
    documentService: services.documentService,
    contracts: ctx.cliExecutor.contracts,
  }
}

/** Source-aware Spec Catalog and document operations. */
export const specRouter = router({
  /** Return owned and direct referenced Specs without flattening compound identity. */
  catalog: publicProcedure.query(async ({ ctx }) => {
    return runPlanningRoot(ctx, (services) => readSpecCatalog(specCatalogSource(ctx, services)))
  }),

  /** Return the exact owned or referenced document projection and its source evidence. */
  document: publicProcedure.input(SpecIdentitySchema).query(async ({ ctx, input }) => {
    try {
      return await runPlanningRoot(ctx, (services) =>
        readSpecDocument(specCatalogSource(ctx, services), input)
      )
    } catch (error) {
      if (error instanceof SpecCatalogIdentityNotFoundError) {
        throw new TRPCError({ code: 'NOT_FOUND', message: error.message })
      }
      throw error
    }
  }),

  /** Write an owned Spec; referenced identities are rejected by the input schema. */
  save: publicProcedure
    .input(z.object({ identity: OwnedSpecIdentitySchema, content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const specId = requireCanonicalOpenSpecEntityId(input.identity.specId, 'specId')
      await runPlanningRoot(ctx, ({ adapter }) => adapter.writeSpec(specId, input.content))
      return { success: true }
    }),

  /** Validate an owned Spec; referenced identities remain immutable CLI projections. */
  validate: publicProcedure.input(OwnedSpecIdentitySchema).query(async ({ ctx, input }) => {
    return runPlanningRoot(ctx, ({ adapter }) => adapter.validateSpec(input.specId))
  }),

  /** Reactively rebuild the source-aware catalog after Root/Reference invalidation. */
  subscribeCatalog: publicProcedure.subscription(({ ctx }) => {
    return createPlanningRootSubscription(ctx, (services) =>
      readSpecCatalog(specCatalogSource(ctx, services))
    )
  }),

  /** Reactively pull the exact source document after project or Store invalidation. */
  subscribeDocument: publicProcedure.input(SpecIdentitySchema).subscription(({ ctx, input }) => {
    return createPlanningRootSubscription(ctx, (services) =>
      readSpecDocument(specCatalogSource(ctx, services), input)
    )
  }),
})

/**
 * Change router - change proposal operations
 */
export const changeRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return runPlanningRoot(ctx, ({ adapter }) => adapter.listChanges())
  }),

  listWithMeta: publicProcedure.query(async ({ ctx }) => {
    return runPlanningRoot(ctx, ({ adapter }) => adapter.listChangesWithMeta())
  }),

  listArchived: publicProcedure.query(async ({ ctx }) => {
    return runPlanningRoot(ctx, ({ adapter }) => adapter.listArchivedChanges())
  }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return runPlanningRoot(ctx, ({ documentService }) => documentService.readChange(input.id))
  }),

  getRaw: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return runPlanningRoot(ctx, ({ adapter }) => adapter.readChangeRaw(input.id))
  }),

  save: publicProcedure
    .input(z.object({ id: z.string(), proposal: z.string(), tasks: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const changeId = requireCanonicalOpenSpecEntityId(input.id, 'changeId')
      await runPlanningRoot(ctx, ({ adapter }) =>
        adapter.writeChange(changeId, input.proposal, input.tasks)
      )
      return { success: true }
    }),

  validate: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return runPlanningRoot(ctx, ({ adapter }) => adapter.validateChange(input.id))
  }),

  toggleTask: publicProcedure
    .input(
      z.object({
        changeId: z.string(),
        location: z.object({
          filePath: z.string().min(1),
          taskIndex: z.number().int().positive(),
        }),
        completed: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await runPlanningRoot(ctx, async ({ adapter, rootContext }) => {
        const projectDir = rootContext.planningRoot?.path
        if (!projectDir) throw new Error('Planning root is unavailable.')
        await setTrackedTaskCompletion({
          adapter,
          projectDir,
          changeId: input.changeId,
          location: input.location,
          completed: input.completed,
        })
      })
      return { success: true }
    }),

  // Reactive subscriptions
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createPlanningRootSubscription(ctx, ({ adapter }) => adapter.listChangesWithMeta())
  }),

  /** Stream bounded Change rows before the complete inventory settles. */
  subscribeBatches: publicProcedure.subscription(({ ctx }) =>
    createPlanningRootProjectionWorkSubscription<ChangeProjectionData, ChangeProjectionBatch>(
      ctx,
      (services, listener) => services.changesProjectionService.subscribe(listener),
      (event) => changeProjectionEventSchema().parse(event)
    )
  ),

  subscribeFiles: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createPlanningRootSubscription(ctx, ({ adapter }) => adapter.readChangeFiles(input.id))
    }),

  writeFile: publicProcedure
    .input(
      z.object({
        id: z.string(),
        path: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await runPlanningRoot(ctx, ({ adapter }) =>
        adapter.writeEntityFile('change', input.id, input.path, input.content)
      )
      return { success: true }
    }),

  prepareFilePreview: publicProcedure
    .input(
      z.object({
        id: z.string(),
        path: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return runPlanningRoot(ctx, ({ filePreviewService }) =>
        filePreviewService.prepareEntityFilePreview({
          stage: 'change',
          changeId: input.id,
          path: input.path,
        })
      )
    }),
})

/**
 * Init router - project initialization
 */
export const initRouter = router({
  init: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.launchProjectAdapter.init()
    return { success: true }
  }),
})

/**
 * Archive router - archived changes
 */
export const archiveRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return runPlanningRoot(ctx, ({ adapter }) => adapter.listArchivedChanges())
  }),

  listWithMeta: publicProcedure.query(async ({ ctx }) => {
    return runPlanningRoot(ctx, ({ adapter }) => adapter.listArchivedChangesWithMeta())
  }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return runPlanningRoot(ctx, async (services) =>
      services.documentService.readEntityDetail(
        'archive',
        input.id,
        'view',
        'processed',
        await buildEntityReadOptions(services, 'archive', input.id)
      )
    )
  }),

  getRaw: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return runPlanningRoot(ctx, async (services) =>
      services.documentService.readEntityDetail(
        'archive',
        input.id,
        'view',
        'source',
        await buildEntityReadOptions(services, 'archive', input.id)
      )
    )
  }),

  // Reactive subscriptions
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createPlanningRootProjectionSubscription(ctx, ({ adapter }) =>
      adapter.listArchivedChangesWithMeta()
    )
  }),

  subscribeOne: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createPlanningRootSubscription(ctx, async (services) =>
        services.documentService.readEntityDetail(
          'archive',
          input.id,
          'view',
          'processed',
          await buildEntityReadOptions(services, 'archive', input.id)
        )
      )
    }),

  subscribeFiles: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createPlanningRootSubscription(ctx, ({ documentService }) =>
        documentService.readArchivedChangeFiles(input.id, 'view', 'source')
      )
    }),

  writeFile: publicProcedure
    .input(
      z.object({
        id: z.string(),
        path: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await runPlanningRoot(ctx, ({ adapter }) =>
        adapter.writeEntityFile('archive', input.id, input.path, input.content)
      )
      return { success: true }
    }),

  prepareFilePreview: publicProcedure
    .input(
      z.object({
        id: z.string(),
        path: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return runPlanningRoot(ctx, ({ filePreviewService }) =>
        filePreviewService.prepareEntityFilePreview({
          stage: 'archive',
          changeId: input.id,
          path: input.path,
        })
      )
    }),
})

/**
 * File change event schema for type safety
 * @internal Used for documentation, actual type comes from @openspecui/core
 */
const _FileChangeEventSchema = z.object({
  type: z.enum(['spec', 'change', 'archive', 'project']),
  action: z.enum(['create', 'update', 'delete']),
  id: z.string().optional(),
  path: z.string(),
  timestamp: z.number(),
})
void _FileChangeEventSchema // Suppress unused warning

/**
 * Realtime router - file change subscriptions
 */
export const realtimeRouter = router({
  /**
   * Subscribe to all file changes
   */
  onFileChange: publicProcedure.subscription(({ ctx }) => {
    return observable<FileChangeEvent>((emit) => {
      if (!ctx.watcher) {
        emit.error(new Error('File watcher not available'))
        return () => {}
      }

      const handler = (event: FileChangeEvent) => {
        emit.next(event)
      }

      ctx.watcher.on('change', handler)

      return () => {
        ctx.watcher?.off('change', handler)
      }
    })
  }),

  /**
   * Subscribe to spec changes only
   */
  onSpecChange: publicProcedure
    .input(z.object({ specId: z.string().optional() }).optional())
    .subscription(({ ctx, input }) => {
      return observable<FileChangeEvent>((emit) => {
        if (!ctx.watcher) {
          emit.error(new Error('File watcher not available'))
          return () => {}
        }

        const handler = (event: FileChangeEvent) => {
          if (event.type !== 'spec') return
          if (input?.specId && event.id !== input.specId) return
          emit.next(event)
        }

        ctx.watcher.on('change', handler)

        return () => {
          ctx.watcher?.off('change', handler)
        }
      })
    }),

  /**
   * Subscribe to change proposal changes only
   */
  onChangeChange: publicProcedure
    .input(z.object({ changeId: z.string().optional() }).optional())
    .subscription(({ ctx, input }) => {
      return observable<FileChangeEvent>((emit) => {
        if (!ctx.watcher) {
          emit.error(new Error('File watcher not available'))
          return () => {}
        }

        const handler = (event: FileChangeEvent) => {
          if (event.type !== 'change' && event.type !== 'archive') return
          if (input?.changeId && event.id !== input.changeId) return
          emit.next(event)
        }

        ctx.watcher.on('change', handler)

        return () => {
          ctx.watcher?.off('change', handler)
        }
      })
    }),
})

/**
 * Config router - configuration management
 */
export const configRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    return ctx.configManager.readConfig()
  }),

  getPresence: publicProcedure.query(async ({ ctx }) => {
    return ctx.configManager.readConfigPresence()
  }),

  /** 获取实际使用的 CLI 命令（runner 解析后的 execute-path，字符串形式用于 UI 显示） */
  getEffectiveCliCommand: publicProcedure.query(async ({ ctx }) => {
    return ctx.configManager.getCliCommandString()
  }),

  /** 获取检测到的默认 CLI 命令（不读取配置文件，字符串形式用于 UI 显示） */
  getDefaultCliCommand: publicProcedure.query(async () => {
    return getDefaultCliCommandString()
  }),

  update: publicProcedure
    .input(
      z.object({
        cli: z
          .object({
            command: z.string().nullable().optional(),
            args: z.array(z.string()).nullable().optional(),
          })
          .optional(),
        theme: z.enum(['light', 'dark', 'system']).optional(),
        codeEditor: z
          .object({
            theme: CodeEditorThemeSchema.optional(),
          })
          .optional(),
        appBaseUrl: z.string().optional(),
        opsx: OpsxConfigSchema.partial().optional(),
        terminal: TerminalConfigSchema.omit({ rendererEngine: true })
          .partial()
          .extend({
            rendererEngine: TerminalRendererEngineSchema.optional(),
          })
          .optional(),
        dashboard: DashboardConfigSchema.partial().optional(),
        git: GitConfigSchema.partial().optional(),
        notifications: NotificationSettingsSchema.partial().optional(),
        translation: DocumentTranslationConfigUpdateSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const hasCliCommand =
        input.cli !== undefined && Object.prototype.hasOwnProperty.call(input.cli, 'command')
      const hasCliArgs =
        input.cli !== undefined && Object.prototype.hasOwnProperty.call(input.cli, 'args')

      if (hasCliCommand && !hasCliArgs) {
        await ctx.configManager.setCliCommand(input.cli?.command ?? '')
        if (
          input.theme !== undefined ||
          input.codeEditor !== undefined ||
          input.appBaseUrl !== undefined ||
          input.opsx !== undefined ||
          input.terminal !== undefined ||
          input.dashboard !== undefined ||
          input.git !== undefined ||
          input.notifications !== undefined ||
          input.translation !== undefined
        ) {
          await ctx.configManager.writeConfig({
            theme: input.theme,
            codeEditor: input.codeEditor,
            appBaseUrl: input.appBaseUrl,
            opsx: input.opsx,
            terminal: input.terminal,
            dashboard: input.dashboard,
            git: input.git,
            notifications: input.notifications,
            translation: input.translation,
          })
        }
        return { success: true }
      }

      await ctx.configManager.writeConfig(input)
      return { success: true }
    }),

  // Reactive subscription
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.configManager.readConfig())
  }),

  subscribePresence: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.configManager.readConfigPresence())
  }),

  getTerminalShellDefaults: publicProcedure.query(async () => {
    const platform =
      process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'common'
    return resolveTerminalShellDefaults({
      platform,
      env: {
        SHELL: process.env.SHELL,
        ComSpec: process.env.ComSpec,
      },
    })
  }),
})

function buildPlanningRootUpdateArgs(
  rootContext: PlanningRootServices['rootContext'],
  options: { force?: boolean } = {}
): string[] {
  const planningRoot = rootContext.planningRoot
  if (!planningRoot) throw new Error('Planning root is unavailable.')
  const args = ['update', planningRoot.path]
  if (options.force) args.push('--force')
  return args
}

/**
 * CLI router - execute external openspec CLI commands
 */
export const cliRouter = router({
  checkAvailability: publicProcedure.query(async ({ ctx }) => {
    return ctx.cliExecutor.checkAvailability()
  }),

  /** 嗅探全局 openspec 命令（无缓存） */
  sniffGlobalCli: publicProcedure.query(async () => {
    return sniffGlobalCli()
  }),

  /** Stream the fixed global CLI install and invalidate Root Context on every settlement. */
  installGlobalCliStream: publicProcedure.subscription(({ ctx }) => {
    return createCliStreamObservable((onEvent) =>
      new CliMutationInvalidator(ctx.runtimeInvalidation).stream(
        ['context'],
        (emitEvent) =>
          ctx.cliExecutor.executeCommandStream(
            ['npm', 'install', '-g', '@fission-ai/openspec'],
            emitEvent
          ),
        onEvent,
        () => ctx.configManager.invalidateResolvedCliRunner()
      )
    )
  }),

  /** 获取可用的工具列表（available: true） */
  getAvailableTools: publicProcedure.query(() => {
    // 返回完整的工具信息，去掉 scope 和 detectionPath（前端不需要）
    return getAvailableTools().map((tool) => ({
      name: tool.name,
      value: tool.value,
      available: tool.available,
      successLabel: tool.successLabel,
    })) satisfies AIToolOption[]
  }),

  /** 获取所有工具列表（包括 available: false 的） */
  getAllTools: publicProcedure.query(() => {
    // 返回完整的工具信息，去掉 scope 和 detectionPath（前端不需要）
    return getAllTools().map((tool) => ({
      name: tool.name,
      value: tool.value,
      available: tool.available,
      successLabel: tool.successLabel,
    })) satisfies AIToolOption[]
  }),

  /** Subscribe to launch-project tools detected through reactive filesystem reads. */
  subscribeDetectedProjectTools: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(async () => {
      return (await getDetectedProjectTools(ctx.projectDir)).map((tool) => ({
        name: tool.name,
        value: tool.value,
        available: tool.available,
        successLabel: tool.successLabel,
      })) satisfies AIToolOption[]
    })
  }),

  /** Subscribe to launch skills and environment-owned commands for one delivery contract. */
  subscribeToolInitStates: publicProcedure
    .input(
      z.object({
        delivery: z.enum(['both', 'skills', 'commands']),
        workflows: z.array(z.string()).default([]),
      })
    )
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await ctx.toolCommandObservation.start()
        return getToolInitStates(ctx.projectDir, {
          delivery: input.delivery,
          workflows: input.workflows,
        })
      })
    }),

  /** 获取已配置的工具列表（检查配置文件是否存在） */
  getConfiguredTools: publicProcedure.query(async ({ ctx }) => {
    return getConfiguredTools(ctx.projectDir)
  }),

  /** 订阅已配置的工具列表（响应式） */
  subscribeConfiguredTools: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => getConfiguredTools(ctx.projectDir))
  }),

  /** 初始化 OpenSpec（非交互式） */
  init: publicProcedure
    .input(
      z
        .object({
          tools: z.union([z.array(z.string()), z.literal('all'), z.literal('none')]).optional(),
          profile: z.enum(['core', 'custom']).optional(),
          force: z.boolean().optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      return runOpenSpecCliMutation(ctx, ['init'], () =>
        ctx.cliExecutor.init({
          tools: input?.tools,
          profile: input?.profile,
          force: input?.force,
        })
      )
    }),

  validate: publicProcedure
    .input(
      z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('item'),
          id: z.string().min(1),
          type: z.enum(['spec', 'change']).optional(),
          strict: z.boolean().optional(),
        }),
        z.object({
          kind: z.literal('scope'),
          scope: z.enum(['all', 'changes', 'specs']),
          strict: z.boolean().optional(),
        }),
      ])
    )
    .mutation(async ({ ctx, input }) => {
      return runPlanningRoot(ctx, ({ rootContext }) =>
        ctx.cliExecutor.contracts.validate({
          target:
            input.kind === 'item'
              ? { kind: 'item', id: input.id, type: input.type }
              : { kind: 'scope', scope: input.scope },
          strict: input.strict,
          ...getRootContextCliSelector(rootContext),
        })
      )
    }),

  /** 流式执行 validate（实时输出） */
  validateStream: publicProcedure
    .input(
      z.object({
        type: z.enum(['spec', 'change']).optional(),
        id: z.string().optional(),
        strict: z.boolean().optional(),
        /** Opaque generation observed during workflow preparation. */
        expectedRootGeneration: z.string().min(1).optional(),
      })
    )
    .subscription(({ ctx, input }) => {
      return createPlanningRootCliStreamObservable(
        ctx,
        ({ rootContext, gitBindingToken }, onEvent) => {
          if (
            input.expectedRootGeneration !== undefined &&
            input.expectedRootGeneration !== gitBindingToken
          ) {
            throw new TRPCError({
              code: 'CONFLICT',
              message:
                'Planning root changed before validation started. Prepare the workflow again.',
            })
          }
          const { expectedRootGeneration: _expectedRootGeneration, ...validateInput } = input
          return ctx.cliExecutor.validateStream(
            { ...validateInput, ...getRootContextCliSelector(rootContext) },
            onEvent
          )
        }
      )
    }),

  /** Update instruction files only in the current Server-selected Planning root. */
  update: publicProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      return runPlanningRoot(ctx, ({ rootContext }) => {
        const args = buildPlanningRootUpdateArgs(rootContext, input)
        return runOpenSpecCliMutation(ctx, args, () => ctx.cliExecutor.execute(args))
      })
    }),

  /** Stream one Planning-root Update without accepting a browser path or Store selector. */
  updateStream: publicProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .subscription(({ ctx, input }) => {
      return createPlanningRootCliStreamObservable(ctx, ({ rootContext }, onEvent) => {
        const args = buildPlanningRootUpdateArgs(rootContext, input)
        return streamOpenSpecCliMutation(
          ctx,
          args,
          (mutationEvent) => ctx.cliExecutor.executeStream(args, mutationEvent),
          onEvent
        )
      })
    }),

  /** 流式执行 init（实时输出） */
  initStream: publicProcedure
    .input(
      z
        .object({
          tools: z.union([z.array(z.string()), z.literal('all'), z.literal('none')]).optional(),
          profile: z.enum(['core', 'custom']).optional(),
          force: z.boolean().optional(),
        })
        .optional()
    )
    .subscription(({ ctx, input }) => {
      return createCliStreamObservable((onEvent) =>
        streamOpenSpecCliMutation(
          ctx,
          ['init'],
          (mutationEvent) =>
            ctx.cliExecutor.initStream(
              {
                tools: input?.tools,
                profile: input?.profile,
                force: input?.force,
              },
              mutationEvent
            ),
          onEvent
        )
      )
    }),

  /** Strict validate then archive against one Server-owned Root Context selection. */
  archiveStrictStream: publicProcedure
    .input(
      z.object({
        changeId: z.string(),
        skipSpecs: z.boolean().optional(),
        noValidate: z.boolean().optional(),
      })
    )
    .subscription(({ ctx, input }) => {
      return createCliStreamObservable((onEvent) => {
        const changeId = requireCanonicalOpenSpecEntityId(input.changeId, 'changeId')
        return startPlanningRootCliStream(
          ctx,
          ({ rootContext }, leasedEvent) => {
            const selector = getRootContextCliSelector(rootContext)
            return startStrictArchiveStream({
              skipValidation: input.noValidate === true,
              startValidate: (validateEvent) =>
                ctx.cliExecutor.validateStream(
                  {
                    id: changeId,
                    type: 'change',
                    strict: true,
                    ...selector,
                  },
                  validateEvent
                ),
              startArchive: (archiveEvent) =>
                streamOpenSpecCliMutation(
                  ctx,
                  ['archive'],
                  (mutationEvent) =>
                    ctx.cliExecutor.archiveStream(
                      changeId,
                      {
                        skipSpecs: input.skipSpecs,
                        noValidate: true,
                        ...selector,
                      },
                      mutationEvent
                    ),
                  archiveEvent
                ),
              onEvent: leasedEvent,
            })
          },
          onEvent
        )
      })
    }),
})

/**
 * OPSX router - CLI-driven workflow data
 */
export const opsxRouter = router({
  runWorkflow: publicProcedure
    .input(
      z.object({
        requestedMode: workflowRequestedModeSchema,
        input: runWorkflowInputSchema,
      })
    )
    .mutation(async ({ ctx, input }): Promise<RunWorkflowResultV2> => {
      return runPlanningRoot(ctx, ({ workflowInvocationService }) =>
        workflowInvocationService.runWorkflow(
          input.input as RunWorkflowInputV1,
          input.requestedMode as WorkflowRequestedModeV1
        )
      )
    }),

  status: publicProcedure
    .input(
      z.object({
        change: z.string().optional(),
        schema: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }): Promise<ChangeStatus> => {
      return fetchOpsxStatus(ctx, input)
    }),

  subscribeStatus: publicProcedure
    .input(
      z.object({
        change: z.string().optional(),
        schema: z.string().optional(),
      })
    )
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(() => fetchOpsxStatus(ctx, input, true))
    }),

  statusList: publicProcedure.query(async ({ ctx }): Promise<ChangeStatus[]> => {
    return fetchOpsxStatusList(ctx)
  }),

  subscribeStatusList: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => fetchOpsxStatusList(ctx, true))
  }),

  instructions: publicProcedure
    .input(
      z.object({
        change: z.string().optional(),
        artifact: z.string(),
        schema: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }): Promise<ArtifactInstructions> => {
      return fetchOpsxInstructions(ctx, input)
    }),

  subscribeInstructions: publicProcedure
    .input(
      z.object({
        change: z.string().optional(),
        artifact: z.string(),
        schema: z.string().optional(),
      })
    )
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(() => fetchOpsxInstructions(ctx, input, true))
    }),

  applyInstructions: publicProcedure
    .input(
      z.object({
        change: z.string().optional(),
        schema: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }): Promise<ApplyInstructions> => {
      return fetchOpsxApplyInstructions(ctx, input)
    }),

  subscribeApplyInstructions: publicProcedure
    .input(
      z.object({
        change: z.string().optional(),
        schema: z.string().optional(),
      })
    )
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(() => fetchOpsxApplyInstructions(ctx, input, true))
    }),

  configBundle: publicProcedure.query(async ({ ctx }) => {
    return fetchOpsxConfigBundle(ctx)
  }),

  subscribeConfigBundle: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => fetchOpsxConfigBundle(ctx, true))
  }),

  templates: publicProcedure
    .input(z.object({ schema: z.string().optional() }).optional())
    .query(async ({ ctx, input }): Promise<TemplatesMap> => {
      return fetchOpsxTemplates(ctx, input?.schema)
    }),

  subscribeTemplates: publicProcedure
    .input(z.object({ schema: z.string().optional() }).optional())
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(() => fetchOpsxTemplates(ctx, input?.schema, true))
    }),

  templateContents: publicProcedure
    .input(z.object({ schema: z.string().optional() }).optional())
    .query(async ({ ctx, input }): Promise<TemplateContentMap> => {
      return fetchOpsxTemplateContents(ctx, input?.schema)
    }),

  subscribeTemplateContents: publicProcedure
    .input(z.object({ schema: z.string().optional() }).optional())
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(() => fetchOpsxTemplateContents(ctx, input?.schema, true))
    }),

  schemaFiles: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }): Promise<ChangeFile[]> => {
      return runPlanningRoot(ctx, async ({ kernel }) => {
        await kernel.ensureSchemaFiles(input.name)
        return kernel.getSchemaFiles(input.name)
      })
    }),

  subscribeSchemaFiles: publicProcedure
    .input(z.object({ name: z.string() }))
    .subscription(({ ctx, input }) => {
      return createPlanningRootSubscription(ctx, async ({ kernel }) => {
        await kernel.ensureSchemaFiles(input.name)
        return kernel.getSchemaFiles(input.name)
      })
    }),

  schemaYaml: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      return runPlanningRoot(ctx, async ({ kernel }) => {
        await kernel.ensureSchemaYaml(input.name)
        return kernel.getSchemaYaml(input.name)
      })
    }),

  subscribeSchemaYaml: publicProcedure
    .input(z.object({ name: z.string() }))
    .subscription(({ ctx, input }) => {
      return createPlanningRootSubscription(ctx, async ({ kernel }) => {
        await kernel.ensureSchemaYaml(input.name)
        return kernel.getSchemaYaml(input.name)
      })
    }),

  writeSchemaYaml: publicProcedure
    .input(z.object({ name: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await mutatePlanningSchema(ctx, {
        action: 'write-yaml',
        schema: input.name,
        content: input.content,
      })
      return { success: true }
    }),

  writeSchemaFile: publicProcedure
    .input(z.object({ schema: z.string(), path: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await mutatePlanningSchema(ctx, {
        action: 'write-file',
        schema: input.schema,
        path: input.path,
        content: input.content,
      })
      return { success: true }
    }),

  createSchemaFile: publicProcedure
    .input(z.object({ schema: z.string(), path: z.string(), content: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await mutatePlanningSchema(ctx, {
        action: 'create-file',
        schema: input.schema,
        path: input.path,
        ...(input.content === undefined ? {} : { content: input.content }),
      })
      return { success: true }
    }),

  createSchemaDirectory: publicProcedure
    .input(z.object({ schema: z.string(), path: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await mutatePlanningSchema(ctx, {
        action: 'create-directory',
        schema: input.schema,
        path: input.path,
      })
      return { success: true }
    }),

  deleteSchemaEntry: publicProcedure
    .input(z.object({ schema: z.string(), path: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await mutatePlanningSchema(ctx, {
        action: 'delete-entry',
        schema: input.schema,
        path: input.path,
      })
      return { success: true }
    }),

  templateContent: publicProcedure
    .input(z.object({ schema: z.string(), artifactId: z.string() }))
    .query(async ({ ctx, input }) => {
      const templateContents = await fetchOpsxTemplateContents(ctx, input.schema)
      const info = templateContents[input.artifactId]
      if (!info) {
        throw new Error(`Template not found for ${input.schema}:${input.artifactId}`)
      }
      return info
    }),

  subscribeTemplateContent: publicProcedure
    .input(z.object({ schema: z.string(), artifactId: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        const templateContents = await fetchOpsxTemplateContents(ctx, input.schema, true)
        const info = templateContents[input.artifactId]
        if (!info) {
          throw new Error(`Template not found for ${input.schema}:${input.artifactId}`)
        }
        return info
      })
    }),

  writeTemplateContent: publicProcedure
    .input(z.object({ schema: z.string(), artifactId: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await mutatePlanningSchema(ctx, {
        action: 'write-template',
        schema: input.schema,
        artifactId: input.artifactId,
        content: input.content,
      })
      return { success: true }
    }),

  deleteSchema: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await mutatePlanningSchema(ctx, { action: 'delete-schema', schema: input.name })
      return { success: true }
    }),

  /** Create one project-local Schema from the selected Planning root. */
  initSchema: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await mutatePlanningSchema(ctx, { action: 'init', name: input.name })
      if (!result) throw new Error('Schema init did not return CLI evidence.')
      return result
    }),

  /** Fork one available Schema into the selected Planning root. */
  forkSchema: publicProcedure
    .input(z.object({ source: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await mutatePlanningSchema(ctx, {
        action: 'fork',
        source: input.source,
        name: input.name,
      })
      if (!result) throw new Error('Schema fork did not return CLI evidence.')
      return result
    }),

  listChanges: publicProcedure.query(async ({ ctx }) => {
    return runPlanningRoot(ctx, async ({ kernel }) => {
      await kernel.ensureChangeIds()
      return kernel.getChangeIds()
    })
  }),

  subscribeChanges: publicProcedure.subscription(({ ctx }) => {
    return createPlanningRootSubscription(ctx, async ({ kernel }) => {
      await kernel.ensureChangeIds()
      return kernel.getChangeIds()
    })
  }),

  readArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .query(async ({ ctx, input }) => {
      const location = requireOpsxArtifactLocation(input)
      return runPlanningRoot(ctx, async ({ kernel, documentService }) => {
        await kernel.ensureArtifactOutput(location.changeId, location.outputPath)
        return documentService.readChangeArtifactOutput(
          location.changeId,
          location.outputPath,
          'view',
          'processed'
        )
      })
    }),

  subscribeArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .subscription(({ ctx, input }) => {
      const location = requireOpsxArtifactLocation(input)
      return createPlanningRootSubscription(ctx, async ({ kernel, documentService }) => {
        await kernel.ensureArtifactOutput(location.changeId, location.outputPath)
        return documentService.readChangeArtifactOutput(
          location.changeId,
          location.outputPath,
          'view',
          'processed'
        )
      })
    }),

  readGlobArtifactFiles: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .query(async ({ ctx, input }) => {
      const location = requireOpsxArtifactLocation(input)
      return runPlanningRoot(ctx, async ({ kernel, documentService }) => {
        await kernel.ensureGlobArtifactFiles(location.changeId, location.outputPath)
        return documentService.readChangeGlobArtifactFiles(
          location.changeId,
          location.outputPath,
          'view',
          'processed'
        )
      })
    }),

  subscribeGlobArtifactFiles: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .subscription(({ ctx, input }) => {
      const location = requireOpsxArtifactLocation(input)
      return createPlanningRootSubscription(ctx, async ({ kernel, documentService }) => {
        await kernel.ensureGlobArtifactFiles(location.changeId, location.outputPath)
        return documentService.readChangeGlobArtifactFiles(
          location.changeId,
          location.outputPath,
          'view',
          'processed'
        )
      })
    }),

  writeArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await runPlanningRoot(ctx, ({ adapter }) =>
        adapter.writeEntityFile('change', input.changeId, input.outputPath, input.content)
      )
      return { success: true }
    }),
})

/**
 * KV router - in-memory reactive key-value store
 * No disk persistence — devices use IndexedDB for their own storage.
 */
export const kvRouter = router({
  get: publicProcedure.input(z.object({ key: z.string() })).query(({ input }) => {
    return reactiveKV.get(input.key) ?? null
  }),

  set: publicProcedure
    .input(z.object({ key: z.string(), value: z.unknown() }))
    .mutation(({ input }) => {
      reactiveKV.set(input.key, input.value)
      return { success: true }
    }),

  delete: publicProcedure.input(z.object({ key: z.string() })).mutation(({ input }) => {
    reactiveKV.delete(input.key)
    return { success: true }
  }),

  subscribe: publicProcedure.input(z.object({ key: z.string() })).subscription(({ input }) => {
    return observable<unknown>((emit) => {
      // Emit current value immediately
      const current = reactiveKV.get(input.key)
      emit.next(current ?? null)

      // Listen for changes
      const unsub = reactiveKV.onKey(input.key, (value) => {
        emit.next(value ?? null)
      })

      return () => {
        unsub()
      }
    })
  }),
})

/**
 * Source-scoped project Search over Planning-root Owned Specs, Changes, and Archives by default,
 * or direct read-only Referenced Specs when explicitly selected. Queries and subscriptions retain
 * the exact normalized scope through their result boundary.
 */
export const searchRouter = router({
  query: publicProcedure
    .input(ProjectSearchQuerySchema)
    .output(ProjectSearchHitSchema.array())
    .query(async ({ ctx, input }) => {
      return runPlanningRoot(ctx, async ({ searchService }) =>
        parseProjectSearchHits(await searchService.query(input), input.scope)
      )
    }),

  subscribe: publicProcedure.input(ProjectSearchQuerySchema).subscription(({ ctx, input }) => {
    return createPlanningRootSubscription(ctx, async ({ searchService }) =>
      parseProjectSearchHits(await searchService.queryReactive(input), input.scope)
    )
  }),
})

/**
 * System router - runtime status and heartbeat-friendly subscription
 */
export const systemRouter = router({
  status: publicProcedure.query(({ ctx }) => {
    return buildSystemStatus(ctx)
  }),

  subscribe: publicProcedure.subscription(({ ctx }) => {
    return observable<SystemStatusPayload>((emit) => {
      const pushStatus = () => {
        emit.next(buildSystemStatus(ctx))
      }

      pushStatus()
      const unsubscribeWatcherRuntime = subscribeWatcherRuntimeStatus(() => {
        pushStatus()
      })
      const unsubscribeProjectRecovery = ctx.projectRecoveryService.subscribe(() => {
        pushStatus()
      })

      const timer = setInterval(() => {
        pushStatus()
      }, 3000)
      timer.unref()

      return () => {
        clearInterval(timer)
        unsubscribeWatcherRuntime()
        unsubscribeProjectRecovery()
      }
    })
  }),
})

/**
 * Dashboard router - objective project overview for UI
 */
export const dashboardRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    return runPlanningRoot(ctx, ({ dashboardOverviewService }) =>
      dashboardOverviewService.getCurrent()
    )
  }),

  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createPlanningRootSubscription(ctx, ({ dashboardOverviewService }) =>
      dashboardOverviewService.getCurrent()
    )
  }),

  getSummary: publicProcedure.query(({ ctx }) => {
    return runPlanningRoot(ctx, ({ dashboardProjectionService }) =>
      dashboardProjectionService.getSummary()
    )
  }),

  getTrends: publicProcedure.query(({ ctx }) => {
    return runPlanningRoot(ctx, ({ dashboardProjectionService }) =>
      dashboardProjectionService.getTrends()
    )
  }),

  getGit: publicProcedure.query(({ ctx }) => {
    return runPlanningRoot(ctx, ({ dashboardProjectionService }) =>
      dashboardProjectionService.getGit()
    )
  }),

  subscribeSummary: publicProcedure.subscription(({ ctx }) =>
    createPlanningRootProjectionWorkSubscription<DashboardSummaryProjection>(
      ctx,
      (services, listener) => services.dashboardProjectionService.subscribeSummary(listener),
      (event) =>
        dashboardProjectionEventSchema<DashboardSummaryProjection>(
          DashboardSummaryProjectionSchema
        ).parse(event)
    )
  ),

  subscribeTrends: publicProcedure.subscription(({ ctx }) =>
    createPlanningRootProjectionWorkSubscription<DashboardTrendsProjection>(
      ctx,
      (services, listener) => services.dashboardProjectionService.subscribeTrends(listener),
      (event) =>
        dashboardProjectionEventSchema<DashboardTrendsProjection>(
          DashboardTrendsProjectionSchema
        ).parse(event)
    )
  ),

  subscribeGit: publicProcedure.subscription(({ ctx }) =>
    createPlanningRootProjectionWorkSubscription<DashboardGitSnapshot>(
      ctx,
      (services, listener) => services.dashboardProjectionService.subscribeGit(listener),
      (event) =>
        dashboardProjectionEventSchema<DashboardGitSnapshot>(DashboardGitSnapshotSchema).parse(
          event
        )
    )
  ),

  refreshGitSnapshot: publicProcedure
    .input(
      z.object({
        scope: z.literal('code'),
        expectedBindingToken: gitBindingTokenSchema,
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const reason = input.reason?.trim() || 'manual-refresh'
      return runGitScope(ctx, input, async (codeRepository) => {
        await touchDashboardGitRefreshStamp(gitRepositoryCwd(codeRepository), reason)
        invalidateCurrentDashboardGitProjection(ctx)
        return { success: true }
      })
    }),

  removeDetachedWorktree: publicProcedure
    .input(
      z.object({
        scope: z.literal('code'),
        expectedBindingToken: gitBindingTokenSchema,
        path: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return runGitScope(ctx, input, async (codeRepository) => {
        const projectDir = gitRepositoryCwd(codeRepository)
        await removeDetachedDashboardGitWorktree({
          projectDir,
          targetPath: input.path,
        })
        invalidateGitPanelCache(projectDir)
        await touchDashboardGitRefreshStamp(projectDir, 'remove-detached-worktree')
        invalidateCurrentDashboardGitProjection(ctx)
        return { success: true }
      })
    }),

  gitTaskStatus: publicProcedure.query(() => {
    return getDashboardGitTaskStatus()
  }),

  subscribeGitTaskStatus: publicProcedure.subscription(() => {
    return observable<DashboardGitTaskStatus>((emit) => {
      emit.next(getDashboardGitTaskStatus())
      const unsubscribe = subscribeDashboardGitTaskStatus((status) => {
        emit.next(status)
      })

      return () => {
        unsubscribe()
      }
    })
  }),
})

function invalidateCurrentDashboardGitProjection(ctx: Context): void {
  void runPlanningRoot(ctx, ({ dashboardProjectionService }) =>
    dashboardProjectionService.invalidateGit()
  ).catch(() => {
    // Code Git remains independent; Root Context surfaces planning projection failures.
  })
}

async function fetchGitScopes(ctx: Context): Promise<GitRepositoryScopes> {
  return ctx.gitRepositoryBindings.resolveScopes()
}

async function runGitScope<T>(
  ctx: Context,
  binding: { scope: GitRepositoryScope; expectedBindingToken: string },
  task: (repository: GitRepositoryScopeDescriptor) => Promise<T> | T
): Promise<T> {
  try {
    return await ctx.gitRepositoryBindings.run(binding, task)
  } catch (error) {
    if (error instanceof GitRepositoryBindingConflictError) {
      throw new TRPCError({ code: 'CONFLICT', message: error.message, cause: error })
    }
    throw error
  }
}

function gitRepositoryCwd(scope: GitRepositoryScopeDescriptor): string {
  return scope.repository?.topLevel ?? scope.rootPath
}

/** Explicit code/planning Git repository query and mutation procedures. */
export const gitRouter = router({
  /** Return the stable Launch-owned Code binding without waiting for Planning resolution. */
  code: publicProcedure.query(({ ctx }) => ctx.gitRepositoryBindings.resolveCodeScope()),

  /** Return the current Code/Planning repository bindings and their opaque epochs. */
  scopes: publicProcedure.query(({ ctx }): Promise<GitRepositoryScopes> => fetchGitScopes(ctx)),

  /** Stream the current Code/Planning repository bindings and their opaque epochs. */
  subscribeScopes: publicProcedure.subscription(({ ctx }) => {
    return observable<GitRepositoryScopes>((emit) => {
      let active = true
      let planningSubscription: { unsubscribe(): void } | null = null
      void ctx.gitRepositoryBindings
        .resolveCodeScope()
        .then((code) => {
          if (!active) return
          emit.next({ defaultScope: 'code', code, planningState: 'resolving', planning: null })
          planningSubscription = createReactiveSubscription(() =>
            ctx.gitRepositoryBindings.resolvePlanningScopes(code, { reactive: true })
          ).subscribe({
            next(scopes) {
              if (active) emit.next(scopes)
            },
            error(error) {
              if (active) emit.error(error)
            },
          })
          if (!active) planningSubscription.unsubscribe()
        })
        .catch((error: unknown) => {
          if (active) emit.error(error instanceof Error ? error : new Error(String(error)))
        })

      return () => {
        active = false
        planningSubscription?.unsubscribe()
      }
    })
  }),

  overview: publicProcedure
    .input(
      z.object({ scope: gitRepositoryScopeSchema, expectedBindingToken: gitBindingTokenSchema })
    )
    .query(async ({ ctx, input }): Promise<GitWorktreeOverview> => {
      return runGitScope(ctx, input, (repository) =>
        buildGitWorktreeOverview({ projectDir: gitRepositoryCwd(repository) })
      )
    }),

  listEntries: publicProcedure
    .input(
      z.object({
        scope: gitRepositoryScopeSchema,
        expectedBindingToken: gitBindingTokenSchema,
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
    )
    .query(async ({ ctx, input }): Promise<GitEntriesPage> => {
      return runGitScope(ctx, input, (repository) =>
        listCurrentWorktreeGitEntries({
          projectDir: gitRepositoryCwd(repository),
          cursor: input.cursor,
          limit: input.limit,
        })
      )
    }),

  getEntryMeta: publicProcedure
    .input(
      z.object({
        scope: gitRepositoryScopeSchema,
        expectedBindingToken: gitBindingTokenSchema,
        selector: gitEntrySelectorSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      return runGitScope(ctx, input, (repository) =>
        getCurrentWorktreeGitEntryMeta({
          projectDir: gitRepositoryCwd(repository),
          selector: input.selector,
        })
      )
    }),

  getEntryFiles: publicProcedure
    .input(
      z.object({
        scope: gitRepositoryScopeSchema,
        expectedBindingToken: gitBindingTokenSchema,
        selector: gitEntrySelectorSchema,
      })
    )
    .query(async ({ ctx, input }): Promise<GitEntryFiles> => {
      const config = await ctx.configManager.readConfig()
      return runGitScope(ctx, input, (repository) =>
        getCurrentWorktreeGitEntryFiles({
          projectDir: gitRepositoryCwd(repository),
          selector: input.selector,
          eagerPatchLineBudget: config.git.diffEagerLineBudget,
        })
      )
    }),

  getEntryPatch: publicProcedure
    .input(
      z.object({
        scope: gitRepositoryScopeSchema,
        expectedBindingToken: gitBindingTokenSchema,
        selector: gitEntrySelectorSchema,
        fileId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }): Promise<GitEntryPatch> => {
      return runGitScope(ctx, input, (repository) =>
        getCurrentWorktreeGitEntryPatch({
          projectDir: gitRepositoryCwd(repository),
          selector: input.selector,
          fileId: input.fileId,
        })
      )
    }),

  refresh: publicProcedure
    .input(
      z.object({
        scope: gitRepositoryScopeSchema,
        expectedBindingToken: gitBindingTokenSchema,
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return runGitScope(ctx, input, async (repository) => {
        const projectDir = gitRepositoryCwd(repository)
        const reason = input.reason?.trim() || 'manual-refresh'
        invalidateGitPanelCache(projectDir)
        await touchDashboardGitRefreshStamp(projectDir, reason)
        return { success: true }
      })
    }),

  removeDetachedWorktree: publicProcedure
    .input(
      z.object({
        scope: gitRepositoryScopeSchema,
        expectedBindingToken: gitBindingTokenSchema,
        path: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return runGitScope(ctx, input, async (repository) => {
        const projectDir = gitRepositoryCwd(repository)
        await removeDetachedDashboardGitWorktree({
          projectDir,
          targetPath: input.path,
        })
        invalidateGitPanelCache(projectDir)
        await touchDashboardGitRefreshStamp(projectDir, 'remove-detached-worktree')
        return { success: true }
      })
    }),

  switchWorktree: publicProcedure
    .input(
      z.object({
        scope: gitRepositoryScopeSchema,
        expectedBindingToken: gitBindingTokenSchema,
        path: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }): Promise<GitWorktreeHandoff> => {
      if (!ctx.gitWorktreeHandoff) {
        throw new Error('Worktree handoff is unavailable in this runtime.')
      }

      return runGitScope(ctx, input, async (repository) => {
        const target = await resolveGitWorktreeSwitchTarget({
          projectDir: gitRepositoryCwd(repository),
          targetPath: input.path,
        })

        if (!target) {
          throw new Error('Worktree not found.')
        }
        if (!target.pathAvailable) {
          throw new Error(
            'Worktree path is no longer available. Remove the stale worktree entry first.'
          )
        }

        return ctx.gitWorktreeHandoff?.ensureWorktreeServer({ targetPath: target.path })
      }).then((handoff) => {
        if (!handoff) throw new Error('Worktree handoff is unavailable in this runtime.')
        return handoff
      })
    }),
})

/**
 * Stores router — read-only discovery of machine-registered OpenSpec stores (beta).
 *
 * 实现 beta 功能容错范式（spec: openspec-cli-integration › Beta Feature Fault Tolerance）：
 * 后端对 `openspec store list/doctor --json` 做宽松解析，把失败归类为两类异常，**永不抛未捕获错误**。
 *  - 异常一（数据不兼容）：exit 0 但 zod 宽松验证失败 → available=false + error.kind='data-incompatible'
 *  - 异常二（指令变更/缺失）：非零退出 → available=false + error.kind='command-unavailable'
 * 两种异常都尽力携带 cliVersion（版本信息非常重要）。前端据此决定"显示错误+版本"或"隐藏入口"。
 */
const STORES_LIST_CACHE_TTL_MS = 30_000
let cachedCliVersion: { value: string | undefined; expiresAt: number } | null = null

async function resolveCliVersion(ctx: Context): Promise<string | undefined> {
  const now = Date.now()
  if (cachedCliVersion && cachedCliVersion.expiresAt > now) {
    return cachedCliVersion.value
  }
  try {
    const availability = await ctx.cliExecutor.checkAvailability()
    cachedCliVersion = { value: availability.version, expiresAt: now + STORES_LIST_CACHE_TTL_MS }
    return availability.version
  } catch {
    cachedCliVersion = { value: undefined, expiresAt: now + STORES_LIST_CACHE_TTL_MS }
    return undefined
  }
}

async function fetchStoresList(ctx: Context): Promise<StoreFeatureResult<StoreListEntry[]>> {
  // 永不抛：CLI 调用、解析、版本探测全部包裹，失败归类为两类异常之一。
  const cliVersion = await resolveCliVersion(ctx).catch(() => undefined)
  try {
    const result = await ctx.cliExecutor.contracts.listStores()
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
      await ctx.storeObservation.reconcile(projection.stores)
    }
    return projection
  } catch (error) {
    // 兜底：任何未预期错误都归类为指令变更（异常二），让前端隐藏入口，绝不崩溃。
    const message = error instanceof Error ? error.message : String(error)
    return {
      available: false,
      stores: [],
      evidence: null,
      error: { kind: 'command-unavailable', message, ...(cliVersion ? { cliVersion } : {}) },
      ...(cliVersion ? { cliVersion } : {}),
    }
  }
}

async function fetchStoresDoctor(
  ctx: Context,
  id?: string
): Promise<StoreFeatureResult<StoreDoctorStore[]>> {
  const cliVersion = await resolveCliVersion(ctx).catch(() => undefined)
  try {
    const result = await ctx.cliExecutor.contracts.doctorStores(id)
    const classification = classifyStoreCliResult({
      result,
      schema: StoreDoctorResultSchema,
      cliVersion,
    })
    return toStoreFeatureResult(classification, {
      fromData: (data) => data.stores,
      fallback: [],
      cliVersion,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      available: false,
      stores: [],
      evidence: null,
      error: { kind: 'command-unavailable', message, ...(cliVersion ? { cliVersion } : {}) },
      ...(cliVersion ? { cliVersion } : {}),
    }
  }
}

/** Read-only Store registry and Doctor projections for the current runtime environment. */
export const storesRouter = router({
  /** store 列表（只读，带异常归类） */
  list: publicProcedure.query(({ ctx }) => fetchStoresList(ctx)),

  /** 单个/全部 store 健康诊断（按需，带异常归类） */
  doctor: publicProcedure
    .input(z.object({ id: z.string().optional() }).optional())
    .query(({ ctx, input }) => fetchStoresDoctor(ctx, input?.id)),

  /**
   * Backend-owned Store mutation (stores.mutate). Runs setup/register/unregister/remove through the
   * official CLI under the `StoreMutationService` lifecycle (accepted -> running -> succeeded | failed |
   * indeterminate) with request-id deduplication. V1 has no Cancel and no automatic retry.
   */
  mutate: publicProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        kind: z.enum(['setup', 'register', 'unregister', 'remove']),
        storeId: z.string().optional(),
        // setup
        path: z.string().optional(),
        initGit: z.boolean().optional(),
        remote: z.string().optional(),
        // register
        id: z.string().optional(),
        confirmIdentity: z.boolean().optional(),
        // remove
        confirmDelete: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = getStoreMutationService(ctx)
      const run: StartStoreMutationInput['run'] = async () => {
        let result
        if (input.kind === 'setup') {
          if (!input.path) throw new Error('setup requires a path.')
          result = await ctx.cliExecutor.contracts.setupStore(input.storeId ?? input.id ?? 'store', {
            path: input.path,
            initGit: input.initGit,
            remote: input.remote,
          })
        } else if (input.kind === 'register') {
          if (!input.path) throw new Error('register requires a path.')
          result = await ctx.cliExecutor.contracts.registerStore(input.path, {
            id: input.id,
            confirmIdentity: input.confirmIdentity,
          })
        } else if (input.kind === 'unregister') {
          if (!input.storeId) throw new Error('unregister requires a storeId.')
          result = await ctx.cliExecutor.contracts.unregisterStore(input.storeId)
        } else {
          if (!input.storeId) throw new Error('remove requires a storeId.')
          result = await ctx.cliExecutor.contracts.removeStore(input.storeId, {
            confirmDelete: input.confirmDelete,
          })
        }
        return {
          exitStatus: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          payload: result.success ? result.data : undefined,
        }
      }
      const mutation = await service.start({
        requestId: input.requestId,
        envUri: storeMutationEnvUri(`openspecui-env://1/${ctx.projectDir}`),
        kind: input.kind,
        storeId: input.storeId ?? input.id,
        run,
      })
      // Each terminal or indeterminate outcome invalidates the affected Store/context projections.
      if (mutation.status !== 'running' && mutation.status !== 'accepted') {
        ctx.runtimeInvalidation.invalidate(['stores', 'context'])
      }
      return mutation
    }),
})

/**
 * Per-process Store mutation service. One backend process owns one service; request ids deduplicate
 * starts within it. Lazily attached to a module-level singleton so the tRPC context need not change.
 */
let _storeMutationService: StoreMutationService | null = null
function getStoreMutationService(_ctx: Context): StoreMutationService {
  if (!_storeMutationService) _storeMutationService = new StoreMutationService()
  return _storeMutationService
}

const runtimeInvalidationFacetSchema = z.enum(RUNTIME_INVALIDATION_FACETS)

/** Push identity-only invalidation tokens; every client pulls its authoritative projection. */
export const runtimeInvalidationRouter = router({
  subscribe: publicProcedure
    .input(z.object({ facets: z.array(runtimeInvalidationFacetSchema).min(1) }))
    .subscription(({ ctx, input }) => {
      return observable<RuntimeInvalidationToken[]>((emit) => {
        const facets = input.facets as RuntimeInvalidationFacet[]
        const push = () => emit.next(ctx.runtimeInvalidation.track(...facets))
        push()
        const releaseInvalidation = ctx.runtimeInvalidation.subscribe(facets, (tokens) => {
          emit.next(tokens)
        })
        return () => {
          releaseInvalidation()
        }
      })
    }),
})

async function fetchProjectBindingConfig(ctx: Context, reactive = false) {
  const rootPreview = reactive
    ? await ctx.planningRootServices.resolveRootContextReactive()
    : await ctx.planningRootServices.resolveRootContext()
  return readProjectBindingConfig({
    launchProjectDir: ctx.projectDir,
    rootPreview,
  })
}

/**
 * Write launch binding first and resolve a detached preview while subscriptions converge through
 * the owner. The returned id is mutation-local; Root Context subscriptions do not echo it.
 */
async function updateProjectBindingConfig(
  ctx: Context,
  input: ProjectBindingUpdate
): Promise<ProjectBindingUpdateResult> {
  const launchWrite = await writeProjectBindingConfig({
    launchProjectDir: ctx.projectDir,
    update: input,
  })
  // The physical writer has settled the launch configuration. Retire every current Root snapshot before
  // reactive consumers can combine the new launch binding with an old Planning-root record.
  ctx.runtimeInvalidation.invalidate(['project', 'context'])
  const rootPreview = await resolveServerRootContext({
    projectDir: ctx.projectDir,
    cliExecutor: ctx.cliExecutor,
  })
  const transitionId = randomUUID()
  if (rootPreview.state === 'ready') {
    return {
      kind: 'project-binding-update',
      launchWrite,
      rootPreview,
      transition: {
        id: transitionId,
        state: 'converging',
        observedAt: rootPreview.observedAt,
      },
    }
  }
  return {
    kind: 'project-binding-update',
    launchWrite,
    rootPreview,
    transition: {
      id: transitionId,
      state: 'preview-error',
      observedAt: rootPreview.observedAt,
      error: rootPreview.error,
    },
  }
}

async function fetchActiveRootConfig(ctx: Context, reactive = false) {
  return runPlanningRoot(
    ctx,
    ({ rootContext }) =>
      readActiveRootConfig({
        launchProjectDir: ctx.projectDir,
        rootContext,
      }),
    { reactive }
  )
}

async function fetchEnvironmentGlobalConfig(ctx: Context, reactive = false) {
  const rootPreview = reactive
    ? await ctx.planningRootServices.resolveRootContextReactive()
    : await ctx.planningRootServices.resolveRootContext()
  return readEnvironmentGlobalConfig({
    dataScope: dataScopeFromRootPreview(rootPreview),
    cliExecutor: ctx.cliExecutor,
  })
}

/** OpenSpec configuration surfaces separated by their physical owners. */
export const planningConfigRouter = router({
  projectBinding: publicProcedure.query(({ ctx }) => fetchProjectBindingConfig(ctx)),

  subscribeProjectBinding: publicProcedure.subscription(({ ctx }) =>
    createReactiveSubscription(() => fetchProjectBindingConfig(ctx, true))
  ),

  /**
   * Persist launch-owned Store/Reference declarations, then return the completed launch write, one
   * detached Root Context preview, and a mutation-local transition id. The Planning-root subscription
   * remains the authority for asynchronous convergence and does not echo that mutation-local id.
   */
  updateProjectBinding: publicProcedure
    .input(ProjectBindingUpdateSchema)
    .mutation(({ ctx, input }) => updateProjectBindingConfig(ctx, input)),

  activeRoot: publicProcedure.query(({ ctx }) => fetchActiveRootConfig(ctx)),

  subscribeActiveRoot: publicProcedure.subscription(({ ctx }) =>
    createPlanningRootSubscription(ctx, ({ rootContext }) =>
      readActiveRootConfig({ launchProjectDir: ctx.projectDir, rootContext })
    )
  ),

  writeActiveRoot: publicProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await runPlanningRoot(ctx, ({ rootContext }) =>
        writeActiveRootConfig({
          launchProjectDir: ctx.projectDir,
          rootContext,
          content: input.content,
        })
      )
      return { success: true }
    }),

  environmentGlobal: publicProcedure.query(({ ctx }) => fetchEnvironmentGlobalConfig(ctx)),

  subscribeEnvironmentGlobal: publicProcedure.subscription(({ ctx }) =>
    createReactiveSubscription(() => fetchEnvironmentGlobalConfig(ctx, true))
  ),

  /** Apply the official Core profile preset in the backend runtime environment. */
  applyCoreProfile: publicProcedure.mutation(async ({ ctx }) => {
    const args = ['config', 'profile', 'core']
    return runOpenSpecCliMutation(ctx, args, () => ctx.cliExecutor.execute(args))
  }),

  writeEnvironmentGlobal: publicProcedure
    .input(z.object({ config: EnvironmentGlobalConfigValueSchema }))
    .mutation(async ({ ctx, input }) => {
      await runOpenSpecCliMutation(ctx, ['config', 'set'], () =>
        writeEnvironmentGlobalConfig({ cliExecutor: ctx.cliExecutor, config: input.config })
      )
      return { success: true }
    }),
})

/** CLI-owned planning Root Context shared by every project-workspace surface. */
export const rootContextRouter = router({
  get: publicProcedure.query(({ ctx }) => ctx.planningRootServices.resolveRootContext()),
  subscribe: publicProcedure.subscription(({ ctx }) =>
    createRootContextSubscription(ctx.planningRootServices)
  ),
})

/**
 * Main app router
 */
export const appRouter = router({
  dashboard: dashboardRouter,
  git: gitRouter,
  spec: specRouter,
  change: changeRouter,
  archive: archiveRouter,
  init: initRouter,
  realtime: realtimeRouter,
  config: configRouter,
  planningConfig: planningConfigRouter,
  globalSettings: globalSettingsRouter,
  translationCache: translationCacheRouter,
  translationEngines: translationEnginesRouter,
  localModels: localModelsRouter,
  localCt2Models: localCt2ModelsRouter,
  localLlamaModels: localLlamaModelsRouter,
  notifications: notificationsRouter,
  sounds: soundsRouter,
  cli: cliRouter,
  rootContext: rootContextRouter,
  runtimeInvalidation: runtimeInvalidationRouter,
  opsx: opsxRouter,
  stores: storesRouter,
  kv: kvRouter,
  search: searchRouter,
  system: systemRouter,
})

/** Complete OpenSpecUI Server tRPC contract. */
export type AppRouter = typeof appRouter
