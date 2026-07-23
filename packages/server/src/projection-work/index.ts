/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Expose the Server-owned live Projection Work primitives.
 * 2. Keep protocol, trace, scheduler, and registry physically discoverable.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
export { ProjectionWorkPhaseTrace } from './phase-trace.js'
export type {
  ProjectionWorkClock,
  ProjectionWorkPhaseTraceEntry,
  ProjectionWorkPhaseTraceOptions,
} from './phase-trace.js'
export { ProjectionWorkCapacityError, ProjectionWorkRegistry } from './registry.js'
export type {
  ProjectionWorkLoaderContext,
  ProjectionWorkRegistryOptions,
  ProjectionWorkRegistryStats,
  ProjectionWorkRequest,
  ProjectionWorkSubscription,
} from './registry.js'
export {
  ProjectionWorkRuntime,
  ProjectionWorkRuntimeCapacityError,
  createServerProjectionWorkRuntime,
  serverProjectionWorkCacheBudget,
  serverProjectionWorkResourceLimits,
} from './runtime.js'
export { ProjectionWorkScheduler } from './scheduler.js'
export type {
  ProjectionWorkResourceLimits,
  ProjectionWorkScheduleRequest,
  ProjectionWorkSchedulerOptions,
} from './scheduler.js'
export { createProjectionWorkSubscription } from './subscription.js'
export {
  projectionWorkIdentityKey,
  projectionWorkPhases,
  projectionWorkResourceClasses,
} from './types.js'
export type {
  ProjectionWorkEvent,
  ProjectionWorkIdentity,
  ProjectionWorkLoaderPhase,
  ProjectionWorkPriority,
  ProjectionWorkProgress,
  ProjectionWorkResourceClass,
  ProjectionWorkSnapshot,
} from './types.js'
