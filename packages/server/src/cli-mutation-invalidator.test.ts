/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Verify buffered success, failure, and indeterminate errors invalidate before delivery.
 * 2. Verify streamed terminal/null settlements and cancellation invalidate once before observation.
 *
 * Original request (2026-07-15): "Every terminal or indeterminate outcome invalidates affected projections before they are pulled again."
 */
import {
  RuntimeInvalidationIndex,
  type CliStreamEvent,
  type CliStreamHandle,
  type CliStreamSettlement,
} from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { CliMutationInvalidator } from './cli-mutation-invalidator.js'

function settledHandle(exitCode: number | null): CliStreamHandle {
  const settlement: CliStreamSettlement = { reason: 'exited', exitCode }
  return {
    settled: Promise.resolve(settlement),
    cancel: () => Promise.resolve(settlement),
  }
}

describe('CliMutationInvalidator', () => {
  it('invalidates before returning buffered success or failure evidence', async () => {
    const invalidation = new RuntimeInvalidationIndex()
    const service = new CliMutationInvalidator(invalidation)

    const success = await service.run(['project'], async () => ({ success: true, exitCode: 0 }))
    expect(success).toEqual({ success: true, exitCode: 0 })
    expect(invalidation.current('project')).toBe(1)

    const failure = await service.run(['project'], async () => ({ success: false, exitCode: 1 }))
    expect(failure).toEqual({ success: false, exitCode: 1 })
    expect(invalidation.current('project')).toBe(2)
  })

  it('invalidates before rethrowing an indeterminate buffered error', async () => {
    const invalidation = new RuntimeInvalidationIndex()
    const service = new CliMutationInvalidator(invalidation)
    const failure = new Error('terminal result unavailable')

    await expect(
      service.run(['stores', 'context'], async () => Promise.reject(failure))
    ).rejects.toBe(failure)
    expect(invalidation.current('stores')).toBe(1)
    expect(invalidation.current('context')).toBe(1)
  })

  it.each([0, 1, null])('invalidates once before forwarding streamed exit %j', async (exitCode) => {
    const invalidation = new RuntimeInvalidationIndex()
    const service = new CliMutationInvalidator(invalidation)
    const events: CliStreamEvent[] = []
    const stream = service.stream(
      ['project', 'context'],
      (onEvent) => {
        onEvent({ type: 'exit', exitCode })
        return settledHandle(exitCode)
      },
      (event) => {
        expect(invalidation.current('project')).toBe(1)
        events.push(event)
      }
    )

    expect(events).toEqual([{ type: 'exit', exitCode }])
    await stream.cancel()
    expect(invalidation.current('project')).toBe(1)
    expect(invalidation.current('context')).toBe(1)
  })

  it('invalidates once before canceling a stream without terminal evidence', async () => {
    const invalidation = new RuntimeInvalidationIndex()
    const service = new CliMutationInvalidator(invalidation)
    const terminal = Promise.withResolvers<CliStreamSettlement>()
    const cancelProcess = vi.fn(() => {
      terminal.resolve({ reason: 'cancelled', exitCode: null })
      return terminal.promise
    })
    const stream = service.stream(
      ['schemas'],
      () => ({ settled: terminal.promise, cancel: cancelProcess }),
      vi.fn()
    )

    const cancellation = stream.cancel()
    expect(stream.cancel()).toBe(cancellation)
    await cancellation
    expect(cancelProcess).toHaveBeenCalledOnce()
    expect(invalidation.current('schemas')).toBe(1)
  })
})
