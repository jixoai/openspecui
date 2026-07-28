/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Materialize semantic start presentation requests as private browser/PWA launch URLs.
 * 2. Keep the external URL opener replaceable by another runtime host adapter.
 *
 * Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口。"
 */
import { buildDirectWebLaunchUrl, buildHostedAppLaunchUrl } from './hosted-app.js'
import type {
  StartCommandPresentationRequest,
  StartCommandPresenter,
} from './start-command-presentation.js'

/** Browser-runtime primitive used only after presentation semantics are resolved. */
export type ExternalUrlOpener = (target: string) => Promise<unknown>

function buildBrowserPresentationTarget(request: StartCommandPresentationRequest): string {
  if (request.surface === 'hosted-app') {
    return buildHostedAppLaunchUrl({
      baseUrl: request.appBaseUrl,
      apiBaseUrl: request.apiBaseUrl,
      credential: request.credential,
    })
  }

  return buildDirectWebLaunchUrl({
    baseUrl: request.webBaseUrl,
    credential: request.credential,
  })
}

/** Create the Browser/PWA adapter for the host-neutral start presentation contract. */
export function createBrowserStartCommandPresenter(
  openExternalUrl: ExternalUrlOpener
): StartCommandPresenter {
  return {
    async present(request) {
      await openExternalUrl(buildBrowserPresentationTarget(request))
    },
  }
}
