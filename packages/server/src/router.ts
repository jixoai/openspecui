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
  ApplyInstructionsSchema,
  ArtifactInstructionsSchema,
  ChangeStatusSchema,
  SchemaInfoSchema,
  SchemaResolutionSchema,
  TemplatesSchema,
  getAllTools,
  getAvailableTools,
  getConfiguredTools,
  getDefaultCliCommandString,
  reactiveReadDir,
  reactiveReadFile,
  reactiveStat,
  sniffGlobalCli,
  type AIToolOption,
  type ApplyInstructions,
  type ArtifactInstructions,
  type ChangeStatus,
  type SchemaInfo,
  type SchemaResolution,
  type TemplatesMap,
} from '@openspecui/core'
import { SearchQuerySchema, type SearchQuery } from '@openspecui/search'
import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, matchesGlob, relative, resolve, sep } from 'node:path'
import { z } from 'zod'
import { createCliStreamObservable } from './cli-stream-observable.js'
import { parseSchemaYaml } from './opsx-schema.js'
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

function parseCliJson<T>(raw: string, schema: z.ZodSchema<T>, label: string): T {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error(`${label} returned empty output`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`${label} returned invalid JSON: ${message}`)
  }
  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`${label} returned unexpected JSON: ${result.error.message}`)
  }
  return result.data
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

function toRelativePath(root: string, absolutePath: string): string {
  const rel = relative(root, absolutePath)
  return rel.split(sep).join('/')
}

async function readEntriesUnderRoot(root: string): Promise<ChangeFile[]> {
  const rootStat = await reactiveStat(root)
  if (!rootStat?.isDirectory) return []

  const collectEntries = async (dir: string): Promise<ChangeFile[]> => {
    const names = await reactiveReadDir(dir, { includeHidden: false })
    const entries: ChangeFile[] = []

    for (const name of names) {
      const fullPath = join(dir, name)
      const statInfo = await reactiveStat(fullPath)
      if (!statInfo) continue

      const relativePath = toRelativePath(root, fullPath)

      if (statInfo.isDirectory) {
        entries.push({ path: relativePath, type: 'directory' })
        entries.push(...(await collectEntries(fullPath)))
      } else {
        const content = await reactiveReadFile(fullPath)
        const size = content ? Buffer.byteLength(content, 'utf-8') : undefined
        entries.push({
          path: relativePath,
          type: 'file',
          content: content ?? undefined,
          size,
        })
      }
    }

    return entries
  }

  return collectEntries(root)
}

async function touchOpsxProjectDeps(projectDir: string): Promise<void> {
  const openspecDir = join(projectDir, 'openspec')
  await reactiveReadFile(join(openspecDir, 'config.yaml'))
  const schemaRoot = join(openspecDir, 'schemas')
  const schemaDirs = await reactiveReadDir(schemaRoot, {
    directoriesOnly: true,
    includeHidden: true,
  })
  await Promise.all(
    schemaDirs.map((name) => reactiveReadFile(join(schemaRoot, name, 'schema.yaml')))
  )
  await reactiveReadDir(join(openspecDir, 'changes'), {
    directoriesOnly: true,
    includeHidden: true,
    exclude: ['archive'],
  })
}

async function touchOpsxChangeDeps(projectDir: string, changeId: string): Promise<void> {
  const changeDir = join(projectDir, 'openspec', 'changes', changeId)
  await reactiveReadDir(changeDir, { includeHidden: true })
  await reactiveReadFile(join(changeDir, '.openspec.yaml'))
}

interface GlobArtifactFile {
  path: string
  type: 'file'
  content: string
}

async function readGlobArtifactFiles(
  projectDir: string,
  changeId: string,
  outputPath: string
): Promise<GlobArtifactFile[]> {
  const changeDir = join(projectDir, 'openspec', 'changes', changeId)
  const allEntries = await readEntriesUnderRoot(changeDir)
  return allEntries
    .filter((entry) => entry.type === 'file' && matchesGlob(entry.path, outputPath))
    .map((entry) => ({
      path: entry.path,
      type: 'file' as const,
      content: entry.content ?? '',
    }))
}

