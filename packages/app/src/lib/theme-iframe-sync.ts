/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Force-sync the App theme preference to every live Workspace iframe.
 *
 * Original request (2026-08-02): "如果修改了 app 的 theme，那么需要强制同步给子窗口。
 *   新的子窗口也要集成和同步这个 theme。但是如果子窗口自己修改 theme，不会同步给 app。"
 *
 * The App is the single theme master. This is a one-directional push: child windows
 * receive and apply but never echo back. New windows inherit via the `theme` URL param
 * (buildEmbeddedUiLaunchUrl); this module covers the live re-sync of already-open windows.
 */
import type { HostedShellTheme } from '@openspecui/core/hosted-app'

/** Message type discriminator shared with the web-side receiver. */
export const HOSTED_THEME_SYNC_TYPE = 'openspecui:hosted-theme'

export interface HostedThemeSyncMessage {
  readonly type: typeof HOSTED_THEME_SYNC_TYPE
  readonly theme: HostedShellTheme
}

/**
 * Push the App theme to every live Workspace iframe via postMessage.
 * Each iframe's origin is derived from its own `src` so `targetOrigin` is never '*'.
 * Frames whose contentWindow is unavailable (not yet loaded / detached) are skipped.
 */
export function broadcastThemeToIframes(
  iframeRefs: Readonly<Record<string, HTMLIFrameElement | null>>,
  theme: HostedShellTheme
): void {
  const message: HostedThemeSyncMessage = { type: HOSTED_THEME_SYNC_TYPE, theme }
  for (const iframe of Object.values(iframeRefs)) {
    if (!iframe) continue
    const contentWindow = iframe.contentWindow
    if (!contentWindow) continue
    const targetOrigin = resolveIframeOrigin(iframe)
    if (!targetOrigin) continue
    contentWindow.postMessage(message, targetOrigin)
  }
}

function resolveIframeOrigin(iframe: HTMLIFrameElement): string | null {
  const src = iframe.src || iframe.getAttribute('src')
  if (!src) return null
  try {
    return new URL(src, window.location.origin).origin
  } catch {
    return null
  }
}
