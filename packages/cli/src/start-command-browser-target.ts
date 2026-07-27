/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Own the start command's Server credential handoff to its private browser target.
 * 2. Keep the displayed hosted locator credential-free while requesting Direct Web or App.
 *
 * Original request (2026-07-24): "Prove the real CLI start-command browser-target owner."
 */
import { buildDirectWebLaunchUrl, buildHostedAppLaunchUrl } from './hosted-app.js'
import type { CLIOptions, RunningServer } from './index.js'

/** Inputs owned by the CLI start handler before Server startup. */
export interface StartCommandBrowserTargetOptions {
  serverOptions: Omit<CLIOptions, 'onBrowserLaunchCredential' | 'open'>
  hostedBaseUrl: string | null
  shouldOpen: boolean
  onServerReady?: (evidence: { server: RunningServer; publicHostedUrl: string | null }) => void
}

/** Production dependencies used by the CLI start-command browser-target owner. */
export interface StartCommandBrowserTargetDependencies {
  startServer: (options: CLIOptions) => Promise<RunningServer>
  openBrowser: (target: string) => Promise<unknown>
}

/** Start the Server and request the credential-bearing target owned by the CLI start command. */
export async function coordinateStartCommandBrowserTarget(
  options: StartCommandBrowserTargetOptions,
  dependencies: StartCommandBrowserTargetDependencies
): Promise<RunningServer> {
  let browserLaunchCredential: string | null = null
  const server = await dependencies.startServer({
    ...options.serverOptions,
    open: false,
    onBrowserLaunchCredential: (credential) => {
      browserLaunchCredential = credential
    },
  })
  const publicHostedUrl = options.hostedBaseUrl
    ? buildHostedAppLaunchUrl({
        baseUrl: options.hostedBaseUrl,
        apiBaseUrl: server.url,
      })
    : null
  const browserTarget = options.hostedBaseUrl
    ? buildHostedAppLaunchUrl({
        baseUrl: options.hostedBaseUrl,
        apiBaseUrl: server.url,
        credential: browserLaunchCredential,
      })
    : buildDirectWebLaunchUrl({
        baseUrl: server.url,
        credential: browserLaunchCredential,
      })

  options.onServerReady?.({ server, publicHostedUrl })
  if (options.shouldOpen) await dependencies.openBrowser(browserTarget)
  return server
}
