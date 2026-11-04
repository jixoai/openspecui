/**
 * Orthogonal intents (updated 2026-11-04 Asia/Shanghai):
 * 1. Expose reactive file, directory, existence, and stat projections.
 * 2. Expose dynamic reference-counted observation-root ownership.
 * 3. Expose immediate settlement for application-owned filesystem mutations.
 * 4. Expose optional dependency-recompute lifecycle observation.
 * 5. Expose the process-level settlement coordinator so arm/attach/consumer call sites can request
 *    a pass, plus the normalization helper their raw roots must cross first.
 * 6. Expose the awaited one-shot input settler that keeps every registration alive.
 *
 * Original request (2026-07-15): "操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 *   — fix-reactive-fs-settlement S4: `settlePaths` for one-shot freshness without orphaning.
 */
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
 * 1. 为当前运行环境创建 ReactiveObservationEnvironment 并获取所需根
 * 2. 使用 ReactiveContext.stream() 包装任务
 * 3. 任务中的 reactiveReadFile/reactiveReadDir 调用会自动追踪依赖
 *
 * @example
 * ```typescript
 * import { ReactiveObservationEnvironment, ReactiveContext, reactiveReadFile } from './reactive-fs'
 *
 * const environment = new ReactiveObservationEnvironment()
 * await environment.acquireRoot('/path/to/project')
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
export {
  ReactiveObservationEnvironment,
  type ObservationEnvironmentRoot,
  type ObservationRootOwner,
} from './observation-environment.js'
export { ReactiveContext, type ReactiveContextStreamObserver } from './reactive-context.js'
export { ReactiveState, contextStorage, type ReactiveStateOptions } from './reactive-state.js'

// 响应式文件操作
export {
  clearCache,
  getCacheSize,
  reactiveExists,
  reactiveReadDir,
  reactiveReadFile,
  reactiveStat,
  settlePaths,
  settleReactiveFileWrite,
  settleReactivePathMutation,
  updateReactiveFileCache,
} from './reactive-fs.js'

// 监听器池管理（基于 @parcel/watcher）
export {
  acquireWatcher,
  acquireWatcherRoot,
  closeAllWatchers,
  getActiveWatcherCount,
  getWatcherRuntimeStatus,
  isWatcherPoolInitialized,
  subscribeWatcherRuntimeStatus,
  type WatcherRootRelease,
  type WatcherRootRuntimeStatus,
  type WatcherRuntimeStatus,
} from './watcher-pool.js'

// 结算协调器（进程级单例；触发点与后续池化调度共用）
export {
  getSettlementDiagnostics,
  isSettlementInFlight,
  registerSettlementTimerCountProvider,
  requestSettlement,
  setSettlementPassHookForTests,
  type SettlementDiagnostics,
  type SettlementPassHook,
  type SettlementPassHookEvent,
} from './settlement-coordinator.js'

// 路径规范化：结算网两侧必须先进入同一 realpath 空间
export { resolveRealPathThroughExistingAncestor } from './path-realpath.js'

// 底层项目监听器（高级用法）
export {
  ProjectWatcher,
  closeAllProjectWatchers,
  getProjectWatcher,
  type PathCallback,
  type ProjectResidencyEvictionReason,
  type ProjectResidencyStatus,
  type ProjectWatcherReinitializeReason,
  type ProjectWatcherReinitializedListener,
  type ProjectWatcherRuntimeStatus,
  type ProjectWatcherRuntimeStatusListener,
  type WatchEvent,
  type WatchEventType,
} from './project-watcher.js'
