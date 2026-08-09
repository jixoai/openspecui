/**
 * Orthogonal intents (created 2026-08-08 Asia/Shanghai):
 * 1. Resolve Bun task commands through the shared shell-independent invocation owners.
 * 2. Retire a Bun-owned Windows process tree only through its launch-time executable identity.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import process from 'node:process'
import { terminateWindowsProcessTreeByIdentity } from '../../packages/core/src/child-process-tree.js'
import { resolveCommandInvocation } from './command-invocation.mjs'

export interface BunTaskInvocation {
  readonly args: string[]
  readonly command: string
  readonly expectedExecutablePath: string
}

/** Resolve the exact command that Bun will spawn and later prove it still owns. */
export function resolveBunTaskInvocation(
  command: string,
  args: readonly string[]
): BunTaskInvocation {
  const invocation = resolveCommandInvocation(command, args)
  if (invocation.windowsVerbatimArguments) {
    throw new Error(`Bun task ${command} resolved to a Node-only verbatim command boundary.`)
  }
  return {
    command: invocation.command,
    args: invocation.args,
    expectedExecutablePath: invocation.command,
  }
}

/** Terminate one Bun-owned Windows process tree after proving its root executable identity. */
export async function terminateBunWindowsProcessTree(
  rootPid: number,
  expectedExecutablePath: string
): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('Bun Windows process-tree termination is unavailable on this platform.')
  }
  await terminateWindowsProcessTreeByIdentity(rootPid, expectedExecutablePath)
}
