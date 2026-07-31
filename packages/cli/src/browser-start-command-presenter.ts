/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Materialize Direct Project Web presentation requests as private browser launch URLs.
 * 2. Keep the external URL opener replaceable without reflecting private targets through failures.
 *
 * Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口。"
 */
import { buildDirectWebLaunchUrl } from './hosted-app.js'

/** Present one backend-owned Project Web surface directly. */
export interface ProjectWebPresentationRequest {
  surface: 'project-web'
  webBaseUrl: string
  credential: string | null
}

/** Runtime host boundary for opening a ready project backend in the system Browser. */
export interface StartCommandPresenter {
  present(request: ProjectWebPresentationRequest): Promise<void>
}

/** Browser-runtime primitive used only after presentation semantics are resolved. */
export type ExternalUrlOpener = (target: string) => Promise<unknown>

function buildBrowserPresentationTarget(request: ProjectWebPresentationRequest): string {
  return buildDirectWebLaunchUrl({
    baseUrl: request.webBaseUrl,
    credential: request.credential,
  })
}

/** Create the Browser adapter for the host-neutral start presentation contract. */
export function createBrowserStartCommandPresenter(
  openExternalUrl: ExternalUrlOpener
): StartCommandPresenter {
  return {
    async present(request) {
      try {
        await openExternalUrl(buildBrowserPresentationTarget(request))
      } catch {
        throw new Error('Failed to open Project Web in the system browser.')
      }
    },
  }
}
