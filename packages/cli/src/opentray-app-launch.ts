/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Project source and packaged CLI runtimes into one shell-free OpenTray cold-launch vector.
 * 2. Persist the public daemon lifecycle entry instead of the private detached bootstrap state.
 * 3. Reconstruct source package resolution while excluding transient Node process flags.
 *
 * Owner correction (2026-07-30): appMode must follow the complete skill-creator-v2/OpenTray lifecycle contract.
 */
import { basename, dirname, isAbsolute } from 'node:path'
import type { OpenTrayAppLaunchOptions } from 'opentray'

const SOURCE_LOADER_FLAGS = new Set([
  '--import',
  '--loader',
  '--experimental-loader',
  '--require',
  '-r',
])
const SOURCE_LOADER_PREFIXES = ['--import=', '--loader=', '--experimental-loader=', '--require=']

function selectSourceRuntimeArgs(execArgv: readonly string[]): string[] {
  const selected = ['--conditions=development']
  for (let index = 0; index < execArgv.length; index += 1) {
    const argument = execArgv[index]
    if (SOURCE_LOADER_FLAGS.has(argument)) {
      const value = execArgv[index + 1]
      if (value !== undefined) {
        selected.push(argument, value)
        index += 1
      }
      continue
    }
    if (SOURCE_LOADER_PREFIXES.some((prefix) => argument.startsWith(prefix))) {
      selected.push(argument)
    }
  }
  return selected
}

/** Resolve the durable public CLI command used by a later macOS Dock cold launch. */
export function resolveOpenTrayAppLaunch(options: {
  entryPath: string
  execArgv: readonly string[]
  execPath: string
  runtimeDir: string
}): OpenTrayAppLaunchOptions {
  if (!isAbsolute(options.execPath) || !isAbsolute(options.entryPath)) {
    throw new Error('OpenTray App launch requires absolute executable and CLI entry paths.')
  }
  if (!isAbsolute(options.runtimeDir)) {
    throw new Error('OpenTray App launch requires an absolute CLI runtime directory.')
  }

  const sourceRuntime = basename(options.runtimeDir) === 'src'
  return {
    command: options.execPath,
    args: [
      ...(sourceRuntime ? selectSourceRuntimeArgs(options.execArgv) : []),
      options.entryPath,
      'start',
    ],
    cwd: dirname(options.runtimeDir),
  }
}
