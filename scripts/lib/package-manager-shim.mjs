/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Resolve standard Windows npm-style Node command shims to argv-safe JavaScript entries.
 * 2. Route pnpm arguments requiring shell-sensitive characters through a native Corepack boundary.
 * 3. Resolve the Node executable independently from a Bun host's `process.execPath`.
 * 4. Extract modern (`%dp0%`) and legacy (`%~dp0`) shim entries under hardened containment that
 *    admits only real files inside the shim directory or its `.bin` parent.
 *
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 * Original request (2026-08-28, issue #258): "No available OpenSpec CLI runner." — mirror of the
 *   packages/core fix so release smoke and diagnostics parse modern npm shims identically.
 */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'

const PACKAGE_MANAGER_ENTRY_NAMES = {
  npm: new Set(['npm-cli.js']),
  pnpm: new Set(['pnpm.cjs', 'pnpm.js', 'pnpm.mjs']),
}

const NODE_COMMAND_SHIM_GUARD_PATTERN = /(?:node(?:\.exe)?|node_exe|npm_node_execpath|_prog)/i

/**
 * npm shim generations reference their entry relative to the shim directory through two shapes:
 * the legacy literal `%~dp0\path\entry.js` and the modern (cmd-shim v4+, npm ≥7) variable form
 * `SET dp0=%~dp0` … `"%dp0%\path\entry.js"`.
 */
const NODE_COMMAND_SHIM_ENTRY_PATTERN = /%(?:~dp0|dp0%)([^"\r\n]*?\.(?:c|m)?js)/gi

/** Raw dp0-relative JavaScript entry references found in one npm-style command shim. */
export function extractNodeCommandShimEntryTokens(source) {
  const tokens = []
  for (const match of source.matchAll(NODE_COMMAND_SHIM_ENTRY_PATTERN)) {
    const token = match[1]?.trim().replace(/^[/\\]+/, '')
    if (token) tokens.push(token)
  }
  return tokens
}

function isContainableShimEntryToken(token, normalizedToken) {
  if (!token) return false
  if (token.includes('\0')) return false
  if (/^[a-zA-Z]:/.test(normalizedToken)) return false // drive-letter absolute path
  if (token.startsWith('\\\\') || normalizedToken.startsWith('//')) return false // UNC path
  return !token.includes('%') // unresolved cmd.exe variable reference
}

function isWithinDirectory(root, candidate) {
  const relativePath = relative(root, candidate)
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

function resolveExistingShimEntry(commandShim, token) {
  const normalizedToken = token.replace(/\\/g, '/')
  if (!isContainableShimEntryToken(token, normalizedToken)) return null
  const entry = resolve(dirname(commandShim), normalizedToken)
  let realEntry
  let realShimDirectory
  try {
    realEntry = realpathSync.native(entry)
    realShimDirectory = dirname(realpathSync.native(commandShim))
  } catch {
    return null
  }
  let stats
  try {
    stats = statSync(realEntry)
  } catch {
    return null
  }
  if (!stats.isFile()) return null
  // Standard npm layouts are the global prefix (entry inside the shim directory) and local
  // installs (shim in node_modules/.bin: entry inside .bin's parent). Anything else fails closed.
  const realShimParent = dirname(realShimDirectory)
  const withinShimDirectory = isWithinDirectory(realShimDirectory, realEntry)
  const withinDotBinParent =
    basename(realShimDirectory).toLowerCase() === '.bin' &&
    isWithinDirectory(realShimParent, realEntry)
  if (!withinShimDirectory && !withinDotBinParent) return null
  return realEntry
}

/** Resolve the JavaScript entry one standard npm-style Node command shim delegates to. */
export function resolveNodeCommandShimEntry(commandShim, source) {
  const tokens = extractNodeCommandShimEntryTokens(source)
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const entry = resolveExistingShimEntry(commandShim, tokens[index] ?? '')
    if (entry) return entry
  }
  return null
}

/**
 * @param {string} commandShim
 * @returns {string | null}
 */
function resolveNodeJavaScriptEntry(commandShim) {
  const source = readFileSync(commandShim, 'utf8')
  if (!NODE_COMMAND_SHIM_GUARD_PATTERN.test(source)) return null
  return resolveNodeCommandShimEntry(commandShim, source)
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
