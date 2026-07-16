/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Register planning-root document, OPSX, dashboard, and archive procedures.
 * 2. Register CLI, Root Context, tool initialization, configuration, and Store projections.
 * 3. Register Git, terminal, system, notification, and recovery procedures.
 * 4. Register translation runtime, model, asset, and cache procedures.
 * 5. Compose the public tRPC application router and shared procedure schemas.
 *
 * Compromise: tRPC router inference currently requires one composition module; splitting its
 * established 2,600-line registration surface is outside the OpenSpec 1.6 contract slice.
 *
 * Original request (2026-07-15): "你先负责后端（内核）的开发。"
 */
import type {
  ChangeFile,
  CliExecutor,
  CliStreamEvent,
  ConfigManager,
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
  OPSX_CORE_PROFILE_WORKFLOWS,
  OPSX_TEXT_INPUT_ACTIONS,
  OpsxConfigSchema,
  OwnedSpecIdentitySchema,
  ProjectBindingUpdateSchema,
  requireCanonicalOpenSpecEntityId,
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
  type DashboardOverview,
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
  type ToolInitDelivery,
  type WorkflowRequestedModeV1,
} from '@openspecui/core'
import {
  NotificationGroupKeySchema,
  NotificationPublishInputSchema,
  type NotificationRecord,
} from '@openspecui/core/notifications'
import { CustomSoundIdSchema } from '@openspecui/core/sounds'
import { SearchQuerySchema } from '@openspecui/search'
import { initTRPC, TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
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
import { resolveEntityEntryPath } from './entity-file-paths.js'
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
  resolveGitRepositoryDescriptor,
  resolveGitRepositoryScopes,
  selectGitRepositoryScope,
} from './git-repository-scope.js'
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
import { reactiveKV } from './reactive-kv.js'
import { createReactiveSubscription } from './reactive-subscription.js'
import { createRootContextSubscription, resolveServerRootContext } from './root-context-service.js'
import {
  readSpecCatalog,
  readSpecDocument,
  SpecCatalogIdentityNotFoundError,
} from './spec-catalog-service.js'
import type { StoreObservationReconciler } from './store-observation-service.js'
import { startStrictArchiveStream } from './strict-archive-stream.js'
import { setTrackedTaskCompletion } from './tracked-task-mutation.js'
import type { TranslationCacheService } from './translation-cache-service.js'
import type { TranslationEngineService } from './translation-engine-service.js'

