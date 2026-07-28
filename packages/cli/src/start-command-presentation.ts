/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Coordinate Server readiness into one host-neutral start presentation request.
 * 2. Keep public hosted evidence credential-free while credentials remain runtime-only presenter input.
 *
 * Original request (2026-07-28): "从底层上封装，后续可能对接 OpenTray 原生窗口。"
 */
import { buildHostedAppLaunchUrl } from './hosted-app.js'
import type { CLIOptions, RunningServer } from './index.js'

/** Present the backend-owned Project Web surface directly. */
export interface ProjectWebPresentationRequest {
  surface: 'project-web'
  webBaseUrl: string
  credential: string | null
}

/** Present the multi-project App surface through the selected runtime host. */
export interface HostedAppPresentationRequest {
  surface: 'hosted-app'
  appBaseUrl: string
  apiBaseUrl: string
  credential: string | null
}

/** Semantic start intent consumed by Browser today and native hosts in the future. */
export type StartCommandPresentationRequest =
  | ProjectWebPresentationRequest
  | HostedAppPresentationRequest

/** Runtime host boundary for presenting one ready OpenSpecUI backend. */
export interface StartCommandPresenter {
  present(request: StartCommandPresentationRequest): Promise<void>
}

/** Inputs owned by the CLI start handler before Server startup. */
export interface StartCommandPresentationOptions {
  serverOptions: Omit<CLIOptions, 'onBrowserLaunchCredential' | 'open'>
  hostedBaseUrl: string | null
  shouldOpen: boolean
  onServerReady?: (evidence: { server: RunningServer; publicHostedUrl: string | null }) => void
}

/** Production dependencies used by the CLI start presentation owner. */
export interface StartCommandPresentationDependencies {
  startServer: (options: CLIOptions) => Promise<RunningServer>
  presenter: StartCommandPresenter
}

/** Start the Server and submit one semantic request to the selected runtime presenter. */
export async function coordinateStartCommandPresentation(
  options: StartCommandPresentationOptions,
  dependencies: StartCommandPresentationDependencies
): Promise<RunningServer> {
  let presentationCredential: string | null = null
  const server = await dependencies.startServer({
    ...options.serverOptions,
    open: false,
    onBrowserLaunchCredential: (credential) => {
      presentationCredential = credential
    },
  })
  const publicHostedUrl = options.hostedBaseUrl
    ? buildHostedAppLaunchUrl({
        baseUrl: options.hostedBaseUrl,
        apiBaseUrl: server.url,
      })
    : null

  options.onServerReady?.({ server, publicHostedUrl })
  if (options.shouldOpen) {
    const request: StartCommandPresentationRequest = options.hostedBaseUrl
      ? {
          surface: 'hosted-app',
          appBaseUrl: options.hostedBaseUrl,
          apiBaseUrl: server.url,
          credential: presentationCredential,
        }
      : {
          surface: 'project-web',
          webBaseUrl: server.url,
          credential: presentationCredential,
        }
    await dependencies.presenter.present(request)
  }
  return server
}
