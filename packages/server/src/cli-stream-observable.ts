/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Adapt one CLI event stream to a terminal-safe tRPC observable.
 * 2. Request cancellation even when the client detaches before asynchronous startup completes.
 * 3. Isolate downstream emission failures from the server process.
 * 4. Project a rejected CLI settlement as exactly one attached-client terminal error.
 *
 * Original request (2026-07-15): "Every terminal or indeterminate outcome invalidates affected projections before they are pulled again."
 * Original request (2026-07-17): "tRPC unsubscribe requests cancellation while the Manager awaits settlement."
 */
import type { CliStreamEvent, CliStreamHandle } from '@openspecui/core'
import { observable } from '@trpc/server/observable'

/**
 * 创建安全的 CLI 流式 observable
 *
 * 解决的问题：
 * 1. 防止在 emit.complete() 之后调用 emit.next()（会导致 "Controller is already closed" 错误）
 * 2. 统一的错误处理，防止未捕获的异常导致服务器崩溃
 * 3. 确保取消时正确清理资源
 *
 * @param startStream 启动流的函数，接收 onEvent 回调，返回结算感知的流句柄
 */
export function createCliStreamObservable(
  startStream: (
    onEvent: (event: CliStreamEvent) => void
  ) => Promise<CliStreamHandle> | CliStreamHandle
) {
  return observable<CliStreamEvent>((emit) => {
    let handle: CliStreamHandle | undefined
    let completed = false
    let detached = false

    const emitTerminalError = (error: unknown) => {
      if (completed || detached) return
      completed = true
      try {
        emit.error(error instanceof Error ? error : new Error(String(error)))
      } catch {
        // 已脱离或已关闭的下游 observer 不再有终态投影面。
      }
    }

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
    Promise.resolve(startStream(safeEventHandler))
      .then((startedHandle) => {
        handle = startedHandle
        void startedHandle.settled.catch(emitTerminalError)
        if (detached) {
          void startedHandle.cancel().catch((error: unknown) => {
            console.error('[CLI Stream] Error cancelling detached stream:', error)
          })
          return
        }
      })
      .catch((err) => {
        // 启动失败时发送错误
        console.error('[CLI Stream] Error starting stream:', err)
        emitTerminalError(err)
      })

    // 返回清理函数
    return () => {
      detached = true
      completed = true
      void handle?.cancel().catch((error: unknown) => {
        console.error('[CLI Stream] Error cancelling stream:', error)
      })
    }
  })
}
