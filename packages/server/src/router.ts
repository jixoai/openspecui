import type {
  ChangeFile,
  CliExecutor,
  ConfigManager,
  FileChangeEvent,
  GitEntriesPage,
  GitEntryFiles,
  GitEntryPatch,
  GitEntrySelector,
  GitWorktreeHandoff,
  GitWorktreeOverview,
  GlobalSettingsManager,
  OpenSpecAdapter,
  OpenSpecWatcher,
  OpsxKernel,
} from '@openspecui/core'
import {
  BatchTranslateInputSchema,
  CodeEditorThemeSchema,
  DashboardConfigSchema,
  DocumentTranslationConfigSchema,
  getAllTools,
  getAvailableTools,
  getConfiguredTools,
  getDefaultCliCommandString,
  getDetectedProjectTools,
  getToolInitStates,
  getWatcherRuntimeStatus,
  GitConfigSchema,
  NotificationSettingsSchema,
  OpenSpecUIGlobalSettingsSchema,
  OpsxConfigSchema,
  resolveTerminalShellDefaults,
  ServiceTranslationEngineIdSchema,
  sniffGlobalCli,
  subscribeWatcherRuntimeStatus,
  TerminalConfigSchema,
  TerminalRendererEngineSchema,
  TranslationCacheReadInputSchema,
  TranslationCacheSettingsSchema,
  TranslationCacheWriteInputSchema,
  TranslationEngineIdSchema,
  TranslationLocalSettingsSchema,
  TranslationOpenAISettingsSchema,
  type AIToolOption,
  type ApplyInstructions,
  type ArtifactInstructions,
  type ChangeStatus,
  type DashboardOverview,
  type ProjectRecoveryStatus,
  type RunWorkflowInputV1,
  type RunWorkflowResultV1,
  type SchemaDetail,
  type SchemaInfo,
  type SchemaResolution,
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
import { SearchQuerySchema, type SearchQuery } from '@openspecui/search'
import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { z } from 'zod'
import { createCliStreamObservable } from './cli-stream-observable.js'
import type { CustomSoundService } from './custom-sound-service.js'
import { removeDetachedDashboardGitWorktree } from './dashboard-git-snapshot.js'
import type { DashboardOverviewService } from './dashboard-overview-service.js'
import {
  getDashboardGitTaskStatus,
  subscribeDashboardGitTaskStatus,
  touchDashboardGitRefreshStamp,
  type DashboardGitTaskStatus,
} from './dashboard-overview.js'
import type { DocumentService } from './document-service.js'
import { resolveEntityEntryPath } from './entity-file-paths.js'
import { buildEntityReadOptions } from './entity-read-options.js'
import type { FilePreviewService } from './file-preview-service.js'
import {
  buildGitWorktreeOverview,
  getCurrentWorktreeGitEntryFiles,
  getCurrentWorktreeGitEntryMeta,
  getCurrentWorktreeGitEntryPatch,
  listCurrentWorktreeGitEntries,
  resolveGitWorktreeSwitchTarget,
} from './git-panel-data.js'
import type { LocalModelAssetService } from './local-model-asset-service.js'
import type { NotificationService } from './notification-service.js'
import type { ProjectRecoveryService } from './project-recovery-service.js'
import { reactiveKV } from './reactive-kv.js'
import {
  createReactiveSubscription,
  createReactiveSubscriptionWithInput,
} from './reactive-subscription.js'
import type { SearchService } from './search-service.js'
import type { TranslationCacheService } from './translation-cache-service.js'
import type { TranslationEngineService } from './translation-engine-service.js'
import type { WorkflowInvocationService } from './workflow-invocation-service.js'

export interface Context {
  adapter: OpenSpecAdapter
  configManager: ConfigManager
  documentService: DocumentService
  cliExecutor: CliExecutor
  kernel: OpsxKernel
  workflowInvocationService: WorkflowInvocationService
  searchService: SearchService
  dashboardOverviewService: DashboardOverviewService
  projectRecoveryService: ProjectRecoveryService
  notificationService: NotificationService
  customSoundService: CustomSoundService
  globalSettingsManager: GlobalSettingsManager
  translationCacheService: TranslationCacheService
  filePreviewService: FilePreviewService
  translationEngineService: TranslationEngineService
  localModelAssetService: LocalModelAssetService
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
    .input(
      OpenSpecUIGlobalSettingsSchema.partial().extend({
        translationCache: TranslationCacheSettingsSchema.partial().optional(),
        translationEngines: z
          .object({
            openai: TranslationOpenAISettingsSchema.partial().optional(),
            local: TranslationLocalSettingsSchema.partial().optional(),
          })
          .optional(),
      })
    )
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
        selectedGroupId: input.selectedGroupId ?? asset.plan?.selectedGroupId,
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
      await ctx.localModelAssetService.markSelectedModel(input.modelId)
      return { success: true }
    }),

  download: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.localModelAssetService.startDownload(input.modelId, input.selectedGroupId)
    }),

  pause: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.localModelAssetService.pauseDownload(input.modelId)
    }),

  resume: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        selectedGroupId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.localModelAssetService.resumeDownload(input.modelId, input.selectedGroupId)
    }),

  delete: publicProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.localModelAssetService.deleteModel(input.modelId)
    }),
})

