import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import type {
  OpenSpecAdapter,
  OpenSpecWatcher,
  FileChangeEvent,
  ConfigManager,
  CliExecutor,
} from '@openspecui/core'
import {
  getAvailableTools,
  getAllTools,
  getConfiguredTools,
  getDefaultCliCommandString,
  sniffGlobalCli,
  type AIToolOption,
} from '@openspecui/core'
import type { ProviderManager } from '@openspecui/ai-provider'
import {
  createReactiveSubscription,
  createReactiveSubscriptionWithInput,
} from './reactive-subscription.js'
import { createCliStreamObservable } from './cli-stream-observable.js'

export interface Context {
  adapter: OpenSpecAdapter
  providerManager: ProviderManager
  configManager: ConfigManager
  cliExecutor: CliExecutor
  watcher?: OpenSpecWatcher
  projectDir: string
}

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

/**
 * Dashboard router - overview and status
 */
export const dashboardRouter = router({
  getData: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.getDashboardData()
  }),

  isInitialized: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.isInitialized()
  }),

  // Reactive subscriptions
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.adapter.getDashboardData())
  }),

  subscribeInitialized: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.adapter.isInitialized())
  }),
})

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
  subscribe: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.adapter.listChangesWithMeta())
  }),

  subscribeOne: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput((id: string) => ctx.adapter.readChange(id))(
        input.id
      )
    }),

  subscribeRaw: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ ctx, input }) => {
      return createReactiveSubscriptionWithInput((id: string) => ctx.adapter.readChangeRaw(id))(
        input.id
      )
    }),
})

/**
 * AI router - AI-assisted operations
 */
export const aiRouter = router({
  listProviders: publicProcedure.query(({ ctx }) => {
    return ctx.providerManager.list()
  }),

  checkAvailability: publicProcedure.query(async ({ ctx }) => {
    const results = await ctx.providerManager.checkAvailability()
    return Object.fromEntries(results)
  }),

  review: publicProcedure
    .input(
      z.object({
        content: z.string(),
        type: z.enum(['spec', 'change']),
        provider: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = input.provider
        ? ctx.providerManager.get(input.provider)
        : ctx.providerManager.getDefaultApi()

      if (!provider) {
        throw new Error('No AI provider available')
      }

      const response = await provider.complete({
        messages: [
          {
            role: 'system',
            content: `You are an expert ${input.type === 'spec' ? 'specification' : 'change proposal'} reviewer.
            Analyze the document and provide line-by-line comments for improvements.
            Format your response as JSON array: [{"line": number, "type": "suggestion"|"warning"|"error", "comment": "..."}]`,
          },
          {
            role: 'user',
            content: `Review this ${input.type}:\n\n${input.content}`,
          },
        ],
      })

      try {
        return JSON.parse(response.content)
      } catch {
        return [{ line: 1, type: 'info', comment: response.content }]
      }
    }),

  translate: publicProcedure
    .input(
      z.object({
        content: z.string(),
        targetLang: z.enum(['en', 'zh']),
        provider: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = input.provider
        ? ctx.providerManager.get(input.provider)
        : ctx.providerManager.getDefaultApi()

      if (!provider) {
        throw new Error('No AI provider available')
      }

      const langName = input.targetLang === 'en' ? 'English' : 'Chinese'

      const response = await provider.complete({
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following OpenSpec document to ${langName}.
            Preserve all markdown formatting, headers, and structure. Only translate the text content.`,
          },
          {
            role: 'user',
            content: input.content,
          },
        ],
      })

      return { translated: response.content }
    }),

  suggest: publicProcedure
    .input(
      z.object({
        content: z.string(),
        instruction: z.string(),
        provider: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = input.provider
        ? ctx.providerManager.get(input.provider)
        : ctx.providerManager.getDefaultApi()

      if (!provider) {
        throw new Error('No AI provider available')
      }

      const response = await provider.complete({
        messages: [
          {
            role: 'system',
            content: `You are an OpenSpec document editor. Modify the document according to the user's instruction.
            Return only the modified document, maintaining proper OpenSpec markdown format.`,
          },
          {
            role: 'user',
            content: `Instruction: ${input.instruction}\n\nDocument:\n${input.content}`,
          },
        ],
      })

      return { suggested: response.content }
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
 * Project router - project-level files (project.md, AGENTS.md)
 */
export const projectRouter = router({
  getProjectMd: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.readProjectMd()
  }),

  getAgentsMd: publicProcedure.query(async ({ ctx }) => {
    return ctx.adapter.readAgentsMd()
  }),

  saveProjectMd: publicProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.adapter.writeProjectMd(input.content)
      return { success: true }
    }),

  saveAgentsMd: publicProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.adapter.writeAgentsMd(input.content)
      return { success: true }
    }),

  // Reactive subscriptions
  subscribeProjectMd: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.adapter.readProjectMd())
  }),

  subscribeAgentsMd: publicProcedure.subscription(({ ctx }) => {
    return createReactiveSubscription(() => ctx.adapter.readAgentsMd())
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

  /** 获取实际使用的 CLI 命令（检测全局命令或 fallback 到 npx，字符串形式用于 UI 显示） */
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
        cli: z.object({ command: z.string() }).optional(),
        ui: z.object({ theme: z.enum(['light', 'dark', 'system']) }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.configManager.writeConfig(input)
      return { success: true }
    }),

  setCliCommand: publicProcedure
    .input(z.object({ command: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.configManager.setCliCommand(input.command)
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
    return observable<{ type: 'command' | 'stdout' | 'stderr' | 'exit'; data?: string; exitCode?: number | null }>((emit) => {
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
 * Main app router
 */
export const appRouter = router({
  dashboard: dashboardRouter,
  spec: specRouter,
  change: changeRouter,
  archive: archiveRouter,
  project: projectRouter,
  ai: aiRouter,
  init: initRouter,
  realtime: realtimeRouter,
  config: configRouter,
  cli: cliRouter,
})

export type AppRouter = typeof appRouter
