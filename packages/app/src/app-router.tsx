/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Register App-native Workspaces and Stores as the only primary domain routes (8.1/8.3).
 * 2. Redirect the root to Workspaces; keep Settings as a secondary utility route (8.2).
 * 3. Preserve typed launch and host-presentation context across the App route tree; Task Manager is App-owned overlay state.
 *
 * Original request (2026-07-15): "在没有后端的基础上，先把前端的初步工作先完成。"
 * Original request (2026-07-30): "左侧只留下 Workspaces + Stores 就行了。"
 * Spec: hosted-app-distribution › "Workspaces And Stores App Information Architecture".
 *
 * Retired routes (removed without compatibility glue): /connections, /environment, /environment/stores/*
 * (Inspector/Inventory/Context Matrix). Workspaces and Stores are the only primary destinations; Settings is a
 * secondary utility route. Task Manager is a Home-opened Dialog rather than a route.
 */
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { AppLayout } from './components/app-layout'
import type { HostedShellLaunchRequest } from './lib/shell-state'
import { SettingsRoute } from './routes/settings'
import { StoreDetailRoute } from './routes/store-detail'
import { StoresEnvironmentsRoute } from './routes/stores-environments'
import { StoresIndexRoute } from './routes/stores-index'
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

// --- Workspaces：固定 Home + 项目工作面 ---
const workspacesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspaces',
  component: WorkspacesRoute,
})

// --- Stores：selected-Environment index + Environment evidence + composite-identity Detail ---
const storesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stores',
  component: StoresIndexRoute,
})

const storesEnvironmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stores/environments',
  component: StoresEnvironmentsRoute,
})

const storeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stores/$encodedEnvUri/$storeId',
  component: StoreDetailRoute,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsRoute,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  workspacesRoute,
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
