import type {
  ChangeFile,
  CliExecutor,
  ConfigManager,
  FileChangeEvent,
  OpenSpecAdapter,
  OpenSpecWatcher,
  OpsxKernel,
} from '@openspecui/core'
import {
  getAllTools,
  getAvailableTools,
  getConfiguredTools,
  getDefaultCliCommandString,
  getWatcherRuntimeStatus,
  sniffGlobalCli,
  type AIToolOption,
  type ApplyInstructions,
  type ArtifactInstructions,
  type ChangeStatus,
  type SchemaDetail,
  type SchemaInfo,
  type SchemaResolution,
  type TemplateContentMap,
  type TemplatesMap,
} from '@openspecui/core'
import { SearchQuerySchema, type SearchQuery } from '@openspecui/search'
import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { z } from 'zod'
import { createCliStreamObservable } from './cli-stream-observable.js'
import { reactiveKV } from './reactive-kv.js'
import {
  createReactiveSubscription,
  createReactiveSubscriptionWithInput,
} from './reactive-subscription.js'
import type { SearchService } from './search-service.js'

export interface Context {
  adapter: OpenSpecAdapter
  configManager: ConfigManager
  cliExecutor: CliExecutor
  kernel: OpsxKernel
  searchService: SearchService
  watcher?: OpenSpecWatcher
  projectDir: string
}

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

function requireChangeId(changeId: string | undefined): string {
  if (!changeId) {
    throw new Error('change is required')
  }
  return changeId
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

function buildSystemStatus(ctx: Context): {
  projectDir: string
  watcherEnabled: boolean
  watcherGeneration: number
  watcherReinitializeCount: number
  watcherLastReinitializeReason: string | null
} {
  const runtime = getWatcherRuntimeStatus()
  return {
    projectDir: ctx.projectDir,
    watcherEnabled: runtime?.initialized ?? false,
    watcherGeneration: runtime?.generation ?? 0,
    watcherReinitializeCount: runtime?.reinitializeCount ?? 0,
    watcherLastReinitializeReason: runtime?.lastReinitializeReason ?? null,
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
    return ctx.adapter.readSpec(input.id)
  }),

  getRaw: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.adapter.readSpecRaw(input.id)
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
      return createReactiveSubscriptionWithInput((id: string) => ctx.adapter.readSpec(id))(input.id)
    }),

  subscribeRaw: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput((id: string) => ctx.adapter.readSpecRaw(id))(
        input.id
      )
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
    return ctx.adapter.readChange(input.id)
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
  subscribeFiles: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput((id: string) => ctx.adapter.readChangeFiles(id))(
        input.id
      )
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
    return ctx.adapter.readArchivedChange(input.id)
  }),

  getRaw: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.adapter.readArchivedChangeRaw(input.id)
  }),

  // Reactive subscriptions
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.adapter.listArchivedChangesWithMeta())
  }),

  subscribeOne: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput((id: string) =>
        ctx.adapter.readArchivedChange(id)
      )(input.id)
    }),

  subscribeFiles: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput((id: string) =>
        ctx.adapter.readArchivedChangeFiles(id)
      )(input.id)
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
        terminal: z
          .object({
            fontSize: z.number().min(8).max(32).optional(),
            fontFamily: z.string().optional(),
            cursorBlink: z.boolean().optional(),
            cursorStyle: z.enum(['block', 'underline', 'bar']).optional(),
            scrollback: z.number().min(0).max(100000).optional(),
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
        if (input.theme !== undefined || input.terminal !== undefined) {
          await ctx.configManager.writeConfig({
            theme: input.theme,
            terminal: input.terminal,
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
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.cliExecutor.init(input?.tools ?? 'all')
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
        })
        .optional()
    )
    .subscription(({ ctx, input }) => {
      return createCliStreamObservable((onEvent) =>
        ctx.cliExecutor.initStream(input?.tools ?? 'all', onEvent)
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

  changeMetadata: publicProcedure
    .input(z.object({ changeId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.kernel.waitForWarmup()
      await ctx.kernel.ensureChangeMetadata(input.changeId)
      return ctx.kernel.getChangeMetadata(input.changeId)
    }),

  subscribeChangeMetadata: publicProcedure
    .input(z.object({ changeId: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await ctx.kernel.waitForWarmup()
        await ctx.kernel.ensureChangeMetadata(input.changeId)
        return ctx.kernel.getChangeMetadata(input.changeId)
      })
    }),

  readArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.kernel.waitForWarmup()
      await ctx.kernel.ensureArtifactOutput(input.changeId, input.outputPath)
      return ctx.kernel.getArtifactOutput(input.changeId, input.outputPath)
    }),

  subscribeArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await ctx.kernel.waitForWarmup()
        await ctx.kernel.ensureArtifactOutput(input.changeId, input.outputPath)
        return ctx.kernel.getArtifactOutput(input.changeId, input.outputPath)
      })
    }),

  readGlobArtifactFiles: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.kernel.waitForWarmup()
      await ctx.kernel.ensureGlobArtifactFiles(input.changeId, input.outputPath)
      return ctx.kernel.getGlobArtifactFiles(input.changeId, input.outputPath)
    }),

  subscribeGlobArtifactFiles: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await ctx.kernel.waitForWarmup()
        await ctx.kernel.ensureGlobArtifactFiles(input.changeId, input.outputPath)
        return ctx.kernel.getGlobArtifactFiles(input.changeId, input.outputPath)
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
    return observable<ReturnType<typeof buildSystemStatus>>((emit) => {
      emit.next(buildSystemStatus(ctx))

      const timer = setInterval(() => {
        emit.next(buildSystemStatus(ctx))
      }, 3000)
      timer.unref()

      return () => {
        clearInterval(timer)
      }
    })
  }),
})

/**
 * Main app router
 */
export const appRouter = router({
  spec: specRouter,
  change: changeRouter,
  archive: archiveRouter,
  init: initRouter,
  realtime: realtimeRouter,
  config: configRouter,
  cli: cliRouter,
  opsx: opsxRouter,
  kv: kvRouter,
  search: searchRouter,
  system: systemRouter,
})

export type AppRouter = typeof appRouter
