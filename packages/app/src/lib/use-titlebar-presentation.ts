/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Bind declared host presentation and measured geometry to browser media, resize, and React lifecycle events.
 * 2. Forward pointer input from the dedicated App titlebar without giving Workspace controls drag authority.
 * 3. Converge host-declared chrome when the native bridge becomes observable after React mount.
 *
 * Original request (2026-07-29): "Browser/PWA 和 OpenTray 只能有一个标题栏 geometry owner。"
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 * Owner correction (2026-07-30): declared OpenTray chrome must render before native bridge observation settles.
 * Owner correction (2026-07-30): unknown overlay geometry retains the reference 8px edge fallback.
 * Owner correction (2026-07-30): a declared native overlay must not remain permanently on fallback padding.
 */
import { useCallback, useEffect, useRef, useState, type PointerEventHandler } from 'react'
import {
  DEFAULT_OVERLAY_TITLEBAR_INSETS,
  type HostedAppWindowControlsOverlayLike,
} from './pwa-runtime'
import {
  createAppTitlebarPresentationOwner,
  type AppTitlebarPresentation,
  type AppTitlebarPresentationOwner,
  type OpenTrayWindowLike,
} from './titlebar-presentation'

export interface TitlebarNavigatorLike {
  opentray?: { window?: OpenTrayWindowLike }
  opentrayWindow?: OpenTrayWindowLike
  window?: OpenTrayWindowLike
  windowControlsOverlay?: HostedAppWindowControlsOverlayLike
}

const NATIVE_BRIDGE_RETRY_DELAY_MS = 50
const NATIVE_BRIDGE_RETRY_LIMIT = 40

/** Resolve every public OpenTray window projection supported by the installed extension. */
export function resolveTitlebarOpenTrayWindow(
  runtimeNavigator: TitlebarNavigatorLike
): OpenTrayWindowLike | undefined {
  return (
    runtimeNavigator.opentrayWindow ?? runtimeNavigator.window ?? runtimeNavigator.opentray?.window
  )
}

const DEFAULT_PRESENTATION: AppTitlebarPresentation = {
  kind: 'browser',
  insets: { left: 0, right: 0, top: 0, height: 0 },
}

/** Read and subscribe to the active host titlebar presentation. */
export function useTitlebarPresentation(declaredOpenTrayOverlay = false): {
  onPointerDown: PointerEventHandler<HTMLElement>
  presentation: AppTitlebarPresentation
} {
  const [presentation, setPresentation] = useState<AppTitlebarPresentation>(() =>
    declaredOpenTrayOverlay
      ? { kind: 'opentray', insets: DEFAULT_OVERLAY_TITLEBAR_INSETS }
      : DEFAULT_PRESENTATION
  )
  const ownerRef = useRef<AppTitlebarPresentationOwner | null>(null)

  useEffect(() => {
    let active = true
    let nativeGeometryMeasured = false
    let retryCount = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const clearRetry = () => {
      if (retryTimer !== null) clearTimeout(retryTimer)
      retryTimer = null
    }
    const readRuntime = () => {
      const runtimeNavigator = navigator as TitlebarNavigatorLike
      return {
        viewportWidth: window.innerWidth,
        declaredOpenTrayOverlay,
        openTrayWindow: resolveTitlebarOpenTrayWindow(runtimeNavigator),
        pwaOverlay: runtimeNavigator.windowControlsOverlay,
      }
    }
    const owner = createAppTitlebarPresentationOwner({
      readRuntime,
      onChange: setPresentation,
      onNativeGeometry: () => {
        nativeGeometryMeasured = true
        clearRetry()
      },
    })
    ownerRef.current = owner

    const retryNativeGeometry = () => {
      if (
        !active ||
        !declaredOpenTrayOverlay ||
        nativeGeometryMeasured ||
        retryCount >= NATIVE_BRIDGE_RETRY_LIMIT
      ) {
        return
      }
      retryCount += 1
      retryTimer = setTimeout(() => {
        retryTimer = null
        void owner.refresh().finally(retryNativeGeometry)
      }, NATIVE_BRIDGE_RETRY_DELAY_MS)
    }
    void owner.start().finally(retryNativeGeometry)

    const refresh = () => void owner.refresh()
    const standaloneMedia = window.matchMedia?.('(display-mode: standalone)')
    const overlayMedia = window.matchMedia?.('(display-mode: window-controls-overlay)')
    standaloneMedia?.addEventListener('change', refresh)
    overlayMedia?.addEventListener('change', refresh)
    window.addEventListener('resize', refresh)
    window.addEventListener('load', refresh)

    return () => {
      active = false
      clearRetry()
      ownerRef.current = null
      standaloneMedia?.removeEventListener('change', refresh)
      overlayMedia?.removeEventListener('change', refresh)
      window.removeEventListener('resize', refresh)
      window.removeEventListener('load', refresh)
      owner.stop()
    }
  }, [declaredOpenTrayOverlay])

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
