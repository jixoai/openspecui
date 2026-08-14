/**
 * Orthogonal intents (created 2026-08-14 Asia/Shanghai):
 * 1. Prove the shared Git runner hides the child console window (`windowsHide`) so Git polling and
 *    registration executed by a console-less Windows daemon never flashes a cmd window.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 */
import type { ExecFileOptions } from 'node:child_process'
import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'

import { defaultRunGit } from './git-shared.js'

interface RecordedExecFileCall {
  file: string
  args: string[]
  options: ExecFileOptions
}

const execFileCalls = vi.hoisted(() => [] as RecordedExecFileCall[])

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  type ExecFileCallback = (error: Error | null, output: { stdout: string; stderr: string }) => void
  const execFileMock = (
    file: string,
    args: readonly string[],
    options: ExecFileOptions,
    callback: ExecFileCallback
  ): void => {
    execFileCalls.push({ file, args: [...args], options })
    queueMicrotask(() => callback(null, { stdout: 'ok\n', stderr: '' }))
  }
  return { ...actual, execFile: execFileMock }
})

describe('defaultRunGit hidden-console boundary', () => {
  it('executes Git with windowsHide true', async () => {
    const result = await defaultRunGit(process.cwd(), ['status', '--short'])

    expect(result.ok).toBe(true)
    const call = execFileCalls.at(-1)
    expect(call?.file).toBe('git')
    expect(call?.args).toEqual(['status', '--short'])
    expect(call?.options).toMatchObject({ windowsHide: true })
  })
})
