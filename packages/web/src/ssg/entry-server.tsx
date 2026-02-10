/**
 * SSR entry point for pre-rendering
 */
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { RootLayout } from '../components/layout'
import { ArchiveModalProvider } from '../lib/archive-modal-context'
import { setSSRBasePath } from '../lib/static-mode'
import { StaticDataProvider } from './static-data-context'
import { Dashboard } from '../routes/dashboard'
import { SpecList } from '../routes/spec-list'
import { SpecView } from '../routes/spec-view'
import { ChangeList } from '../routes/change-list'
import { ChangeView } from '../routes/change-view'
import { ArchiveList } from '../routes/archive-list'
import { ArchiveView } from '../routes/archive-view'
import { Config } from '../routes/config'
import { Settings } from '../routes/settings'
import type { ExportSnapshot } from '@openspecui/core'

function createRouteTree() {
  const rootRoute = createRootRoute({ component: RootLayout })

  return rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard }),
    createRoute({ getParentRoute: () => rootRoute, path: '/specs', component: SpecList }),
    createRoute({ getParentRoute: () => rootRoute, path: '/specs/$specId', component: SpecView }),
    createRoute({ getParentRoute: () => rootRoute, path: '/changes', component: ChangeList }),
    createRoute({ getParentRoute: () => rootRoute, path: '/changes/$changeId', component: ChangeView }),
    createRoute({ getParentRoute: () => rootRoute, path: '/archive', component: ArchiveList }),
    createRoute({ getParentRoute: () => rootRoute, path: '/archive/$changeId', component: ArchiveView }),
    createRoute({ getParentRoute: () => rootRoute, path: '/config', component: Config }),
    createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: Settings }),
  ])
}

/**
 * Render a route to HTML string
 */
export async function render(url: string, snapshot: ExportSnapshot, basePath = '/'): Promise<string> {
  setSSRBasePath(basePath)

  const router = createRouter({
    routeTree: createRouteTree(),
    history: createMemoryHistory({ initialEntries: [url] }),
    basepath: basePath,
  })

  await router.load()

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  return renderToString(
    <StaticDataProvider snapshot={snapshot} basePath={basePath}>
      <QueryClientProvider client={queryClient}>
        <ArchiveModalProvider>
          <RouterProvider router={router} />
        </ArchiveModalProvider>
      </QueryClientProvider>
    </StaticDataProvider>
  )
}

/**
 * Get all routes to pre-render
 */
export function getRoutes(snapshot: ExportSnapshot): string[] {
  return [
    '/',
    '/specs',
    '/changes',
    '/archive',
    '/config',
    '/settings',
    ...snapshot.specs.map(s => `/specs/${s.id}`),
    ...snapshot.changes.map(c => `/changes/${c.id}`),
    ...snapshot.archives.map(a => `/archive/${a.id}`),
  ]
}

/**
 * Get page title for a route
 */
export function getTitle(path: string, snapshot: ExportSnapshot): string {
  if (path === '/') return 'Dashboard'
  if (path === '/specs') return 'Specifications'
  if (path === '/changes') return 'Active Changes'
  if (path === '/archive') return 'Archived Changes'
  if (path === '/config') return 'Config'
  if (path === '/settings') return 'Settings'

  const specMatch = path.match(/^\/specs\/(.+)$/)
  if (specMatch) return snapshot.specs.find(s => s.id === specMatch[1])?.name || 'Spec'

  const changeMatch = path.match(/^\/changes\/(.+)$/)
  if (changeMatch) return snapshot.changes.find(c => c.id === changeMatch[1])?.name || 'Change'

  const archiveMatch = path.match(/^\/archive\/(.+)$/)
  if (archiveMatch) return snapshot.archives.find(a => a.id === archiveMatch[1])?.name || 'Archive'

  return 'OpenSpec UI'
}
