/**
 * Orthogonal intents (created 2026-08-14 Asia/Shanghai):
 * 1. Prove the shell-independent spawn boundary hides child console windows by default so a
 *    console-less Windows daemon never flashes a cmd window per executed command.
 * 2. Preserve an explicit caller-owned windowsHide override as a deliberate opt-out.
 * 3. Prove buffered commands inherit the same hidden-console default through spawnSafe.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 */
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'
import { runBufferedCommand, spawnSafe } from './spawn-safe.js'

vi.mock('./command-invocation.js', () => ({
  resolveCommandInvocation: (command: string, args: readonly string[]) => ({
    command,
    args: [...args],
  }),
}))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  const createStubChild = (pid: number): ChildProcess => {
    const child = Object.assign(new EventEmitter(), {
      pid,
      exitCode: null as number | null,
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
    })
    return child as ChildProcess
  }
  return {
    ...actual,
    spawn: vi.fn(
      (_command: string, _args: readonly string[], _options?: SpawnOptions): ChildProcess =>
        createStubChild(47_210)
    ),
  }
})

function lastSpawnOptions(): SpawnOptions | undefined {
  return vi.mocked(spawn).mock.calls.at(-1)?.[2]
}

describe('spawnSafe hidden-console boundary', () => {
  it('spawns with windowsHide true by default', () => {
    const started = spawnSafe('node', ['--version'], { cwd: process.cwd() })

    expect(started.ok).toBe(true)
    expect(lastSpawnOptions()).toMatchObject({ shell: false, windowsHide: true })
  })

  it('preserves an explicit windowsHide false override', () => {
    const started = spawnSafe('node', ['--version'], {
      cwd: process.cwd(),
      windowsHide: false,
    })

    expect(started.ok).toBe(true)
    expect(lastSpawnOptions()).toMatchObject({ windowsHide: false })
  })

  it('runs buffered commands with windowsHide true', async () => {
    const pending = runBufferedCommand({
      command: 'node',
      args: ['-e', '0'],
      cwd: process.cwd(),
      env: process.env,
    })
    const child = vi.mocked(spawn).mock.results.at(-1)?.value
    expect(child).toBeDefined()
    child?.emit('close', 0, null)

    const result = await pending
    expect(result.exitCode).toBe(0)
    expect(lastSpawnOptions()).toMatchObject({ shell: false, windowsHide: true })
  })
})
