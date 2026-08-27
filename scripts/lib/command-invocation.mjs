/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Resolve shell-independent Node subprocess invocations for native tools and command shims.
 * 2. Prefer Windows executables and reject opaque command shims that cannot preserve argv safely.
 * 3. Resolve npm-style Node owners correctly when this module runs under Bun.
 *
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import {
  resolveWindowsNodeCommandShimInvocation,
  resolveWindowsPackageManagerInvocation,
} from './package-manager-shim.mjs'

/** @typedef {{ args: string[], command: string, windowsVerbatimArguments?: boolean }} CommandInvocation */

/** @param {string} command */
function findWindowsCommandCandidates(command) {
  const result = spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) {
    // where.exe prints localized text ("INFO: Could not find files..."), so carry the canonical
    // not-found code instead of matching message text.
    throw Object.assign(
      new Error(result.stderr.trim() || `Unable to resolve ${command} from PATH.`),
      {
        code: 'ENOENT',
      }
    )
  }
  return result.stdout
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .filter(Boolean)
}

/** @param {string} command */
function tryFindWindowsCommandCandidates(command) {
  try {
    return findWindowsCommandCandidates(command)
  } catch {
    return []
  }
}

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @param {readonly string[]} candidates
 * @param {readonly string[]} [corepackCandidates]
 * @param {readonly string[]} [nodeCandidates]
 * @returns {CommandInvocation}
 */
export function resolveWindowsCommandInvocation(
  command,
  args,
  candidates,
  corepackCandidates = [],
  nodeCandidates = []
) {
  const packageManagerInvocation = resolveWindowsPackageManagerInvocation(
    command,
    args,
    candidates,
    corepackCandidates,
    nodeCandidates
  )
  if (packageManagerInvocation) return packageManagerInvocation

  const executable = candidates.find((candidate) => candidate.toLowerCase().endsWith('.exe'))
  if (executable) return { command: executable, args: [...args] }

  const commandShims = candidates.filter((candidate) => candidate.toLowerCase().endsWith('.cmd'))
  for (const commandShim of commandShims) {
    const invocation = resolveWindowsNodeCommandShimInvocation(args, commandShim, nodeCandidates)
    if (invocation) return invocation
  }
  if (commandShims.length === 0) {
    throw new Error(`${command} resolved from PATH without an executable or command shim.`)
  }
  throw new Error(
    `${command} resolved only to ${commandShims[0]}. Opaque Windows command shims cannot preserve argv safely; install a native executable or configure an executable command.`
  )
}

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @returns {CommandInvocation}
 */
export function resolveCommandInvocation(command, args) {
  if (process.platform !== 'win32') return { command, args: [...args] }
  return resolveWindowsCommandInvocation(
    command,
    args,
    findWindowsCommandCandidates(command),
    command === 'pnpm' ? tryFindWindowsCommandCandidates('corepack') : [],
    tryFindWindowsCommandCandidates('node')
  )
}
