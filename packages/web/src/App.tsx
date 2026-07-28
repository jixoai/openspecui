/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Compose live Web providers and the main Router owner.
 * 2. Bootstrap IDE main, bottom, and pop navigation histories.
 * 3. Preserve static/live router selection and shared base-path behavior.
 * 4. Install theme and View Transition runtime ownership.
 * 5. Render route admission through the shared visual lifecycle geometry.
 *
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下）。"
 * Compromise: provider and router bootstrap remain co-located because TanStack Router registration and the
 * main/bottom/pop singleton wiring are module-scoped runtime ownership.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRootRoute, createRouter } from '@tanstack/react-router'
import { RootLayout } from './components/layout'
import { BottomArea, setBottomRouter } from './components/layout/bottom-area'
import { PopArea, setPopRouter } from './components/layout/pop-area'
import { RoutePendingSkeleton } from './components/realtime'
import { ThemeBootstrap } from './components/theme-bootstrap'
import './index.css'
import { ArchiveModalProvider } from './lib/archive-modal-context'
import { navController } from './lib/nav-controller'
import { createNavHistory } from './lib/nav-history'
import { NotificationProvider } from './lib/notifications/context'
import { createPopRouteTree, createRouteTree } from './lib/route-tree'
import { getBasePath, isStaticMode } from './lib/static-mode'
import { TerminalProvider } from './lib/terminal-context'
import { queryClient } from './lib/trpc'
import { ViewTransitionsBootstrap } from './lib/view-transitions/bootstrap'

// --- Static mode: single router, standard browser history ---
// --- IDE mode: dual routers via navController ---

const isStatic = isStaticMode()

// Root layout for main area
const mainRoot = createRootRoute({
  component: RootLayout,
  pendingComponent: RoutePendingSkeleton,
})

const basepath = getBasePath()

const mainRouter = isStatic
  ? createRouter({
      routeTree: createRouteTree(mainRoot),
      basepath,
    })
  : createRouter({
      routeTree: createRouteTree(mainRoot),
      history: createNavHistory('main', navController),
      basepath,
    })

// Bottom router (only in IDE mode)
if (!isStatic) {
  const bottomRoot = createRootRoute({
    component: BottomArea,
  })
  const bottomRouter = createRouter({
    routeTree: createRouteTree(bottomRoot),
    history: createNavHistory('bottom', navController),
    basepath,
  })
  setBottomRouter(bottomRouter)
}

const popRoot = createRootRoute({
  component: PopArea,
})
const popRouter = createRouter({
  routeTree: createPopRouteTree(popRoot),
  history: createNavHistory('pop', navController),
  basepath,
})
setPopRouter(popRouter)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof mainRouter
  }
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ArchiveModalProvider>
        <TerminalProvider>
          <NotificationProvider>
            <ViewTransitionsBootstrap />
            <ThemeBootstrap />
            <RouterProvider router={mainRouter} />
          </NotificationProvider>
        </TerminalProvider>
      </ArchiveModalProvider>
    </QueryClientProvider>
  )
}
