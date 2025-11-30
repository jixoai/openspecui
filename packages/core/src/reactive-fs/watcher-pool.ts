import { watch, type FSWatcher } from 'node:fs'
import { resolve } from 'node:path'

/** 监听器池条目 */
interface WatcherEntry {
  watcher: FSWatcher
  refCount: number
  callbacks: Set<() => void>
}

/** 全局监听器池，共享同一路径的监听器 */
const watcherPool = new Map<string, WatcherEntry>()

/** 防抖定时器 */
const debounceTimers = new Map<string, NodeJS.Timeout>()

/** 默认防抖时间 (ms) */
const DEBOUNCE_MS = 100

/**
 * 获取或创建文件/目录监听器
 *
 * 特性：
 * - 同一路径共享监听器
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
  options: { recursive?: boolean; debounceMs?: number } = {}
): () => void {
  const normalizedPath = resolve(path)
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS

  let entry = watcherPool.get(normalizedPath)

  if (!entry) {
    // 创建新的监听器
    const watcher = watch(
      normalizedPath,
      { recursive: options.recursive ?? false, persistent: false },
      () => {
        // 防抖处理
        const existingTimer = debounceTimers.get(normalizedPath)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        const timer = setTimeout(() => {
          debounceTimers.delete(normalizedPath)
          const currentEntry = watcherPool.get(normalizedPath)
          if (currentEntry) {
            for (const cb of currentEntry.callbacks) {
              try {
                cb()
              } catch (err) {
                console.error(`Watcher callback error for ${normalizedPath}:`, err)
              }
            }
          }
        }, debounceMs)

        debounceTimers.set(normalizedPath, timer)
      }
    )

    watcher.on('error', (err) => {
      console.error(`Watcher error for ${normalizedPath}:`, err)
    })

    entry = {
      watcher,
      refCount: 0,
      callbacks: new Set(),
    }
    watcherPool.set(normalizedPath, entry)
  }

  // 增加引用计数
  entry.refCount++
  entry.callbacks.add(onChange)

  // 返回释放函数
  return () => {
    const currentEntry = watcherPool.get(normalizedPath)
    if (!currentEntry) return

    currentEntry.callbacks.delete(onChange)
    currentEntry.refCount--

    // 引用计数归零时关闭监听器
    if (currentEntry.refCount === 0) {
      currentEntry.watcher.close()
      watcherPool.delete(normalizedPath)

      // 清理防抖定时器
      const timer = debounceTimers.get(normalizedPath)
      if (timer) {
        clearTimeout(timer)
        debounceTimers.delete(normalizedPath)
      }
    }
  }
}

/**
 * 获取当前活跃的监听器数量（用于调试）
 */
export function getActiveWatcherCount(): number {
  return watcherPool.size
}

/**
 * 关闭所有监听器（用于测试清理）
 */
export function closeAllWatchers(): void {
  for (const [path, entry] of watcherPool) {
    entry.watcher.close()
    const timer = debounceTimers.get(path)
    if (timer) {
      clearTimeout(timer)
    }
  }
  watcherPool.clear()
  debounceTimers.clear()
}
