/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Own the global App titlebar, shared desktop sidebar expansion, navigation, and mobile-safe routed viewport budget.
 * 2. Install shared connection, daemon Workspace, Store-mutation, and launch owners above every route.
 * 3. Keep project Workspaces separate from environment-scoped administration.
 * 4. Preserve the stateful HostedShell and its iframe Documents across route changes.
 * 5. Keep Stores runtime and ledger-level backend observation mounted across their complete App scopes.
 * Compromise: Task Manager Dialog and favorite-nav launch ownership remain here because both span the persistent
 * HostedShell and daemon Workspace owner without becoming another primary or routed domain.
 *
 * Original request (2026-07-15): "在没有后端的基础上，先把前端的初步工作先完成。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 * Owner correction (2026-07-30): the self-drawn window titlebar belongs above every App route.
 * Owner correction (2026-07-30): Settings belongs in the overlay titlebar, with navigation fallback for non-overlay hosts.
 * Owner correction (2026-07-31): "TaskManagerPage 改成 TaskManagerDialog"
 * Owner correction (2026-07-31): Workspaces secondary navigation directly lists Favorites; Running evidence moves
 *   to Task Manager and requires Health API plus WebSocket observation.
 * Owner correction (2026-07-31): replace the sidebar glyph with the App logo and retire PWA chrome.
 * Owner correction (2026-07-31): OpenTray hides duplicate sidebar branding; favorite rows use status lights only.
 * Owner correction (2026-07-31): either App brand toggles a compact icon-only primary-navigation rail.
 * Owner correction (2026-07-31): sidebar topology changes use native View Transitions, never transform/width timers.
 */
import { selectWorkspaceDirectoryCatalogView } from '@openspecui/core/workspace-directory-catalog'
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Boxes, PanelLeftClose, Settings, Store, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { ConnectionObservationProvider } from '../lib/connection-observation'
import { MutationObservationProvider } from '../lib/mutation-observation-provider'
import {
  RunningBackendObservationProvider,
  useRunningBackendObservations,
} from '../lib/running-backend-observation-provider'
import { runSidebarViewTransition } from '../lib/sidebar-view-transition'
import { StoresRuntimeProvider } from '../lib/stores-runtime'
import { useHostedShellThemeState } from '../lib/use-hosted-shell-theme'
import { useRouterContext } from '../lib/use-router-context'
import { useTitlebarPresentation } from '../lib/use-titlebar-presentation'
import { AppDaemonWorkspaceOwner, useAppDaemonWorkspace } from './app-daemon-workspace-owner'
import { AppLaunchOwner } from './app-launch-owner'
import { AppTitlebar } from './app-titlebar'
import { HostedShell } from './hosted-shell'
import { WorkspaceTaskManagerDialog } from './workspace-task-manager-dialog'
import { WorkspacesSecondaryNav } from './workspaces-secondary-nav'

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
  return (
    <AppLaunchOwner>
      <AppDaemonWorkspaceOwner>
        <RunningBackendObservationProvider>
          <MutationObservationProvider>
            <ConnectionObservationProvider>
              <AppLayoutSurface />
            </ConnectionObservationProvider>
          </MutationObservationProvider>
        </RunningBackendObservationProvider>
      </AppDaemonWorkspaceOwner>
    </AppLaunchOwner>
  )
}

