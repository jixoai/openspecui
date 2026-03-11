export type HostedAppDisplayMode = 'browser' | 'standalone' | 'window-controls-overlay'

export interface BeforeInstallPromptChoice {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

export interface BeforeInstallPromptEventLike extends Event {
  prompt(): Promise<void>
  userChoice: Promise<BeforeInstallPromptChoice>
}

export interface HostedAppTitlebarAreaRect {
  x: number
  y: number
  width: number
  height: number
}

export interface HostedAppTitlebarInsets {
  left: number
  right: number
  top: number
  height: number
}

export interface HostedAppWindowControlsOverlayLike {
  visible: boolean
  getTitlebarAreaRect(): HostedAppTitlebarAreaRect
  addEventListener(type: 'geometrychange', listener: EventListener): void
  removeEventListener(type: 'geometrychange', listener: EventListener): void
}

export interface HostedAppPwaRuntime {
  matchMedia(query: string): Pick<MediaQueryList, 'matches'>
  innerWidth: number
  navigatorStandalone?: boolean
  windowControlsOverlay?: HostedAppWindowControlsOverlayLike
}

export const EMPTY_TITLEBAR_INSETS: HostedAppTitlebarInsets = {
  left: 0,
  right: 0,
  top: 0,
  height: 0,
}

export function isBeforeInstallPromptEvent(value: unknown): value is BeforeInstallPromptEventLike {
  return (
    value instanceof Event &&
    typeof (value as BeforeInstallPromptEventLike).prompt === 'function' &&
    typeof (value as BeforeInstallPromptEventLike).userChoice?.then === 'function'
  )
}

export function computeHostedAppDisplayMode(runtime: HostedAppPwaRuntime): HostedAppDisplayMode {
  if (
    runtime.windowControlsOverlay?.visible ||
    runtime.matchMedia('(display-mode: window-controls-overlay)').matches
  ) {
    return 'window-controls-overlay'
  }

  if (
    runtime.navigatorStandalone === true ||
    runtime.matchMedia('(display-mode: standalone)').matches
  ) {
    return 'standalone'
  }

  return 'browser'
}

export function computeTitlebarInsets(
  rect: HostedAppTitlebarAreaRect,
  viewportWidth: number
): HostedAppTitlebarInsets {
  const left = Math.max(Math.round(rect.x), 0)
  const right = Math.max(Math.round(viewportWidth - rect.x - rect.width), 0)
  const top = Math.max(Math.round(rect.y), 0)
  const height = Math.max(Math.round(rect.height), 0)

  return {
    left,
    right,
    top,
    height,
  }
}

export function readHostedAppTitlebarInsets(runtime: HostedAppPwaRuntime): HostedAppTitlebarInsets {
  const overlay = runtime.windowControlsOverlay
  if (!overlay?.visible) {
    return EMPTY_TITLEBAR_INSETS
  }

  return computeTitlebarInsets(overlay.getTitlebarAreaRect(), runtime.innerWidth)
}
