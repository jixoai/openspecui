/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Prove translation runtime installation cancellation crosses the Core process-tree owner.
 * 2. Prove a child that never closes reaches a bounded terminal cancellation result.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { spawnSafe, terminateChildProcessTree } from '@openspecui/core'
import { ChildProcess } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runRuntimeInstallCommand } from './translation-engine-service.js'

vi.mock('@openspecui/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openspecui/core')>()
  return {
    ...actual,
    spawnSafe: vi.fn(actual.spawnSafe),
    terminateChildProcessTree: vi.fn(actual.terminateChildProcessTree),
  }
})

describe('translation runtime install process', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes AbortSignal cancellation through the child-process tree owner', async () => {
    const child = new ChildProcess()
    vi.mocked(spawnSafe).mockReturnValueOnce({ ok: true, child })
    vi.mocked(terminateChildProcessTree).mockImplementationOnce(async (ownedChild) => {
      expect(ownedChild).toBe(child)
      child.emit('close', null)
    })
    const controller = new AbortController()
    const installation = runRuntimeInstallCommand({
      command: {
        cmd: 'pnpm',
        args: ['add', 'fixture'],
        displayCommand: 'pnpm add fixture',
      },
      cwd: process.cwd(),
      signal: controller.signal,
    })

    controller.abort()

    await expect(installation).resolves.toBe('Translation runtime installation cancelled.')
    expect(terminateChildProcessTree).toHaveBeenCalledOnce()
  })

  it('bounds cancellation when the terminated child never reports close', async () => {
    const child = new ChildProcess()
    vi.mocked(spawnSafe).mockReturnValueOnce({ ok: true, child })
    vi.mocked(terminateChildProcessTree).mockResolvedValue(undefined)
    const controller = new AbortController()
    const installation = runRuntimeInstallCommand({
      command: {
        cmd: 'pnpm',
        args: ['add', 'fixture'],
        displayCommand: 'pnpm add fixture',
      },
      cwd: process.cwd(),
      signal: controller.signal,
      terminationTimeoutMs: 20,
    })

    controller.abort()

    await expect(installation).resolves.toBe(
      'Translation runtime installation cancellation did not settle.'
    )
    expect(terminateChildProcessTree).toHaveBeenNthCalledWith(1, child, 'SIGTERM')
    expect(terminateChildProcessTree).toHaveBeenNthCalledWith(2, child, 'SIGKILL')
  })
})
