import { findAvailablePort } from '@openspecui/server'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

import type { GitWorktreeHandoff } from '@openspecui/core'
import type { SpawnCommandConfig } from './local-hosted-app-dev'

const DEFAULT_CHILD_TIMEOUT_MS = 15_000
const DEFAULT_PORT_START = 3100
const DEFAULT_PORT_ATTEMPTS = 200

export interface LocalCliWorkspace {
  repoRoot: string
  cliPackageDir: string
}

export interface WorktreeInstanceManager {
  ensureWorktreeServer(input: { targetPath: string }): Promise<GitWorktreeHandoff>
  close(): Promise<void>
}

interface WorktreeInstanceManagerOptions {
  currentProjectDir: string
  currentServerUrl: string
  runtimeDir: string
  readinessTimeoutMs?: number
  preferredPortStart?: number
}

interface ManagedInstance {
  projectDir: string
  serverUrl: string
  child: ChildProcess
  lastUsedAt: number
}

export function resolveLocalCliWorkspace(runtimeDir: string): LocalCliWorkspace | null {
  const repoRoot = resolve(runtimeDir, '..', '..', '..')
  const rootPackageJson = join(repoRoot, 'package.json')
  const cliPackageJson = join(repoRoot, 'packages', 'cli', 'package.json')
  const cliSourceEntry = join(repoRoot, 'packages', 'cli', 'src', 'cli.ts')

  if (!existsSync(rootPackageJson) || !existsSync(cliPackageJson) || !existsSync(cliSourceEntry)) {
    return null
  }

  return {
    repoRoot,
    cliPackageDir: join(repoRoot, 'packages', 'cli'),
  }
}

function resolvePnpmCommand(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

export function createWorktreeServerCommand(options: {
  runtimeDir: string
  projectDir: string
  port: number
}): SpawnCommandConfig {
  const workspace = resolveLocalCliWorkspace(options.runtimeDir)
  if (workspace) {
    return {
      command: resolvePnpmCommand(),
      args: [
        '--filter',
        'openspecui',
        'run',
        'dev',
        '--dir',
        options.projectDir,
        '--port',
        String(options.port),
        '--no-open',
      ],
      cwd: workspace.repoRoot,
      env: { ...process.env },
    }
  }

  return {
    command: process.execPath,
    args: [
      join(options.runtimeDir, 'cli.mjs'),
      'start',
      options.projectDir,
      '--port',
      String(options.port),
      '--no-open',
    ],
    cwd: options.projectDir,
    env: { ...process.env },
  }
}

async function waitForServerReady(options: {
  serverUrl: string
  projectDir: string
  child: ChildProcess
  timeoutMs: number
}): Promise<void> {
  let exitMessage: string | null = null
  let startupError: Error | null = null

  options.child.once('error', (error) => {
    startupError = error
  })
  options.child.once('exit', (code, signal) => {
    exitMessage = signal ? `signal ${signal}` : `exit ${code ?? 'unknown'}`
  })

  const deadline = Date.now() + options.timeoutMs
  while (Date.now() < deadline) {
    if (startupError) {
      throw startupError
    }
    if (exitMessage) {
      throw new Error(`Worktree server exited before becoming ready (${exitMessage})`)
    }

    try {
      const response = await fetch(`${options.serverUrl}/api/health`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
      if (response.ok) {
        const payload = (await response.json()) as { projectDir?: unknown }
        if (payload.projectDir === options.projectDir) {
          return
        }
      }
    } catch {
      // Server is still starting.
    }

    await delay(250)
  }

  throw new Error(`Timed out waiting for worktree server at ${options.serverUrl}`)
}

async function isHealthyInstance(instance: ManagedInstance): Promise<boolean> {
  try {
    const response = await fetch(`${instance.serverUrl}/api/health`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) return false
    const payload = (await response.json()) as { projectDir?: unknown }
    return payload.projectDir === instance.projectDir
  } catch {
    return false
  }
}

function killChildProcess(child: ChildProcess, signal: NodeJS.Signals): void {
  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall back to direct child signal if the process group no longer exists.
    }
  }

  child.kill(signal)
}

function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      cleanup()
      resolvePromise(false)
    }, timeoutMs)

    const onExit = () => {
      cleanup()
      resolvePromise(true)
    }

    const cleanup = () => {
      clearTimeout(timer)
      child.off('exit', onExit)
    }

    child.once('exit', onExit)
  })
}

async function stopChildProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }

  killChildProcess(child, 'SIGTERM')
  const exited = await waitForChildExit(child, 5_000)
  if (exited) {
    return
  }

  killChildProcess(child, 'SIGKILL')
  await waitForChildExit(child, 1_000)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms)
  })
}

export function createWorktreeInstanceManager(
  options: WorktreeInstanceManagerOptions
): WorktreeInstanceManager {
  const currentProjectDir = resolve(options.currentProjectDir)
  const instances = new Map<string, ManagedInstance>()
  const pending = new Map<string, Promise<GitWorktreeHandoff>>()

  const ensureWorktreeServer = async (input: {
    targetPath: string
  }): Promise<GitWorktreeHandoff> => {
    const targetPath = resolve(input.targetPath)
    if (targetPath === currentProjectDir) {
      return {
        projectDir: currentProjectDir,
        serverUrl: options.currentServerUrl,
      }
    }

    const existing = instances.get(targetPath)
    if (existing && (await isHealthyInstance(existing))) {
      existing.lastUsedAt = Date.now()
      return {
        projectDir: existing.projectDir,
        serverUrl: existing.serverUrl,
      }
    }

    if (existing) {
      instances.delete(targetPath)
      await stopChildProcess(existing.child)
    }

    const pendingInstance = pending.get(targetPath)
    if (pendingInstance) {
      return pendingInstance
    }

    const promise = (async (): Promise<GitWorktreeHandoff> => {
      const port = await findAvailablePort(
        options.preferredPortStart ?? DEFAULT_PORT_START,
        DEFAULT_PORT_ATTEMPTS
      )
      const command = createWorktreeServerCommand({
        runtimeDir: options.runtimeDir,
        projectDir: targetPath,
        port,
      })
      const child = spawn(command.command, command.args, {
        cwd: command.cwd,
        env: command.env,
        stdio: 'inherit',
        detached: process.platform !== 'win32',
      })
      const serverUrl = `http://localhost:${port}`

      try {
        await waitForServerReady({
          serverUrl,
          projectDir: targetPath,
          child,
          timeoutMs: options.readinessTimeoutMs ?? DEFAULT_CHILD_TIMEOUT_MS,
        })
      } catch (error) {
        await stopChildProcess(child)
        throw error
      }

      const instance: ManagedInstance = {
        projectDir: targetPath,
        serverUrl,
        child,
        lastUsedAt: Date.now(),
      }
      instances.set(targetPath, instance)
      child.once('exit', () => {
        const current = instances.get(targetPath)
        if (current?.child === child) {
          instances.delete(targetPath)
        }
      })

      return {
        projectDir: targetPath,
        serverUrl,
      }
    })()

    pending.set(targetPath, promise)
    try {
      return await promise
    } finally {
      pending.delete(targetPath)
    }
  }

  const close = async (): Promise<void> => {
    await Promise.all(
      [...instances.values()].map(async (instance) => {
        instances.delete(instance.projectDir)
        await stopChildProcess(instance.child)
      })
    )
  }

  return {
    ensureWorktreeServer,
    close,
  }
}
