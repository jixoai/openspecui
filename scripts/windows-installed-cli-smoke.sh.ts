#!/usr/bin/env bun
/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Pack the already-built CLI and install the real tarball into an isolated Windows directory.
 * 2. Prove packaged CLI, App, Web, and native-icon artifacts exist after installation.
 * 3. Resolve the installed npm shim to a native Node argv boundary and verify daemon start/stop.
 * 4. Remove only the transaction-owned temporary root after every terminal outcome.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  resolveCommandInvocation,
  resolveWindowsCommandInvocation,
  type CommandInvocation,
} from './lib/command-invocation.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, '..')
const TEMP_PREFIX = 'openspecui-windows-installed-smoke-'

function execute(
  invocation: CommandInvocation,
  cwd: string,
  env: NodeJS.ProcessEnv,
  capture = false
): string {
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: 'utf8',
    env,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
  })
  if (result.error) throw result.error
  if ((result.status ?? 1) !== 0) {
    const stderr = capture ? result.stderr.trim() : ''
    throw new Error(stderr || `${invocation.command} exited with code ${result.status ?? 1}.`)
  }
  return capture ? result.stdout.trim() : ''
}

function executeCommand(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  capture = false
): string {
  return execute(resolveCommandInvocation(command, args), cwd, env, capture)
}

function installedInvocation(shim: string, args: readonly string[]): CommandInvocation {
  const node = resolveCommandInvocation('node', [])
  return resolveWindowsCommandInvocation('openspecui', args, [shim], [], [node.command])
}

async function assertBuiltArtifacts(): Promise<void> {
  await Promise.all(
    [
      join(REPOSITORY_ROOT, 'packages', 'cli', 'dist', 'cli.mjs'),
      join(REPOSITORY_ROOT, 'packages', 'cli', 'app', 'index.html'),
      join(REPOSITORY_ROOT, 'packages', 'cli', 'web', 'index.html'),
    ].map((path) => access(path))
  )
}

async function assertInstalledArtifacts(installRoot: string): Promise<string> {
  const packageRoot = join(installRoot, 'node_modules', 'openspecui')
  const shim = join(installRoot, 'node_modules', '.bin', 'openspecui.cmd')
  await Promise.all(
    [
      shim,
      join(packageRoot, 'dist', 'cli.mjs'),
      join(packageRoot, 'app', 'index.html'),
      join(packageRoot, 'web', 'index.html'),
      join(packageRoot, 'app', 'native-icons', 'app-icon', 'win32-light.ico'),
    ].map((path) => access(path))
  )
  return shim
}

async function removeOwnedTempRoot(root: string): Promise<void> {
  const resolvedTemp = resolve(tmpdir())
  const resolvedRoot = resolve(root)
  if (
    !resolvedRoot.startsWith(`${resolvedTemp}${sep}`) ||
    !basename(resolvedRoot).startsWith(TEMP_PREFIX)
  ) {
    throw new Error(`Refusing to remove non-owned smoke root: ${resolvedRoot}`)
  }
  await rm(resolvedRoot, { force: true, recursive: true })
}

async function runSmoke(root: string): Promise<void> {
  const packRoot = join(root, 'pack')
  const installRoot = join(root, 'install')
  const daemonHome = join(root, 'home')
  await Promise.all([
    mkdir(packRoot, { recursive: true }),
    mkdir(installRoot, { recursive: true }),
    mkdir(daemonHome, { recursive: true }),
  ])
  await assertBuiltArtifacts()

  executeCommand(
    'pnpm',
    ['--filter', 'openspecui', 'pack', '--pack-destination', packRoot],
    REPOSITORY_ROOT,
    process.env,
    true
  )
  const tarballs = (await readdir(packRoot)).filter((entry) => entry.endsWith('.tgz'))
  if (tarballs.length !== 1) {
    throw new Error(`Expected one packed CLI tarball, received ${tarballs.length}.`)
  }

  executeCommand('pnpm', ['init'], installRoot, process.env)
  executeCommand(
    'pnpm',
    ['add', '--ignore-workspace', '--offline', join(packRoot, tarballs[0]!)],
    installRoot,
    process.env
  )
  const shim = await assertInstalledArtifacts(installRoot)
  const runtimeEnv = { ...process.env, NO_COLOR: '1', OPENSPECUI_HOME: daemonHome }
  const version = execute(installedInvocation(shim, ['--version']), installRoot, runtimeEnv, true)
  if (version !== '7.0.1') throw new Error(`Installed CLI reported unexpected version ${version}.`)

  let startError: unknown
  try {
    execute(installedInvocation(shim, ['start', '--web']), installRoot, runtimeEnv)
  } catch (error) {
    startError = error
  } finally {
    try {
      execute(installedInvocation(shim, ['stop']), installRoot, runtimeEnv)
    } catch (stopError) {
      if (startError === undefined) startError = stopError
    }
  }
  if (startError !== undefined) throw startError
}

async function main(): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('The installed CLI smoke must run on Windows.')
  }
  const root = await mkdtemp(join(tmpdir(), TEMP_PREFIX))
  let smokeError: unknown
  try {
    await runSmoke(root)
  } catch (error) {
    smokeError = error
  }

  try {
    await removeOwnedTempRoot(root)
  } catch (cleanupError) {
    if (smokeError !== undefined) throw new AggregateError([smokeError, cleanupError])
    throw cleanupError
  }
  if (smokeError !== undefined) throw smokeError
  console.log('Installed Windows CLI pack/start/stop smoke passed.')
}

await main()
