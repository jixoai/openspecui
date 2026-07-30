/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Register App-native Connections, Environment, Workspaces, Settings, and Store routes.
 * 2. Preserve typed launch and host-presentation context across the App route tree.
 *
 * Original request (2026-07-15): "在没有后端的基础上，先把前端的初步工作先完成。"
 * Owner correction (2026-07-30): the self-drawn titlebar belongs above every App route.
 */
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { AppLayout } from './components/app-layout'
import type { HostedShellLaunchRequest } from './lib/shell-state'
import { ConnectionsRoute } from './routes/connections'
import { ContextMatrixRoute } from './routes/context-matrix'
import { EnvironmentRoute } from './routes/environment'
import { SettingsRoute } from './routes/settings'
import { StoreInspectorRoute } from './routes/store-inspector'
import { StoreInventoryRoute } from './routes/store-inventory'
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
    // 首页重定向到 Connections（Home/Connections 是 App 的主入口）。
    throw redirect({ to: '/connections' })
  },
})

const connectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/connections',
  component: ConnectionsRoute,
})

const environmentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/environment',
  component: EnvironmentRoute,
})

// --- Workspaces：现有 iframe 多标签 HostedShell，作为项目工作面入口 ---
const workspacesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspaces',
  component: WorkspacesRoute,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsRoute,
})

// --- 实验性 Store Manager（扁平路由，与 web 包 route-tree 模式一致） ---
// 路由说明：/environment/stores 是 Store Manager 根，默认重定向到 Inspector（B 视图为首选）。
const storeManagerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/environment/stores',
  beforeLoad: () => {
    throw redirect({ to: '/environment/stores/inspector' })
  },
})

const storeInspectorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/environment/stores/inspector',
  component: StoreInspectorRoute,
})

const contextMatrixRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/environment/stores/context',
  component: ContextMatrixRoute,
})

const storeInventoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/environment/stores/inventory',
  component: StoreInventoryRoute,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  connectionsRoute,
  environmentRoute,
  workspacesRoute,
  settingsRoute,
  storeManagerRoute,
  storeInspectorRoute,
  contextMatrixRoute,
  storeInventoryRoute,
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
