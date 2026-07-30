/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Own the global App titlebar, navigation, and mobile-safe routed viewport budget.
 * 2. Install shared connection, daemon Workspace, Store-mutation, and launch owners above every route.
 * 3. Keep project Workspaces separate from environment-scoped administration.
 * 4. Preserve the stateful HostedShell and its iframe Documents across route changes.
 *
 * Original request (2026-07-15): "在没有后端的基础上，先把前端的初步工作先完成。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 * Owner correction (2026-07-30): the self-drawn window titlebar belongs above every App route.
 * Owner correction (2026-07-30): Settings belongs in the overlay titlebar, with navigation fallback for non-overlay hosts.
 */
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Boxes, Settings, Store, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { ConnectionObservationProvider } from '../lib/connection-observation'
import { MutationObservationProvider } from '../lib/mutation-observation-provider'
import { useRouterContext } from '../lib/use-router-context'
import { useTitlebarPresentation } from '../lib/use-titlebar-presentation'
import { AppDaemonWorkspaceOwner } from './app-daemon-workspace-owner'
import { AppLaunchOwner } from './app-launch-owner'
import { AppTitlebar } from './app-titlebar'
import { HostedShell } from './hosted-shell'

interface AppNavItem {
  to: string
  icon: LucideIcon
  label: string
}

interface AppLayoutStyle extends CSSProperties {
  '--app-titlebar-left': string
  '--app-titlebar-right': string
}

/**
 * App 主导航（二八空间法则）：Workspaces 与 Stores 是仅有的两个主域入口；Settings 收纳为辅助（8.1/8.2）。
 *
 * 注意：Workspaces 是 iframe 多标签项目工作面，HostedShell 保持 App 生命周期挂载。
 */
const APP_NAV_ITEMS: AppNavItem[] = [
  { to: '/workspaces', icon: Boxes, label: 'Workspaces' },
  { to: '/stores', icon: Store, label: 'Stores' },
]

const SETTINGS_ITEM: AppNavItem = { to: '/settings', icon: Settings, label: 'Settings' }

/** Render the persistent App navigation around the current child route. */
export function AppLayout() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { appPresentation } = useRouterContext()
  const titlebar = useTitlebarPresentation(appPresentation === 'opentray-overlay')
  const workspacesVisible = pathname === '/workspaces'
  const hasOverlayTitlebar =
    titlebar.presentation.kind === 'opentray' || titlebar.presentation.kind === 'pwa-overlay'
  const [workspacesMounted, setWorkspacesMounted] = useState(workspacesVisible)
  useEffect(() => {
    if (workspacesVisible) setWorkspacesMounted(true)
  }, [workspacesVisible])
  // Workspaces/Stores 主域高亮：/workspaces/* 高亮 Workspaces；/stores/* 高亮 Stores。
  const isActive = (to: string) =>
    pathname === to ||
    (to === '/workspaces' && pathname.startsWith('/workspaces')) ||
    (to === '/stores' && pathname.startsWith('/stores'))
  const rootStyle: AppLayoutStyle = {
    '--app-titlebar-left': `${titlebar.presentation.insets.left}px`,
    '--app-titlebar-right': `${titlebar.presentation.insets.right}px`,
  }

  return (
    <AppLaunchOwner>
      <AppDaemonWorkspaceOwner>
        <MutationObservationProvider>
          <ConnectionObservationProvider>
            <div
              className="bg-background text-foreground flex h-dvh min-h-0 flex-col overflow-hidden"
              data-titlebar-presentation={titlebar.presentation.kind}
              data-testid="app-layout"
              style={rootStyle}
            >
              <AppTitlebar
                onSettings={() => void navigate({ to: '/settings' })}
                presentation={titlebar.presentation}
                onPointerDown={titlebar.onPointerDown}
                settingsActive={pathname === '/settings'}
              />

              <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                <aside className="border-border bg-muted/30 hidden w-56 shrink-0 flex-col gap-1 border-r p-3 md:flex">
                  <div className="text-muted-foreground mb-4 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide">
                    <Store className="h-4 w-4" />
                    OpenSpecUI App
                  </div>
                  <nav className="flex flex-col gap-1">
                    {APP_NAV_ITEMS.map((item) => (
                      <AppNavLink key={item.to} item={item} active={isActive(item.to)} />
                    ))}
                  </nav>
                  <div className="flex-1" />
                  {hasOverlayTitlebar ? null : (
                    <nav className="flex flex-col gap-1">
                      <AppNavLink item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM.to)} />
                    </nav>
                  )}
                </aside>

                {/* 移动端顶栏 */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <header className="border-border bg-background/80 sticky top-0 z-10 flex items-center gap-1 border-b px-2 py-2 backdrop-blur md:hidden">
                    {(hasOverlayTitlebar ? APP_NAV_ITEMS : APP_NAV_ITEMS.concat(SETTINGS_ITEM)).map(
                      (item) => {
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                              isActive(item.to)
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{item.label}</span>
                          </Link>
                        )
                      }
                    )}
                  </header>
                  <main
                    className={`min-h-0 min-w-0 flex-1 ${workspacesVisible ? 'overflow-hidden' : 'overflow-auto'}`}
                    data-testid="app-main"
                  >
                    {workspacesMounted ? (
                      <div
                        data-testid="hosted-workspaces-surface"
                        hidden={!workspacesVisible}
                        aria-hidden={!workspacesVisible}
                        className="h-full min-h-0"
                      >
                        <HostedShell
                          initialLaunchRequest={null}
                          fallbackLaunchRequest={null}
                          initialError={null}
                        />
                      </div>
                    ) : null}
                    {workspacesVisible ? null : <Outlet />}
                  </main>
                </div>
              </div>
            </div>
          </ConnectionObservationProvider>
        </MutationObservationProvider>
      </AppDaemonWorkspaceOwner>
    </AppLaunchOwner>
  )
}

function AppNavLink({ item, active }: { item: AppNavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  )
}