async function fetchOpsxStatus(
  ctx: Context,
  input: { change?: string; schema?: string }
): Promise<ChangeStatus> {
  const changeId = requireChangeId(input.change)
  await touchOpsxProjectDeps(ctx.projectDir)
  await touchOpsxChangeDeps(ctx.projectDir, changeId)

  const args = ['status', '--json', '--change', changeId]
  if (input.schema) args.push('--schema', input.schema)

  const result = await ctx.cliExecutor.execute(args)
  if (!result.success) {
    throw new Error(result.stderr || `openspec status failed (exit ${result.exitCode ?? 'null'})`)
  }
  const status = parseCliJson(result.stdout, ChangeStatusSchema, 'openspec status')
  // Add project-relative path for display purposes
  const changeRelDir = `openspec/changes/${changeId}`
  for (const artifact of status.artifacts) {
    artifact.relativePath = `${changeRelDir}/${artifact.outputPath}`
  }
  return status
}

async function fetchOpsxStatusList(ctx: Context): Promise<ChangeStatus[]> {
  const changesDir = join(ctx.projectDir, 'openspec', 'changes')
  const changeIds = await reactiveReadDir(changesDir, {
    directoriesOnly: true,
    includeHidden: false,
    exclude: ['archive'],
  })
  const statuses = await Promise.all(
    changeIds.map((changeId) => fetchOpsxStatus(ctx, { change: changeId }))
  )
  return statuses
}

async function fetchOpsxInstructions(
  ctx: Context,
  input: { change?: string; artifact: string; schema?: string }
): Promise<ArtifactInstructions> {
  const changeId = requireChangeId(input.change)
  await touchOpsxProjectDeps(ctx.projectDir)
  await touchOpsxChangeDeps(ctx.projectDir, changeId)

  const args = ['instructions', input.artifact, '--json', '--change', changeId]
  if (input.schema) args.push('--schema', input.schema)

  const result = await ctx.cliExecutor.execute(args)
  if (!result.success) {
    throw new Error(
      result.stderr || `openspec instructions failed (exit ${result.exitCode ?? 'null'})`
    )
  }
  return parseCliJson(result.stdout, ArtifactInstructionsSchema, 'openspec instructions')
}

async function fetchOpsxApplyInstructions(
  ctx: Context,
  input: { change?: string; schema?: string }
): Promise<ApplyInstructions> {
  const changeId = requireChangeId(input.change)
  await touchOpsxProjectDeps(ctx.projectDir)
  await touchOpsxChangeDeps(ctx.projectDir, changeId)

  const args = ['instructions', 'apply', '--json', '--change', changeId]
  if (input.schema) args.push('--schema', input.schema)

  const result = await ctx.cliExecutor.execute(args)
  if (!result.success) {
    throw new Error(
      result.stderr || `openspec instructions apply failed (exit ${result.exitCode ?? 'null'})`
    )
  }
  return parseCliJson(result.stdout, ApplyInstructionsSchema, 'openspec instructions apply')
}

async function fetchOpsxSchemas(ctx: Context): Promise<SchemaInfo[]> {
  await touchOpsxProjectDeps(ctx.projectDir)
  const result = await ctx.cliExecutor.schemas()
  if (!result.success) {
    throw new Error(result.stderr || `openspec schemas failed (exit ${result.exitCode ?? 'null'})`)
  }
  return parseCliJson(result.stdout, z.array(SchemaInfoSchema), 'openspec schemas')
}

