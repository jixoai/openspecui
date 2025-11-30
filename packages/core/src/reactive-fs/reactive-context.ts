import { contextStorage, type ReactiveState } from './reactive-state.js'

/** PromiseWithResolvers polyfill for ES2022 */
interface PromiseWithResolvers<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

function createPromiseWithResolvers<T>(): PromiseWithResolvers<T> {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * 响应式上下文，管理依赖收集和变更通知
 *
 * 核心机制：
 * - 在 stream() 中执行任务时，通过 AsyncLocalStorage 传递 this
 * - 任务中的所有 ReactiveState.get() 调用都会自动注册依赖
 * - 当任何依赖变更时，重新执行任务并 yield 新结果
 */
export class ReactiveContext {
  /** 当前追踪的依赖 */
  private dependencies = new Set<ReactiveState<unknown>>()
  /** 等待变更的 Promise */
  private changePromise?: PromiseWithResolvers<void>
  /** 是否已销毁 */
  private destroyed = false

  /**
   * 追踪依赖
   * 由 ReactiveState.get() 调用
   */
  track(state: ReactiveState<unknown>): void {
    if (!this.destroyed) {
      this.dependencies.add(state)
    }
  }

  /**
   * 通知变更
   * 由 ReactiveState.set() 调用
   */
  notifyChange(): void {
    if (!this.destroyed && this.changePromise) {
      this.changePromise.resolve()
    }
  }

  /**
   * 运行响应式任务流
   * 每次依赖变更时重新执行任务并 yield 结果
   *
   * @param task 要执行的异步任务
   * @param signal 用于取消的 AbortSignal
   */
  async *stream<T>(task: () => Promise<T>, signal?: AbortSignal): AsyncGenerator<T> {
    try {
      while (!signal?.aborted && !this.destroyed) {
        // 清理上一轮的依赖
        this.clearDependencies()

        // 创建新的变更等待 Promise
        this.changePromise = createPromiseWithResolvers()

        // 在上下文中执行任务，收集依赖
        const result = await contextStorage.run(this, task)

        // yield 结果
        yield result

        // 如果没有依赖，说明任务不依赖任何响应式状态，直接退出
        if (this.dependencies.size === 0) {
          break
        }

        // 等待依赖变更
        await Promise.race([
          this.changePromise.promise,
          signal ? this.waitForAbort(signal) : new Promise(() => {}),
        ])

        // 检查是否被取消
        if (signal?.aborted) {
          break
        }
      }
    } finally {
      this.destroy()
    }
  }

  /**
   * 执行一次任务（非响应式）
   * 用于初始数据获取
   */
  async runOnce<T>(task: () => Promise<T>): Promise<T> {
    return contextStorage.run(this, task)
  }

  /**
   * 清理依赖
   */
  private clearDependencies(): void {
    for (const state of this.dependencies) {
      state.unsubscribe(this)
    }
    this.dependencies.clear()
  }

  /**
   * 销毁上下文
   * @param reason 可选的销毁原因，如果提供则 reject changePromise
   */
  private destroy(reason?: Error): void {
    this.destroyed = true
    this.clearDependencies()
    if (reason && this.changePromise) {
      this.changePromise.reject(reason)
    }
    this.changePromise = undefined
  }

  /**
   * 等待 AbortSignal
   */
  private waitForAbort(signal: AbortSignal): Promise<void> {
    return new Promise((_, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'))
      })
    })
  }
}
