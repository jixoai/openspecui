import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { RootLayout } from './components/layout'
import './index.css'
import { ArchiveModalProvider } from './lib/archive-modal-context'
import { queryClient } from './lib/trpc'
import { ArchiveList } from './routes/archive-list'
import { ArchiveView } from './routes/archive-view'
import { ChangeList } from './routes/change-list'
import { ChangeView } from './routes/change-view'
import { Dashboard } from './routes/dashboard'
import { Project } from './routes/project'
import { Settings } from './routes/settings'
import { SpecList } from './routes/spec-list'
import { SpecView } from './routes/spec-view'

// Add type declaration for runtime base path
declare global {
  interface Window {
    __OPENSPEC_BASE_PATH__?: string
  }
}

// Root layout
const rootRoute = createRootRoute({
  component: RootLayout,
  pendingComponent: () => (
    <div className="route-loading text-muted-foreground animate-pulse p-6 text-center text-sm">
      Loading...
    </div>
  ),
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

// Get base path from runtime configuration (injected in index.html)
const basepath = window.__OPENSPEC_BASE_PATH__ || '/'

const router = createRouter({
  routeTree,
  basepath,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ArchiveModalProvider>
        <RouterProvider router={router} />
      </ArchiveModalProvider>
    </QueryClientProvider>
  )
}
