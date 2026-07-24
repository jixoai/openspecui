/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Provide the persistent App navigation and routed content layout.
 * 2. Keep project Sessions separate from environment-scoped administration.
 * 3. Install shared connection and Store-mutation observation owners above every route.
 *
 * Original request (2026-07-15): "在没有后端的基础上，先把前端的初步工作先完成。"
 */
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Boxes, Home, MonitorSmartphone, Settings, Store, type LucideIcon } from 'lucide-react'
import { ConnectionObservationProvider } from '../lib/connection-observation'
import { MutationObservationProvider } from '../lib/mutation-observation-provider'

interface AppNavItem {
  to: string
  icon: LucideIcon
  label: string
}

/**
 * App 级主导航（二八空间法则：高频 Home/Environment/Sessions 在直接空间；Settings 收纳）。
 *
 * 注意：Sessions（iframe 多标签项目工作面）保留为现有 HostedShell 入口。
 */
const APP_NAV_ITEMS: AppNavItem[] = [
  { to: '/connections', icon: Home, label: 'Connections' },
  { to: '/environment', icon: MonitorSmartphone, label: 'Environment' },
  { to: '/sessions', icon: Boxes, label: 'Sessions' },
]

const SETTINGS_ITEM: AppNavItem = { to: '/settings', icon: Settings, label: 'Settings' }

/** Render the persistent App navigation around the current child route. */
export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // /environment/stores 下的任意子路由都高亮 Environment。
  const isActive = (to: string) =>
    pathname === to || (to === '/environment' && pathname.startsWith('/environment'))

  return (
    <MutationObservationProvider>
      <ConnectionObservationProvider>
        <div className="bg-background text-foreground flex min-h-screen">
          <aside className="border-border bg-muted/30 hidden w-56 shrink-0 flex-col gap-1 border-r p-3 md:flex">
            <div className="text-muted-foreground mb-4 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide">
              <Store className="h-4 w-4" />
              OpenSpecUI App
            </div>
            <nav className="flex flex-col gap-1">
              {APP_NAV_ITEMS.map((item) => (
                <AppNavLink key={item.to} item={item} active={isActive(item.to)} />
              ))}
            </nav>
            <div className="flex-1" />
            <nav className="flex flex-col gap-1">
              <AppNavLink item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM.to)} />
            </nav>
          </aside>

          {/* 移动端顶栏 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-border bg-background/80 sticky top-0 z-10 flex items-center gap-1 border-b px-2 py-2 backdrop-blur md:hidden">
              {APP_NAV_ITEMS.concat(SETTINGS_ITEM).map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                      isActive(item.to)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                )
              })}
            </header>
            <main className="min-w-0 flex-1">
              <Outlet />
            </main>
          </div>
        </div>
      </ConnectionObservationProvider>
    </MutationObservationProvider>
  )
}

function AppNavLink({ item, active }: { item: AppNavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  )
}
