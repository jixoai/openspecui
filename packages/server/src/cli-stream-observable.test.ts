/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Prove client detachment requests cancellation for streams whose handle arrives later.
 * 2. Prove delayed cancellation settles and invalidates before its outcome is observed.
 * 3. Prove rejected settlement converges to one terminal error without an exit event.
 *
 * Original request (2026-07-15): "Every terminal or indeterminate outcome invalidates affected projections before they are pulled again."
 * Original request (2026-07-17): "A rejected CLI settlement is one terminal transport fact."
 */
import {
  RuntimeInvalidationIndex,
  type CliStreamHandle,
  type CliStreamSettlement,
} from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { CliMutationInvalidator } from './cli-mutation-invalidator.js'
import { createCliStreamObservable } from './cli-stream-observable.js'

describe('createCliStreamObservable', () => {
  it('cancels a mutation stream whose client detached before startup completed', async () => {
    const invalidation = new RuntimeInvalidationIndex()
    const mutation = new CliMutationInvalidator(invalidation)
    const started = Promise.withResolvers<CliStreamHandle>()
    const terminal = Promise.withResolvers<CliStreamSettlement>()
    const cancelProcess = vi.fn(() => {
      terminal.resolve({ reason: 'cancelled', exitCode: null })
      return terminal.promise
    })
    const stream = createCliStreamObservable(async (onEvent) => {
      const process = await started.promise
      return mutation.stream(['project'], () => process, onEvent)
    })

    const subscription = stream.subscribe({})
    subscription.unsubscribe()
    started.resolve({ settled: terminal.promise, cancel: cancelProcess })
    await vi.waitFor(() => expect(cancelProcess).toHaveBeenCalledTimes(1))

    await vi.waitFor(() => expect(invalidation.current('project')).toBe(1))
  })

  it('emits exactly one terminal error when an attached handle rejects settlement', async () => {
    const terminal = Promise.withResolvers<CliStreamSettlement>()
    // The test owns this rejection until the observable subscribes to it.
    void terminal.promise.catch(() => {})
    const failure = new Error('forced termination did not confirm child close')
    const stream = createCliStreamObservable(() => ({
      settled: terminal.promise,
      cancel: () => terminal.promise,
    }))
    const errors: unknown[] = []
    const exits: CliStreamSettlement[] = []

    const subscription = stream.subscribe({
      next: (event) => {
        if (event.type === 'exit')
          exits.push({ reason: 'exited', exitCode: event.exitCode ?? null })
      },
      error: (error) => errors.push(error),
    })
    terminal.reject(failure)

    await vi.waitFor(() => expect(errors).toEqual([failure]))
    expect(exits).toEqual([])
    subscription.unsubscribe()
  })

  it('keeps a detached subscriber silent when its handle later rejects settlement', async () => {
    const terminal = Promise.withResolvers<CliStreamSettlement>()
    void terminal.promise.catch(() => {})
    const cancel = vi.fn(() => terminal.promise)
    const stream = createCliStreamObservable(() => ({ settled: terminal.promise, cancel }))
    const errors: unknown[] = []

    const subscription = stream.subscribe({ error: (error) => errors.push(error) })
    subscription.unsubscribe()
    terminal.reject(new Error('forced termination did not confirm child close'))

    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(errors).toEqual([])
  })
})
