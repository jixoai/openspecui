/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Compose static Web providers and the static Router owner.
 * 2. Bootstrap static main/pop histories without fabricating live projection state.
 * 3. Render truthful route admission through shared visual lifecycle geometry.
 *
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下）。"
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRootRoute, createRouter } from '@tanstack/react-router'
import { PopArea, setPopRouter } from './components/layout/pop-area'
import { RootLayoutStatic } from './components/layout/root-layout-static'
import { RoutePendingSkeleton } from './components/realtime'
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
  pendingComponent: RoutePendingSkeleton,
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
