/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Present the daemon-owned App shell through the system Browser host.
 * 2. Materialize private Direct Project Web URLs only at the external opener boundary without reflecting them through failures.
 * 3. Own local App HTTP teardown without touching project backends.
 *
 * Original request (2026-07-29): "--web 决定 tray 的一些行为，这是一开始就要定下来的。"
 */
import type { DaemonPresentationHost } from './daemon-server.js'
import { buildDirectWebLaunchUrl } from './hosted-app.js'
import type { LocalAppServer } from './local-app-server.js'

export type DaemonExternalUrlOpener = (target: string) => Promise<unknown>

/** Create the Browser/PWA host around one daemon-owned local App server. */
export function createBrowserDaemonHost(options: {
  appServer: LocalAppServer
  openExternalUrl: DaemonExternalUrlOpener
}): DaemonPresentationHost {
  return {
    appUrl: options.appServer.url,
    capabilities: { browser: true, nativeWindow: false },
    setWorkspaces(workspaces) {
      options.appServer.setWorkspaces(workspaces)
    },
    async activate() {
      await options.openExternalUrl(options.appServer.url)
    },
    async openProjectInBrowser(workspace) {
      try {
        await options.openExternalUrl(
          buildDirectWebLaunchUrl({
            baseUrl: workspace.backendUrl,
            credential: workspace.credential,
          })
        )
      } catch {
        throw new Error('Failed to open the registered Workspace in the system browser.')
      }
    },
    async close() {
      await options.appServer.close()
    },
  }
}
