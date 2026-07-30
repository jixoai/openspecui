/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Bootstrap the detached App daemon from explicit environment-owned startup evidence.
 * 2. Compose local App HTTP, presentation host, and IPC lifecycle in teardown order.
 * 3. Keep project backend credentials and processes outside daemon bootstrap state.
 * 4. Project source or packaged CLI execution into the public native cold-launch lifecycle.
 * 5. Enable native DevTools only for the source CLI development runtime.
 *
 * Original request (2026-07-29): "多次执行 openspecui --app 只是在激活同一个 daemon。"
 * Owner correction (2026-07-30): "pnpm openspecui这种开发模式下，应该要启动 opentray 的 devtools。"
 * Owner correction (2026-07-30): appMode must include the durable `openspecui start` cold-launch vector.
 */
import { basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveAppAssetsDir } from './app-assets.js'
import { resolveDaemonPaths } from './daemon-paths.js'
import { DaemonHostModeSchema, type DaemonHostMode } from './daemon-protocol.js'
import { startDaemonServer, type RunningDaemonServer } from './daemon-server.js'
import { startLocalAppServer } from './local-app-server.js'
import { resolveOpenTrayAppLaunch } from './opentray-app-launch.js'
import {
  createOpenTrayDaemonPresenter,
  type DaemonPresenterDiagnostic,
  type OpenTrayDaemonPresenterResolution,
} from './opentray-daemon-presenter.js'
import { readCliPackageVersion } from './package-version.js'

export const DAEMON_RUN_ENV = 'OPENSPECUI_INTERNAL_DAEMON_RUN'
export const DAEMON_HOST_MODE_ENV = 'OPENSPECUI_INTERNAL_DAEMON_HOST_MODE'

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
  openExternalUrl?: (target: string) => Promise<unknown>
}): Promise<void> {
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
    server = await startDaemonServer({
      endpoint: paths.endpoint,
      runDir: paths.runDir,
      version,
      hostMode: presentation.effectiveHostMode,
      host: presentation.host,
    })
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
