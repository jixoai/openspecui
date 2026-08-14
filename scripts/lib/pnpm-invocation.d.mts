/**
 * Orthogonal intents (created 2026-08-04 Asia/Shanghai):
 * 1. Type the shell-independent pnpm subprocess invocation consumed by TypeScript scripts.
 *
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
export interface PnpmInvocation {
  args: string[]
  command: string
  windowsVerbatimArguments?: boolean
}

export function resolvePnpmInvocation(args: readonly string[]): PnpmInvocation

export function resolveWindowsPnpmInvocation(
  args: readonly string[],
  candidates: readonly string[],
  corepackCandidates?: readonly string[]
): PnpmInvocation