async function fetchOpsxSchemaResolution(ctx: Context, name: string): Promise<SchemaResolution> {
  await touchOpsxProjectDeps(ctx.projectDir)
  const result = await ctx.cliExecutor.schemaWhich(name)
  if (!result.success) {
    throw new Error(
      result.stderr || `openspec schema which failed (exit ${result.exitCode ?? 'null'})`
    )
  }
  return parseCliJson(result.stdout, SchemaResolutionSchema, 'openspec schema which')
}

async function fetchOpsxTemplates(ctx: Context, schema?: string): Promise<TemplatesMap> {
  await touchOpsxProjectDeps(ctx.projectDir)
  const result = await ctx.cliExecutor.templates(schema)
  if (!result.success) {
    throw new Error(
      result.stderr || `openspec templates failed (exit ${result.exitCode ?? 'null'})`
    )
  }
  return parseCliJson(result.stdout, TemplatesSchema, 'openspec templates')
}

type TemplateContentMap = Record<
  string,
  { content: string | null; path: string; source: TemplatesMap[string]['source'] }
>

async function fetchOpsxTemplateContents(
  ctx: Context,
  schema?: string
): Promise<TemplateContentMap> {
  const templates = await fetchOpsxTemplates(ctx, schema)
  const entries = await Promise.all(
    Object.entries(templates).map(async ([artifactId, info]) => {
      const content = await reactiveReadFile(info.path)
      return [artifactId, { content, path: info.path, source: info.source }] as const
    })
  )
  return Object.fromEntries(entries)
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

  schemas: publicProcedure.query(async ({ ctx }): Promise<SchemaInfo[]> => {
    return fetchOpsxSchemas(ctx)
  }),

  subscribeSchemas: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => fetchOpsxSchemas(ctx))
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

  schemaResolution: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }): Promise<SchemaResolution> => {
      return fetchOpsxSchemaResolution(ctx, input.name)
    }),

  subscribeSchemaResolution: publicProcedure
    .input(z.object({ name: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(() => fetchOpsxSchemaResolution(ctx, input.name))
    }),

  schemaDetail: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      await touchOpsxProjectDeps(ctx.projectDir)
      const resolution = await fetchOpsxSchemaResolution(ctx, input.name)
      const schemaPath = join(resolution.path, 'schema.yaml')
      const content = await reactiveReadFile(schemaPath)
      if (!content) {
        throw new Error(`schema.yaml not found at ${schemaPath}`)
      }
      return parseSchemaYaml(content)
    }),

  subscribeSchemaDetail: publicProcedure
    .input(z.object({ name: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await touchOpsxProjectDeps(ctx.projectDir)
        const resolution = await fetchOpsxSchemaResolution(ctx, input.name)
        const schemaPath = join(resolution.path, 'schema.yaml')
        const content = await reactiveReadFile(schemaPath)
        if (!content) {
          throw new Error(`schema.yaml not found at ${schemaPath}`)
        }
        return parseSchemaYaml(content)
      })
    }),

  schemaFiles: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }): Promise<ChangeFile[]> => {
      await touchOpsxProjectDeps(ctx.projectDir)
      const resolution = await fetchOpsxSchemaResolution(ctx, input.name)
      return readEntriesUnderRoot(resolution.path)
    }),

  subscribeSchemaFiles: publicProcedure
    .input(z.object({ name: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await touchOpsxProjectDeps(ctx.projectDir)
        const resolution = await fetchOpsxSchemaResolution(ctx, input.name)
        return readEntriesUnderRoot(resolution.path)
      })
    }),

  schemaYaml: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      await touchOpsxProjectDeps(ctx.projectDir)
      const resolution = await fetchOpsxSchemaResolution(ctx, input.name)
      const schemaPath = join(resolution.path, 'schema.yaml')
      return reactiveReadFile(schemaPath)
    }),

  subscribeSchemaYaml: publicProcedure
    .input(z.object({ name: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        await touchOpsxProjectDeps(ctx.projectDir)
        const resolution = await fetchOpsxSchemaResolution(ctx, input.name)
        const schemaPath = join(resolution.path, 'schema.yaml')
        return reactiveReadFile(schemaPath)
      })
    }),

  writeSchemaYaml: publicProcedure
    .input(z.object({ name: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await touchOpsxProjectDeps(ctx.projectDir)
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
      await touchOpsxProjectDeps(ctx.projectDir)
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
      await touchOpsxProjectDeps(ctx.projectDir)
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
      await touchOpsxProjectDeps(ctx.projectDir)
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
      await touchOpsxProjectDeps(ctx.projectDir)
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
      const templates = await fetchOpsxTemplates(ctx, input.schema)
      const info = templates[input.artifactId]
      if (!info) {
        throw new Error(`Template not found for ${input.schema}:${input.artifactId}`)
      }
      const content = await reactiveReadFile(info.path)
      return { content, path: info.path, source: info.source }
    }),

  subscribeTemplateContent: publicProcedure
    .input(z.object({ schema: z.string(), artifactId: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        const templates = await fetchOpsxTemplates(ctx, input.schema)
        const info = templates[input.artifactId]
        if (!info) {
          throw new Error(`Template not found for ${input.schema}:${input.artifactId}`)
        }
        const content = await reactiveReadFile(info.path)
        return { content, path: info.path, source: info.source }
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
      await touchOpsxProjectDeps(ctx.projectDir)
      const resolution = await fetchOpsxSchemaResolution(ctx, input.name)
      ensureEditableSource(resolution.source, 'schema')
      await rm(resolution.path, { recursive: true, force: true })
      return { success: true }
    }),

  projectConfig: publicProcedure.query(async ({ ctx }) => {
    const configPath = join(ctx.projectDir, 'openspec', 'config.yaml')
    return reactiveReadFile(configPath)
  }),

  subscribeProjectConfig: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(async () => {
      const configPath = join(ctx.projectDir, 'openspec', 'config.yaml')
      return reactiveReadFile(configPath)
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
    const changesDir = join(ctx.projectDir, 'openspec', 'changes')
    return reactiveReadDir(changesDir, {
      directoriesOnly: true,
      exclude: ['archive'],
      includeHidden: false,
    })
  }),

  subscribeChanges: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(async () => {
      const changesDir = join(ctx.projectDir, 'openspec', 'changes')
      return reactiveReadDir(changesDir, {
        directoriesOnly: true,
        exclude: ['archive'],
        includeHidden: false,
      })
    })
  }),

  changeMetadata: publicProcedure
    .input(z.object({ changeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const metadataPath = join(
        ctx.projectDir,
        'openspec',
        'changes',
        input.changeId,
        '.openspec.yaml'
      )
      return reactiveReadFile(metadataPath)
    }),

  subscribeChangeMetadata: publicProcedure
    .input(z.object({ changeId: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        const metadataPath = join(
          ctx.projectDir,
          'openspec',
          'changes',
          input.changeId,
          '.openspec.yaml'
        )
        return reactiveReadFile(metadataPath)
      })
    }),

  readArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .query(async ({ ctx, input }) => {
      const artifactPath = join(
        ctx.projectDir,
        'openspec',
        'changes',
        input.changeId,
        input.outputPath
      )
      return reactiveReadFile(artifactPath)
    }),

  subscribeArtifactOutput: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        const artifactPath = join(
          ctx.projectDir,
          'openspec',
          'changes',
          input.changeId,
          input.outputPath
        )
        return reactiveReadFile(artifactPath)
      })
    }),

  readGlobArtifactFiles: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .query(async ({ ctx, input }) => {
      return readGlobArtifactFiles(ctx.projectDir, input.changeId, input.outputPath)
    }),

  subscribeGlobArtifactFiles: publicProcedure
    .input(z.object({ changeId: z.string(), outputPath: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscription(async () => {
        return readGlobArtifactFiles(ctx.projectDir, input.changeId, input.outputPath)
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
})

export type AppRouter = typeof appRouter
