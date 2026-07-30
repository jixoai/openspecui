/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Register App-native Workspaces and Stores as the only primary domain routes (8.1/8.3).
 * 2. Redirect the root to Workspaces; keep Settings as a secondary utility route (8.2).
 * 3. Preserve typed launch and host-presentation context across the App route tree.
 *
 * Original request (2026-07-15): "在没有后端的基础上，先把前端的初步工作先完成。"
 * Original request (2026-07-30): "左侧只留下 Workspaces + Stores 就行了。"
 * Spec: hosted-app-distribution › "Workspaces And Stores App Information Architecture".
 *
 * Retired routes (removed without compatibility glue): /connections, /environment, /environment/stores/*
 * (Inspector/Inventory/Context Matrix). Workspaces and Stores are the only primary destinations; Settings is a
 * secondary utility route. /workspaces/tasks is the Home-owned Task Manager secondary page (8.1b).
 */
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { AppLayout } from './components/app-layout'
import { StoresIndex } from './components/stores-index'
import type { HostedShellLaunchRequest } from './lib/shell-state'
import { SettingsRoute } from './routes/settings'
import { WorkspacesRoute } from './routes/workspaces'

/**
 * App 路由上下文：承载一次性启动信息（launch params / fallback / error）。
 *
 * 这些值在 main.tsx 解析后注入 router，供 /workspaces（HostedShell）使用。
 */
export interface AppRouterContext {
  initialLaunchRequest: HostedShellLaunchRequest | null
  fallbackLaunchRequest: HostedShellLaunchRequest | null
  initialError: string | null
  appPresentation?: 'opentray-overlay'
}

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: AppLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // 首页重定向到 Workspaces（Workspaces Home 是 App 的主入口）。
    throw redirect({ to: '/workspaces' })
  },
})

// --- Workspaces：固定 Home + 项目工作面 + Task Manager ---
const workspacesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspaces',
  component: WorkspacesRoute,
})

// Home-owned Task Manager secondary page. The Workspaces shell remains mounted above routed content (8.1b).
const workspacesTasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspaces/tasks',
  // Task Manager detail is owned by the running-backend projection; render placeholder until the route is wired
  // into the layout surface. Static segment takes precedence over the Stores detail dynamic match.
  component: () => null,
})

// --- Stores：selected-Environment index + Environment evidence + composite-identity Detail ---
const storesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stores',
  component: () => (
    <StoresIndex
      rows={[]}
      envUri=""
      // TODO(P7 Store Detail): wire live Store rows + Environment authority here.
    />
  ),
})

const storesEnvironmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stores/environments',
  // Environment evidence subpage: connected projects, CLI versions, capability facts, source conflict (7.7).
  // TODO(P7): wire Environment evidence component.
  component: () => null,
})

const storeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stores/$encodedEnvUri/$storeId',
  // Composite-identity Store Detail. The route params are decoded by the Store Detail component via
  // parseStoreDetailRouteIdentity; envUri stays opaque. TODO(P7): wire Store Detail component.
  component: () => null,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsRoute,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  workspacesRoute,
  workspacesTasksRoute,
  storesRoute,
  storesEnvironmentsRoute,
  storeDetailRoute,
  settingsRoute,
])

/** Create one App router instance with its launch context injected at the root. */
export function createAppRouter(context: AppRouterContext) {
  const router = createRouter({
    routeTree,
    context,
    defaultPreload: 'intent',
  })

  return router
}

// 让 TanStack Router 类型推断锁定到本模块创建的 router 实例。
// 必须位于文件顶层（ambient module 声明要求）。
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
