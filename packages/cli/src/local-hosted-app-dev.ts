import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer as createNetServer } from 'node:net'
import { join, resolve } from 'node:path'

export const LOCAL_HOSTED_APP_DEV_DEFAULT_PORT = 13005

export interface LocalHostedAppWorkspace {
  repoRoot: string
  appDir: string
  webDistDir: string
}

export interface SpawnCommandConfig {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}

export interface LocalHostedAppDevSession {
  baseUrl: string
  close(): Promise<void>
}

export function resolveLocalHostedAppWorkspace(cliDir: string): LocalHostedAppWorkspace | null {
  const repoRoot = resolve(cliDir, '..', '..', '..')
  const rootPackageJson = join(repoRoot, 'package.json')
  const appPackageJson = join(repoRoot, 'packages', 'app', 'package.json')

  if (!existsSync(rootPackageJson) || !existsSync(appPackageJson)) {
    return null
  }

  return {
    repoRoot,
    appDir: join(repoRoot, 'packages', 'app'),
    webDistDir: join(repoRoot, 'packages', 'web', 'dist'),
  }
}

export function shouldUseLocalHostedAppDevMode(options: {
  appValue: string | undefined
  workspace: LocalHostedAppWorkspace | null
}): options is { appValue: ''; workspace: LocalHostedAppWorkspace } {
  return options.appValue === '' && options.workspace !== null
}

export function createHostedAppWebBuildCommand(
  workspace: LocalHostedAppWorkspace
): SpawnCommandConfig {
  return {
    command: resolvePnpmCommand(),
    args: ['--filter', '@openspecui/web', 'build'],
    cwd: workspace.repoRoot,
    env: { ...process.env },
  }
}

export function createLocalHostedAppDevCommand(options: {
  workspace: LocalHostedAppWorkspace
  port: number
  resolvedVersion: string
}): SpawnCommandConfig {
  return {
    command: resolvePnpmCommand(),
    args: [
      '--filter',
      '@openspecui/app',
      'exec',
      'vite',
      '--host',
      '127.0.0.1',
      '--port',
      String(options.port),
      '--strictPort',
    ],
    cwd: options.workspace.repoRoot,
    env: {
      ...process.env,
      OPENSPECUI_APP_DEV_MODE: '1',
      OPENSPECUI_APP_DEV_WEB_DIST: options.workspace.webDistDir,
      OPENSPECUI_APP_DEV_VERSION: options.resolvedVersion,
    },
  }
}

export async function startLocalHostedAppDev(options: {
  workspace: LocalHostedAppWorkspace
  resolvedVersion: string
  preferredPort?: number
  readinessTimeoutMs?: number
}): Promise<LocalHostedAppDevSession> {
  await ensureLocalHostedAppWebDist(options.workspace)

  const port = await findAvailablePort(options.preferredPort ?? LOCAL_HOSTED_APP_DEV_DEFAULT_PORT)
  const command = createLocalHostedAppDevCommand({
    workspace: options.workspace,
    port,
    resolvedVersion: options.resolvedVersion,
  })
  const child = spawn(command.command, command.args, {
    cwd: command.cwd,
    env: command.env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  })

  const baseUrl = `http://127.0.0.1:${port}`
  try {
    await waitForHostedAppDevReady({
      baseUrl,
      child,
      timeoutMs: options.readinessTimeoutMs ?? 15_000,
    })
  } catch (error) {
    await stopChildProcess(child)
    throw error
  }

  return {
    baseUrl,
    close: () => stopChildProcess(child),
  }
}

async function ensureLocalHostedAppWebDist(workspace: LocalHostedAppWorkspace): Promise<void> {
  const command = createHostedAppWebBuildCommand(workspace)
  console.log('🛠️  Building packages/web for local hosted app dev...')
  await runCommand(command)
}

function resolvePnpmCommand(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

async function runCommand(command: SpawnCommandConfig): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command.command, command.args, {
      cwd: command.cwd,
      env: command.env,
      stdio: 'inherit',
    })

    child.once('error', (error) => {
      rejectPromise(error)
    })
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(
        new Error(
          `Command failed: ${command.command} ${command.args.join(' ')} (${signal ? `signal ${signal}` : `exit ${code ?? 'unknown'}`})`
        )
      )
    })
  })
}

async function waitForHostedAppDevReady(options: {
  baseUrl: string
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
      throw new Error(`Local hosted app dev server exited before becoming ready (${exitMessage})`)
    }

    try {
      const response = await fetch(`${options.baseUrl}/version.json`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
      if (response.ok) {
        return
      }
    } catch {
      // The Vite dev server is still starting.
    }

    await delay(250)
  }

  throw new Error(`Timed out waiting for local hosted app dev server at ${options.baseUrl}`)
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

function killChildProcess(child: ChildProcess, signal: NodeJS.Signals): void {
  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall back to the direct child signal when process groups are unavailable.
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function isPortAvailable(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = createNetServer()
    server.once('error', () => {
      resolve(false)
    })
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })
}

async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = startPort + attempt
    if (await isPortAvailable(port)) {
      return port
    }
  }

  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`)
}