export interface Context {
  /** Launch-project adapter; only launch-scoped operations such as init may use it. */
  launchProjectAdapter: OpenSpecAdapter
  /** Lazy owner of all CLI-selected planning-root filesystem services. */
  planningRootServices: PlanningRootServiceResolver
  /** Runtime-environment invalidation identity; projections pull their own authoritative data. */
  runtimeInvalidation: RuntimeInvalidationController
  /** CLI-truth reconciler for dynamic registered Store observation roots. */
  storeObservation: StoreObservationReconciler
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

export interface GitWorktreeHandoffService {
  ensureWorktreeServer(input: { targetPath: string }): Promise<GitWorktreeHandoff>
}

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

function resolvePlanningRoot(
  ctx: Context,
  options: { reactive?: boolean } = {}
): Promise<PlanningRootServices> {
  return options.reactive
    ? ctx.planningRootServices.resolveReactive()
    : ctx.planningRootServices.resolve()
}

function createPlanningRootSubscription<T>(
  ctx: Context,
  task: (services: PlanningRootServices) => Promise<T>
) {
  return createReactiveSubscription(async () =>
    task(await resolvePlanningRoot(ctx, { reactive: true }))
  )
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

async function streamOpenSpecCliMutation(
  ctx: Context,
  args: readonly string[],
  start: (onEvent: (event: CliStreamEvent) => void) => Promise<() => void> | (() => void),
  onEvent: (event: CliStreamEvent) => void
): Promise<() => void> {
  const facets = getOpenSpecMutationFacets(args)
  if (!facets) return await start(onEvent)
  return new CliMutationInvalidator(ctx.runtimeInvalidation).stream(facets, start, onEvent)
}

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

type OpsxWorkflowProfile = 'core' | 'custom'
type OpsxWorkflowDelivery = 'both' | 'skills' | 'commands'

interface OpsxProfileState {
  available: boolean
  profile: OpsxWorkflowProfile | null
  delivery: OpsxWorkflowDelivery | null
  workflows: string[]
  driftStatus: 'in-sync' | 'drift' | 'unknown'
  warningText: string | null
  error?: string
}

function requireChangeId(changeId: string | undefined): string {
  if (!changeId) {
    throw new Error('change is required')
  }
  return changeId
}

function parseOpsxProfileListJson(stdout: string): {
  profile: OpsxWorkflowProfile
  delivery: OpsxWorkflowDelivery
  workflows: string[]
} | null {
  try {
    const parsed = JSON.parse(stdout) as {
      profile?: unknown
      delivery?: unknown
      workflows?: unknown
    }
    const profile: OpsxWorkflowProfile = parsed.profile === 'custom' ? 'custom' : 'core'
    const delivery: OpsxWorkflowDelivery =
      parsed.delivery === 'skills' || parsed.delivery === 'commands' ? parsed.delivery : 'both'
    const workflows = Array.isArray(parsed.workflows)
      ? parsed.workflows.filter(
          (item): item is string => typeof item === 'string' && item.length > 0
        )
      : profile === 'core'
        ? [...OPSX_CORE_PROFILE_WORKFLOWS]
        : []
    return { profile, delivery, workflows }
  } catch {
    return null
  }
}

function parseOpsxConfigDrift(output: string): { drift: boolean; warningText: string | null } {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const warningLine =
    lines.find((line) => /global config.+not applied.+project/i.test(line)) ??
    lines.find((line) => /out of sync/i.test(line)) ??
    lines.find((line) => /run\s+`?openspec\s+update`?/i.test(line)) ??
    null

  return { drift: warningLine !== null, warningText: warningLine }
}

async function fetchOpsxProfileState(ctx: Context): Promise<OpsxProfileState> {
  const configListJson = await ctx.cliExecutor.execute(['config', 'list', '--json'])
  if (!configListJson.success) {
    return {
      available: false,
      profile: null,
      delivery: null,
      workflows: [],
      driftStatus: 'unknown',
      warningText: null,
      error: configListJson.stderr || 'Failed to load profile config.',
    }
  }

  const parsed = parseOpsxProfileListJson(configListJson.stdout)
  if (!parsed) {
    return {
      available: false,
      profile: null,
      delivery: null,
      workflows: [],
      driftStatus: 'unknown',
      warningText: null,
      error: 'Invalid JSON from `openspec config list --json`.',
    }
  }

  const configListText = await ctx.cliExecutor.execute(['config', 'list'])
  if (!configListText.success) {
    return {
      available: true,
      profile: parsed.profile,
      delivery: parsed.delivery,
      workflows: parsed.workflows,
      driftStatus: 'unknown',
      warningText: null,
    }
  }

  const drift = parseOpsxConfigDrift(`${configListText.stdout}\n${configListText.stderr}`)
  return {
    available: true,
    profile: parsed.profile,
    delivery: parsed.delivery,
    workflows: parsed.workflows,
    driftStatus: drift.drift ? 'drift' : 'in-sync',
    warningText: drift.warningText,
  }
}

function ensureEditableSource(source: SchemaResolution['source'], label: string): void {
  if (source === 'package') {
    throw new Error(`${label} is read-only (package source)`)
  }
}

function resolveEntryPath(root: string, entryPath: string): string {
  const normalizedRoot = resolve(root)
  const resolvedPath = resolve(normalizedRoot, entryPath)
  const rootPrefix = normalizedRoot + sep
  if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(rootPrefix)) {
    throw new Error('Invalid path: outside schema root')
  }
  return resolvedPath
}

async function fetchOpsxStatus(
  ctx: Context,
  input: { change?: string; schema?: string },
  reactive = false
): Promise<ChangeStatus> {
  const changeId = requireChangeId(input.change)
  const { kernel } = await resolvePlanningRoot(ctx, { reactive })
  await kernel.waitForWarmup()
  await kernel.ensureStatus(changeId, input.schema)
  return kernel.getStatus(changeId, input.schema)
}

async function fetchOpsxStatusList(ctx: Context, reactive = false): Promise<ChangeStatus[]> {
  const { kernel } = await resolvePlanningRoot(ctx, { reactive })
  await kernel.waitForWarmup()
  await kernel.ensureStatusList()
  return kernel.getStatusList()
}

async function fetchOpsxInstructions(
  ctx: Context,
  input: { change?: string; artifact: string; schema?: string },
  reactive = false
): Promise<ArtifactInstructions> {
  const changeId = requireChangeId(input.change)
  const { kernel } = await resolvePlanningRoot(ctx, { reactive })
  await kernel.waitForWarmup()
  await kernel.ensureInstructions(changeId, input.artifact, input.schema)
  return kernel.getInstructions(changeId, input.artifact, input.schema)
}

async function fetchOpsxApplyInstructions(
  ctx: Context,
  input: { change?: string; schema?: string },
  reactive = false
): Promise<ApplyInstructions> {
  const changeId = requireChangeId(input.change)
  const { kernel } = await resolvePlanningRoot(ctx, { reactive })
  await kernel.waitForWarmup()
  await kernel.ensureApplyInstructions(changeId, input.schema)
  return kernel.getApplyInstructions(changeId, input.schema)
}

async function fetchOpsxConfigBundle(
  ctx: Context,
  reactive = false
): Promise<{
  schemas: SchemaInfo[]
  schemaDetails: Record<string, SchemaDetail | null>
  schemaResolutions: Record<string, SchemaResolution | null>
}> {
  const { kernel } = await resolvePlanningRoot(ctx, { reactive })
  await kernel.ensureSchemas()
  const schemas = kernel.getSchemas()

  for (const schema of schemas) {
    void kernel.ensureSchemaDetail(schema.name).catch(() => {
      // Keep bundle responsive; errors surface from dedicated schema subscriptions/routes.
    })
    void kernel.ensureSchemaResolution(schema.name).catch(() => {
      // Keep bundle responsive; errors surface from dedicated schema subscriptions/routes.
    })
  }

  const schemaDetails: Record<string, SchemaDetail | null> = {}
  const schemaResolutions: Record<string, SchemaResolution | null> = {}
  for (const schema of schemas) {
    schemaDetails[schema.name] = kernel.peekSchemaDetail(schema.name)
    schemaResolutions[schema.name] = kernel.peekSchemaResolution(schema.name)
  }

  return { schemas, schemaDetails, schemaResolutions }
}

async function fetchOpsxSchemaResolution(
  ctx: Context,
  name: string,
  reactive = false
): Promise<SchemaResolution> {
  const { kernel } = await resolvePlanningRoot(ctx, { reactive })
  await kernel.waitForWarmup()
  await kernel.ensureSchemaResolution(name)
  return kernel.getSchemaResolution(name)
}

async function fetchOpsxTemplates(
  ctx: Context,
  schema?: string,
  reactive = false
): Promise<TemplatesMap> {
  const { kernel } = await resolvePlanningRoot(ctx, { reactive })
  await kernel.waitForWarmup()
  await kernel.ensureTemplates(schema)
  return kernel.getTemplates(schema)
}

async function fetchOpsxTemplateContents(
  ctx: Context,
  schema?: string,
  reactive = false
): Promise<TemplateContentMap> {
  const { kernel } = await resolvePlanningRoot(ctx, { reactive })
  await kernel.waitForWarmup()
  await kernel.ensureTemplateContents(schema)
  return kernel.getTemplateContents(schema)
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
    const services = await resolvePlanningRoot(ctx)
    return readSpecCatalog(specCatalogSource(ctx, services))
  }),

  /** Return the exact owned or referenced document projection and its source evidence. */
  document: publicProcedure.input(SpecIdentitySchema).query(async ({ ctx, input }) => {
    const services = await resolvePlanningRoot(ctx)
    try {
      return await readSpecDocument(specCatalogSource(ctx, services), input)
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
      await (await resolvePlanningRoot(ctx)).adapter.writeSpec(specId, input.content)
      return { success: true }
    }),

  /** Validate an owned Spec; referenced identities remain immutable CLI projections. */
  validate: publicProcedure.input(OwnedSpecIdentitySchema).query(async ({ ctx, input }) => {
    return (await resolvePlanningRoot(ctx)).adapter.validateSpec(input.specId)
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
    return (await resolvePlanningRoot(ctx)).adapter.listChanges()
  }),

  listWithMeta: publicProcedure.query(async ({ ctx }) => {
    return (await resolvePlanningRoot(ctx)).adapter.listChangesWithMeta()
  }),

  listArchived: publicProcedure.query(async ({ ctx }) => {
    return (await resolvePlanningRoot(ctx)).adapter.listArchivedChanges()
  }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return (await resolvePlanningRoot(ctx)).documentService.readChange(input.id)
  }),

  getRaw: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return (await resolvePlanningRoot(ctx)).adapter.readChangeRaw(input.id)
  }),

  save: publicProcedure
    .input(z.object({ id: z.string(), proposal: z.string(), tasks: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const changeId = requireCanonicalOpenSpecEntityId(input.id, 'changeId')
      await (
        await resolvePlanningRoot(ctx)
      ).adapter.writeChange(changeId, input.proposal, input.tasks)
      return { success: true }
    }),

  validate: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return (await resolvePlanningRoot(ctx)).adapter.validateChange(input.id)
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
      const services = await resolvePlanningRoot(ctx)
      const { rootContext } = services
      const projectDir = rootContext.planningRoot?.path
      if (!projectDir) throw new Error('Planning root is unavailable.')
      await setTrackedTaskCompletion({
        adapter: services.adapter,
        projectDir,
        changeId: input.changeId,
        location: input.location,
        completed: input.completed,
      })
      return { success: true }
    }),

  // Reactive subscriptions
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createPlanningRootSubscription(ctx, ({ adapter }) => adapter.listChangesWithMeta())
  }),

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
      const { rootContext } = await resolvePlanningRoot(ctx)
      const projectDir = rootContext.planningRoot?.path
      if (!projectDir) throw new Error('Planning root is unavailable.')
      const info = resolveEntityEntryPath({
        projectDir,
        stage: 'change',
        changeId: input.id,
        path: input.path,
      })
      await mkdir(dirname(info.absolutePath), { recursive: true })
      await writeFile(info.absolutePath, input.content, 'utf-8')
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
      return (await resolvePlanningRoot(ctx)).filePreviewService.prepareEntityFilePreview({
        stage: 'change',
        changeId: input.id,
        path: input.path,
      })
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
    return (await resolvePlanningRoot(ctx)).adapter.listArchivedChanges()
  }),

  listWithMeta: publicProcedure.query(async ({ ctx }) => {
    return (await resolvePlanningRoot(ctx)).adapter.listArchivedChangesWithMeta()
  }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const services = await resolvePlanningRoot(ctx)
    return services.documentService.readEntityDetail(
      'archive',
      input.id,
      'view',
      'processed',
      await buildEntityReadOptions(services, 'archive', input.id)
    )
  }),

  getRaw: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const services = await resolvePlanningRoot(ctx)
    return services.documentService.readEntityDetail(
      'archive',
      input.id,
      'view',
      'source',
      await buildEntityReadOptions(services, 'archive', input.id)
    )
  }),

  // Reactive subscriptions
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createPlanningRootSubscription(ctx, ({ adapter }) =>
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
      const { rootContext } = await resolvePlanningRoot(ctx)
      const projectDir = rootContext.planningRoot?.path
      if (!projectDir) throw new Error('Planning root is unavailable.')
      const info = resolveEntityEntryPath({
        projectDir,
        stage: 'archive',
        changeId: input.id,
        path: input.path,
      })
      await mkdir(dirname(info.absolutePath), { recursive: true })
      await writeFile(info.absolutePath, input.content, 'utf-8')
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
      return (await resolvePlanningRoot(ctx)).filePreviewService.prepareEntityFilePreview({
        stage: 'archive',
        changeId: input.id,
        path: input.path,
      })
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

  /** 流式执行全局安装命令 */
  installGlobalCliStream: publicProcedure.subscription(({ ctx }) => {
    return observable<{
      type: 'command' | 'stdout' | 'stderr' | 'exit'
      data?: string
      exitCode?: number | null
    }>((emit) => {
      const cancel = ctx.cliExecutor.executeCommandStream(
        ['npm', 'install', '-g', '@fission-ai/openspec'],
        (event) => {
          emit.next(event)
          if (event.type === 'exit') {
            emit.complete()
          }
        }
      )

      return () => {
        cancel()
      }
    })
  }),

  /** 流式执行任意命令（用于前端通用终端） */
  runCommandStream: publicProcedure
    .input(
      z.object({
        command: z.string(),
        args: z.array(z.string()).default([]),
      })
    )
    .subscription(({ ctx, input }) => {
      return createCliStreamObservable(async (onEvent) => {
        if (input.command !== 'openspec') {
          return ctx.cliExecutor.executeCommandStream([input.command, ...input.args], onEvent)
        }
        return streamOpenSpecCliMutation(
          ctx,
          input.args,
          (mutationEvent) =>
            ctx.cliExecutor.executeCommandStream([input.command, ...input.args], mutationEvent),
          onEvent
        )
      })
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

  getDetectedProjectTools: publicProcedure.query(async ({ ctx }) => {
    return (await getDetectedProjectTools(ctx.projectDir)).map((tool) => ({
      name: tool.name,
      value: tool.value,
      available: tool.available,
      successLabel: tool.successLabel,
    })) satisfies AIToolOption[]
  }),

  /** 获取 OpenSpec CLI profile/workflow 配置与当前项目漂移状态 */
  getProfileState: publicProcedure.query(async ({ ctx }) => {
    return fetchOpsxProfileState(ctx)
  }),

  getToolInitStates: publicProcedure
    .input(
      z.object({
        delivery: z.enum(['both', 'skills', 'commands']),
        workflows: z.array(z.string()).default([]),
      })
    )
    .query(async ({ ctx, input }) => {
      return getToolInitStates(ctx.projectDir, {
        delivery: input.delivery as ToolInitDelivery,
        workflows: input.workflows,
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

  /** 归档 change（非交互式） */
  archive: publicProcedure
    .input(
      z.object({
        changeId: z.string(),
        skipSpecs: z.boolean().optional(),
        noValidate: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { rootContext } = await resolvePlanningRoot(ctx)
      return runOpenSpecCliMutation(ctx, ['archive'], () =>
        ctx.cliExecutor.contracts.archive(input.changeId, {
          skipSpecs: input.skipSpecs,
          noValidate: input.noValidate,
          ...getRootContextCliSelector(rootContext),
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
      const { rootContext } = await resolvePlanningRoot(ctx)
      return ctx.cliExecutor.contracts.validate({
        target:
          input.kind === 'item'
            ? { kind: 'item', id: input.id, type: input.type }
            : { kind: 'scope', scope: input.scope },
        strict: input.strict,
        ...getRootContextCliSelector(rootContext),
      })
    }),

  /** 流式执行 validate（实时输出） */
  validateStream: publicProcedure
    .input(
      z.object({
        type: z.enum(['spec', 'change']).optional(),
        id: z.string().optional(),
        strict: z.boolean().optional(),
      })
    )
    .subscription(({ ctx, input }) => {
      return createCliStreamObservable(async (onEvent) => {
        const { rootContext } = await resolvePlanningRoot(ctx)
        return ctx.cliExecutor.validateStream(
          { ...input, ...getRootContextCliSelector(rootContext) },
          onEvent
        )
      })
    }),

  execute: publicProcedure
    .input(z.object({ args: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      return runOpenSpecCliMutation(ctx, input.args, () => ctx.cliExecutor.execute(input.args))
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

  /** 流式执行 archive（实时输出） */
  archiveStream: publicProcedure
    .input(
      z.object({
        changeId: z.string(),
        skipSpecs: z.boolean().optional(),
        noValidate: z.boolean().optional(),
      })
    )
    .subscription(({ ctx, input }) => {
      return createCliStreamObservable(async (onEvent) => {
        const { rootContext } = await resolvePlanningRoot(ctx)
        return streamOpenSpecCliMutation(
          ctx,
          ['archive'],
          (mutationEvent) =>
            ctx.cliExecutor.archiveStream(
              input.changeId,
              {
                skipSpecs: input.skipSpecs,
                noValidate: input.noValidate,
                ...getRootContextCliSelector(rootContext),
              },
              mutationEvent
            ),
          onEvent
        )
      })
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
      return createCliStreamObservable(async (onEvent) => {
        const { rootContext } = await resolvePlanningRoot(ctx)
        const selector = getRootContextCliSelector(rootContext)
        return startStrictArchiveStream({
          skipValidation: input.noValidate === true,
          startValidate: (validateEvent) =>
            ctx.cliExecutor.validateStream(
              {
                id: input.changeId,
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
                  input.changeId,
                  {
                    skipSpecs: input.skipSpecs,
                    noValidate: true,
                    ...selector,
                  },
                  mutationEvent
                ),
              archiveEvent
            ),
          onEvent,
        })
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
      return (await resolvePlanningRoot(ctx)).workflowInvocationService.runWorkflow(
        input.input as RunWorkflowInputV1,
        input.requestedMode as WorkflowRequestedModeV1
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
      const { kernel } = await resolvePlanningRoot(ctx)
      await kernel.waitForWarmup()
      await kernel.ensureSchemaFiles(input.name)
      return kernel.getSchemaFiles(input.name)
    }),

  subscribeSchemaFiles: publicProcedure
    .input(z.object({ name: z.string() }))
    .subscription(({ ctx, input }) => {
      return createPlanningRootSubscription(ctx, async ({ kernel }) => {
        await kernel.waitForWarmup()
        await kernel.ensureSchemaFiles(input.name)
        return kernel.getSchemaFiles(input.name)
      })
    }),

  schemaYaml: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      const { kernel } = await resolvePlanningRoot(ctx)
      await kernel.waitForWarmup()
      await kernel.ensureSchemaYaml(input.name)
      return kernel.getSchemaYaml(input.name)
    }),

  subscribeSchemaYaml: publicProcedure
    .input(z.object({ name: z.string() }))
    .subscription(({ ctx, input }) => {
      return createPlanningRootSubscription(ctx, async ({ kernel }) => {
        await kernel.waitForWarmup()
        await kernel.ensureSchemaYaml(input.name)
        return kernel.getSchemaYaml(input.name)
      })
    }),

  writeSchemaYaml: publicProcedure
    .input(z.object({ name: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const resolution = await fetchOpsxSchemaResolution(ctx, input.name)
      ensureEditableSource(resolution.source, 'schema.yaml')
      const schemaPath = join(resolution.path, 'schema.yaml')
      await mkdir(dirname(schemaPath), { recursive: true })
      await writeFile(schemaPath, input.content, 'utf-8')
      return { success: true }
    }),

  writeSchemaFile: publicProcedure
    .input(z.object({ schema: z.string(), path: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const resolution = await fetchOpsxSchemaResolution(ctx, input.schema)
      ensureEditableSource(resolution.source, 'schema file')
      if (!input.path.trim()) {
        throw new Error('path is required')
      }
      const fullPath = resolveEntryPath(resolution.path, input.path)
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, input.content, 'utf-8')
      return { success: true }
    }),

  createSchemaFile: publicProcedure
    .input(z.object({ schema: z.string(), path: z.string(), content: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const resolution = await fetchOpsxSchemaResolution(ctx, input.schema)
      ensureEditableSource(resolution.source, 'schema file')
      if (!input.path.trim()) {
        throw new Error('path is required')
      }
      const fullPath = resolveEntryPath(resolution.path, input.path)
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, input.content ?? '', 'utf-8')
      return { success: true }
    }),

  createSchemaDirectory: publicProcedure
    .input(z.object({ schema: z.string(), path: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const resolution = await fetchOpsxSchemaResolution(ctx, input.schema)
      ensureEditableSource(resolution.source, 'schema directory')
      if (!input.path.trim()) {
        throw new Error('path is required')
      }
      const fullPath = resolveEntryPath(resolution.path, input.path)
      await mkdir(fullPath, { recursive: true })
      return { success: true }
    }),

  deleteSchemaEntry: publicProcedure
    .input(z.object({ schema: z.string(), path: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const resolution = await fetchOpsxSchemaResolution(ctx, input.schema)
      ensureEditableSource(resolution.source, 'schema entry')
      if (!input.path.trim()) {
        throw new Error('path is required')
      }
      const fullPath = resolveEntryPath(resolution.path, input.path)
      if (fullPath === resolve(resolution.path)) {
        throw new Error('cannot delete schema root')
      }
      await rm(fullPath, { recursive: true, force: true })
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
      const templates = await fetchOpsxTemplates(ctx, input.schema)
      const info = templates[input.artifactId]
      if (!info) {
        throw new Error(`Template not found for ${input.schema}:${input.artifactId}`)
      }
      ensureEditableSource(info.source, 'template')
      await mkdir(dirname(info.path), { recursive: true })
      await writeFile(info.path, input.content, 'utf-8')
      return { success: true }
    }),

  deleteSchema: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const resolution = await fetchOpsxSchemaResolution(ctx, input.name)
      ensureEditableSource(resolution.source, 'schema')
      await rm(resolution.path, { recursive: true, force: true })
      return { success: true }
    }),

  listChanges: publicProcedure.query(async ({ ctx }) => {
    const { kernel } = await resolvePlanningRoot(ctx)
    await kernel.waitForWarmup()
    await kernel.ensureChangeIds()
    return kernel.getChangeIds()
  }),

  subscribeChanges: publicProcedure.subscription(({ ctx }) => {
    return createPlanningRootSubscription(ctx, async ({ kernel }) => {
      await kernel.waitForWarmup()
      await kernel.ensureChangeIds()
      return kernel.getChangeIds()
    })
  }),

  readArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .query(async ({ ctx, input }) => {
      const { kernel, documentService } = await resolvePlanningRoot(ctx)
      await kernel.waitForWarmup()
      await kernel.ensureArtifactOutput(input.changeId, input.outputPath)
      return documentService.readChangeArtifactOutput(
        input.changeId,
        input.outputPath,
        'view',
        'processed'
      )
    }),

  subscribeArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .subscription(({ ctx, input }) => {
      return createPlanningRootSubscription(ctx, async ({ kernel, documentService }) => {
        await kernel.waitForWarmup()
        await kernel.ensureArtifactOutput(input.changeId, input.outputPath)
        return documentService.readChangeArtifactOutput(
          input.changeId,
          input.outputPath,
          'view',
          'processed'
        )
      })
    }),

  readGlobArtifactFiles: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .query(async ({ ctx, input }) => {
      const { kernel, documentService } = await resolvePlanningRoot(ctx)
      await kernel.waitForWarmup()
      await kernel.ensureGlobArtifactFiles(input.changeId, input.outputPath)
      return documentService.readChangeGlobArtifactFiles(
        input.changeId,
        input.outputPath,
        'view',
        'processed'
      )
    }),

  subscribeGlobArtifactFiles: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .subscription(({ ctx, input }) => {
      return createPlanningRootSubscription(ctx, async ({ kernel, documentService }) => {
        await kernel.waitForWarmup()
        await kernel.ensureGlobArtifactFiles(input.changeId, input.outputPath)
        return documentService.readChangeGlobArtifactFiles(
          input.changeId,
          input.outputPath,
          'view',
          'processed'
        )
      })
    }),

  writeArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { rootContext } = await resolvePlanningRoot(ctx)
      const projectDir = rootContext.planningRoot?.path
      if (!projectDir) throw new Error('Planning root is unavailable.')
      const info = resolveEntityEntryPath({
        projectDir,
        stage: 'change',
        changeId: input.changeId,
        path: input.outputPath,
      })
      await mkdir(dirname(info.absolutePath), { recursive: true })
      await writeFile(info.absolutePath, input.content, 'utf-8')
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
 * Search router - unified fulltext search over specs/changes/archives
 */
export const searchRouter = router({
  query: publicProcedure.input(SearchQuerySchema).query(async ({ ctx, input }) => {
    return (await resolvePlanningRoot(ctx)).searchService.query(input)
  }),

  subscribe: publicProcedure.input(SearchQuerySchema).subscription(({ ctx, input }) => {
    return createPlanningRootSubscription(ctx, ({ searchService }) =>
      searchService.queryReactive(input)
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
    return (await resolvePlanningRoot(ctx)).dashboardOverviewService.getCurrent()
  }),

  subscribe: publicProcedure.subscription(({ ctx }) => {
    return observable<DashboardOverview>((emit) => {
      let unsubscribe: (() => void) | null = null
      let disposed = false

      void resolvePlanningRoot(ctx)
        .then(({ dashboardOverviewService }) => {
          if (disposed) return
          unsubscribe = dashboardOverviewService.subscribe(
            (overview) => {
              emit.next(overview)
            },
            {
              emitCurrent: true,
              onError: (error) => {
                emit.error(error)
              },
            }
          )
        })
        .catch((error) => {
          emit.error(error instanceof Error ? error : new Error(String(error)))
        })

      return () => {
        disposed = true
        unsubscribe?.()
      }
    })
  }),

  refreshGitSnapshot: publicProcedure
    .input(z.object({ scope: z.literal('code'), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const reason = input.reason?.trim() || 'manual-refresh'
      const codeRepository = await resolveGitScope(ctx, input.scope)
      await (await resolvePlanningRoot(ctx)).dashboardOverviewService.refresh(reason)
      await touchDashboardGitRefreshStamp(gitRepositoryCwd(codeRepository), reason)
      return {
        success: true,
      }
    }),

  removeDetachedWorktree: publicProcedure
    .input(z.object({ scope: z.literal('code'), path: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { dashboardOverviewService } = await resolvePlanningRoot(ctx)
      const codeRepository = await resolveGitScope(ctx, input.scope)
      const projectDir = gitRepositoryCwd(codeRepository)
      await dashboardOverviewService.getCurrent()
      await removeDetachedDashboardGitWorktree({
        projectDir,
        targetPath: input.path,
      })
      await dashboardOverviewService.refresh('remove-detached-worktree')
      invalidateGitPanelCache(projectDir)
      await touchDashboardGitRefreshStamp(projectDir, 'remove-detached-worktree')
      return {
        success: true,
      }
    }),

  gitTaskStatus: publicProcedure.query(async ({ ctx }) => {
    await (await resolvePlanningRoot(ctx)).dashboardOverviewService.getCurrent()
    return getDashboardGitTaskStatus()
  }),

  subscribeGitTaskStatus: publicProcedure.subscription(({ ctx }) => {
    return observable<DashboardGitTaskStatus>((emit) => {
      void resolvePlanningRoot(ctx)
        .then(({ dashboardOverviewService }) => dashboardOverviewService.getCurrent())
        .catch(() => {
          // Ignore warmup failures here; the overview query surfaces them.
        })
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

async function fetchGitScopes(ctx: Context): Promise<GitRepositoryScopes> {
  let planningRootDir: string | null = null
  try {
    planningRootDir = (await resolvePlanningRoot(ctx)).rootContext.planningRoot?.path ?? null
  } catch {
    // Code repository remains usable when the CLI-selected planning root is unavailable.
  }
  return resolveGitRepositoryScopes({
    launchProjectDir: ctx.projectDir,
    planningRootDir,
  })
}

async function resolveGitScope(
  ctx: Context,
  scope: GitRepositoryScope
): Promise<GitRepositoryScopeDescriptor> {
  if (scope === 'code') {
    return resolveGitRepositoryDescriptor({ scope, rootPath: ctx.projectDir })
  }

  const planningRootDir = (await resolvePlanningRoot(ctx)).rootContext.planningRoot?.path
  if (!planningRootDir) {
    throw new Error('Planning repository scope requires a resolved planning root.')
  }
  const scopes = await resolveGitRepositoryScopes({
    launchProjectDir: ctx.projectDir,
    planningRootDir,
  })
  return selectGitRepositoryScope(scopes, scope)
}

function gitRepositoryCwd(scope: GitRepositoryScopeDescriptor): string {
  return scope.repository?.topLevel ?? scope.rootPath
}

export const gitRouter = router({
  scopes: publicProcedure.query(({ ctx }): Promise<GitRepositoryScopes> => fetchGitScopes(ctx)),

  overview: publicProcedure
    .input(z.object({ scope: gitRepositoryScopeSchema }))
    .query(async ({ ctx, input }): Promise<GitWorktreeOverview> => {
      const repository = await resolveGitScope(ctx, input.scope)
      return buildGitWorktreeOverview({ projectDir: gitRepositoryCwd(repository) })
    }),

  listEntries: publicProcedure
    .input(
      z.object({
        scope: gitRepositoryScopeSchema,
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
    )
    .query(async ({ ctx, input }): Promise<GitEntriesPage> => {
      const repository = await resolveGitScope(ctx, input.scope)
      return listCurrentWorktreeGitEntries({
        projectDir: gitRepositoryCwd(repository),
        cursor: input.cursor,
        limit: input.limit,
      })
    }),

  getEntryMeta: publicProcedure
    .input(z.object({ scope: gitRepositoryScopeSchema, selector: gitEntrySelectorSchema }))
    .query(async ({ ctx, input }) => {
      const repository = await resolveGitScope(ctx, input.scope)
      return getCurrentWorktreeGitEntryMeta({
        projectDir: gitRepositoryCwd(repository),
        selector: input.selector,
      })
    }),

  getEntryFiles: publicProcedure
    .input(z.object({ scope: gitRepositoryScopeSchema, selector: gitEntrySelectorSchema }))
    .query(async ({ ctx, input }): Promise<GitEntryFiles> => {
      const config = await ctx.configManager.readConfig()
      const repository = await resolveGitScope(ctx, input.scope)
      return getCurrentWorktreeGitEntryFiles({
        projectDir: gitRepositoryCwd(repository),
        selector: input.selector,
        eagerPatchLineBudget: config.git.diffEagerLineBudget,
      })
    }),

  getEntryPatch: publicProcedure
    .input(
      z.object({
        scope: gitRepositoryScopeSchema,
        selector: gitEntrySelectorSchema,
        fileId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }): Promise<GitEntryPatch> => {
      const repository = await resolveGitScope(ctx, input.scope)
      return getCurrentWorktreeGitEntryPatch({
        projectDir: gitRepositoryCwd(repository),
        selector: input.selector,
        fileId: input.fileId,
      })
    }),

  refresh: publicProcedure
    .input(z.object({ scope: gitRepositoryScopeSchema, reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const repository = await resolveGitScope(ctx, input.scope)
      const projectDir = gitRepositoryCwd(repository)
      const reason = input.reason?.trim() || 'manual-refresh'
      invalidateGitPanelCache(projectDir)
      await touchDashboardGitRefreshStamp(projectDir, reason)
      return { success: true }
    }),

  removeDetachedWorktree: publicProcedure
    .input(z.object({ scope: gitRepositoryScopeSchema, path: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const repository = await resolveGitScope(ctx, input.scope)
      const projectDir = gitRepositoryCwd(repository)
      await removeDetachedDashboardGitWorktree({
        projectDir,
        targetPath: input.path,
      })
      invalidateGitPanelCache(projectDir)
      await touchDashboardGitRefreshStamp(projectDir, 'remove-detached-worktree')
      return { success: true }
    }),

  switchWorktree: publicProcedure
    .input(z.object({ scope: gitRepositoryScopeSchema, path: z.string().min(1) }))
    .mutation(async ({ ctx, input }): Promise<GitWorktreeHandoff> => {
      if (!ctx.gitWorktreeHandoff) {
        throw new Error('Worktree handoff is unavailable in this runtime.')
      }

      const repository = await resolveGitScope(ctx, input.scope)
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

      return ctx.gitWorktreeHandoff.ensureWorktreeServer({ targetPath: target.path })
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

export const storesRouter = router({
  /** store 列表（只读，带异常归类） */
  list: publicProcedure.query(({ ctx }) => fetchStoresList(ctx)),

  /** 单个/全部 store 健康诊断（按需，带异常归类） */
  doctor: publicProcedure
    .input(z.object({ id: z.string().optional() }).optional())
    .query(({ ctx, input }) => fetchStoresDoctor(ctx, input?.id)),
})

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

async function fetchProjectBindingConfig(ctx: Context) {
  const rootPreview = await resolveServerRootContext(ctx)
  return readProjectBindingConfig({
    launchProjectDir: ctx.projectDir,
    rootPreview,
  })
}

async function fetchActiveRootConfig(ctx: Context, reactive = false) {
  const { rootContext } = await resolvePlanningRoot(ctx, { reactive })
  return readActiveRootConfig({
    launchProjectDir: ctx.projectDir,
    rootContext,
  })
}

async function fetchEnvironmentGlobalConfig(ctx: Context) {
  const rootPreview = await resolveServerRootContext(ctx)
  return readEnvironmentGlobalConfig({
    dataScope: dataScopeFromRootPreview(rootPreview),
    cliExecutor: ctx.cliExecutor,
  })
}

/** OpenSpec configuration surfaces separated by their physical owners. */
export const planningConfigRouter = router({
  projectBinding: publicProcedure.query(({ ctx }) => fetchProjectBindingConfig(ctx)),

  subscribeProjectBinding: publicProcedure.subscription(({ ctx }) =>
    createReactiveSubscription(() => fetchProjectBindingConfig(ctx))
  ),

  updateProjectBinding: publicProcedure
    .input(ProjectBindingUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      await writeProjectBindingConfig({ launchProjectDir: ctx.projectDir, update: input })
      return fetchProjectBindingConfig(ctx)
    }),

  activeRoot: publicProcedure.query(({ ctx }) => fetchActiveRootConfig(ctx)),

  subscribeActiveRoot: publicProcedure.subscription(({ ctx }) =>
    createPlanningRootSubscription(ctx, ({ rootContext }) =>
      readActiveRootConfig({ launchProjectDir: ctx.projectDir, rootContext })
    )
  ),

  writeActiveRoot: publicProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { rootContext } = await resolvePlanningRoot(ctx)
      await writeActiveRootConfig({
        launchProjectDir: ctx.projectDir,
        rootContext,
        content: input.content,
      })
      return { success: true }
    }),

  environmentGlobal: publicProcedure.query(({ ctx }) => fetchEnvironmentGlobalConfig(ctx)),

  subscribeEnvironmentGlobal: publicProcedure.subscription(({ ctx }) =>
    createReactiveSubscription(() => fetchEnvironmentGlobalConfig(ctx))
  ),

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
  get: publicProcedure.query(({ ctx }) => resolveServerRootContext(ctx)),
  subscribe: publicProcedure.subscription(({ ctx }) => createRootContextSubscription(ctx)),
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

export type AppRouter = typeof appRouter