const OPSX_CORE_PROFILE_WORKFLOWS = ['propose', 'explore', 'apply', 'archive'] as const
const gitEntrySelectorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('uncommitted') }),
  z.object({ type: z.literal('commit'), hash: z.string().min(1) }),
])

const workflowRequestedModeSchema = z.enum(['compose', 'command', 'direct'])
const runWorkflowInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['explore', 'propose']), text: z.string() }),
  z.object({
    action: z.literal('new'),
    changeId: z.string(),
    schema: z.string().optional(),
    description: z.string().optional(),
    extraArgs: z.array(z.string()).default([]),
  }),
  z.object({
    action: z.enum(['continue', 'ff']),
    changeId: z.string(),
    artifactId: z.string(),
    schema: z.string().optional(),
  }),
  z.object({
    action: z.enum(['apply', 'archive', 'verify', 'sync']),
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

async function resolveGlobalConfigPath(ctx: Context): Promise<string> {
  const result = await ctx.cliExecutor.execute(['config', 'path'])
  if (!result.success) {
    throw new Error(result.stderr || 'Failed to resolve OpenSpec global config path.')
  }
  const path = result.stdout.trim()
  if (!path) {
    throw new Error('OpenSpec global config path is empty.')
  }
  return path
}

async function fetchGlobalConfigJson(ctx: Context): Promise<Record<string, unknown>> {
  const result = await ctx.cliExecutor.execute(['config', 'list', '--json'])
  if (!result.success) {
    throw new Error(result.stderr || 'Failed to load OpenSpec global config.')
  }
  try {
    const parsed = JSON.parse(result.stdout) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('OpenSpec global config must be a JSON object.')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid JSON from \`openspec config list --json\`: ${message}`)
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
  input: { change?: string; schema?: string }
): Promise<ChangeStatus> {
  const changeId = requireChangeId(input.change)
  await ctx.kernel.waitForWarmup()
  await ctx.kernel.ensureStatus(changeId, input.schema)
  return ctx.kernel.getStatus(changeId, input.schema)
}

async function fetchOpsxStatusList(ctx: Context): Promise<ChangeStatus[]> {
  await ctx.kernel.waitForWarmup()
  await ctx.kernel.ensureStatusList()
  return ctx.kernel.getStatusList()
}

async function fetchOpsxInstructions(
  ctx: Context,
  input: { change?: string; artifact: string; schema?: string }
): Promise<ArtifactInstructions> {
  const changeId = requireChangeId(input.change)
  await ctx.kernel.waitForWarmup()
  await ctx.kernel.ensureInstructions(changeId, input.artifact, input.schema)
  return ctx.kernel.getInstructions(changeId, input.artifact, input.schema)
}

async function fetchOpsxApplyInstructions(
  ctx: Context,
  input: { change?: string; schema?: string }
): Promise<ApplyInstructions> {
  const changeId = requireChangeId(input.change)
  await ctx.kernel.waitForWarmup()
  await ctx.kernel.ensureApplyInstructions(changeId, input.schema)
  return ctx.kernel.getApplyInstructions(changeId, input.schema)
}

async function fetchOpsxConfigBundle(ctx: Context): Promise<{
  schemas: SchemaInfo[]
  schemaDetails: Record<string, SchemaDetail | null>
  schemaResolutions: Record<string, SchemaResolution | null>
}> {
  await ctx.kernel.ensureSchemas()
  const schemas = ctx.kernel.getSchemas()

  for (const schema of schemas) {
    void ctx.kernel.ensureSchemaDetail(schema.name).catch(() => {
      // Keep bundle responsive; errors surface from dedicated schema subscriptions/routes.
    })
    void ctx.kernel.ensureSchemaResolution(schema.name).catch(() => {
      // Keep bundle responsive; errors surface from dedicated schema subscriptions/routes.
    })
  }

  const schemaDetails: Record<string, SchemaDetail | null> = {}
  const schemaResolutions: Record<string, SchemaResolution | null> = {}
  for (const schema of schemas) {
    schemaDetails[schema.name] = ctx.kernel.peekSchemaDetail(schema.name)
    schemaResolutions[schema.name] = ctx.kernel.peekSchemaResolution(schema.name)
  }

  return { schemas, schemaDetails, schemaResolutions }
}

async function fetchOpsxSchemaResolution(ctx: Context, name: string): Promise<SchemaResolution> {
  await ctx.kernel.waitForWarmup()
  await ctx.kernel.ensureSchemaResolution(name)
  return ctx.kernel.getSchemaResolution(name)
}

async function fetchOpsxTemplates(ctx: Context, schema?: string): Promise<TemplatesMap> {
  await ctx.kernel.waitForWarmup()
  await ctx.kernel.ensureTemplates(schema)
  return ctx.kernel.getTemplates(schema)
}

async function fetchOpsxTemplateContents(
  ctx: Context,
  schema?: string
): Promise<TemplateContentMap> {
  await ctx.kernel.waitForWarmup()
  await ctx.kernel.ensureTemplateContents(schema)
  return ctx.kernel.getTemplateContents(schema)
}

interface SystemStatusPayload {
  projectDir: string
  watcherEnabled: boolean
  watcherGeneration: number
  watcherReinitializeCount: number
  watcherLastReinitializeReason: string | null
  projectRecovery: ProjectRecoveryStatus
}

function buildSystemStatus(ctx: Context): SystemStatusPayload {
  const runtime = getWatcherRuntimeStatus()
  return {
    projectDir: ctx.projectDir,
    watcherEnabled: runtime?.initialized ?? false,
    watcherGeneration: runtime?.generation ?? 0,
    watcherReinitializeCount: runtime?.reinitializeCount ?? 0,
    watcherLastReinitializeReason: runtime?.lastReinitializeReason ?? null,
    projectRecovery: ctx.projectRecoveryService.getCurrent(),
  }
}

/**
 * Spec router - spec CRUD operations
 */
export const specRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.listSpecs()
  }),

  listWithMeta: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.listSpecsWithMeta()
  }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.documentService.readSpec(input.id)
  }),

  getRaw: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const result = await ctx.documentService.readSpecRaw(input.id, 'view', 'processed')
    return result?.markdown ?? null
  }),

  save: publicProcedure
    .input(z.object({ id: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.adapter.writeSpec(input.id, input.content)
      return { success: true }
    }),

  validate: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.adapter.validateSpec(input.id)
  }),

  // Reactive subscriptions
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.adapter.listSpecsWithMeta())
  }),

  subscribeOne: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput((id: string) => ctx.documentService.readSpec(id))(
        input.id
      )
    }),

  subscribeRaw: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput(async (id: string) => {
        const result = await ctx.documentService.readSpecRaw(id, 'view', 'processed')
        return result?.markdown ?? null
      })(input.id)
    }),
})

