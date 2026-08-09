/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Resolve standard Windows npm-style Node command shims to argv-safe JavaScript entries.
 * 2. Route pnpm arguments requiring shell-sensitive characters through a native Corepack boundary.
 * 3. Resolve the Node executable independently from a Bun host's `process.execPath`.
 *
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import process from 'node:process'

const PACKAGE_MANAGER_ENTRY_NAMES = {
  npm: new Set(['npm-cli.js']),
  pnpm: new Set(['pnpm.cjs', 'pnpm.js', 'pnpm.mjs']),
}

/**
 * @param {'npm' | 'pnpm'} command
 * @param {string} commandShim
 * @returns {string | null}
 */
function resolveNodeJavaScriptEntry(commandShim) {
  const source = readFileSync(commandShim, 'utf8')
  if (!/(?:node(?:\.exe)?|node_exe|npm_node_execpath|_prog)/i.test(source)) return null
  const entries = []
  const matches = source.matchAll(/%~dp0([^"\r\n]*?\.(?:c|m)?js)/gi)
  for (const match of matches) {
    const relativeEntry = match[1]?.trim().replace(/^[/\\]+/, '')
    if (!relativeEntry) continue
    const entry = resolve(dirname(commandShim), relativeEntry)
    if (existsSync(entry)) entries.push(entry)
  }
  return entries.at(-1) ?? null
}

/**
 * @param {string} commandShim
 * @param {readonly string[]} nodeCandidates
 * @returns {string | null}
 */
function resolveNodeExecutable(commandShim, nodeCandidates) {
  const siblingExecutable = resolve(dirname(commandShim), 'node.exe')
  if (existsSync(siblingExecutable)) return siblingExecutable
  if (basename(process.execPath).toLowerCase() === 'node.exe') return process.execPath
  return (
    nodeCandidates.find((candidate) => basename(candidate).toLowerCase() === 'node.exe') ?? null
  )
}

/**
 * Resolve one standard npm-generated Node command shim without passing argv through cmd.exe.
 * @param {readonly string[]} args
 * @param {string} commandShim
 * @param {readonly string[]} [nodeCandidates]
 * @returns {{ args: string[], command: string } | null}
 */
export function resolveWindowsNodeCommandShimInvocation(args, commandShim, nodeCandidates = []) {
  const entry = resolveNodeJavaScriptEntry(commandShim)
  if (!entry) return null
  const nodeExecutable = resolveNodeExecutable(commandShim, nodeCandidates)
  return nodeExecutable ? { command: nodeExecutable, args: [entry, ...args] } : null
}

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @param {string} commandShim
 * @param {readonly string[]} [nodeCandidates]
 * @returns {{ args: string[], command: string } | null}
 */
export function resolveWindowsPackageManagerShimInvocation(
  command,
  args,
  commandShim,
  nodeCandidates = []
) {
  if (command !== 'npm' && command !== 'pnpm') return null

  const siblingExecutable = commandShim.replace(/\.cmd$/i, '.exe')
  if (existsSync(siblingExecutable)) {
    return { command: siblingExecutable, args: [...args] }
  }

  const invocation = resolveWindowsNodeCommandShimInvocation(args, commandShim, nodeCandidates)
  const entry = invocation?.args[0]
  if (!entry || !PACKAGE_MANAGER_ENTRY_NAMES[command].has(basename(entry))) return null
  return invocation
}

/** @param {readonly string[]} args */
function requiresShellIndependentInvocation(args) {
  return args.some((argument) => /[%^&|<>"]/.test(argument) || argument.endsWith('\\'))
}

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @param {readonly string[]} candidates
 * @param {readonly string[]} corepackCandidates
 * @param {readonly string[]} nodeCandidates
 * @returns {{ args: string[], command: string } | null}
 */
export function resolveWindowsPackageManagerInvocation(
  command,
  args,
  candidates,
  corepackCandidates,
  nodeCandidates
) {
  if (command !== 'npm' && command !== 'pnpm') return null

  if (requiresShellIndependentInvocation(args)) {
    if (command === 'pnpm') {
      const corepackExecutable = corepackCandidates.find((candidate) =>
        candidate.toLowerCase().endsWith('.exe')
      )
      if (!corepackExecutable) return null
      return { command: corepackExecutable, args: ['pnpm', ...args] }
    }

    for (const commandShim of candidates.filter((candidate) =>
      candidate.toLowerCase().endsWith('.cmd')
    )) {
      const invocation = resolveWindowsPackageManagerShimInvocation(
        command,
        args,
        commandShim,
        nodeCandidates
      )
      if (invocation) return invocation
    }
    return null
  }

  const executable = candidates.find((candidate) => candidate.toLowerCase().endsWith('.exe'))
  if (executable) return { command: executable, args: [...args] }

  for (const commandShim of candidates.filter((candidate) =>
    candidate.toLowerCase().endsWith('.cmd')
  )) {
    const invocation = resolveWindowsPackageManagerShimInvocation(
      command,
      args,
      commandShim,
      nodeCandidates
    )
    if (invocation) return invocation
  }
  return null
}
