/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Bootstrap the detached App daemon from explicit environment-owned startup evidence and freeze its OpenSpec execution mode.
 * 2. Compose local App HTTP, presentation host, and IPC lifecycle in teardown order.
 * 3. Own local-directory project children through the managed daemon control boundary.
 * 4. Project source or packaged CLI execution into the public native cold-launch lifecycle.
 * 5. Enable native DevTools only for the source CLI development runtime.
 *
 * Original request (2026-07-29): "多次执行 openspecui --app 只是在激活同一个 daemon。"
 * Owner correction (2026-07-30): "pnpm openspecui这种开发模式下，应该要启动 opentray 的 devtools。"
 * Owner correction (2026-07-30): appMode must include the durable `openspecui start` cold-launch vector.
 * Owner acceptance (2026-07-31): Worker is the default buffered OpenSpec execution mode.
 */
import { resolveOpenSpecSpawnMode } from '@openspecui/core'
import type { AppDaemonWorkspaceBinding } from '@openspecui/core/app-daemon-control'
import { execFile } from 'node:child_process'
import { basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { resolveAppAssetsDir } from './app-assets.js'
import { resolveDaemonPaths } from './daemon-paths.js'
import { DaemonHostModeSchema, type DaemonHostMode } from './daemon-protocol.js'
import { startDaemonServer, type RunningDaemonServer } from './daemon-server.js'
import type { CLIOptions, RunningServer } from './index.js'
import { startLocalAppServer } from './local-app-server.js'
import { createManagedProjectOwner } from './managed-project-owner.js'
import {
  adaptOwnerToManagedControl,
  canonicalizeProjectDirectory,
  createManagedRegistrar,
  createProductionManagedSpawner,
} from './managed-project-production.js'
import { resolveOpenTrayAppLaunch } from './opentray-app-launch.js'
import {
  createOpenTrayDaemonPresenter,
  type DaemonPresenterDiagnostic,
  type OpenTrayDaemonPresenterResolution,
} from './opentray-daemon-presenter.js'
import { readCliPackageVersion } from './package-version.js'

export const DAEMON_RUN_ENV = 'OPENSPECUI_INTERNAL_DAEMON_RUN'
export const DAEMON_HOST_MODE_ENV = 'OPENSPECUI_INTERNAL_DAEMON_HOST_MODE'
export const DAEMON_RESTORE_PROJECTS_ENV = 'OPENSPECUI_INTERNAL_DAEMON_RESTORE_PROJECTS'
const execFileAsync = promisify(execFile)

/** Consume credential-free canonical directories transferred only across an explicit daemon restart. */
export function consumeDaemonRestoreProjects(env: NodeJS.ProcessEnv): string[] {
  const raw = env[DAEMON_RESTORE_PROJECTS_ENV]
  delete env[DAEMON_RESTORE_PROJECTS_ENV]
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      : []
  } catch {
    return []
  }
}

function githubSlugFromRemote(remoteUrl: string): string | null {
  const match = remoteUrl.match(/github\.com(?::|\/)([^/]+)\/([^/]+?)(?:\.git)?$/i)
  return match?.[1] && match[2] ? `${match[1]}/${match[2]}` : null
}

async function inspectManagedProjectGit(
  projectDir: string
): Promise<AppDaemonWorkspaceBinding['git']> {
  const read = async (args: string[]): Promise<string | null> => {
    try {
      const result = await execFileAsync('git', ['-C', projectDir, ...args], {
        encoding: 'utf8',
        timeout: 3_000,
      })
      return result.stdout.trim() || null
    } catch {
      return null
    }
  }
  const [remoteUrl, branch] = await Promise.all([
    read(['remote', 'get-url', 'origin']),
    read(['branch', '--show-current']),
  ])
  if (!remoteUrl && !branch) return null
  return { remoteUrl, branch, githubSlug: remoteUrl ? githubSlugFromRemote(remoteUrl) : null }
}

/** Distinguish the source CLI launched by `pnpm openspecui` from a packaged CLI runtime. */
export function isDevelopmentCliRuntime(runtimeDir: string): boolean {
  return basename(runtimeDir) === 'src'
}

/** Detect and consume the private detached-daemon bootstrap marker. */
export function consumeDaemonBootstrap(env: NodeJS.ProcessEnv): DaemonHostMode | null {
  const shouldRun = env[DAEMON_RUN_ENV] === '1'
  const hostMode = env[DAEMON_HOST_MODE_ENV]
  delete env[DAEMON_RUN_ENV]
  delete env[DAEMON_HOST_MODE_ENV]
  if (!shouldRun) return null
  return DaemonHostModeSchema.parse(hostMode)
}

