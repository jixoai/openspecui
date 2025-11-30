import { resolve } from 'node:path'
import { realpathSync } from 'node:fs'
import { getProjectWatcher, type ProjectWatcher } from './project-watcher.js'

/**
 * 获取路径的真实路径（解析符号链接）
 */
function getRealPath(path: string): string {
  try {
    return realpathSync(resolve(path))
  } catch {
    return resolve(path)
  }
}

/**
 * 全局 ProjectWatcher 实例
 * 通过 initWatcherPool 初始化
 */
let globalProjectWatcher: ProjectWatcher | null = null
let globalProjectDir: string | null = null

/** 默认防抖时间 (ms) */
const DEBOUNCE_MS = 100

/** 路径订阅条目 */
interface PathSubscription {
  path: string
  callbacks: Set<() => void>
  unsubscribe: () => void
  onError?: () => void
}

/** 路径订阅缓存 */
const subscriptionCache = new Map<string, PathSubscription>()

/** 防抖定时器 */
const debounceTimers = new Map<string, NodeJS.Timeout>()

/**
 * 初始化 watcher pool
 *
 * 必须在使用 acquireWatcher 之前调用。
 * 通常由 server 在启动时调用。
 *
 * @param projectDir 项目根目录
 */
export async function initWatcherPool(projectDir: string): Promise<void> {
  const normalizedDir = getRealPath(projectDir)

  if (globalProjectWatcher && globalProjectDir === normalizedDir) {
    // 已初始化为同一目录
    return
  }

  // 关闭旧的 watcher
  if (globalProjectWatcher) {
    await globalProjectWatcher.close()
  }

  globalProjectDir = normalizedDir
  globalProjectWatcher = getProjectWatcher(normalizedDir)
  await globalProjectWatcher.init()
}

/**
 * 获取或创建文件/目录监听器
 *
 * 特性：
 * - 使用 @parcel/watcher 监听项目根目录
 * - 自动处理新创建的目录（解决 init 后无法监听的问题）
 * - 同一路径共享订阅
 * - 引用计数管理生命周期
 * - 内置防抖机制
 *
 * @param path 要监听的路径
 * @param onChange 变更回调
 * @param options 监听选项
 * @returns 释放函数，调用后取消订阅
 */
export function acquireWatcher(
  path: string,
  onChange: () => void,
  options: { recursive?: boolean; debounceMs?: number; onError?: () => void } = {}
): () => void {
  if (!globalProjectWatcher || !globalProjectWatcher.isInitialized) {
    console.warn('[watcher-pool] ProjectWatcher not initialized. Call initWatcherPool first.')
    // 返回空操作，避免崩溃
    return () => {}
  }

  const normalizedPath = getRealPath(path)
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS
  const isRecursive = options.recursive ?? false

  // 生成缓存 key（包含 recursive 选项）
  const cacheKey = `${normalizedPath}:${isRecursive}`

  let subscription = subscriptionCache.get(cacheKey)

  if (!subscription) {
    // 创建新的订阅（同步，因为 watcher 已初始化）
    const unsubscribe = globalProjectWatcher.subscribeSync(
      normalizedPath,
      () => {
        // 防抖处理
        const existingTimer = debounceTimers.get(cacheKey)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        const timer = setTimeout(() => {
          debounceTimers.delete(cacheKey)
          const currentSub = subscriptionCache.get(cacheKey)
          if (currentSub) {
            for (const cb of currentSub.callbacks) {
              try {
                cb()
              } catch (err) {
                console.error(`[watcher-pool] Callback error for ${normalizedPath}:`, err)
              }
            }
          }
        }, debounceMs)

        debounceTimers.set(cacheKey, timer)
      },
      { watchChildren: isRecursive }
    )

    subscription = {
      path: normalizedPath,
      callbacks: new Set(),
      unsubscribe,
      onError: options.onError,
    }
    subscriptionCache.set(cacheKey, subscription)
  }

  // 添加回调
  subscription.callbacks.add(onChange)

  // 返回释放函数
  return () => {
    const currentSub = subscriptionCache.get(cacheKey)
    if (!currentSub) return

    currentSub.callbacks.delete(onChange)

    // 所有回调都已移除，清理订阅
    if (currentSub.callbacks.size === 0) {
      currentSub.unsubscribe()
      subscriptionCache.delete(cacheKey)

      // 清理防抖定时器
      const timer = debounceTimers.get(cacheKey)
      if (timer) {
        clearTimeout(timer)
        debounceTimers.delete(cacheKey)
      }
    }
  }
}

/**
 * 获取当前活跃的监听器数量（用于调试）
 */
export function getActiveWatcherCount(): number {
  return subscriptionCache.size
}

/**
 * 关闭所有监听器（用于测试清理）
 */
export async function closeAllWatchers(): Promise<void> {
  // 清理所有订阅
  for (const [key, sub] of subscriptionCache) {
    sub.unsubscribe()
    const timer = debounceTimers.get(key)
    if (timer) {
      clearTimeout(timer)
    }
  }
  subscriptionCache.clear()
  debounceTimers.clear()

  // 关闭 ProjectWatcher
  if (globalProjectWatcher) {
    await globalProjectWatcher.close()
    globalProjectWatcher = null
    globalProjectDir = null
  }
}

/**
 * 检查 watcher pool 是否已初始化
 */
export function isWatcherPoolInitialized(): boolean {
  return globalProjectWatcher !== null && globalProjectWatcher.isInitialized
}

/**
 * 获取当前监听的项目目录
 */
export function getWatchedProjectDir(): string | null {
  return globalProjectDir
}
