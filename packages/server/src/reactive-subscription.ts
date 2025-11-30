import { observable } from '@trpc/server/observable'
import { ReactiveContext } from '@openspecui/core'

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
