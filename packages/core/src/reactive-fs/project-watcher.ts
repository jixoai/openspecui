import type { AsyncSubscription, Event } from '@parcel/watcher'
import { dirname, resolve } from 'node:path'
import { existsSync, lstatSync, realpathSync } from 'node:fs'

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

/** 恢复重试间隔 (ms) */
const RECOVERY_INTERVAL_MS = 3000

/** 路径语义检查间隔 (ms) */
const PATH_LIVENESS_INTERVAL_MS = 3000

/** watcher 重建原因 */
export type ProjectWatcherReinitializeReason =
  | 'drop-events'
  | 'watcher-error'
  | 'missing-project-dir'
  | 'project-dir-replaced'
  | 'manual'

/** watcher 运行时状态（用于调试和运维观测） */
export interface ProjectWatcherRuntimeStatus {
  generation: number
  reinitializeCount: number
  lastReinitializeReason: ProjectWatcherReinitializeReason | null
  reinitializeReasonCounts: Readonly<Record<ProjectWatcherReinitializeReason, number>>
}

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

  // 错误恢复相关
  private reinitializeTimer: NodeJS.Timeout | null = null
  private reinitializePending = false
  private reinitializeReasonPending: ProjectWatcherReinitializeReason | null = null
  private pathLivenessTimer: NodeJS.Timeout | null = null
  private projectDirFingerprint: string | null = null

  // 运行时状态
  private generation = 0
  private reinitializeCount = 0
  private lastReinitializeReason: ProjectWatcherReinitializeReason | null = null
  private reinitializeReasonCounts: Record<ProjectWatcherReinitializeReason, number> = {
    'drop-events': 0,
    'watcher-error': 0,
    'missing-project-dir': 0,
    'project-dir-replaced': 0,
    manual: 0,
  }

  constructor(
    projectDir: string,
    options: {
      debounceMs?: number
      ignore?: string[]
    } = {}
  ) {
    // 使用真实路径，确保与事件路径匹配（macOS 上 /var -> /private/var）
    this.projectDir = getRealPath(projectDir)
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS
    this.ignore = options.ignore ?? DEFAULT_IGNORE
  }

  /**
   * 初始化 watcher
   * 懒加载，首次订阅时自动调用
   */
  async init(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.doInit().catch((error) => {
      this.initPromise = null
      throw error
    })
    return this.initPromise
  }

  private async doInit(): Promise<void> {
    // 动态导入 @parcel/watcher
    const watcher = await import('@parcel/watcher')

    this.subscription = await watcher.subscribe(
      this.projectDir,
      (err, events) => {
        if (err) {
          this.handleWatcherError(err)
          return
        }
        this.handleEvents(events)
      },
      { ignore: this.ignore }
    )

    this.initialized = true
    this.generation += 1
    this.projectDirFingerprint = this.getProjectDirFingerprint()
    this.startPathLivenessMonitor()
  }

  /**
   * 处理 watcher 错误
   * 统一走错误驱动重建流程
   */
  private handleWatcherError(err: Error): void {
    const errorMsg = err.message || String(err)

    // 检测 FSEvents dropped 错误
    if (errorMsg.includes('Events were dropped')) {
      if (!this.reinitializePending) {
        console.warn('[ProjectWatcher] FSEvents dropped events, scheduling reinitialize...')
        this.scheduleReinitialize('drop-events')
      }
      return
    }

    console.error('[ProjectWatcher] Watcher error, scheduling reinitialize:', err)
    this.scheduleReinitialize('watcher-error')
  }

  /**
   * 延迟重建 watcher（防抖，避免频繁重建）
   */
  private scheduleReinitialize(reason: ProjectWatcherReinitializeReason): void {
    this.reinitializeReasonPending = reason
    if (this.reinitializePending) return

    this.reinitializePending = true

    if (this.reinitializeTimer) {
      clearTimeout(this.reinitializeTimer)
    }

    this.reinitializeTimer = setTimeout(() => {
      this.reinitializeTimer = null
      this.reinitializePending = false
      const pendingReason = this.reinitializeReasonPending ?? reason
      this.reinitializeReasonPending = null
      console.log(`[ProjectWatcher] Reinitializing (reason: ${pendingReason})...`)
      void this.reinitialize(pendingReason)
    }, RECOVERY_INTERVAL_MS)
    this.reinitializeTimer.unref()
  }

  /**
   * 读取项目目录指纹（目录不存在时返回 null）
   * 用于检测 path 对应实体是否被替换（inode/dev 漂移）
   */
  private getProjectDirFingerprint(): string | null {
    try {
      const stat = lstatSync(this.projectDir)
      return `${stat.dev}:${stat.ino}`
    } catch {
      return null
    }
  }

  /**
   * 启动路径语义监测（避免 watcher 绑定到已失效句柄）
   */
  private startPathLivenessMonitor(): void {
    this.stopPathLivenessMonitor()
    this.pathLivenessTimer = setInterval(() => {
      this.checkPathLiveness()
    }, PATH_LIVENESS_INTERVAL_MS)
    this.pathLivenessTimer.unref()
  }

  /**
   * 停止路径语义监测
   */
  private stopPathLivenessMonitor(): void {
    if (this.pathLivenessTimer) {
      clearInterval(this.pathLivenessTimer)
      this.pathLivenessTimer = null
    }
  }

  /**
   * 只读检查 projectDir 是否仍指向初始化时的目录实体
   */
  private checkPathLiveness(): void {
    if (!this.initialized || this.reinitializePending) {
      return
    }

    const current = this.getProjectDirFingerprint()

    if (current === null) {
      console.warn('[ProjectWatcher] Project directory missing, scheduling reinitialize...')
      this.scheduleReinitialize('missing-project-dir')
      return
    }

    if (this.projectDirFingerprint === null) {
      this.projectDirFingerprint = current
      return
    }

    if (current !== this.projectDirFingerprint) {
      console.warn('[ProjectWatcher] Project directory replaced, scheduling reinitialize...')
      this.scheduleReinitialize('project-dir-replaced')
    }
  }

  /**
   * 处理原始事件
   */
  private handleEvents(events: Event[]): void {
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
   * 获取 watcher 运行时状态
   */
  get runtimeStatus(): ProjectWatcherRuntimeStatus {
    return {
      generation: this.generation,
      reinitializeCount: this.reinitializeCount,
      lastReinitializeReason: this.lastReinitializeReason,
      reinitializeReasonCounts: { ...this.reinitializeReasonCounts },
    }
  }

  /**
   * 记录重建统计
   */
  private markReinitialized(reason: ProjectWatcherReinitializeReason): void {
    this.reinitializeCount += 1
    this.lastReinitializeReason = reason
    this.reinitializeReasonCounts[reason] += 1
  }

  /**
   * 重新初始化 watcher
   */
  private async reinitialize(reason: ProjectWatcherReinitializeReason): Promise<void> {
    this.stopPathLivenessMonitor()

    if (this.subscription) {
      try {
        await this.subscription.unsubscribe()
      } catch {
        // ignore unsubscribe errors
      }
      this.subscription = null
    }

    this.initialized = false
    this.initPromise = null
    this.projectDirFingerprint = null

    if (!existsSync(this.projectDir)) {
      console.warn('[ProjectWatcher] Project directory does not exist, waiting for it to be created...')
      this.waitForProjectDir('missing-project-dir')
      return
    }

    try {
      await this.init()
      this.markReinitialized(reason)
      console.log('[ProjectWatcher] Reinitialized successfully')
    } catch (err) {
      console.error('[ProjectWatcher] Failed to reinitialize:', err)
      this.scheduleReinitialize(reason)
    }
  }

  /**
   * 等待项目目录被创建
   */
  private waitForProjectDir(reason: ProjectWatcherReinitializeReason): void {
    this.reinitializeReasonPending = reason
    this.reinitializePending = true

    if (this.reinitializeTimer) {
      clearTimeout(this.reinitializeTimer)
      this.reinitializeTimer = null
    }

    this.reinitializeTimer = setTimeout(() => {
      this.reinitializeTimer = null
      this.reinitializePending = false

      if (!existsSync(this.projectDir)) {
        this.waitForProjectDir(reason)
        return
      }

      const pendingReason = this.reinitializeReasonPending ?? reason
      this.reinitializeReasonPending = null
      console.log('[ProjectWatcher] Project directory created, reinitializing...')
      void this.reinitialize(pendingReason)
    }, RECOVERY_INTERVAL_MS)
    this.reinitializeTimer.unref()
  }

  /**
   * 关闭 watcher
   */
  async close(): Promise<void> {
    this.stopPathLivenessMonitor()

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.reinitializeTimer) {
      clearTimeout(this.reinitializeTimer)
      this.reinitializeTimer = null
    }
    this.reinitializePending = false
    this.reinitializeReasonPending = null

    if (this.subscription) {
      await this.subscription.unsubscribe()
      this.subscription = null
    }

    this.pathSubscriptions.clear()
    this.pendingEvents = []
    this.initialized = false
    this.initPromise = null
    this.projectDirFingerprint = null
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
