import type { CliStreamEvent } from '@openspecui/core'
import { observable } from '@trpc/server/observable'

/**
 * 创建安全的 CLI 流式 observable
 *
 * 解决的问题：
 * 1. 防止在 emit.complete() 之后调用 emit.next()（会导致 "Controller is already closed" 错误）
 * 2. 统一的错误处理，防止未捕获的异常导致服务器崩溃
 * 3. 确保取消时正确清理资源
 *
 * @param startStream 启动流的函数，接收 onEvent 回调，返回取消函数的 Promise
 */
export function createCliStreamObservable(
  startStream: (onEvent: (event: CliStreamEvent) => void) => Promise<() => void>
) {
  return observable<CliStreamEvent>((emit) => {
    let cancel: (() => void) | undefined
    let completed = false

    /**
     * 安全的事件处理器
     * - 检查是否已完成，防止重复调用
     * - 使用 try-catch 防止异常导致服务器崩溃
     */
    const safeEventHandler = (event: CliStreamEvent) => {
      // 如果已经完成，忽略后续事件
      if (completed) return

      try {
        emit.next(event)

        // exit 事件表示流结束
        if (event.type === 'exit') {
          completed = true
          emit.complete()
        }
      } catch (err) {
        // 捕获任何错误，防止服务器崩溃
        console.error('[CLI Stream] Error emitting event:', err)
        if (!completed) {
          completed = true
          try {
            emit.error(err instanceof Error ? err : new Error(String(err)))
          } catch {
            // 如果 emit.error 也失败，静默处理
          }
        }
      }
    }

    // 启动流
    startStream(safeEventHandler)
      .then((cancelFn) => {
        cancel = cancelFn
      })
      .catch((err) => {
        // 启动失败时发送错误
        console.error('[CLI Stream] Error starting stream:', err)
        if (!completed) {
          completed = true
          try {
            emit.error(err instanceof Error ? err : new Error(String(err)))
          } catch {
            // 静默处理
          }
        }
      })

    // 返回清理函数
    return () => {
      completed = true
      cancel?.()
    }
  })
}
