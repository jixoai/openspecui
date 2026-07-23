/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Bridge one Server-owned Projection Work to a typed tRPC observable.
 * 2. Keep existing generic reactive-subscription helpers on their established contract.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { observable } from '@trpc/server/observable'
import { ProjectionWorkRegistry, type ProjectionWorkRequest } from './registry.js'
import type { ProjectionWorkEvent } from './types.js'

/**
 * Subscribe to one provenance-bound work registry entry. The registry, rather than tRPC's subscriber, owns
 * dependency tracking, snapshot replay, cancellation, and late-generation retirement.
 */
export function createProjectionWorkSubscription<T, TBatch = never>(
  registry: ProjectionWorkRegistry<T, TBatch>,
  request: ProjectionWorkRequest<T, TBatch>
) {
  return observable<ProjectionWorkEvent<T, TBatch>>((emit) => {
    try {
      const subscription = registry.subscribe(request, (event) => emit.next(event))
      return () => subscription.unsubscribe()
    } catch (error: unknown) {
      emit.error(error instanceof Error ? error : new Error(String(error)))
      return () => {}
    }
  })
}
