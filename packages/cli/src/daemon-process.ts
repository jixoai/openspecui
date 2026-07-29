/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Bootstrap the detached App daemon from explicit environment-owned startup evidence.
 * 2. Compose local App HTTP, presentation host, and IPC lifecycle in teardown order.
 * 3. Keep project backend credentials and processes outside daemon bootstrap state.
 *
 * Original request (2026-07-29): "多次执行 openspecui --app 只是在激活同一个 daemon。"
 */
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveAppAssetsDir } from './app-assets.js'
import { createBrowserDaemonHost } from './browser-daemon-host.js'
import { resolveDaemonPaths } from './daemon-paths.js'
import { DaemonHostModeSchema, type DaemonHostMode } from './daemon-protocol.js'
import { startDaemonServer } from './daemon-server.js'
import { startLocalAppServer } from './local-app-server.js'
import { readCliPackageVersion } from './package-version.js'

export const DAEMON_RUN_ENV = 'OPENSPECUI_INTERNAL_DAEMON_RUN'
export const DAEMON_HOST_MODE_ENV = 'OPENSPECUI_INTERNAL_DAEMON_HOST_MODE'

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
  hostMode: DaemonHostMode
  runtimeDir?: string
  openExternalUrl?: (target: string) => Promise<unknown>
}): Promise<void> {
  const runtimeDir = options.runtimeDir ?? dirname(fileURLToPath(import.meta.url))
  const paths = resolveDaemonPaths()
  const assetsDir = await resolveAppAssetsDir(runtimeDir)
  const appServer = await startLocalAppServer({ assetsDir })
  const openExternalUrl =
    options.openExternalUrl ??
    (async (target: string) => {
      const open = await import('open')
      await open.default(target)
    })
  // Native presentation is replaced by the OpenTray host in checkpoint 6. Until then status truthfully
  // reports Browser capability only instead of claiming a native window exists.
  const host = createBrowserDaemonHost({ appServer, openExternalUrl })
  const server = await startDaemonServer({
    endpoint: paths.endpoint,
    runDir: paths.runDir,
    version: readCliPackageVersion(runtimeDir),
    hostMode:
      options.hostMode === 'native' && !host.capabilities.nativeWindow ? 'web' : options.hostMode,
    host,
  })
  const shutdown = () => void server.close()
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  await server.closed
  process.off('SIGINT', shutdown)
  process.off('SIGTERM', shutdown)
}
