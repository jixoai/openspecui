/**
 * Orthogonal intents (created 2026-08-08 Asia/Shanghai):
 * 1. Prove Windows development shutdown retires the real pnpm wrapper and all recorded descendants.
 * 2. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { spawn } from 'node:child_process'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import {
  readWindowsProcessTable,
  resolveWindowsProcessTreePids,
  terminateDevProcessTree,
} from './dev-process-supervisor.js'
import { resolvePnpmInvocation } from './pnpm-invocation.mjs'

async function waitForProcessTree(rootPid: number): Promise<number[]> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const pids = resolveWindowsProcessTreePids(rootPid, await readWindowsProcessTable())
    if (pids.length > 1) return pids
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  return [rootPid]
}

describe.runIf(process.platform === 'win32')('development process supervisor', () => {
  it('terminates a pnpm command and every descendant process', async () => {
    const invocation = resolvePnpmInvocation(['exec', 'node', '-e', 'setInterval(() => {}, 1000)'])
    const child = spawn(invocation.command, invocation.args, {
      stdio: 'ignore',
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      windowsHide: true,
    })
    await new Promise<void>((resolveSpawn, rejectSpawn) => {
      child.once('spawn', resolveSpawn)
      child.once('error', rejectSpawn)
    })

    const trackedPids = await waitForProcessTree(child.pid ?? -1)
    expect(trackedPids.length).toBeGreaterThan(1)
    await terminateDevProcessTree(child)

    const remaining = await readWindowsProcessTable()
    expect(trackedPids.filter((pid) => remaining.some((row) => row.ProcessId === pid))).toEqual([])
  }, 15_000)
})
