import type { AsyncSubscription, Event } from '@parcel/watcher'
import { dirname, resolve } from 'node:path'
import { realpathSync, existsSync, utimesSync } from 'node:fs'

/**
 * 获取路径的真实路径（解析符号链接）
 * 在 macOS 上，/var 是 /private/var 的符号链接
 */
function getRealPath(path: string): string {
  try {
    return realpathSync(resolve(path))
  } catch {
    // 路径不存在时返回原始解析后的路径
    return resolve(path)
  }
}

/**
 * 事件类型
 */
export type WatchEventType = 'create' | 'update' | 'delete'

/**
 * 监听事件
 */
export interface WatchEvent {
  type: WatchEventType
  path: string
}

/**
 * 路径订阅回调
 */
export type PathCallback = (events: WatchEvent[]) => void

/**
 * 路径订阅条目
 */
interface PathSubscription {
  /** 监听的路径（规范化后） */
  path: string
  /** 是否监听目录内容变更（而非目录本身） */
  watchChildren: boolean
  callback: PathCallback
}

/** 默认防抖时间 (ms) */
const DEBOUNCE_MS = 50

/** 默认忽略模式 */
const DEFAULT_IGNORE = ['node_modules', '.git', '**/.DS_Store']

/** 健康检查间隔 (ms) - 3秒 */
const HEALTH_CHECK_INTERVAL_MS = 3000

/**
 * 项目监听器
 *
 * 使用 @parcel/watcher 监听项目根目录，
 * 然后通过路径前缀匹配分发事件给订阅者。
 *
 * 特性：
 * - 单个 watcher 监听整个项目
 * - 自动处理新创建的目录
 * - 内置防抖机制
 * - 高性能原生实现
 */
export class ProjectWatcher {
  private projectDir: string
  private subscription: AsyncSubscription | null = null
  private pathSubscriptions = new Map<symbol, PathSubscription>()
  private pendingEvents: WatchEvent[] = []
  private debounceTimer: NodeJS.Timeout | null = null
  private debounceMs: number
  private ignore: string[]
  private initialized = false
  private initPromise: Promise<void> | null = null

  // 健康检查相关
  private healthCheckTimer: NodeJS.Timeout | null = null
  private lastEventTime = 0
  private healthCheckPending = false
  private enableHealthCheck: boolean

  constructor(
    projectDir: string,
    options: {
      debounceMs?: number
      ignore?: string[]
      /** 是否启用健康检查（默认 true） */
      enableHealthCheck?: boolean
    } = {}
  ) {
    // 使用真实路径，确保与事件路径匹配（macOS 上 /var -> /private/var）
    this.projectDir = getRealPath(projectDir)
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS
    this.ignore = options.ignore ?? DEFAULT_IGNORE
    this.enableHealthCheck = options.enableHealthCheck ?? true
  }

  /**
   * 初始化 watcher
   * 懒加载，首次订阅时自动调用
   */
  async init(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.doInit()
    await this.initPromise
  }

  private async doInit(): Promise<void> {
    // 动态导入 @parcel/watcher
    const watcher = await import('@parcel/watcher')

    this.subscription = await watcher.subscribe(
      this.projectDir,
      (err, events) => {
        if (err) {
          console.error('[ProjectWatcher] Error:', err)
          return
        }
        this.handleEvents(events)
      },
      { ignore: this.ignore }
    )

    this.initialized = true
    this.lastEventTime = Date.now()

    // 启动健康检查
    if (this.enableHealthCheck) {
      this.startHealthCheck()
    }
  }