function AppLayoutSurface() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { appPresentation } = useRouterContext()
  const titlebar = useTitlebarPresentation(appPresentation === 'opentray-overlay')
  const appTheme = useHostedShellThemeState()
  const workspacesVisible = pathname === '/workspaces'
  const hasOverlayTitlebar = titlebar.presentation.kind === 'opentray'
  const [workspacesMounted, setWorkspacesMounted] = useState(workspacesVisible)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [taskManagerOpen, setTaskManagerOpen] = useState(false)
  const [favoritePendingPath, setFavoritePendingPath] = useState<string | null>(null)
  const [favoriteLaunchError, setFavoriteLaunchError] = useState<string | null>(null)
  const daemonWorkspace = useAppDaemonWorkspace()
  const runningBackendObservations = useRunningBackendObservations()
  const favoriteDirectories = selectWorkspaceDirectoryCatalogView(
    daemonWorkspace.directoryCatalog
  ).favorites
  const runningWorkspaceIds = new Set(
    runningBackendObservations.observations.flatMap((observation) =>
      observation.state === 'running' ? [observation.workspaceId] : []
    )
  )
  const runningProjectPaths = daemonWorkspace.workspaces.flatMap((workspace) =>
    runningWorkspaceIds.has(workspace.id) ? [workspace.projectDir] : []
  )
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
  const toggleSidebar = () => {
    runSidebarViewTransition({
      direction: sidebarCollapsed ? 'expand' : 'collapse',
      update: () => setSidebarCollapsed((collapsed) => !collapsed),
    })
  }
  const openFavorite = (canonicalPath: string) => {
    const current = daemonWorkspace.workspaces.find(
      (workspace) => workspace.projectDir === canonicalPath
    )
    if (current) {
      daemonWorkspace.focusWorkspace(current.id)
      void navigate({ to: '/workspaces' })
      return
    }
    if (favoritePendingPath !== null) return
    setFavoritePendingPath(canonicalPath)
    setFavoriteLaunchError(null)
    void daemonWorkspace
      .startManagedProject(canonicalPath)
      .then(() => {
        void navigate({ to: '/workspaces' })
      })
      .catch((error: unknown) => {
        setFavoriteLaunchError(
          error instanceof Error ? error.message : 'Failed to start favorite Workspace.'
        )
      })
      .finally(() => setFavoritePendingPath(null))
  }

  return (
    <div
      className="text-foreground flex h-dvh min-h-0 flex-col overflow-hidden"
      data-app-shell
      data-titlebar-presentation={titlebar.presentation.kind}
      data-testid="app-layout"
      style={rootStyle}
    >
      <AppTitlebar
        onSettings={() => void navigate({ to: '/settings' })}
        presentation={titlebar.presentation}
        onPointerDown={titlebar.onPointerDown}
        settingsActive={pathname === '/settings'}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        theme={appTheme.theme}
        resolvedTheme={appTheme.resolvedTheme}
        onToggleTheme={appTheme.toggleTheme}
      />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <aside
          className={`border-border bg-muted/30 hidden shrink-0 flex-col gap-1 overflow-hidden border-r md:flex ${
            sidebarCollapsed ? 'w-14 p-2' : 'w-56 p-3'
          }`}
          data-app-sidebar
          data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}
        >
          {hasOverlayTitlebar ? null : (
            <div
              className={`mb-4 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
            >
              <button
                aria-expanded={!sidebarCollapsed}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className={`text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 items-center rounded-md text-xs font-semibold uppercase tracking-wide transition-colors ${
                  sidebarCollapsed ? 'justify-center px-0' : 'gap-2 px-2'
                }`}
                data-app-sidebar-brand
                onClick={toggleSidebar}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                type="button"
              >
                <img aria-hidden="true" className="h-4 w-4 shrink-0" src="/icon.svg" alt="" />
                <span className={sidebarCollapsed ? 'sr-only' : undefined}>OpenSpecUI App</span>
              </button>
              {!sidebarCollapsed ? (
                <button
                  aria-label="Collapse sidebar"
                  className="app-sidebar-toggle hover:bg-muted text-muted-foreground hover:text-foreground border-border inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
                  onClick={toggleSidebar}
                  title="Collapse sidebar"
                  type="button"
                >
                  <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          )}
          <nav className="flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden">
            <AppNavLink
              item={APP_NAV_ITEMS[0]!}
              active={isActive('/workspaces')}
              collapsed={sidebarCollapsed}
            />
            {sidebarCollapsed ? null : (
              <div className="ml-4 max-h-72 min-w-0 overflow-y-auto overflow-x-hidden pl-1">
                <WorkspacesSecondaryNav
                  favorites={favoriteDirectories}
                  runningPaths={runningProjectPaths}
                  pendingPath={favoritePendingPath}
                  onSelect={openFavorite}
                />
                {favoriteLaunchError ? (
                  <p role="alert" className="text-destructive px-2 py-1 text-xs">
                    {favoriteLaunchError}
                  </p>
                ) : null}
              </div>
            )}
            <AppNavLink
              item={APP_NAV_ITEMS[1]!}
              active={isActive('/stores')}
              collapsed={sidebarCollapsed}
            />
          </nav>
          <div className="flex-1" />
          {hasOverlayTitlebar ? null : (
            <nav className="flex flex-col gap-1">
              <AppNavLink
                item={SETTINGS_ITEM}
                active={isActive(SETTINGS_ITEM.to)}
                collapsed={sidebarCollapsed}
              />
            </nav>
          )}
        </aside>

        {/* 移动端顶栏 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-app-shell-content>
          <header className="border-border bg-background/80 sticky top-0 z-10 flex items-center gap-1 border-b px-2 py-2 backdrop-blur md:hidden">
            <img aria-hidden="true" className="h-4 w-4 shrink-0" src="/icon.svg" alt="" />
            <div className="flex items-center gap-1">
              {APP_NAV_ITEMS.map((item) => {
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
              })}
            </div>
            <div className="flex-1" />
            <Link
              aria-label="Settings"
              to={SETTINGS_ITEM.to}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                isActive(SETTINGS_ITEM.to)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{SETTINGS_ITEM.label}</span>
            </Link>
          </header>
          {isActive('/workspaces') ? (
            <div className="hidden" data-testid="mobile-workspaces-secondary-nav" />
          ) : null}
          <main
            className={`bg-background min-h-0 min-w-0 flex-1 ${workspacesVisible ? 'overflow-hidden' : 'overflow-auto'}`}
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
                  onOpenTaskManager={() => setTaskManagerOpen(true)}
                  appTheme={appTheme.theme}
                />
              </div>
            ) : null}
            <StoresRuntimeProvider enabled={pathname.startsWith('/stores')}>
              {workspacesVisible ? null : <Outlet />}
            </StoresRuntimeProvider>
          </main>
        </div>
      </div>
      <WorkspaceTaskManagerDialog
        open={taskManagerOpen}
        onClose={() => setTaskManagerOpen(false)}
      />
    </div>
  )
}

function AppNavLink({
  item,
  active,
  collapsed,
}: {
  item: AppNavItem
  active: boolean
  collapsed: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`flex h-9 items-center rounded-md text-sm transition-colors ${
        collapsed ? 'justify-center px-0' : 'gap-2 px-3'
      } ${
        active
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={collapsed ? 'sr-only' : undefined}>{item.label}</span>
    </Link>
  )
}
