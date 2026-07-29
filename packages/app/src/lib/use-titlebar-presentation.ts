/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Bind the titlebar presentation owner to browser media, resize, and React lifecycle events.
 * 2. Forward pointer input from the dedicated App titlebar without giving Workspace controls drag authority.
 *
 * Original request (2026-07-29): "Browser/PWA 和 OpenTray 只能有一个标题栏 geometry owner。"
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 */
import { useCallback, useEffect, useRef, useState, type PointerEventHandler } from 'react'
import type { HostedAppWindowControlsOverlayLike } from './pwa-runtime'
import {
  createAppTitlebarPresentationOwner,
  type AppTitlebarPresentation,
  type AppTitlebarPresentationOwner,
  type OpenTrayWindowLike,
} from './titlebar-presentation'

interface TitlebarNavigator extends Navigator {
  opentray?: { window?: OpenTrayWindowLike }
  opentrayWindow?: OpenTrayWindowLike
  windowControlsOverlay?: HostedAppWindowControlsOverlayLike
}

const DEFAULT_PRESENTATION: AppTitlebarPresentation = {
  kind: 'browser',
  insets: { left: 0, right: 0, top: 0, height: 0 },
}

/** Read and subscribe to the active host titlebar presentation. */
export function useTitlebarPresentation(): {
  onPointerDown: PointerEventHandler<HTMLElement>
  presentation: AppTitlebarPresentation
} {
  const [presentation, setPresentation] = useState(DEFAULT_PRESENTATION)
  const ownerRef = useRef<AppTitlebarPresentationOwner | null>(null)

  useEffect(() => {
    const readRuntime = () => {
      const runtimeNavigator = navigator as TitlebarNavigator
      return {
        viewportWidth: window.innerWidth,
        openTrayWindow: runtimeNavigator.opentrayWindow ?? runtimeNavigator.opentray?.window,
        pwaOverlay: runtimeNavigator.windowControlsOverlay,
      }
    }
    const owner = createAppTitlebarPresentationOwner({
      readRuntime,
      onChange: setPresentation,
    })
    ownerRef.current = owner
    void owner.start()

    const refresh = () => void owner.refresh()
    const standaloneMedia = window.matchMedia('(display-mode: standalone)')
    const overlayMedia = window.matchMedia('(display-mode: window-controls-overlay)')
    standaloneMedia.addEventListener('change', refresh)
    overlayMedia.addEventListener('change', refresh)
    window.addEventListener('resize', refresh)

    return () => {
      ownerRef.current = null
      standaloneMedia.removeEventListener('change', refresh)
      overlayMedia.removeEventListener('change', refresh)
      window.removeEventListener('resize', refresh)
      owner.stop()
    }
  }, [])

  const onPointerDown = useCallback<PointerEventHandler<HTMLElement>>((event) => {
    ownerRef.current?.startDrag({
      root: event.currentTarget,
      target: event.target,
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
    })
  }, [])

  return { onPointerDown, presentation }
}
