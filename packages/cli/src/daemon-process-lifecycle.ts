/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Bound daemon readiness, shutdown, and spawned-child settlement waits.
 * 2. Compare two credential-free daemon observations before forced PID retirement.
 * 3. Preserve the original lifecycle failure when verified cleanup succeeds.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import type { ChildProcess } from 'node:child_process'

import type { DaemonStatus } from './daemon-protocol.js'

export type DaemonStatusReader = () => Promise<DaemonStatus | null>

export class DaemonLifecycleTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DaemonLifecycleTimeoutError'
  }
}

function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs))
}

export async function waitForDaemonStatus(
  readStatus: DaemonStatusReader,
  timeoutMs: number,
  logFile: string
): Promise<DaemonStatus> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const status = await readStatus()
    if (status) return status
    await delay(50)
  }
  throw new DaemonLifecycleTimeoutError(
    `App daemon did not become ready within ${timeoutMs}ms. See ${logFile}.`
  )
}

export async function waitForDaemonStop(
  readStatus: DaemonStatusReader,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await readStatus()) === null) return
    await delay(50)
  }
  throw new DaemonLifecycleTimeoutError(`App daemon endpoint did not stop within ${timeoutMs}ms.`)
}

export function isSameDaemonStatus(expected: DaemonStatus, observed: DaemonStatus): boolean {
  return (
    expected.pid === observed.pid &&
    expected.version === observed.version &&
    expected.hostMode === observed.hostMode &&
    expected.openSpecSpawnMode === observed.openSpecSpawnMode &&
    expected.appUrl === observed.appUrl &&
    expected.capabilities.browser === observed.capabilities.browser &&
    expected.capabilities.nativeWindow === observed.capabilities.nativeWindow
  )
}

export async function withDaemonLifecycleTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new DaemonLifecycleTimeoutError(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function hasChildExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (hasChildExited(child)) return Promise.resolve(true)
  return new Promise((resolve) => {
    const settle = (exited: boolean) => {
      clearTimeout(timer)
      child.off('exit', onExit)
      child.off('close', onExit)
      resolve(exited)
    }
    const onExit = () => settle(true)
    const timer = setTimeout(() => settle(false), timeoutMs)
    child.once('exit', onExit)
    child.once('close', onExit)
  })
}

export async function terminateSpawnedDaemon(
  child: ChildProcess,
  terminateTree: (child: ChildProcess, signal: NodeJS.Signals) => Promise<void>,
  timeoutMs: number
): Promise<void> {
  await withDaemonLifecycleTimeout(
    terminateTree(child, 'SIGKILL'),
    timeoutMs,
    `Timed out terminating newly spawned App daemon PID ${child.pid ?? 'unknown'}.`
  )
  if (child.pid === undefined || hasChildExited(child)) return
  if (!(await waitForChildExit(child, timeoutMs))) {
    throw new DaemonLifecycleTimeoutError(
      `Newly spawned App daemon PID ${child.pid} did not report exit after verified termination.`
    )
  }
}

export async function rethrowAfterSpawnCleanup(
  child: ChildProcess,
  failure: unknown,
  terminateTree: (child: ChildProcess, signal: NodeJS.Signals) => Promise<void>,
  timeoutMs: number
): Promise<never> {
  const lifecycleFailure = failure instanceof Error ? failure : new Error(String(failure))
  try {
    await terminateSpawnedDaemon(child, terminateTree, timeoutMs)
  } catch (cleanupFailure) {
    throw new AggregateError(
      [lifecycleFailure, cleanupFailure],
      `${lifecycleFailure.message} Newly spawned daemon cleanup also failed.`
    )
  }
  throw lifecycleFailure
}
