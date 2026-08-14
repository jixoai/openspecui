/**
 * Orthogonal intents (created 2026-08-08 Asia/Shanghai):
 * 1. Prove the Core Windows terminator retires a real cmd-shim root and every recorded descendant.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import type { ChildProcess } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  readWindowsProcessTable,
  resolveWindowsProcessTreePids,
  terminateChildProcessTree,
} from './child-process-tree.js'
import { spawnSafe } from './spawn-safe.js'

const TSX_WINDOWS_SHIM = fileURLToPath(
  new URL('../../../node_modules/.bin/tsx.cmd', import.meta.url)
)

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

describe.runIf(process.platform === 'win32')('Windows child-process tree termination', () => {
  it('terminates a real tsx.cmd process tree without leaving descendants', async () => {
    const started = spawnSafe(TSX_WINDOWS_SHIM, ['-e', 'setInterval(() => {}, 1_000)'], {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: 'ignore',
    })
    expect(started.ok).toBe(true)
    if (!started.ok) return

    const child: ChildProcess = started.child
    try {
      await new Promise<void>((resolveSpawn, rejectSpawn) => {
        child.once('spawn', resolveSpawn)
        child.once('error', rejectSpawn)
      })
      const trackedPids = await waitForProcessTree(child.pid ?? -1)
      expect(trackedPids.length).toBeGreaterThan(1)

      await terminateChildProcessTree(child)

      await expect(waitForProcessesToExit(trackedPids)).resolves.toEqual([])
    } finally {
      await terminateChildProcessTree(child, 'SIGKILL').catch(() => undefined)
    }
  }, 20_000)
})
