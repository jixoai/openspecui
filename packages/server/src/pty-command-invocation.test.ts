/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Prove ConPTY receives a native Node invocation while PTY metadata retains exact Agent argv.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import type { IEvent, IPty } from '@lydell/node-pty'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn<typeof import('@lydell/node-pty').spawn>(),
}))

vi.mock('@lydell/node-pty', () => ({ spawn: spawnMock }))

import { PtyManager } from './pty-manager.js'

const tempDirs: string[] = []

function createPtyEvent<T>(): IEvent<T> {
  return () => ({ dispose: () => {} })
}

function createMockPty(): IPty {
  return {
    pid: 42,
    cols: 80,
    rows: 24,
    process: 'mock-agent',
    handleFlowControl: false,
    onData: createPtyEvent<string>(),
    onExit: createPtyEvent<{ exitCode: number; signal?: number }>(),
    resize: () => {},
    clear: () => {},
    write: () => {},
    kill: () => {},
    pause: () => {},
    resume: () => {},
  }
}

afterEach(async () => {
  vi.unstubAllEnvs()
  spawnMock.mockReset()
  await Promise.all(
    tempDirs.splice(0).map((path) => rm(path, { force: true, recursive: true, maxRetries: 5 }))
  )
})

describe.runIf(process.platform === 'win32')('Windows PTY command invocation', () => {
  it('preserves special Agent argv without exposing the physical Node command as UI metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openspecui-pty-command-'))
    tempDirs.push(root)
    const command = join(root, 'claude.cmd')
    const nodeExecutable = join(root, 'node.exe')
    const entry = join(root, 'node_modules', 'claude', 'bin', 'claude.mjs')
    const args = ['a&b', '%PATH%', '^caret', 'quote"x', 'C:\\tail\\']

    await mkdir(dirname(entry), { recursive: true })
    await copyFile(process.execPath, nodeExecutable)
    await writeFile(
      command,
      ['@ECHO off', '"%~dp0\\node.exe" "%~dp0\\node_modules\\claude\\bin\\claude.mjs" %*', ''].join(
        '\r\n'
      )
    )
    await writeFile(entry, 'process.exitCode = 0\n')
    vi.stubEnv('PATH', root)
    vi.stubEnv('PATHEXT', '.EXE;.CMD')
    spawnMock.mockReturnValue(createMockPty())

    const manager = new PtyManager()
    try {
      const session = manager.create({
        command: 'claude',
        args,
        cwd: root,
        cwdTarget: 'launch-project',
        rootGeneration: null,
      })

      expect(spawnMock).toHaveBeenCalledWith(
        nodeExecutable,
        [entry, ...args],
        expect.objectContaining({ cwd: root })
      )
      expect(session.toInfo()).toMatchObject({ command: 'claude', args })
    } finally {
      manager.closeAll()
    }
  })
})
