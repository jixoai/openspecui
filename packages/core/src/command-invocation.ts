/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Resolve caller-environment Windows commands to native argv-preserving executable boundaries.
 * 2. Project standard npm-style shims and explicit Node shebang launchers onto their real Node executable.
 * 3. Prefer native executables, route shell-sensitive pnpm through Corepack, and reject opaque command shims.
 * 4. Extract modern (`%dp0%`) and legacy (`%~dp0`) npm shim entries under hardened containment
 *    that admits only real files inside the shim directory or its `.bin` parent.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 * Original request (2026-08-28, issue #258): "No available OpenSpec CLI runner." — npm ≥7 `cmd-shim`
 *   references its entry through the `%dp0%` variable, which the legacy-only extractor missed.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, statSync, type Stats } from 'node:fs'
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'

export interface CommandInvocation {
  readonly args: string[]
  readonly command: string
}

export interface CommandInvocationOptions {
  readonly cwd?: string
  readonly env?: NodeJS.ProcessEnv
}

const WINDOWS_NATIVE_EXTENSIONS = new Set(['.com', '.exe'])

function isBareCommand(command: string): boolean {
  return !/[\\/]/.test(command)
}

function commandName(command: string): string {
  return basename(command, extname(command)).toLowerCase()
}

function requiresShellIndependentInvocation(args: readonly string[]): boolean {
  return args.some((argument) => /[%^&|<>"]/.test(argument) || argument.endsWith('\\'))
}

function systemExecutable(name: string, env: NodeJS.ProcessEnv): string {
  const systemRoot = env.SystemRoot ?? env.SYSTEMROOT ?? process.env.SystemRoot ?? 'C:\\Windows'
  return resolve(systemRoot, 'System32', name)
}

function findWindowsCommandCandidates(
  command: string,
  options: CommandInvocationOptions
): string[] {
  const env = options.env ?? process.env
  const result = spawnSync(systemExecutable('where.exe', env), [command], {
    cwd: options.cwd,
    encoding: 'utf8',
    env,
    windowsHide: true,
  })
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

function tryFindWindowsCommandCandidates(
  command: string,
  options: CommandInvocationOptions
): string[] {
  try {
    return findWindowsCommandCandidates(command, options)
  } catch {
    return []
  }
}

function explicitCommandCandidates(command: string, cwd: string): string[] {
  const absolute = isAbsolute(command) ? command : resolve(cwd, command)
  if (extname(absolute)) return [absolute]
  return [`${absolute}.exe`, `${absolute}.cmd`, absolute].filter(existsSync)
}

function commandCandidates(command: string, options: CommandInvocationOptions): string[] {
  if (isBareCommand(command)) return findWindowsCommandCandidates(command, options)
  return explicitCommandCandidates(command, options.cwd ?? process.cwd())
}

function findNativeExecutable(candidates: readonly string[]): string | null {
  return (
    candidates.find((candidate) =>
      WINDOWS_NATIVE_EXTENSIONS.has(extname(candidate).toLowerCase())
    ) ?? null
  )
}

function findNodeExecutable(commandShim: string, options: CommandInvocationOptions): string {
  const siblingNode = resolve(dirname(commandShim), 'node.exe')
  if (existsSync(siblingNode)) return siblingNode

  const fromPath = findNativeExecutable(findWindowsCommandCandidates('node', options))
  if (fromPath) return fromPath
  if (process.release.name === 'node' && extname(process.execPath).toLowerCase() === '.exe') {
    return process.execPath
  }
  throw new Error(`Unable to resolve the Node executable required by ${commandShim}.`)
}

const NODE_COMMAND_SHIM_GUARD_PATTERN = /(?:node(?:\.exe)?|node_exe|npm_node_execpath|_prog)/i

/**
 * npm shim generations reference their entry relative to the shim directory through two shapes:
 * the legacy literal `%~dp0\path\entry.js` and the modern (cmd-shim v4+, npm ≥7) variable form
 * `SET dp0=%~dp0` … `"%dp0%\path\entry.js"`.
 */
const NODE_COMMAND_SHIM_ENTRY_PATTERN = /%(?:~dp0|dp0%)([^"\r\n]*?\.(?:c|m)?js)/gi

/** Raw dp0-relative JavaScript entry references found in one npm-style command shim. */
export function extractNodeCommandShimEntryTokens(source: string): string[] {
  const tokens: string[] = []
  for (const match of source.matchAll(NODE_COMMAND_SHIM_ENTRY_PATTERN)) {
    const rawToken = match[1]?.trim() ?? ''
    // Reject the UNC prefix before stripping leading separators: `\\server\share\x.js` must
    // never degrade into the local relative path `server\share\x.js`.
    if (rawToken.startsWith('\\\\') || rawToken.startsWith('//')) continue
    const token = rawToken.replace(/^[/\\]+/, '')
    if (token) tokens.push(token)
  }
  return tokens
}

function isContainableShimEntryToken(token: string, normalizedToken: string): boolean {
  if (!token) return false
  if (token.includes('\0')) return false
  if (/^[a-zA-Z]:/.test(normalizedToken)) return false // drive-letter absolute path
  if (token.startsWith('\\\\') || normalizedToken.startsWith('//')) return false // UNC path
  return !token.includes('%') // unresolved cmd.exe variable reference
}

function isWithinDirectory(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate)
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

function resolveExistingShimEntry(commandShim: string, token: string): string | null {
  const normalizedToken = token.replace(/\\/g, '/')
  if (!isContainableShimEntryToken(token, normalizedToken)) return null
  const entry = resolve(dirname(commandShim), normalizedToken)
  let realEntry: string
  let realShimDirectory: string
  try {
    realEntry = realpathSync.native(entry)
    realShimDirectory = dirname(realpathSync.native(commandShim))
  } catch {
    return null
  }
  let stats: Stats
  try {
    stats = statSync(realEntry)
  } catch {
    return null
  }
  if (!stats.isFile()) return null
  // Standard npm layouts are the global prefix (shim beside its node_modules: entry inside the
  // shim directory) and local installs (shim in node_modules/.bin: entry inside .bin's parent).
  // Anything else fails closed to the explicit opaque-shim rejection.
  const realShimParent = dirname(realShimDirectory)
  const withinShimDirectory = isWithinDirectory(realShimDirectory, realEntry)
  const withinDotBinParent =
    basename(realShimDirectory).toLowerCase() === '.bin' &&
    isWithinDirectory(realShimParent, realEntry)
  if (!withinShimDirectory && !withinDotBinParent) return null
  return realEntry
}

/**
 * Resolve the JavaScript entry one standard npm-style Node command shim delegates to, or null
 * when no dp0-relative entry survives containment validation.
 */
export function resolveNodeCommandShimEntry(commandShim: string, source: string): string | null {
  const tokens = extractNodeCommandShimEntryTokens(source)
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const entry = resolveExistingShimEntry(commandShim, tokens[index] ?? '')
    if (entry) return entry
  }
  return null
}

function resolveNodeCommandShim(
  commandShim: string,
  args: readonly string[],
  options: CommandInvocationOptions
): CommandInvocation | null {
  const source = readFileSync(commandShim, 'utf8')
  if (!NODE_COMMAND_SHIM_GUARD_PATTERN.test(source)) return null

  const entry = resolveNodeCommandShimEntry(commandShim, source)
  if (!entry) return null
  return {
    command: findNodeExecutable(commandShim, options),
    args: [entry, ...args],
  }
}

function resolveCommandShim(
  candidates: readonly string[],
  args: readonly string[],
  options: CommandInvocationOptions
): CommandInvocation | null {
  for (const candidate of candidates) {
    if (extname(candidate).toLowerCase() !== '.cmd') continue
    const invocation = resolveNodeCommandShim(candidate, args, options)
    if (invocation) return invocation
  }
  return null
}

function resolveNodeShebangInvocation(
  candidates: readonly string[],
  args: readonly string[],
  options: CommandInvocationOptions
): CommandInvocation | null {
  for (const candidate of candidates) {
    if (!existsSync(candidate) || extname(candidate).toLowerCase() === '.cmd') continue
    const firstLine = readFileSync(candidate, 'utf8').split(/\r?\n/, 1)[0]?.trim() ?? ''
    if (!/^#!.*(?:\/|\s)node(?:\.exe)?(?:\s|$)/i.test(firstLine)) continue
    return {
      command: findNodeExecutable(candidate, options),
      args: [candidate, ...args],
    }
  }
  return null
}

/** Resolve one Windows command without projecting argv through cmd.exe. */
export function resolveWindowsCommandInvocation(
  command: string,
  args: readonly string[],
  options: CommandInvocationOptions = {}
): CommandInvocation {
  const candidates = commandCandidates(command, options)
  const name = commandName(command)
  const shellSensitive = requiresShellIndependentInvocation(args)

  if (name === 'pnpm' && shellSensitive) {
    const corepack = findNativeExecutable(tryFindWindowsCommandCandidates('corepack', options))
    if (corepack) return { command: corepack, args: ['pnpm', ...args] }
  }

  if (name === 'npm' && shellSensitive) {
    const shimInvocation = resolveCommandShim(candidates, args, options)
    if (shimInvocation) return shimInvocation
  }

  const executable = findNativeExecutable(candidates)
  if (executable) return { command: executable, args: [...args] }

  const shimInvocation = resolveCommandShim(candidates, args, options)
  if (shimInvocation) return shimInvocation

  const shebangInvocation = resolveNodeShebangInvocation(candidates, args, options)
  if (shebangInvocation) return shebangInvocation

  const commandShim = candidates.find((candidate) => extname(candidate).toLowerCase() === '.cmd')
  if (commandShim) {
    throw new Error(
      `${commandShim} is an opaque Windows command shim; refusing to reinterpret argv through cmd.exe.`
    )
  }
  throw new Error(`${command} did not resolve to a native Windows executable or Node command shim.`)
}

/** Resolve one command using the caller's cwd and environment while preserving POSIX behavior. */
export function resolveCommandInvocation(
  command: string,
  args: readonly string[],
  options: CommandInvocationOptions = {}
): CommandInvocation {
  if (process.platform !== 'win32') return { command, args: [...args] }
  return resolveWindowsCommandInvocation(command, args, options)
}
