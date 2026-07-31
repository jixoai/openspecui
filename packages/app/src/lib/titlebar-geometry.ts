/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Convert native overlay geometry into control-safe horizontal titlebar insets.
 *
 * Original request (2026-07-29): "对 opentray 的窗口 overlay-window-controls 的样式适配。"
 * Owner correction (2026-07-31): PWA is retired; titlebar geometry remains an OpenTray-owned primitive.
 */

export interface AppTitlebarAreaRect {
  x: number
  y: number
  width: number
  height: number
}

export interface AppTitlebarInsets {
  left: number
  right: number
  top: number
  height: number
}

export const EMPTY_TITLEBAR_INSETS: AppTitlebarInsets = {
  left: 0,
  right: 0,
  top: 0,
  height: 0,
}

export const DEFAULT_OVERLAY_TITLEBAR_INSETS: AppTitlebarInsets = {
  left: 8,
  right: 8,
  top: 0,
  height: 0,
}

const WINDOW_CONTROL_MARGIN = 4

/** Convert one native overlay rect into the App titlebar's control-safe insets. */
export function computeTitlebarInsets(
  rect: AppTitlebarAreaRect,
  viewportWidth: number
): AppTitlebarInsets {
  const leftControlInset = Math.max(Math.round(rect.x), 0)
  const rightControlInset = Math.max(Math.round(viewportWidth - rect.x - rect.width), 0)
  const top = Math.max(Math.round(rect.y), 0)
  const height = Math.max(Math.round(rect.height), 0)

  return {
    left: leftControlInset + (leftControlInset > 0 ? WINDOW_CONTROL_MARGIN : 0),
    right: rightControlInset + (rightControlInset > 0 ? WINDOW_CONTROL_MARGIN : 0),
    top,
    height,
  }
}
