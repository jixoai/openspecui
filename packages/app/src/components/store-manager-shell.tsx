/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Compose the selected backend, Inspector, Context Matrix, and Inventory as one Store workspace.
 * 2. Keep Store Manager explicitly experimental.
 * 3. Contain child Store facts within the available mobile inline size.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Owner-reported acceptance gap (2026-07-26): Store Manager did not expose how to select B while retaining A.
 */
import { Link, useRouterState } from '@tanstack/react-router'
import { Columns3, FlaskConical, List, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { StoreManagerBackendSelector } from './store-manager-backend-selector'

/**
 * Store Manager 共享外壳：Experimental 标记 + 三视图导航。
 *
 * 因为路由采用扁平结构（与 web 包 route-tree 模式一致），每个视图组件在顶部渲染此外壳，
 * 避免嵌套布局路由的类型复杂性，同时保持三视图导航与 Experimental 标记的一致性。
 *
 * 关键约束（AGENTS.md）：
 *  - Store Manager 始终明确标记为 experimental，不是 OpenSpecUI 6.0 支持门禁（9.12）。
 *  - App 不实现 Store Git clone/pull/push/synchronization，不做文件系统级项目扫描（9.11）。
 *  - Inspector 是主交互；Context Matrix 是兄弟 Context 视图；Inventory 是宽屏扫描。
 */
export function StoreManagerShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden p-4 md:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="font-nav text-2xl font-bold">Store Manager</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              <FlaskConical className="h-3 w-3" />
              Experimental
            </span>
          </div>
          <StoreManagerBackendSelector />
        </div>
        <p className="text-muted-foreground text-sm">
          Environment-scoped Store administration. Store mutations are backend-owned operations;
          OpenSpecUI does not implement Git synchronization or filesystem-wide scanning.
        </p>
      </header>

      <nav className="border-border flex gap-1 border-b">
        <StoreManagerTabLink
          to="/environment/stores/inspector"
          active={pathname.endsWith('/inspector')}
          icon={Search}
          label="Inspector"
        />
        <StoreManagerTabLink
          to="/environment/stores/context"
          active={pathname.endsWith('/context')}
          icon={Columns3}
          label="Context Matrix"
        />
        <StoreManagerTabLink
          to="/environment/stores/inventory"
          active={pathname.endsWith('/inventory')}
          icon={List}
          label="Inventory"
        />
      </nav>

      {children}
    </div>
  )
}

function StoreManagerTabLink({
  to,
  active,
  icon: Icon,
  label,
}: {
  to: string
  active: boolean
  icon: typeof Search
  label: string
}) {
  return (
    <Link
      to={to}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
        active
          ? 'border-primary text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground border-transparent'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}
