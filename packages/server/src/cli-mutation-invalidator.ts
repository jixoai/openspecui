/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Invalidate affected facets before buffered CLI mutation outcomes reach callers.
 * 2. Invalidate exactly once before streamed exit, cancellation, or startup failure is observed.
 * 3. Preserve the original CLI result, event stream, error, and cancellation behavior unchanged.
 *
 * Original request (2026-07-15): "操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
 */
import type {
  CliStreamEvent,
  RuntimeInvalidationController,
  RuntimeInvalidationFacet,
} from '@openspecui/core'

/** Settlement boundary shared by buffered and streaming CLI mutation execution. */
export class CliMutationInvalidator {
  constructor(private readonly invalidation: RuntimeInvalidationController) {}

  /** Run one buffered mutation and invalidate before its terminal or indeterminate outcome returns. */
  async run<T>(facets: readonly RuntimeInvalidationFacet[], execute: () => Promise<T>): Promise<T> {
    try {
      return await execute()
    } finally {
      this.invalidation.invalidate(facets)
    }
  }

  /** Start one mutation stream and invalidate once before exit, cancellation, or startup failure. */
  async stream(
    facets: readonly RuntimeInvalidationFacet[],
    start: (onEvent: (event: CliStreamEvent) => void) => Promise<() => void> | (() => void),
    onEvent: (event: CliStreamEvent) => void
  ): Promise<() => void> {
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      this.invalidation.invalidate(facets)
    }

    try {
      const cancel = await start((event) => {
        if (event.type === 'exit') settle()
        onEvent(event)
      })
      return () => {
        settle()
        cancel()
      }
    } catch (error) {
      settle()
      throw error
    }
  }
}
