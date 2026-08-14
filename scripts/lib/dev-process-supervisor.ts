/**
 * Orthogonal intents (updated 2026-08-08 Asia/Shanghai):
 * 1. Orchestrate bounded development-process shutdown through the Core child-tree owner.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import type { ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { terminateChildProcessTree } from '../../packages/core/src/child-process-tree.js'

export {
  readWindowsProcessTable,
  resolveWindowsProcessTreePids,
} from '../../packages/core/src/child-process-tree.js'

const CHILD_EXIT_TIMEOUT_MS = 2_000

function hasChildExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

async function waitForChildExit(child: ChildProcess): Promise<void> {
  if (hasChildExited(child)) return
  await Promise.race([
    once(child, 'close').then(() => undefined),
    new Promise<void>((resolveTimeout) => {
      setTimeout(resolveTimeout, CHILD_EXIT_TIMEOUT_MS)
    }),
  ])
}

/** Terminate one spawned development command through the shared Core process-tree owner. */
export async function terminateDevProcessTree(child: ChildProcess): Promise<void> {
  if (hasChildExited(child)) return
  await terminateChildProcessTree(child, 'SIGINT')
  await waitForChildExit(child)
  if (!hasChildExited(child)) {
    await terminateChildProcessTree(child, 'SIGKILL')
    await waitForChildExit(child)
  }
}
