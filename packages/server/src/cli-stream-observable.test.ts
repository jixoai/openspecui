/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove client detachment releases streams that finish asynchronous startup later.
 * 2. Prove mutation invalidation occurs before that delayed cancellation reaches the process.
 *
 * Original request (2026-07-15): "Every terminal or indeterminate outcome invalidates affected projections before they are pulled again."
 */
import { RuntimeInvalidationIndex } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { CliMutationInvalidator } from './cli-mutation-invalidator.js'
import { createCliStreamObservable } from './cli-stream-observable.js'

describe('createCliStreamObservable', () => {
  it('cancels a mutation stream whose client detached before startup completed', async () => {
    const invalidation = new RuntimeInvalidationIndex()
    const mutation = new CliMutationInvalidator(invalidation)
    const started = Promise.withResolvers<() => void>()
    const cancelProcess = vi.fn(() => {
      expect(invalidation.current('project')).toBe(1)
    })
    const stream = createCliStreamObservable((onEvent) =>
      mutation.stream(['project'], async () => started.promise, onEvent)
    )

    const subscription = stream.subscribe({})
    subscription.unsubscribe()
    started.resolve(cancelProcess)
    await vi.waitFor(() => expect(cancelProcess).toHaveBeenCalledTimes(1))

    expect(invalidation.current('project')).toBe(1)
  })
})
