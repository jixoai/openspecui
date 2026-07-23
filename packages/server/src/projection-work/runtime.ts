/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Create a Projection Work registry per Server runtime, never as module-global state.
 * 2. Declare conservative bounded resource, trace, and snapshot-cache budgets.
 * 3. Keep future warmup opt-in until benchmark evidence supports a larger budget.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { ProjectionWorkPhaseTrace } from './phase-trace.js'
import { ProjectionWorkRegistry } from './registry.js'
import { ProjectionWorkScheduler, type ProjectionWorkResourceLimits } from './scheduler.js'

/**
 * P1 starts with one slot for every resource class. The controlled baseline has no evidence that broader CLI,
 * Git, filesystem, or CPU fan-out reduces tail latency, so increasing these limits requires a benchmark update.
 */
export const serverProjectionWorkResourceLimits: ProjectionWorkResourceLimits = {
  cli: 1,
  filesystem: 1,
  git: 1,
  cpu: 1,
}

/** Process-local bounds for snapshots and phase-only benchmark evidence. */
export const serverProjectionWorkCacheBudget = {
  maxEntries: 32,
  maxBytes: 2 * 1024 * 1024,
  maxWorkEntries: 64,
  traceCapacity: 256,
  maxRegistryCount: 8,
} as const

interface ClearableProjectionWorkRegistry {
  clear(): void
}

export class ProjectionWorkRuntimeCapacityError extends Error {
  constructor() {
    super('Projection Work runtime registry capacity is exhausted.')
    this.name = 'ProjectionWorkRuntimeCapacityError'
  }
}

/**
 * Server-local Projection Work owner. Each projection owner receives a strongly typed registry while all of
 * them share one bounded scheduler and phase trace. A pool avoids `unknown` payload reuse across routes.
 */
export class ProjectionWorkRuntime {
  readonly scheduler = new ProjectionWorkScheduler({ limits: serverProjectionWorkResourceLimits })
  readonly phaseTrace = new ProjectionWorkPhaseTrace({
    capacity: serverProjectionWorkCacheBudget.traceCapacity,
  })
  private readonly registries = new Set<ClearableProjectionWorkRegistry>()

  createRegistry<T, TBatch = never>(): ProjectionWorkRegistry<T, TBatch> {
    if (this.registries.size >= serverProjectionWorkCacheBudget.maxRegistryCount) {
      throw new ProjectionWorkRuntimeCapacityError()
    }
    const registry = new ProjectionWorkRegistry<T, TBatch>({
      scheduler: this.scheduler,
      phaseTrace: this.phaseTrace,
      cache: {
        maxEntries: serverProjectionWorkCacheBudget.maxEntries,
        maxBytes: serverProjectionWorkCacheBudget.maxBytes,
      },
      maxWorkEntries: serverProjectionWorkCacheBudget.maxWorkEntries,
    })
    this.registries.add(registry)
    return registry
  }

  clear(): void {
    for (const registry of this.registries) registry.clear()
    this.registries.clear()
    this.phaseTrace.clear()
  }
}

/** Create a Server-local runtime; callers inject typed registries into exact projection owners. */
export function createServerProjectionWorkRuntime(): ProjectionWorkRuntime {
  return new ProjectionWorkRuntime()
}