/** Run one detached daemon until IPC stop or a process termination signal. */
export async function runDaemonProcess(options: {
  entryPath?: string
  execArgv?: readonly string[]
  execPath?: string
  hostMode: DaemonHostMode
  runtimeDir?: string
  restoreProjectDirs?: readonly string[]
  startProjectServer: (options: CLIOptions) => Promise<RunningServer>
  openExternalUrl?: (target: string) => Promise<unknown>
}): Promise<void> {
  const openSpecSpawnMode = resolveOpenSpecSpawnMode()
  const runtimeDir = options.runtimeDir ?? dirname(fileURLToPath(import.meta.url))
  const appLaunch = resolveOpenTrayAppLaunch({
    entryPath: options.entryPath ?? process.argv[1] ?? fileURLToPath(import.meta.url),
    execArgv: options.execArgv ?? process.execArgv,
    execPath: options.execPath ?? process.execPath,
    runtimeDir,
  })
  const paths = resolveDaemonPaths()
  const assetsDir = await resolveAppAssetsDir(runtimeDir)
  let server: RunningDaemonServer | null = null
  const appServer = await startLocalAppServer({
    assetsDir,
    openWorkspaceInBrowser: async (workspaceId) =>
      server?.openWorkspaceInBrowser(workspaceId) ?? 'not-found',
    startManagedProject: async (projectDir) => {
      const result = await server?.startManagedProject(projectDir)
      if (!result) {
        return {
          ok: false,
          error: { code: 'UNSUPPORTED', message: 'OpenSpecUI App daemon is unavailable.' },
        }
      }
      if (!result.ok) {
        const code =
          result.code === 'MANAGED_PROJECT_INVALID_DIRECTORY'
            ? 'INVALID_DIRECTORY'
            : result.code === 'MANAGED_PROJECT_GENERATION_MISMATCH'
              ? 'GENERATION_MISMATCH'
              : result.code === 'MANAGED_PROJECT_REMOTE_CALLER'
                ? 'UNSUPPORTED'
                : 'SPAWN_FAILED'
        return { ok: false, error: { code, message: result.message } }
      }
      const workspace = server?.resolveManagedWorkspace(result.startup.generation)
      if (!workspace) {
        return {
          ok: false,
          error: { code: 'SPAWN_FAILED', message: 'Managed Workspace admission did not settle.' },
        }
      }
      return { ok: true, workspace, alreadyRunning: result.alreadyRunning }
    },
    stopManagedProject: async (generation) => {
      const result = await server?.stopManagedProject(generation)
      if (!result) {
        return {
          ok: false,
          error: { code: 'UNSUPPORTED', message: 'OpenSpecUI App daemon is unavailable.' },
        }
      }
      if (result.ok) return { ok: true, generation: result.generation }
      return {
        ok: false,
        error: {
          code:
            result.code === 'MANAGED_PROJECT_REMOTE_CALLER' ? 'UNSUPPORTED' : 'GENERATION_MISMATCH',
          message: result.message,
        },
      }
    },
  })
  const openExternalUrl =
    options.openExternalUrl ??
    (async (target: string) => {
      const open = await import('open')
      await open.default(target)
    })
  const version = readCliPackageVersion(runtimeDir)
  const reportDiagnostic = (diagnostic: DaemonPresenterDiagnostic) => {
    process.stderr.write(
      `[OpenSpecUI App] ${diagnostic.code} (${diagnostic.stage}): ${diagnostic.message}\n`
    )
  }
  let presentation: OpenTrayDaemonPresenterResolution
  try {
    presentation = await createOpenTrayDaemonPresenter({
      appAssetsDir: assetsDir,
      appLaunch,
      appServer,
      requestedHostMode: options.hostMode,
      version,
      openExternalUrl,
      onStopRequested: () => void server?.close(),
      reportDiagnostic,
      enableDevtools: isDevelopmentCliRuntime(runtimeDir),
    })
  } catch (error) {
    await appServer.close()
    throw error
  }
  try {
    let nextGeneration = 0
    const { spawner } = createProductionManagedSpawner({
      startServer: async ({ projectDir, webAssetsDir }) => {
        let credential: string | null = null
        const running = await options.startProjectServer({
          projectDir,
          port: 0,
          open: false,
          auth: true,
          corsOrigins: [appServer.url, 'http://localhost:5173', 'http://localhost:3000'],
          ...(webAssetsDir ? { webAssetsDir } : {}),
          onBrowserLaunchCredential: (value) => {
            credential = value
          },
        })
        return { url: running.url, credential, close: running.close }
      },
      nextGeneration: () => ++nextGeneration,
    })
    const registrar = createManagedRegistrar(async (startup) => {
      if (!server) throw new Error('App daemon Workspace ledger is not ready.')
      return server.registerManagedWorkspace({
        canonicalProjectDir: startup.identity.canonicalProjectDir,
        backendUrl: startup.backendUrl,
        credential: startup.credential,
        generation: startup.generation,
        git: await inspectManagedProjectGit(startup.identity.canonicalProjectDir),
      })
    })
    const managedOwner = createManagedProjectOwner({
      spawner,
      registrar,
      canonicalize: canonicalizeProjectDirectory,
      isAuthenticatedLocalApp: true,
    })
    const managedProject = adaptOwnerToManagedControl(managedOwner)
    server = await startDaemonServer({
      endpoint: paths.endpoint,
      runDir: paths.runDir,
      version,
      hostMode: presentation.effectiveHostMode,
      openSpecSpawnMode,
      host: presentation.host,
      managedProject,
    })
    const restoreResults = await managedOwner.restoreManagedDirectorySet(
      (options.restoreProjectDirs ?? []).map((canonicalProjectDir) => ({ canonicalProjectDir }))
    )
    for (const result of restoreResults) {
      if (!result.ok) {
        process.stderr.write(
          `[OpenSpecUI App] managed restore failed: ${result.rejection.message}\n`
        )
      }
    }
  } catch (error) {
    await presentation.host.close()
    throw error
  }
  const runningServer = server
  const shutdown = () => {
    void runningServer.close().catch(() => {
      process.stderr.write('App daemon shutdown did not release every host resource.\n')
    })
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  await runningServer.closed
  process.off('SIGINT', shutdown)
  process.off('SIGTERM', shutdown)
}
