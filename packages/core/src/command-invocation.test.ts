/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Prove Windows command resolution consumes the caller's PATH and prefers native executable boundaries.
 * 2. Prove shell-sensitive pnpm uses Corepack or a cmd-only Node entry while opaque shims are rejected.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import { link, mkdir, writeFile } from 'node:fs/promises'
import { delimiter, dirname, join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import { resolveWindowsCommandInvocation } from './command-invocation.js'

function commandPathEnv(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: root,
    PATHEXT: '.EXE;.CMD',
  }
}

async function writeNodeCommandShim(root: string, name: string): Promise<string> {
  const command = join(root, `${name}.cmd`)
  const entry = join(root, 'node_modules', name, 'bin', `${name}.mjs`)
  await mkdir(dirname(entry), { recursive: true })
  await writeFile(
    command,
    [
      '@ECHO off',
      `IF EXIST "%~dp0\\node.exe" (`,
      `  "%~dp0\\node.exe" "%~dp0\\node_modules\\${name}\\bin\\${name}.mjs" %*`,
      ') ELSE (',
      `  node "%~dp0\\node_modules\\${name}\\bin\\${name}.mjs" %*`,
      ')',
      '',
    ].join('\r\n')
  )
  await writeFile(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n')
  return entry
}

describe.runIf(process.platform === 'win32')('Windows command invocation', () => {
  it('prefers a native executable discovered from the caller PATH', async () => {
    const root = await createTempDir()
    try {
      const executable = join(root, 'fixture.exe')
      await link(process.execPath, executable)
      await writeFile(join(root, 'fixture.cmd'), '@ECHO off\r\nexit /b 7\r\n')

      expect(
        resolveWindowsCommandInvocation('fixture', ['a&b'], {
          cwd: root,
          env: commandPathEnv(root),
        })
      ).toEqual({ command: executable, args: ['a&b'] })
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('routes shell-sensitive pnpm argv through Corepack from the caller PATH', async () => {
    const root = await createTempDir()
    try {
      const corepack = join(root, 'corepack.exe')
      await link(process.execPath, corepack)
      await writeFile(join(root, 'pnpm.cmd'), '@ECHO off\r\nexit /b 7\r\n')

      expect(
        resolveWindowsCommandInvocation('pnpm', ['exec', 'fixture', 'a&b'], {
          cwd: root,
          env: commandPathEnv(root),
        })
      ).toEqual({ command: corepack, args: ['pnpm', 'exec', 'fixture', 'a&b'] })
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('uses a pnpm Node shim when the caller PATH has no native pnpm or Corepack executable', async () => {
    const root = await createTempDir()
    try {
      const entry = await writeNodeCommandShim(root, 'pnpm')
      const args = ['exec', 'fixture', 'a&b', '%PATH%', 'C:\\space path\\']
      const env = {
        ...commandPathEnv(root),
        PATH: [root, dirname(process.execPath)].join(delimiter),
      }
      const invocation = resolveWindowsCommandInvocation('pnpm', args, { cwd: root, env })
      const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8', env })

      expect(invocation.args[0]).toBe(entry)
      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual(args)
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('rejects an opaque explicit command shim', async () => {
    const root = await createTempDir()
    try {
      const command = join(root, 'opaque.cmd')
      await writeFile(command, '@ECHO off\r\necho %*\r\n')

      expect(() =>
        resolveWindowsCommandInvocation(command, ['a&b'], {
          cwd: root,
          env: commandPathEnv(root),
        })
      ).toThrow(/opaque Windows command shim/)
    } finally {
      await cleanupTempDir(root)
    }
  })
})
