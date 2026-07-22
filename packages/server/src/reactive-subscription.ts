/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Preserve raw reactive subscription payloads for existing consumers.
 * 2. Expose opt-in recompute lifecycle events for projection consumers.
 * 3. Abort reactive work when an observable subscription is retired.
 *
 * Original request (2026-07-22): "整个过程中，几乎都在 Loading。"
 */
import { ReactiveContext } from '@openspecui/core'
import { observable } from '@trpc/server/observable'

/** 可选响应式投影订阅发出的生命周期数据。 */
export type ReactiveProjectionSubscriptionEvent<T> =
  | { type: 'recompute-started' }
  | { type: 'data'; data: T }

/**
 * 创建响应式订阅
 *
 * 自动追踪 task 中的文件依赖，当依赖变更时自动重新执行并推送新数据。
 *
 * @param task 要执行的异步任务，内部的文件读取会被自动追踪
 * @returns tRPC observable
 *
 * @example
 * ```typescript
 * // 在 router 中使用
 * subscribe: publicProcedure.subscription(({ ctx }) => {
 *   return createReactiveSubscription(() => ctx.adapter.listSpecsWithMeta())
 * })
 * ```
 */
export function createReactiveSubscription<T>(task: () => Promise<T>) {
  return observable<T>((emit) => {
    const context = new ReactiveContext()
    const controller = new AbortController()

    // 启动响应式流
    ;(async () => {
      try {
        for await (const data of context.stream(task, controller.signal)) {
          emit.next(data)
        }
      } catch (err) {
        // 忽略 abort 错误
        if (!controller.signal.aborted) {
          emit.error(err as Error)
        }
      }
    })()

    // 返回清理函数
    return () => {
      controller.abort()
    }
  })
}

/**
 * 创建携带明确重算生命周期事件的响应式投影订阅。
 *
 * 初始任务只发出 `data`。每次依赖驱动的替换会在任务开始前发出
 * `recompute-started`，随后发出任务完成后的 `data`。
 *
 * @param task 自动追踪响应式依赖的异步投影任务
 * @returns 携带可选投影生命周期事件的 tRPC observable
 */
export function createReactiveProjectionSubscription<T>(task: () => Promise<T>) {
  return observable<ReactiveProjectionSubscriptionEvent<T>>((emit) => {
    const context = new ReactiveContext()
    const controller = new AbortController()

    ;(async () => {
      try {
        for await (const data of context.stream(task, controller.signal, {
          onRecomputeStarted() {
            emit.next({ type: 'recompute-started' })
          },
        })) {
          emit.next({ type: 'data', data })
        }
        emit.complete()
      } catch (err) {
        if (!controller.signal.aborted) {
          emit.error(err)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  })
}

/**
 * 创建带输入参数的响应式订阅
 *
 * @param task 接收输入参数的异步任务
 * @returns 返回一个函数，接收输入参数并返回 tRPC observable
 *
 * @example
 * ```typescript
 * // 在 router 中使用
 * subscribeOne: publicProcedure
 *   .input(z.object({ id: z.string() }))
 *   .subscription(({ ctx, input }) => {
 *     return createReactiveSubscriptionWithInput(
 *       (id: string) => ctx.adapter.readSpec(id)
 *     )(input.id)
 *   })
 * ```
 */
export function createReactiveSubscriptionWithInput<TInput, TOutput>(
  task: (input: TInput) => Promise<TOutput>
) {
  return (input: TInput) => {
    return createReactiveSubscription(() => task(input))
  }
}
