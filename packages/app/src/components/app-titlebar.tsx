/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Render a dedicated self-drawn titlebar only for overlay-capable App hosts.
 * 2. Keep the titlebar's blank surface as the sole pointer entry for native window dragging.
 * 3. Reserve the geometry published by the exclusive titlebar presentation owner.
 * 4. Make the application chrome visually distinct from terminal Workspace tabs.
 *
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 */
import { PanelsTopLeft } from 'lucide-react'
import type { PointerEventHandler } from 'react'
import type { AppTitlebarPresentation } from '../lib/titlebar-presentation'

interface AppTitlebarProps {
  presentation: AppTitlebarPresentation
  onPointerDown: PointerEventHandler<HTMLElement>
}

/** Render the overlay-only application titlebar without giving Workspace controls drag authority. */
export function AppTitlebar({ presentation, onPointerDown }: AppTitlebarProps) {
  if (presentation.kind !== 'opentray' && presentation.kind !== 'pwa-overlay') {
    return null
  }

  return (
    <header
      aria-label="Application titlebar"
      className="app-titlebar"
      data-app-titlebar="true"
      data-app-titlebar-kind={presentation.kind}
      onPointerDown={onPointerDown}
    >
      <div aria-hidden="true" className="app-titlebar-content">
        <div className="app-titlebar-brand">
          <span className="app-titlebar-mark">
            <PanelsTopLeft aria-hidden="true" size={13} strokeWidth={1.8} />
          </span>
          <span className="font-nav">OpenSpec UI</span>
        </div>
        <div className="app-titlebar-drag-cue">
          <span />
          <span />
          <span />
        </div>
      </div>
    </header>
  )
}
