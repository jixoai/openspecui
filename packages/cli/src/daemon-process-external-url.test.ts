/**
 * Orthogonal intents (created 2026-08-14 Asia/Shanghai):
 * 1. Prove the daemon's default external-URL opener never routes Windows through a console
 *    subprocess: explorer.exe is spawned hidden, detached, and fire-and-forget.
 * 2. Preserve the POSIX `open` package path unchanged.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 */
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'
import { openExternalUrlHidden } from './daemon-process.js'

interface RecordedSpawnCall {
  command: string
  args: string[]
  options: SpawnOptions
  child: { unref: ReturnType<typeof vi.fn> }
}

const spawnCalls = vi.hoisted(() => [] as RecordedSpawnCall[])
const openMock = vi.hoisted(() => vi.fn(async (_target: string) => undefined))

vi.mock('open', () => ({ default: openMock }))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    spawn: (command: string, args: readonly string[], options: SpawnOptions): ChildProcess => {
      const unref = vi.fn()
      const child = Object.assign(new EventEmitter(), { unref }) as ChildProcess
      spawnCalls.push({ command, args: [...args], options, child: { unref } })
      return child
    },
  }
})

describe('openExternalUrlHidden hidden-console boundary', () => {
  it.runIf(process.platform === 'win32')(
    'opens Windows URLs through a hidden detached explorer.exe',
    async () => {
      openMock.mockClear()
      spawnCalls.length = 0

      await openExternalUrlHidden('http://127.0.0.1:4173/?credential=fixture')

      expect(openMock).not.toHaveBeenCalled()
      const call = spawnCalls.at(-1)
      expect(call?.command).toBe('explorer.exe')
      expect(call?.args).toEqual(['http://127.0.0.1:4173/?credential=fixture'])
      expect(call?.options).toMatchObject({
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
      })
      expect(call?.child.unref).toHaveBeenCalledTimes(1)
    }
  )

  it.runIf(process.platform !== 'win32')('keeps the POSIX open package path', async () => {
    openMock.mockClear()
    spawnCalls.length = 0

    await openExternalUrlHidden('http://127.0.0.1:4173/?credential=fixture')

    expect(openMock).toHaveBeenCalledTimes(1)
    expect(openMock).toHaveBeenCalledWith('http://127.0.0.1:4173/?credential=fixture')
    expect(spawnCalls).toHaveLength(0)
  })
})
