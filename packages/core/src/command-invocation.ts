/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Resolve caller-environment Windows commands to native argv-preserving executable boundaries.
 * 2. Project standard npm-style shims and explicit Node shebang launchers onto their real Node executable.
 * 3. Prefer native executables, route shell-sensitive pnpm through Corepack, and reject opaque command shims.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path'
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
    throw new Error(result.stderr.trim() || `Unable to resolve ${command} from PATH.`)
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

function resolveNodeCommandShim(
  commandShim: string,
  args: readonly string[],
  options: CommandInvocationOptions
): CommandInvocation | null {
  const source = readFileSync(commandShim, 'utf8')
  if (!/(?:node(?:\.exe)?|node_exe|npm_node_execpath|_prog)/i.test(source)) return null

  const entries: string[] = []
  for (const match of source.matchAll(/%~dp0([^"\r\n]*?\.(?:c|m)?js)/gi)) {
    const relativeEntry = match[1]?.trim().replace(/^[\\/]+/, '')
    if (!relativeEntry) continue
    const entry = resolve(dirname(commandShim), relativeEntry)
    if (existsSync(entry)) entries.push(entry)
  }
  const entry = entries.at(-1)
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
