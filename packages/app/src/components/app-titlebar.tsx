/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Render a dedicated self-drawn titlebar only for overlay-capable App hosts.
 * 2. Keep the titlebar's blank surface as the sole pointer entry for native window dragging.
 * 3. Reserve the geometry published by the exclusive titlebar presentation owner.
 *
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 */
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
      className="app-titlebar border-terminal-foreground/20 bg-terminal text-terminal-foreground"
      data-app-titlebar="true"
      data-app-titlebar-kind={presentation.kind}
      onPointerDown={onPointerDown}
    >
      <div aria-hidden="true" className="app-titlebar-brand font-nav text-terminal-foreground/62">
        OpenSpec UI
      </div>
    </header>
  )
}
