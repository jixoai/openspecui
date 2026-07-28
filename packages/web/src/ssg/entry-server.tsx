/**
 * SSR entry point for pre-rendering
 */
import type { ExportSnapshot } from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import { RootLayoutStatic } from '../components/layout/root-layout-static'
import { ArchiveModalProvider } from '../lib/archive-modal-context'
import { createStaticRouteTree } from '../lib/route-tree-static'
import { setSSRBasePath, setStaticMode } from '../lib/static-mode'
import { StaticDataProvider } from './static-data-context'

export { getRoutes, getTitle } from './route-manifest'

/**
 * Render a route to HTML string
 */
export async function render(
  url: string,
  snapshot: ExportSnapshot,
  basePath = '/'
): Promise<string> {
  setSSRBasePath(basePath)
  setStaticMode(true)

  const rootRoute = createRootRoute({ component: RootLayoutStatic })

  const router = createRouter({
    routeTree: createStaticRouteTree(rootRoute),
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
