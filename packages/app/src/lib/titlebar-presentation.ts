/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Select exactly one Browser, PWA overlay, OpenTray overlay, or native-frame titlebar owner.
 * 2. Retire stale geometry listeners and reject late async measurements across source changes.
 * 3. Dispatch native drag only from the designated non-interactive titlebar surface.
 * 4. Preserve compact chrome by projecting geometry only into horizontal control-safe insets.
 *
 * Original request (2026-07-29): "对 opentray 的窗口 overlay-window-controls 的样式适配。"
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 * Owner correction (2026-07-30): follow skill-creator-v2 window-controls safe-area behavior.
 * Owner correction (2026-07-30): copy skill-creator-v2's declared-overlay measurement boundary exactly.
 */
import {
  computeTitlebarInsets,
  DEFAULT_OVERLAY_TITLEBAR_INSETS,
  EMPTY_TITLEBAR_INSETS,
} from './pwa-runtime'

interface TitlebarAreaRect {
  x: number
  y: number
  width: number
  height: number
}

export interface OpenTrayGeometryEvent {
  titlebarAreaRect: TitlebarAreaRect
}

export interface OpenTrayOverlayLike {
  visible?: boolean
  getTitlebarAreaRect(): Promise<TitlebarAreaRect>
  listen?(
    type: 'geometrychange',
    listener: (event: OpenTrayGeometryEvent) => void
  ): Promise<() => Promise<void> | void>
  addEventListener?(type: 'geometrychange', listener: (event: OpenTrayGeometryEvent) => void): void
  removeEventListener?(
    type: 'geometrychange',
    listener: (event: OpenTrayGeometryEvent) => void
  ): void
}

export interface OpenTrayWindowLike {
  overlay?: OpenTrayOverlayLike
  startAppRegionDrag?(options: { x: number; y: number; pointerId: number }): Promise<unknown> | void
}

export interface PwaTitlebarOverlayLike {
  visible: boolean
  getTitlebarAreaRect(): TitlebarAreaRect
  addEventListener(type: 'geometrychange', listener: EventListener): void
  removeEventListener(type: 'geometrychange', listener: EventListener): void
}

export interface AppTitlebarRuntime {
  viewportWidth: number
  declaredOpenTrayOverlay?: boolean
  openTrayWindow?: OpenTrayWindowLike
  pwaOverlay?: PwaTitlebarOverlayLike
}

export type AppTitlebarPresentation =
  | { kind: 'browser'; insets: typeof EMPTY_TITLEBAR_INSETS }
  | { kind: 'native-frame'; insets: typeof EMPTY_TITLEBAR_INSETS }
  | {
      kind: 'opentray' | 'pwa-overlay'
      insets: { left: number; right: number; top: number; height: number }
    }

type TitlebarCleanup = () => Promise<void> | void

export interface AppTitlebarPresentationOwner {
  refresh(): Promise<void>
  start(): Promise<void>
  startDrag(input: {
    root: HTMLElement
    target: EventTarget | null
    clientX: number
    clientY: number
    pointerId: number
  }): void
  stop(): void
}

const ZERO_BROWSER: AppTitlebarPresentation = {
  kind: 'browser',
  insets: EMPTY_TITLEBAR_INSETS,
}

function titlebarPresentation(
  kind: AppTitlebarPresentation['kind'],
  rect: TitlebarAreaRect | null,
  viewportWidth: number
): AppTitlebarPresentation {
  if (kind === 'browser') return { kind, insets: EMPTY_TITLEBAR_INSETS }
  if (kind === 'native-frame') return { kind, insets: EMPTY_TITLEBAR_INSETS }
  return {
    kind,
    insets: rect ? computeTitlebarInsets(rect, viewportWidth) : DEFAULT_OVERLAY_TITLEBAR_INSETS,
  }
}

/** Return true only for non-interactive content inside the dedicated App titlebar. */
export function isOpenTrayDragTarget(target: EventTarget | null, root: HTMLElement): boolean {
  if (!(target instanceof Element) || !root.contains(target)) return false
  const titlebar = target.closest<HTMLElement>('[data-app-titlebar="true"]')
  if (!titlebar || !root.contains(titlebar)) return false
  return !target.closest(
    'button, input, select, textarea, a, [role="button"], [data-tabs-actions="true"], [data-tabs-tab-actions="true"]'
  )
}

