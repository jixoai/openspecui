/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Type shell-independent Node subprocess invocations for repository scripts.
 * 2. Type explicit Corepack and Node owner candidates for Windows command shims.
 *
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */
export interface CommandInvocation {
  args: string[]
  command: string
  windowsVerbatimArguments?: boolean
}

export function resolveCommandInvocation(
  command: string,
  args: readonly string[]
): CommandInvocation

export function resolveWindowsCommandInvocation(
  command: string,
  args: readonly string[],
  candidates: readonly string[],
  corepackCandidates?: readonly string[],
  nodeCandidates?: readonly string[]
): CommandInvocation
