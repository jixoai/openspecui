import { QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
  useRouterState,
} from '@tanstack/react-router'
import { queryClient } from './lib/trpc'
import { useServerStatus } from './lib/use-server-status'
import { Dashboard } from './routes/dashboard'
import { SpecList } from './routes/spec-list'
import { SpecView } from './routes/spec-view'
import { ChangeList } from './routes/change-list'
import { ChangeView } from './routes/change-view'
import { ArchiveList } from './routes/archive-list'
import { ArchiveView } from './routes/archive-view'
import { Project } from './routes/project'
import { Settings } from './routes/settings'
import {
  FileText,
  GitBranch,
  LayoutDashboard,
  Wifi,
  WifiOff,
  FolderOpen,
  Archive,
  Folder,
  Settings as SettingsIcon,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import './index.css'

const css = String.raw

/** Navigation items configuration */
const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/project', icon: Folder, label: 'Project' },
  { to: '/specs', icon: FileText, label: 'Specs' },
  { to: '/changes', icon: GitBranch, label: 'Changes' },
  { to: '/archive', icon: Archive, label: 'Archive' },
] as const

/**
 * Status indicator - simplified for mobile, full for desktop
 */
function StatusIndicator() {
  const status = useServerStatus()

  return (
    <div className="status-indicator flex items-center gap-1.5 text-xs">
      {status.connected ? (
        <>
          <Wifi className="w-3.5 h-3.5 text-green-500" />
          <span className="status-text text-green-600">Live</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5 text-red-500" />
          <span className="status-text text-red-600">Offline</span>
        </>
      )}
    </div>
  )
}

/**
 * Desktop status bar - full information
 */
function DesktopStatusBar() {
  const status = useServerStatus()

  return (
    <div className="desktop-status h-8 border-t border-border bg-muted/30 px-4 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <StatusIndicator />
        {status.projectDir && (
          <div className="flex items-center gap-1.5" title={status.projectDir}>
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="max-w-[300px] truncate">{status.projectDir}</span>
          </div>
        )}
      </div>
      {status.connected && (
        <div className="flex items-center gap-1.5">
          {status.watcherEnabled ? (
            <span className="text-green-600">Watching for changes</span>
          ) : (
            <span className="text-yellow-600">File watcher disabled</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Mobile header with hamburger menu
 */
function MobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  // Find current page title
  const currentItem = navItems.find((item) => {
    if (item.to === '/') return currentPath === '/'
    return currentPath.startsWith(item.to)
  })
  const pageTitle = currentItem?.label ?? 'OpenSpec'

  return (
    <>
      <header className="mobile-header h-12 border-b border-border bg-background px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-1.5 -ml-1.5 hover:bg-muted rounded-md"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold">{pageTitle}</span>
        </div>
        <StatusIndicator />
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <nav className="relative w-64 max-w-[80vw] bg-background border-r border-border p-4 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold">OpenSpec UI</h1>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1.5 hover:bg-muted rounded-md"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-1 flex-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="pt-4 border-t border-border">
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground"
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}

/**
 * Mobile bottom tab bar - quick access to main sections
 */
function MobileTabBar() {
  return (
    <nav className="mobile-tabbar h-14 border-t border-border bg-background flex items-stretch">
      {navItems.slice(0, 5).map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground [&.active]:text-primary"
        >
          <item.icon className="w-5 h-5" />
          <span className="text-[10px]">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

/**
 * Desktop sidebar navigation
 */
function DesktopSidebar() {
  return (
    <nav className="desktop-sidebar w-64 border-r border-border bg-muted/30 p-4 flex flex-col shrink-0">
      <h1 className="text-xl font-bold mb-6">OpenSpec UI</h1>
      <ul className="space-y-1 flex-1">
        {navItems.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground"
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="pt-4 border-t border-border">
        <Link
          to="/settings"
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground"
        >
          <SettingsIcon className="w-4 h-4" />
          Settings
        </Link>
      </div>
    </nav>
  )
}

/** Container query styles for responsive layout */
const layoutStyles = css`
  /* Default: mobile layout */
  .app-layout {
    display: flex;
    flex-direction: column;
  }
  .app-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .desktop-sidebar,
  .desktop-status {
    display: none;
  }
  .mobile-header,
  .mobile-tabbar {
    display: flex;
  }
  .main-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 1rem;
  }

  /* Desktop: sidebar layout (container width >= 768px) */
  @container app (min-width: 768px) {
    .app-layout {
      flex-direction: row;
    }
    .app-body {
      min-width: 0;
    }
    .desktop-sidebar,
    .desktop-status {
      display: flex;
    }
    .mobile-header,
    .mobile-tabbar {
      display: none;
    }
    .main-content {
      padding: 1.5rem;
    }
  }
`

// Root layout with responsive navigation
const rootRoute = createRootRoute({
  component: function RootLayout() {
    return (
      <div className="fixed inset-0 @container/app" style={{ containerName: 'app' }}>
        <style>{layoutStyles}</style>
        <div className="app-layout h-full">
          <DesktopSidebar />
          <div className="app-body flex flex-col flex-1 min-h-0">
            <MobileHeader />
            <main className="main-content flex flex-col">
              <Outlet />
            </main>
            <MobileTabBar />
            <DesktopStatusBar />
          </div>
        </div>
      </div>
    )
  },
})

// Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project',
  component: Project,
})

const specsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/specs',
  component: SpecList,
})

const specViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/specs/$specId',
  component: SpecView,
})

const changesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/changes',
  component: ChangeList,
})

const changeViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/changes/$changeId',
  component: ChangeView,
})

const archiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/archive',
  component: ArchiveList,
})

const archiveViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/archive/$changeId',
  component: ArchiveView,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  projectRoute,
  specsRoute,
  specViewRoute,
  changesRoute,
  changeViewRoute,
  archiveRoute,
  archiveViewRoute,
  settingsRoute,
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
