import { AsyncLocalStorage } from 'node:async_hooks'

// 前向声明 ReactiveContext 接口，避免循环依赖
interface IReactiveContext {
  track(state: ReactiveState<unknown>): void
  notifyChange(): void
}

/**
 * 全局的 AsyncLocalStorage，用于在异步调用链中传递 ReactiveContext
 * 这是实现依赖收集的核心机制
 */
export const contextStorage = new AsyncLocalStorage<IReactiveContext>()

/** ReactiveState 配置选项 */
export interface ReactiveStateOptions<T> {
  /** 自定义相等性比较函数 */
  equals?: (a: T, b: T) => boolean
}

/**
 * 响应式状态类，类似 Signal.State
 *
 * 核心机制：
 * - get() 时自动注册到当前 ReactiveContext 的依赖列表
 * - set() 时如果值变化，通知所有依赖的 Context
 */
export class ReactiveState<T> {
  private currentValue: T
  private readonly equals: (a: T, b: T) => boolean
  /** 所有依赖此状态的 Context */
  private readonly subscribers = new Set<IReactiveContext>()

  constructor(initialValue: T, options?: ReactiveStateOptions<T>) {
    this.currentValue = initialValue
    this.equals = options?.equals ?? ((a, b) => a === b)
  }

  /**
   * 获取当前值
   * 如果在 ReactiveContext 中调用，会自动注册依赖
   */
  get(): T {
    const context = contextStorage.getStore()
    if (context) {
      // 注册依赖：当前 context 依赖此 state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      context.track(this as ReactiveState<any>)
      this.subscribers.add(context)
    }
    return this.currentValue
  }

  /**
   * 设置新值
   * 如果值变化，通知所有订阅者
   * @returns 是否发生了变化
   */
  set(newValue: T): boolean {
    if (this.equals(this.currentValue, newValue)) {
      return false
    }

    this.currentValue = newValue

    // 通知所有订阅者
    for (const context of this.subscribers) {
      context.notifyChange()
    }

    return true
  }

  /**
   * 取消订阅
   * 当 Context 销毁时调用
   */
  unsubscribe(context: IReactiveContext): void {
    this.subscribers.delete(context)
  }

  /**
   * 获取当前订阅者数量（用于调试）
   */
  get subscriberCount(): number {
    return this.subscribers.size
  }
}
