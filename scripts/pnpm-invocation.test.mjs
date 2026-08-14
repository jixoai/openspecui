/**
 * Orthogonal intents (created 2026-08-04 Asia/Shanghai):
 * 1. Prove pnpm subprocess resolution executes both native Windows executables and command shims.
 * 2. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { resolvePnpmInvocation, resolveWindowsPnpmInvocation } from './lib/pnpm-invocation.mjs'

describe('pnpm subprocess invocation', () => {
  it('executes the pnpm candidate resolved for the current platform', () => {
    const invocation = resolvePnpmInvocation(['--version'])
    const result = spawnSync(invocation.command, invocation.args, {
      encoding: 'utf8',
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      windowsHide: true,
    })

    expect(
      result.status,
      JSON.stringify({
        args: invocation.args,
        command: invocation.command,
        error: result.error?.message ?? null,
        stderr: result.stderr,
      })
    ).toBe(0)
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it.runIf(process.platform === 'win32')(
    'executes a Windows pnpm command shim',
    () => {
      const resolved = spawnSync('where.exe', ['pnpm'], { encoding: 'utf8', windowsHide: true })
      const commandShim = resolved.stdout
        .split(/\r?\n/)
        .map((candidate) => candidate.trim())
        .find((candidate) => candidate.toLowerCase().endsWith('.cmd'))

      expect(commandShim).toBeTruthy()
      const invocation = resolveWindowsPnpmInvocation(['--version'], [commandShim ?? ''])
      const result = spawnSync(invocation.command, invocation.args, {
        encoding: 'utf8',
        windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      })

      expect(
        result.status,
        JSON.stringify({
          args: invocation.args,
          command: invocation.command,
          error: result.error?.message ?? null,
          stderr: result.stderr,
        })
      ).toBe(0)
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
    },
    15_000
  )
})
