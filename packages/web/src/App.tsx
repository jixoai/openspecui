import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { queryClient } from './lib/trpc'
import { RootLayout } from './components/layout'
import { Dashboard } from './routes/dashboard'
import { SpecList } from './routes/spec-list'
import { SpecView } from './routes/spec-view'
import { ChangeList } from './routes/change-list'
import { ChangeView } from './routes/change-view'
import { ArchiveList } from './routes/archive-list'
import { ArchiveView } from './routes/archive-view'
import { Project } from './routes/project'
import { Settings } from './routes/settings'
import { ArchiveModalProvider } from './lib/archive-modal-context'
import './index.css'

// Root layout
const rootRoute = createRootRoute({
  component: RootLayout,
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
      <ArchiveModalProvider>
        <RouterProvider router={router} />
      </ArchiveModalProvider>
    </QueryClientProvider>
  )
}
