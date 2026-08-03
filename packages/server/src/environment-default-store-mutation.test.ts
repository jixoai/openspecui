/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Prove machine `defaultStore` set and clear use distinct official CLI mutations.
 * 2. Preserve failed CLI evidence without reporting a completed environment settlement.
 *
 * Original request (2026-08-01): adapt OpenSpec 1.7 machine `defaultStore` with explicit clear.
 */
import type { CliResult } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { writeEnvironmentDefaultStore } from './planning-config-service.js'

function result(overrides: Partial<CliResult> = {}): CliResult {
  return {
    success: true,
    stdout: 'ok\n',
    stderr: '',
    exitCode: 0,
    ...overrides,
  }
}

describe('writeEnvironmentDefaultStore', () => {
  it('sets an exact freeform id through the official string mutation', async () => {
    const execute = vi.fn(async () => result())

    await expect(
      writeEnvironmentDefaultStore({
        cliExecutor: { execute },
        update: { value: 'team-plans' },
      })
    ).resolves.toMatchObject({ success: true })

    expect(execute).toHaveBeenCalledWith([
      'config',
      'set',
      'defaultStore',
      'team-plans',
      '--string',
    ])
  })

  it('clears only defaultStore through the official unset mutation', async () => {
    const execute = vi.fn(async () => result())

    await writeEnvironmentDefaultStore({ cliExecutor: { execute }, update: { value: null } })

    expect(execute).toHaveBeenCalledWith(['config', 'unset', 'defaultStore'])
  })

  it('rejects failed CLI evidence instead of reporting settlement', async () => {
    const execute = vi.fn(async () => result({ success: false, stderr: 'invalid config' }))

    await expect(
      writeEnvironmentDefaultStore({
        cliExecutor: { execute },
        update: { value: 'team-plans' },
      })
    ).rejects.toThrow('invalid config')
  })
})
