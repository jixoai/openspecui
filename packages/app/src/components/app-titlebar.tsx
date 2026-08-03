/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Render a dedicated self-drawn titlebar only for overlay-capable App hosts.
 * 2. Keep the titlebar's blank surface as the sole pointer entry for native window dragging.
 * 3. Reserve the geometry published by the exclusive titlebar presentation owner.
 * 4. Own the overlay-only Settings entry and application brand identity.
 * 5. Toggle the shared desktop sidebar from an explicit icon-button next to the brand.
 * 6. Cycle the App theme preference from the overlay-only theme toggle.
 *
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 * Owner correction (2026-07-30): "Settings 入口挪到titlebar右上角；logo要全面应用。"
 * Owner correction (2026-07-30): "titlebar的高度过高，适当压缩到合理的高度。"
 * Owner correction (2026-07-31): PWA overlay presentation is retired.
 * Owner correction (2026-07-31): OpenTray titlebar product name is "OpenSpecUI App".
 * Original request (2026-08-02): "在它左边新增一个 theme-toggle-icon-button"
 * Original request (2026-08-03): sidebar toggle discoverability — brand logo is display-only
 *   when expanded; an explicit PanelLeftClose icon-button sits at its right. Collapsed: the
 *   icon-button hides and the logo becomes clickable to expand.
 */
import { Monitor, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun } from 'lucide-react'
import type { PointerEventHandler } from 'react'
import type { HostedShellTheme } from '../lib/app-theme'
import type { AppTitlebarPresentation } from '../lib/titlebar-presentation'
import type { ResolvedHostedShellTheme } from '../lib/use-hosted-shell-theme'

interface AppTitlebarProps {
  onSettings(): void
  presentation: AppTitlebarPresentation
  onPointerDown: PointerEventHandler<HTMLElement>
  settingsActive: boolean
  sidebarCollapsed: boolean
  onToggleSidebar(): void
  /** Persisted theme preference, driving the toggle icon label. */
  theme: HostedShellTheme
  /** Effective light/dark value after resolving 'system'; drives the toggle icon glyph. */
  resolvedTheme: ResolvedHostedShellTheme
  /** Cycle system -> light -> dark -> system. */
  onToggleTheme(): void
}

/** Render the overlay-only application titlebar without giving Workspace controls drag authority. */
export function AppTitlebar({
  onSettings,
  presentation,
  onPointerDown,
  settingsActive,
  sidebarCollapsed,
  onToggleSidebar,
  theme,
  resolvedTheme,
  onToggleTheme,
}: AppTitlebarProps) {
  if (presentation.kind !== 'opentray') {
    return null
  }

  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun
  const themeLabel = `Theme: ${theme}`

  return (
    <header
      aria-label="Application titlebar"
      className="app-titlebar"
      data-app-titlebar="true"
      data-app-titlebar-kind={presentation.kind}
      onPointerDown={onPointerDown}
    >
      <div className="app-titlebar-content">
        {/* Brand (display-only) + persistent sidebar toggle grouped together */}
        <div className="app-titlebar-brand-group">
          <div
            className="app-titlebar-brand"
            data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}
          >
            <span aria-hidden="true" className="app-titlebar-mark">
              <img className="app-titlebar-logo app-titlebar-logo-light" src="/icon.svg" alt="" />
              <img
                className="app-titlebar-logo app-titlebar-logo-dark"
                src="/icon.dark.svg"
                alt=""
              />
            </span>
            <span className="font-nav app-titlebar-text">OpenSpecUI App</span>
          </div>
          {/* Persistent toggle-button: survives collapse, aria-pressed reflects open/closed */}
          <button
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={!sidebarCollapsed}
            className="app-titlebar-sidebar-toggle"
            data-pressed={!sidebarCollapsed ? 'true' : 'false'}
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" size={15} strokeWidth={1.8} />
            ) : (
              <PanelLeftClose aria-hidden="true" size={15} strokeWidth={1.8} />
            )}
          </button>
        </div>
        <div className="app-titlebar-actions">
          <button
            aria-label={themeLabel}
            className="app-titlebar-theme-toggle"
            onClick={onToggleTheme}
            title={themeLabel}
            type="button"
          >
            <ThemeIcon aria-hidden="true" size={15} strokeWidth={1.8} />
          </button>
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
      </div>
    </header>
  )
}
