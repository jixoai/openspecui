import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRootRoute, createRouter } from '@tanstack/react-router'
import { RootLayout } from './components/layout'
import { BottomArea, setBottomRouter } from './components/layout/bottom-area'
import './index.css'
import { ArchiveModalProvider } from './lib/archive-modal-context'
import { TerminalProvider } from './lib/terminal-context'
import { isStaticMode, getBasePath } from './lib/static-mode'
import { queryClient } from './lib/trpc'
import { createRouteTree } from './lib/route-tree'
import { navController } from './lib/nav-controller'
import { createNavHistory } from './lib/nav-history'

// --- Static mode: single router, standard browser history ---
// --- IDE mode: dual routers via navController ---

const isStatic = isStaticMode()

// Root layout for main area
const mainRoot = createRootRoute({
  component: RootLayout,
  pendingComponent: () => (
    <div className="route-loading text-muted-foreground animate-pulse p-6 text-center text-sm">
      Loading...
    </div>
  ),
})

const basepath = getBasePath()

const mainRouter = isStatic
  ? createRouter({
      routeTree: createRouteTree(mainRoot),
      basepath,
      defaultViewTransition: true,
    })
  : createRouter({
      routeTree: createRouteTree(mainRoot),
      history: createNavHistory('main', navController),
      basepath,
      defaultViewTransition: true,
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
          <RouterProvider router={mainRouter} />
        </TerminalProvider>
      </ArchiveModalProvider>
    </QueryClientProvider>
  )
}
