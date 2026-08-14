/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Prove development task termination converts async rejection into one explicit failure report.
 *
 * Original request (2026-08-09): "Continue the Windows adaptation and handle similar issues together."
 */
import { describe, expect, it, vi } from 'vitest'
import { settleDevTaskTermination } from './dev-task-termination.js'

describe('development task termination settlement', () => {
  it('reports Stop rejection and resolves the fire-and-forget owner', async () => {
    const error = new Error('PID identity changed')
    const onFailure = vi.fn()

    await expect(
      settleDevTaskTermination({
        action: 'stop',
        taskId: 'server',
        terminate: async () => {
          throw error
        },
        onFailure,
      })
    ).resolves.toBeUndefined()

    expect(onFailure).toHaveBeenCalledWith({
      action: 'stop',
      error,
      message: 'PID identity changed',
      taskId: 'server',
    })
  })
})
