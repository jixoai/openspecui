/**
 * @module reactive-fs
 *
 * 响应式文件系统模块
 *
 * 基于 Signal/Effect 模式，通过 AsyncLocalStorage 实现依赖收集，
 * 让文件读取操作自动响应文件变更。
 *
 * 核心概念：
 * - ReactiveState: 响应式状态，类似 Signal.State
 * - ReactiveContext: 响应式上下文，管理依赖收集和变更通知
 * - reactiveReadFile/reactiveReadDir: 响应式文件操作
 *
 * 使用方式：
 * 1. 在应用启动时调用 initWatcherPool(projectDir) 初始化监听
 * 2. 使用 ReactiveContext.stream() 包装任务
 * 3. 任务中的 reactiveReadFile/reactiveReadDir 调用会自动追踪依赖
 *
 * @example
 * ```typescript
 * import { initWatcherPool, ReactiveContext, reactiveReadFile } from './reactive-fs'
 *
 * // 启动时初始化
 * await initWatcherPool('/path/to/project')
 *
 * // 创建响应式流
 * const context = new ReactiveContext()
 * for await (const data of context.stream(async () => {
 *   const content = await reactiveReadFile('/path/to/file.txt')
 *   return JSON.parse(content ?? '{}')
 * })) {
 *   console.log('Data updated:', data)
 * }
 * ```
 */

// 核心类
export { ReactiveContext } from './reactive-context.js'
export { ReactiveState, contextStorage, type ReactiveStateOptions } from './reactive-state.js'

// 响应式文件操作
export {
  clearCache,
  getCacheSize,
  reactiveExists,
  reactiveReadDir,
  reactiveReadFile,
  reactiveStat,
  updateReactiveFileCache,
} from './reactive-fs.js'

// 监听器池管理（基于 @parcel/watcher）
export {
  acquireWatcher,
  closeAllWatchers,
  getActiveWatcherCount,
  getWatchedProjectDir,
  initWatcherPool,
  isWatcherPoolInitialized,
} from './watcher-pool.js'

// 底层项目监听器（高级用法）
export {
  ProjectWatcher,
  closeAllProjectWatchers,
  getProjectWatcher,
  type PathCallback,
  type WatchEvent,
  type WatchEventType,
} from './project-watcher.js'
