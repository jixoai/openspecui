/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Render a dedicated self-drawn titlebar only for overlay-capable App hosts.
 * 2. Keep the titlebar's blank surface as the sole pointer entry for native window dragging.
 * 3. Reserve the geometry published by the exclusive titlebar presentation owner.
 * 4. Own the overlay-only Settings entry and application brand identity.
 *
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 * Owner correction (2026-07-30): "Settings 入口挪到titlebar右上角；logo要全面应用。"
 * Owner correction (2026-07-30): "titlebar的高度过高，适当压缩到合理的高度。"
 * Owner correction (2026-07-31): PWA overlay presentation is retired.
 */
import { Settings } from 'lucide-react'
import type { PointerEventHandler } from 'react'
import type { AppTitlebarPresentation } from '../lib/titlebar-presentation'

interface AppTitlebarProps {
  onSettings(): void
  presentation: AppTitlebarPresentation
  onPointerDown: PointerEventHandler<HTMLElement>
  settingsActive: boolean
}

/** Render the overlay-only application titlebar without giving Workspace controls drag authority. */
export function AppTitlebar({
  onSettings,
  presentation,
  onPointerDown,
  settingsActive,
}: AppTitlebarProps) {
  if (presentation.kind !== 'opentray') {
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
      <div className="app-titlebar-content">
        <div className="app-titlebar-brand">
          <span aria-hidden="true" className="app-titlebar-mark">
            <img className="app-titlebar-logo app-titlebar-logo-light" src="/icon.svg" alt="" />
            <img className="app-titlebar-logo app-titlebar-logo-dark" src="/icon.dark.svg" alt="" />
          </span>
          <span className="font-nav">OpenSpec UI</span>
        </div>
        <button
          aria-current={settingsActive ? 'page' : undefined}
          aria-label="Settings"
          className="app-titlebar-settings"
          data-active={settingsActive ? 'true' : 'false'}
          onClick={onSettings}
          title="Settings"
          type="button"
        >
          <Settings aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  )
}
