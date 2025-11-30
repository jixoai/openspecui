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
 * 使用示例：
 * ```typescript
 * import { ReactiveContext, reactiveReadFile } from './reactive-fs'
 *
 * const context = new ReactiveContext()
 *
 * for await (const data of context.stream(async () => {
 *   const content = await reactiveReadFile('/path/to/file.txt')
 *   return JSON.parse(content ?? '{}')
 * })) {
 *   console.log('Data updated:', data)
 * }
 * ```
 */

// 核心类
export { ReactiveState, contextStorage, type ReactiveStateOptions } from './reactive-state.js'
export { ReactiveContext } from './reactive-context.js'

// 响应式文件操作
export {
  reactiveReadFile,
  reactiveReadDir,
  reactiveExists,
  reactiveStat,
  clearCache,
  getCacheSize,
} from './reactive-fs.js'

// 监听器池管理
export { acquireWatcher, getActiveWatcherCount, closeAllWatchers } from './watcher-pool.js'