/**
 * Change router - change proposal operations
 */
export const changeRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.listChanges()
  }),

  listWithMeta: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.listChangesWithMeta()
  }),

  listArchived: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.listArchivedChanges()
  }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.documentService.readChange(input.id)
  }),

  getRaw: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.adapter.readChangeRaw(input.id)
  }),

  save: publicProcedure
    .input(z.object({ id: z.string(), proposal: z.string(), tasks: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.adapter.writeChange(input.id, input.proposal, input.tasks)
      return { success: true }
    }),

  archive: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.adapter.archiveChange(input.id)
  }),

  validate: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.adapter.validateChange(input.id)
  }),

  toggleTask: publicProcedure
    .input(
      z.object({
        changeId: z.string(),
        taskIndex: z.number().int().positive(),
        completed: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const success = await ctx.adapter.toggleTask(input.changeId, input.taskIndex, input.completed)
      if (!success) {
        throw new Error(`Failed to toggle task ${input.taskIndex} in change ${input.changeId}`)
      }
      return { success: true }
    }),

  // Reactive subscriptions
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.adapter.listChangesWithMeta())
  }),

  subscribeFiles: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput((id: string) => ctx.adapter.readChangeFiles(id))(
        input.id
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
      const info = resolveEntityEntryPath({
        projectDir: ctx.projectDir,
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
    .query(({ ctx, input }) => {
      return ctx.filePreviewService.prepareEntityFilePreview({
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
    await ctx.adapter.init()
    return { success: true }
  }),
})

/**
 * Archive router - archived changes
 */
export const archiveRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.listArchivedChanges()
  }),

  listWithMeta: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.listArchivedChangesWithMeta()
  }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.documentService.readEntityDetail(
      'archive',
      input.id,
      'view',
      'processed',
      await buildEntityReadOptions(ctx, 'archive', input.id)
    )
  }),

  getRaw: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.documentService.readEntityDetail(
      'archive',
      input.id,
      'view',
      'source',
      await buildEntityReadOptions(ctx, 'archive', input.id)
    )
  }),

  // Reactive subscriptions
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.adapter.listArchivedChangesWithMeta())
  }),

  subscribeOne: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput(async (id: string) =>
        ctx.documentService.readEntityDetail(
          'archive',
          id,
          'view',
          'processed',
          await buildEntityReadOptions(ctx, 'archive', id)
        )
      )(input.id)
    }),

  subscribeFiles: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput((id: string) =>
        ctx.documentService.readArchivedChangeFiles(id, 'view', 'source')
      )(input.id)
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
      const info = resolveEntityEntryPath({
        projectDir: ctx.projectDir,
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
    .query(({ ctx, input }) => {
      return ctx.filePreviewService.prepareEntityFilePreview({
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
        translation: DocumentTranslationConfigSchema.partial()
          .extend({
            engines: z
              .object({
                local: z
                  .object({
                    model: z.string().min(1).optional(),
                    selectedGroupId: z.string().min(1).optional(),
                  })
                  .optional(),
                openai: z.object({ model: z.string().min(1).optional() }).optional(),
              })
              .optional(),
          })
          .optional(),
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
      return createCliStreamObservable(async (onEvent) =>
        ctx.cliExecutor.executeCommandStream([input.command, ...input.args], onEvent)
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

  getGlobalConfigPath: publicProcedure.query(async ({ ctx }) => {
    const path = await resolveGlobalConfigPath(ctx)
    return { path }
  }),

  getGlobalConfig: publicProcedure.query(async ({ ctx }) => {
    return fetchGlobalConfigJson(ctx)
  }),

  setGlobalConfig: publicProcedure
    .input(z.object({ config: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const configPath = await resolveGlobalConfigPath(ctx)
      await mkdir(dirname(configPath), { recursive: true })
      await writeFile(configPath, `${JSON.stringify(input.config, null, 2)}\n`, 'utf8')
      return { success: true }
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
      return ctx.cliExecutor.init({
        tools: input?.tools,
        profile: input?.profile,
        force: input?.force,
      })
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
      return ctx.cliExecutor.archive(input.changeId, {
        skipSpecs: input.skipSpecs,
        noValidate: input.noValidate,
      })
    }),

  validate: publicProcedure
    .input(
      z.object({
        type: z.enum(['spec', 'change']).optional(),
        id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.cliExecutor.validate(input.type, input.id)
    }),

  /** 流式执行 validate（实时输出） */
  validateStream: publicProcedure
    .input(z.object({ type: z.enum(['spec', 'change']).optional(), id: z.string().optional() }))
    .subscription(({ ctx, input }) => {
      return createCliStreamObservable((onEvent) =>
        ctx.cliExecutor.validateStream(input.type, input.id, onEvent)
      )
    }),

  execute: publicProcedure
    .input(z.object({ args: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.cliExecutor.execute(input.args)
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
        ctx.cliExecutor.initStream(
          {
            tools: input?.tools,
            profile: input?.profile,
            force: input?.force,
          },
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
      return createCliStreamObservable((onEvent) =>
        ctx.cliExecutor.archiveStream(
          input.changeId,
          { skipSpecs: input.skipSpecs, noValidate: input.noValidate },
          onEvent
        )
      )
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
    .mutation(async ({ ctx, input }): Promise<RunWorkflowResultV1> => {
      return ctx.workflowInvocationService.runWorkflow(
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
      return createReactiveSubscription(() => fetchOpsxStatus(ctx, input))
    }),

  statusList: publicProcedure.query(async ({ ctx }): Promise<ChangeStatus[]> => {
    return fetchOpsxStatusList(ctx)
  }),

  subscribeStatusList: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => fetchOpsxStatusList(ctx))
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
      return createReactiveSubscription(() => fetchOpsxInstructions(ctx, input))
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
      return createReactiveSubscription(() => fetchOpsxApplyInstructions(ctx, input))
    }),

  configBundle: publicProcedure.query(async ({ ctx }) => {
    return fetchOpsxConfigBundle(ctx)
  }),

  subscribeConfigBundle: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => fetchOpsxConfigBundle(ctx))
  }),

  templates: publicProcedure
    .input(z.object({ schema: z.string().optional() }).optional())
    .query(async ({ ctx, input }): Promise<TemplatesMap> => {
      return fetchOpsxTemplates(ctx, input?.schema)
    }),

  subscribeTemplates: publicProcedure
    .input(z.object({ schema: z.string().optional() }).optional())
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(() => fetchOpsxTemplates(ctx, input?.schema))
    }),

  templateContents: publicProcedure
    .input(z.object({ schema: z.string().optional() }).optional())
    .query(async ({ ctx, input }): Promise<TemplateContentMap> => {
      return fetchOpsxTemplateContents(ctx, input?.schema)
    }),

  subscribeTemplateContents: publicProcedure
    .input(z.object({ schema: z.string().optional() }).optional())
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(() => fetchOpsxTemplateContents(ctx, input?.schema))
    }),

  schemaFiles: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }): Promise<ChangeFile[]> => {
      await ctx.kernel.waitForWarmup()
      await ctx.kernel.ensureSchemaFiles(input.name)
      return ctx.kernel.getSchemaFiles(input.name)
    }),

  subscribeSchemaFiles: publicProcedure
    .input(z.object({ name: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await ctx.kernel.waitForWarmup()
        await ctx.kernel.ensureSchemaFiles(input.name)
        return ctx.kernel.getSchemaFiles(input.name)
      })
    }),

  schemaYaml: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.kernel.waitForWarmup()
      await ctx.kernel.ensureSchemaYaml(input.name)
      return ctx.kernel.getSchemaYaml(input.name)
    }),

  subscribeSchemaYaml: publicProcedure
    .input(z.object({ name: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await ctx.kernel.waitForWarmup()
        await ctx.kernel.ensureSchemaYaml(input.name)
        return ctx.kernel.getSchemaYaml(input.name)
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
        const templateContents = await fetchOpsxTemplateContents(ctx, input.schema)
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

  projectConfig: publicProcedure.query(async ({ ctx }) => {
    await ctx.kernel.waitForWarmup()
    await ctx.kernel.ensureProjectConfig()
    return ctx.kernel.getProjectConfig()
  }),

  subscribeProjectConfig: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(async () => {
      await ctx.kernel.waitForWarmup()
      await ctx.kernel.ensureProjectConfig()
      return ctx.kernel.getProjectConfig()
    })
  }),

  writeProjectConfig: publicProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const openspecDir = join(ctx.projectDir, 'openspec')
      await mkdir(openspecDir, { recursive: true })
      const configPath = join(openspecDir, 'config.yaml')
      await writeFile(configPath, input.content, 'utf-8')
      return { success: true }
    }),

  listChanges: publicProcedure.query(async ({ ctx }) => {
    await ctx.kernel.waitForWarmup()
    await ctx.kernel.ensureChangeIds()
    return ctx.kernel.getChangeIds()
  }),

  subscribeChanges: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(async () => {
      await ctx.kernel.waitForWarmup()
      await ctx.kernel.ensureChangeIds()
      return ctx.kernel.getChangeIds()
    })
  }),

  readArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.kernel.waitForWarmup()
      await ctx.kernel.ensureArtifactOutput(input.changeId, input.outputPath)
      return ctx.documentService.readChangeArtifactOutput(
        input.changeId,
        input.outputPath,
        'view',
        'processed'
      )
    }),

  subscribeArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await ctx.kernel.waitForWarmup()
        await ctx.kernel.ensureArtifactOutput(input.changeId, input.outputPath)
        return ctx.documentService.readChangeArtifactOutput(
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
      await ctx.kernel.waitForWarmup()
      await ctx.kernel.ensureGlobArtifactFiles(input.changeId, input.outputPath)
      return ctx.documentService.readChangeGlobArtifactFiles(
        input.changeId,
        input.outputPath,
        'view',
        'processed'
      )
    }),

  subscribeGlobArtifactFiles: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await ctx.kernel.waitForWarmup()
        await ctx.kernel.ensureGlobArtifactFiles(input.changeId, input.outputPath)
        return ctx.documentService.readChangeGlobArtifactFiles(
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
      const artifactPath = join(
        ctx.projectDir,
        'openspec',
        'changes',
        input.changeId,
        input.outputPath
      )
      await writeFile(artifactPath, input.content, 'utf-8')
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
    return ctx.searchService.query(input)
  }),

  subscribe: publicProcedure.input(SearchQuerySchema).subscription(({ ctx, input }) => {
    return createReactiveSubscriptionWithInput((queryInput: SearchQuery) =>
      ctx.searchService.queryReactive(queryInput)
    )(input)
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
    return ctx.dashboardOverviewService.getCurrent()
  }),

  subscribe: publicProcedure.subscription(({ ctx }) => {
    return observable<DashboardOverview>((emit) => {
      const unsubscribe = ctx.dashboardOverviewService.subscribe(
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

      return () => {
        unsubscribe()
      }
    })
  }),

  refreshGitSnapshot: publicProcedure
    .input(z.object({ reason: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const reason = input?.reason?.trim() || 'manual-refresh'
      await ctx.dashboardOverviewService.refresh(reason)
      await touchDashboardGitRefreshStamp(ctx.projectDir, reason)
      return {
        success: true,
      }
    }),

  removeDetachedWorktree: publicProcedure
    .input(z.object({ path: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.dashboardOverviewService.getCurrent()
      await removeDetachedDashboardGitWorktree({
        projectDir: ctx.projectDir,
        targetPath: input.path,
      })
      await ctx.dashboardOverviewService.refresh('remove-detached-worktree')
      await touchDashboardGitRefreshStamp(ctx.projectDir, 'remove-detached-worktree')
      return {
        success: true,
      }
    }),

  gitTaskStatus: publicProcedure.query(async ({ ctx }) => {
    await ctx.dashboardOverviewService.getCurrent()
    return getDashboardGitTaskStatus()
  }),

  subscribeGitTaskStatus: publicProcedure.subscription(({ ctx }) => {
    return observable<DashboardGitTaskStatus>((emit) => {
      void ctx.dashboardOverviewService.getCurrent().catch(() => {
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

export const gitRouter = router({
  overview: publicProcedure.query(async ({ ctx }): Promise<GitWorktreeOverview> => {
    return buildGitWorktreeOverview({ projectDir: ctx.projectDir })
  }),

  listEntries: publicProcedure
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }): Promise<GitEntriesPage> => {
      return listCurrentWorktreeGitEntries({
        projectDir: ctx.projectDir,
        cursor: input?.cursor,
        limit: input?.limit,
      })
    }),

  getEntryMeta: publicProcedure
    .input(z.object({ selector: gitEntrySelectorSchema }))
    .query(async ({ ctx, input }) => {
      return getCurrentWorktreeGitEntryMeta({
        projectDir: ctx.projectDir,
        selector: input.selector as GitEntrySelector,
      })
    }),

  getEntryFiles: publicProcedure
    .input(z.object({ selector: gitEntrySelectorSchema }))
    .query(async ({ ctx, input }): Promise<GitEntryFiles> => {
      const config = await ctx.configManager.readConfig()
      return getCurrentWorktreeGitEntryFiles({
        projectDir: ctx.projectDir,
        selector: input.selector as GitEntrySelector,
        eagerPatchLineBudget: config.git.diffEagerLineBudget,
      })
    }),

  getEntryPatch: publicProcedure
    .input(
      z.object({
        selector: gitEntrySelectorSchema,
        fileId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }): Promise<GitEntryPatch> => {
      return getCurrentWorktreeGitEntryPatch({
        projectDir: ctx.projectDir,
        selector: input.selector as GitEntrySelector,
        fileId: input.fileId,
      })
    }),

  switchWorktree: publicProcedure
    .input(z.object({ path: z.string().min(1) }))
    .mutation(async ({ ctx, input }): Promise<GitWorktreeHandoff> => {
      if (!ctx.gitWorktreeHandoff) {
        throw new Error('Worktree handoff is unavailable in this runtime.')
      }

      const target = await resolveGitWorktreeSwitchTarget({
        projectDir: ctx.projectDir,
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
  globalSettings: globalSettingsRouter,
  translationCache: translationCacheRouter,
  translationEngines: translationEnginesRouter,
  localModels: localModelsRouter,
  notifications: notificationsRouter,
  sounds: soundsRouter,
  cli: cliRouter,
  opsx: opsxRouter,
  kv: kvRouter,
  search: searchRouter,
  system: systemRouter,
})

export type AppRouter = typeof appRouter
