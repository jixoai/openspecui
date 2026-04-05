import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRootRoute, createRouter } from '@tanstack/react-router'
import { PopArea, setPopRouter } from './components/layout/pop-area'
import { RootLayoutStatic } from './components/layout/root-layout-static'
import './index.css'
import { ArchiveModalProvider } from './lib/archive-modal-context'
import { navController } from './lib/nav-controller'
import { createNavHistory } from './lib/nav-history'
import { createStaticPopRouteTree, createStaticRouteTree } from './lib/route-tree-static'
import { getBasePath } from './lib/static-mode'
import { queryClient } from './lib/trpc'
import { ViewTransitionsBootstrap } from './lib/view-transitions/bootstrap'

const basepath = getBasePath()

const mainRoot = createRootRoute({
  component: RootLayoutStatic,
  pendingComponent: () => (
    <div className="route-loading text-muted-foreground animate-pulse p-6 text-center text-sm">
      Loading...
    </div>
  ),
})

const mainRouter = createRouter({
  routeTree: createStaticRouteTree(mainRoot),
  basepath,
})

const popRoot = createRootRoute({
  component: PopArea,
})
const popRouter = createRouter({
  routeTree: createStaticPopRouteTree(popRoot),
  history: createNavHistory('pop', navController),
  basepath,
})
setPopRouter(popRouter)

export function AppStatic() {
  return (
    <QueryClientProvider client={queryClient}>
      <ArchiveModalProvider>
        <ViewTransitionsBootstrap />
        <RouterProvider router={mainRouter} />
      </ArchiveModalProvider>
    </QueryClientProvider>
  )
}
