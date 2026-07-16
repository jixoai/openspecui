/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify buffered success, failure, and indeterminate errors invalidate before delivery.
 * 2. Verify streamed terminal/null exits and cancellation invalidate once before observation.
 *
 * Original request (2026-07-15): "Every terminal or indeterminate outcome invalidates affected projections before they are pulled again."
 */
import { RuntimeInvalidationIndex, type CliStreamEvent } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { CliMutationInvalidator } from './cli-mutation-invalidator.js'

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
    const cancel = await service.stream(
      ['project', 'context'],
      async (onEvent) => {
        onEvent({ type: 'exit', exitCode })
        return vi.fn()
      },
      (event) => {
        expect(invalidation.current('project')).toBe(1)
        events.push(event)
      }
    )

    expect(events).toEqual([{ type: 'exit', exitCode }])
    cancel()
    expect(invalidation.current('project')).toBe(1)
    expect(invalidation.current('context')).toBe(1)
  })

  it('invalidates once before canceling a stream without terminal evidence', async () => {
    const invalidation = new RuntimeInvalidationIndex()
    const service = new CliMutationInvalidator(invalidation)
    const cancelProcess = vi.fn(() => {
      expect(invalidation.current('schemas')).toBe(1)
    })
    const cancel = await service.stream(['schemas'], async () => cancelProcess, vi.fn())

    cancel()
    cancel()
    expect(cancelProcess).toHaveBeenCalledTimes(2)
    expect(invalidation.current('schemas')).toBe(1)
  })
})
