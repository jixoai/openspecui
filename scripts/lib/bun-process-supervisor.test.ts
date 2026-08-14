/**
 * Orthogonal intents (created 2026-08-08 Asia/Shanghai):
 * 1. Prove Bun task shutdown refuses a mismatched PID identity and retires a real pnpm tree.
 * 2. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 * 3. Keep resolution/termination invariants environment-tolerant: hosted runners may provide pnpm
 *    only as an npm-style `.cmd` (whose node.exe mapping is a real boundary) and the vitest
 *    `process.execPath` may coincide with that node.exe, so the guards are `.cmd`-rejection,
 *    bun.exe-rejection, and npm_execpath non-injection rather than path inequality.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import process from 'node:process'
import { createInterface } from 'node:readline'
import { describe, expect, it } from 'vitest'
import {
  readWindowsProcessTable,
  resolveWindowsProcessTreePids,
} from '../../packages/core/src/child-process-tree.js'
import {
  resolveBunTaskInvocation,
  terminateBunWindowsProcessTree,
} from './bun-process-supervisor.js'

async function waitForProcessTree(rootPid: number): Promise<number[]> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const pids = resolveWindowsProcessTreePids(rootPid, await readWindowsProcessTable())
    if (pids.length > 1) return pids
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  return [rootPid]
}

async function waitForProcessesToExit(pids: readonly number[]): Promise<number[]> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const rows = await readWindowsProcessTable()
    const remaining = pids.filter((pid) => rows.some((row) => row.ProcessId === pid))
    if (remaining.length === 0) return []
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  const rows = await readWindowsProcessTable()
  return pids.filter((pid) => rows.some((row) => row.ProcessId === pid))
}

describe.runIf(process.platform === 'win32')('Bun process supervisor', () => {
  it('keeps pnpm on a real executable boundary instead of a shell or bun shortcut', () => {
    const previousNpmExecPath = process.env.npm_execpath
    process.env.npm_execpath = 'C:\\fixture\\pnpm.cjs'
    try {
      const invocation = resolveBunTaskInvocation('pnpm', ['--version'])
      const command = invocation.command.toLowerCase()
      expect(command.endsWith('.cmd')).toBe(false)
      expect(command).not.toMatch(/\\bun\.exe$/)
      expect(invocation.args).not.toContain(process.env.npm_execpath)
      if (/(?:pnpm|corepack)\.exe$/.test(command)) return
      // A `.cmd`-only pnpm installation legitimately maps to a real node.exe carrying pnpm's entry.
      expect(command.endsWith('\\node.exe')).toBe(true)
      expect(invocation.args[0]?.toLowerCase()).toMatch(/pnpm/)
    } finally {
      if (previousNpmExecPath === undefined) delete process.env.npm_execpath
      else process.env.npm_execpath = previousNpmExecPath
    }
  })

  it('binds termination to the resolved pnpm executable before retiring its descendants', async () => {
    const pnpm = resolveBunTaskInvocation('pnpm', [
      'exec',
      'node',
      '-e',
      'setInterval(() => {}, 1_000)',
    ])
    const helperSource = [
      `const child = Bun.spawn({ cmd: ${JSON.stringify([pnpm.command, ...pnpm.args])}, stdout: 'ignore', stderr: 'ignore' })`,
      'console.log(child.pid)',
      'await child.exited',
    ].join(';')
    const bun = resolveBunTaskInvocation('bun', ['-e', helperSource])
    const helper = spawn(bun.command, bun.args, {
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let rootPid = -1
    try {
      await once(helper, 'spawn')
      const lines = createInterface({ input: helper.stdout! })
      const [line] = (await once(lines, 'line')) as [string]
      lines.close()
      rootPid = Number(line)
      expect(Number.isSafeInteger(rootPid)).toBe(true)
      const trackedPids = await waitForProcessTree(rootPid)
      expect(trackedPids.length).toBeGreaterThan(1)

      // A deliberately unrelated executable must always be refused while the root is alive,
      // independent of whether the host's node.exe coincides with the resolved pnpm boundary.
      await expect(
        terminateBunWindowsProcessTree(rootPid, 'C:\\openspecui-identity-probe-not-the-root.exe')
      ).rejects.toThrow('Refusing to terminate PID')
      await expect(readWindowsProcessTable()).resolves.toEqual(
        expect.arrayContaining([expect.objectContaining({ ProcessId: rootPid })])
      )

      const helperClosed = once(helper, 'close')
      await terminateBunWindowsProcessTree(rootPid, pnpm.expectedExecutablePath)

      await expect(waitForProcessesToExit(trackedPids)).resolves.toEqual([])
      await expect(helperClosed).resolves.toBeDefined()
    } finally {
      if (rootPid > 0) {
        await terminateBunWindowsProcessTree(rootPid, pnpm.expectedExecutablePath).catch(
          () => undefined
        )
      }
      if (helper.exitCode === null && helper.signalCode === null) helper.kill('SIGKILL')
    }
  }, 25_000)
})