/** Create the one lifecycle owner allowed to publish titlebar geometry and native drag. */
export function createAppTitlebarPresentationOwner(options: {
  readRuntime(): AppTitlebarRuntime
  onChange(presentation: AppTitlebarPresentation): void
  onError?(message: string): void
  onNativeGeometry?(): void
}): AppTitlebarPresentationOwner {
  let generation = 0
  let cleanup: TitlebarCleanup | null = null
  let current = ZERO_BROWSER
  let stopped = false

  const report = () => options.onError?.('Native titlebar geometry is unavailable.')
  const publish = (presentation: AppTitlebarPresentation) => {
    if (stopped) return
    current = presentation
    options.onChange(presentation)
  }
  const retire = async () => {
    const previous = cleanup
    cleanup = null
    if (!previous) return
    try {
      await previous()
    } catch {
      report()
    }
  }

  const refresh = async () => {
    stopped = false
    const selectedGeneration = ++generation
    await retire()
    if (selectedGeneration !== generation) return
    const runtime = options.readRuntime()
    const nativeWindow = runtime.openTrayWindow
    const nativeOverlay = nativeWindow?.overlay

    if (runtime.declaredOpenTrayOverlay || nativeOverlay) {
      if (!runtime.declaredOpenTrayOverlay && nativeOverlay?.visible === false) {
        publish(titlebarPresentation('native-frame', null, runtime.viewportWidth))
        return
      }
      publish(titlebarPresentation('opentray', null, runtime.viewportWidth))
      if (!nativeOverlay) return
      try {
        const rect = await nativeOverlay.getTitlebarAreaRect()
        if (selectedGeneration !== generation) return
        publish(titlebarPresentation('opentray', rect, options.readRuntime().viewportWidth))
        options.onNativeGeometry?.()
        const onGeometryChange = (event: OpenTrayGeometryEvent) => {
          if (selectedGeneration !== generation) return
          publish(
            titlebarPresentation(
              'opentray',
              event.titlebarAreaRect,
              options.readRuntime().viewportWidth
            )
          )
        }
        let nextCleanup: TitlebarCleanup | null = null
        if (nativeOverlay.listen) {
          nextCleanup = await nativeOverlay.listen('geometrychange', onGeometryChange)
        } else if (nativeOverlay.addEventListener) {
          nativeOverlay.addEventListener('geometrychange', onGeometryChange)
          nextCleanup = () =>
            nativeOverlay.removeEventListener?.('geometrychange', onGeometryChange)
        }
        if (selectedGeneration !== generation) {
          await nextCleanup?.()
          return
        }
        cleanup = nextCleanup
      } catch {
        if (selectedGeneration === generation) report()
      }
      return
    }

    if (nativeWindow) {
      publish(titlebarPresentation('native-frame', null, runtime.viewportWidth))
      return
    }

    const pwaOverlay = runtime.pwaOverlay
    if (pwaOverlay?.visible) {
      publish(titlebarPresentation('pwa-overlay', null, runtime.viewportWidth))
      const publishPwaGeometry = () => {
        try {
          publish(
            titlebarPresentation(
              'pwa-overlay',
              pwaOverlay.getTitlebarAreaRect(),
              options.readRuntime().viewportWidth
            )
          )
        } catch {
          report()
        }
      }
      publishPwaGeometry()
      const onGeometryChange: EventListener = () => publishPwaGeometry()
      pwaOverlay.addEventListener('geometrychange', onGeometryChange)
      cleanup = () => pwaOverlay.removeEventListener('geometrychange', onGeometryChange)
      return
    }

    publish(ZERO_BROWSER)
  }

  return {
    refresh,
    start: refresh,
    startDrag(input) {
      if (current.kind !== 'opentray' || !isOpenTrayDragTarget(input.target, input.root)) return
      try {
        const result = options.readRuntime().openTrayWindow?.startAppRegionDrag?.({
          x: input.clientX,
          y: input.clientY,
          pointerId: input.pointerId,
        })
        void Promise.resolve(result).catch(report)
      } catch {
        report()
      }
    },
    stop() {
      stopped = true
      generation += 1
      void retire()
      current = ZERO_BROWSER
    },
  }
}
