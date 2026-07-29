/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Define the supported project navigation identity and default area for each route.
 * 2. Derive desktop and mobile navigation from one canonical item registry.
 * 3. Keep Resolved Context under Config while objective Kanban remains a project surface.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Original request (2026-07-28): add the objective Kanban project surface.
 * Owner Context direction (2026-07-29): remove Context from persistent project navigation.
 */
import {
  Archive,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  Settings,
  SlidersHorizontal,
  SquareKanban,
  Terminal,
  type LucideIcon,
} from 'lucide-react'

/** Valid top-level routes in the application */
export type AppRoute =
  | '/dashboard'
  | '/config'
  | '/git'
  | '/specs'
  | '/changes'
  | '/board'
  | '/archive'
  | '/settings'
  | '/terminal'

/** One canonical project navigation entry and its default workspace area. */
export interface NavItem {
  to: AppRoute
  icon: LucideIcon
  label: string
  /** Which area this tab defaults to */
  defaultArea: 'main' | 'bottom'
  /**
   * Whether this entry is a beta feature whose visibility may be controlled at
   * runtime by feature-specific fault tolerance. Non-beta entries are always visible.
   */
  beta?: boolean
}

/** All navigation items — single source of truth */
export const allNavItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', defaultArea: 'main' },
  { to: '/config', icon: SlidersHorizontal, label: 'Config', defaultArea: 'main' },
  { to: '/git', icon: GitBranch, label: 'Git', defaultArea: 'bottom' },
  { to: '/specs', icon: FileText, label: 'Specs', defaultArea: 'main' },
  { to: '/changes', icon: ListTodo, label: 'Changes', defaultArea: 'main' },
  { to: '/board', icon: SquareKanban, label: 'Kanban', defaultArea: 'main' },
  { to: '/archive', icon: Archive, label: 'Archive', defaultArea: 'main' },
  { to: '/settings', icon: Settings, label: 'Settings', defaultArea: 'main' },
  { to: '/terminal', icon: Terminal, label: 'Terminal', defaultArea: 'bottom' },
]

/** Main nav items (legacy compat) */
export const navItems: NavItem[] = allNavItems.filter(
  (i) => i.defaultArea === 'main' && i.to !== '/settings'
)

/** Mobile tabbar items — all main + terminal */
export const mobileNavItems: NavItem[] = allNavItems.filter((i) => i.to !== '/settings')

/** Canonical Settings entry rendered separately by desktop navigation. */
export const settingsItem: NavItem = allNavItems.find((i) => i.to === '/settings')!