  /**
   * 处理原始事件
   */
  private handleEvents(events: Event[]): void {
    // 更新最后事件时间（用于健康检查）
    this.lastEventTime = Date.now()
    // 收到事件说明 watcher 正常工作
    this.healthCheckPending = false

    // 转换事件格式
    const watchEvents: WatchEvent[] = events.map((e) => ({
      type: e.type,
      path: e.path,
    }))

    // 添加到待处理队列
    this.pendingEvents.push(...watchEvents)

    // 防抖处理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.flushEvents()
    }, this.debounceMs)
  }

  /**
   * 分发事件给订阅者
   */
  private flushEvents(): void {
    const events = this.pendingEvents
    this.pendingEvents = []
    this.debounceTimer = null

    if (events.length === 0) return

    // 按订阅者分发事件
    for (const sub of this.pathSubscriptions.values()) {
      const matchedEvents = events.filter((e) => this.matchPath(e, sub))
      if (matchedEvents.length > 0) {
        try {
          sub.callback(matchedEvents)
        } catch (err) {
          console.error(`[ProjectWatcher] Callback error for ${sub.path}:`, err)
        }
      }
    }
  }

  /**
   * 检查事件是否匹配订阅
   */
  private matchPath(event: WatchEvent, sub: PathSubscription): boolean {
    const eventPath = event.path

    if (sub.watchChildren) {
      // 监听目录内容：事件路径是订阅目录的子路径
      // 例如：订阅 /foo，事件 /foo/bar/baz.txt 匹配
      return eventPath.startsWith(sub.path + '/') || eventPath === sub.path
    } else {
      // 监听路径本身或其直接子项
      // 例如：订阅 /foo/bar.txt，事件 /foo/bar.txt 匹配
      // 例如：订阅 /foo，事件 /foo/bar.txt（直接子项）匹配
      const eventDir = dirname(eventPath)
      return eventPath === sub.path || eventDir === sub.path
    }
  }

  /**
   * 同步订阅路径变更（watcher 必须已初始化）
   *
   * 这是同步版本，用于在 watcher 已初始化后快速注册订阅。
   * 如果 watcher 未初始化，抛出错误。
   *
   * @param path 要监听的路径
   * @param callback 变更回调
   * @param options 订阅选项
   * @returns 取消订阅函数
   */
  subscribeSync(
    path: string,
    callback: PathCallback,
    options: { watchChildren?: boolean } = {}
  ): () => void {
    if (!this.initialized) {
      throw new Error('ProjectWatcher not initialized. Call init() first.')
    }

    // 使用真实路径，确保与事件路径匹配
    const normalizedPath = getRealPath(path)
    const id = Symbol()

    this.pathSubscriptions.set(id, {
      path: normalizedPath,
      watchChildren: options.watchChildren ?? false,
      callback,
    })

    return () => {
      this.pathSubscriptions.delete(id)
    }
  }

  /**
   * 订阅路径变更（异步版本，自动初始化）
   *
   * @param path 要监听的路径
   * @param callback 变更回调
   * @param options 订阅选项
   * @returns 取消订阅函数
   */
  async subscribe(
    path: string,
    callback: PathCallback,
    options: { watchChildren?: boolean } = {}
  ): Promise<() => void> {
    // 确保 watcher 已初始化
    await this.init()
    return this.subscribeSync(path, callback, options)
  }

  /**
   * 获取当前订阅数量（用于调试）
   */
  get subscriptionCount(): number {
    return this.pathSubscriptions.size
  }

  /**
   * 检查是否已初始化
   */
  get isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 启动健康检查定时器
   */
  private startHealthCheck(): void {
    this.stopHealthCheck()

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck()
    }, HEALTH_CHECK_INTERVAL_MS)

    // 允许进程退出
    this.healthCheckTimer.unref()
  }

  /**
   * 停止健康检查定时器
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
    this.healthCheckPending = false
  }

  /**
   * 执行健康检查
   *
   * 工作流程：
   * 1. 如果最近有事件，无需检查
   * 2. 如果上次探测还在等待中，说明 watcher 可能失效，尝试重建
   * 3. 否则，创建临时文件触发事件，等待下次检查验证
   */
  private async performHealthCheck(): Promise<void> {
    const now = Date.now()
    const timeSinceLastEvent = now - this.lastEventTime

    // 如果最近有事件，无需检查
    if (timeSinceLastEvent < HEALTH_CHECK_INTERVAL_MS) {
      this.healthCheckPending = false
      return
    }

    // 如果上次探测还在等待中，说明 watcher 失效了
    if (this.healthCheckPending) {
      console.warn('[ProjectWatcher] Health check failed, watcher appears stale. Reinitializing...')
      await this.reinitialize()
      return
    }

    // 发送探测：创建临时目录然后删除
    this.healthCheckPending = true
    this.sendProbe()
  }

  /**
   * 发送探测：通过 utimesSync 修改项目目录的时间戳来触发 watcher 事件
   */
  private sendProbe(): void {
    try {
      const now = new Date()
      utimesSync(this.projectDir, now, now)
    } catch {
      // utimesSync 失败说明目录不存在，下次检查会触发重建
    }
  }

  /**
   * 重新初始化 watcher
   */
  private async reinitialize(): Promise<void> {
    this.stopHealthCheck()

    // 关闭旧的 subscription
    if (this.subscription) {
      try {
        await this.subscription.unsubscribe()
      } catch {
        // 忽略关闭错误
      }
      this.subscription = null
    }

    // 重置状态
    this.initialized = false
    this.initPromise = null
    this.healthCheckPending = false

    // 检查项目目录是否存在
    if (!existsSync(this.projectDir)) {
      console.warn('[ProjectWatcher] Project directory does not exist, waiting for it to be created...')
      // 启动轮询等待目录创建
      this.waitForProjectDir()
      return
    }

    // 重新初始化
    try {
      await this.init()
      console.log('[ProjectWatcher] Reinitialized successfully')
    } catch (err) {
      console.error('[ProjectWatcher] Failed to reinitialize:', err)
      // 稍后重试
      setTimeout(() => this.reinitialize(), HEALTH_CHECK_INTERVAL_MS)
    }
  }

  /**
   * 等待项目目录被创建
   */
  private waitForProjectDir(): void {
    const checkInterval = setInterval(() => {
      if (existsSync(this.projectDir)) {
        clearInterval(checkInterval)
        console.log('[ProjectWatcher] Project directory created, reinitializing...')
        this.reinitialize()
      }
    }, HEALTH_CHECK_INTERVAL_MS)

    // 允许进程退出
    checkInterval.unref()
  }

  /**
   * 关闭 watcher
   */
  async close(): Promise<void> {
    this.stopHealthCheck()

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.subscription) {
      await this.subscription.unsubscribe()
      this.subscription = null
    }

    this.pathSubscriptions.clear()
    this.pendingEvents = []
    this.initialized = false
    this.initPromise = null
  }
}

/**
 * 全局 ProjectWatcher 实例缓存
 * key: 项目目录路径
 */
const watcherCache = new Map<string, ProjectWatcher>()

/**
 * 获取或创建项目监听器
 */
export function getProjectWatcher(
  projectDir: string,
  options?: ConstructorParameters<typeof ProjectWatcher>[1]
): ProjectWatcher {
  const normalizedDir = getRealPath(projectDir)

  let watcher = watcherCache.get(normalizedDir)
  if (!watcher) {
    watcher = new ProjectWatcher(normalizedDir, options)
    watcherCache.set(normalizedDir, watcher)
  }

  return watcher
}

/**
 * 关闭所有 ProjectWatcher（用于测试清理）
 */
export async function closeAllProjectWatchers(): Promise<void> {
  const closePromises = Array.from(watcherCache.values()).map((w) => w.close())
  await Promise.all(closePromises)
  watcherCache.clear()
}
