/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Define the supported project navigation identity and default area for each route.
 * 2. Derive desktop and mobile navigation from one canonical item registry.
 * 3. Keep Context as the sole project surface for Root, Reference, and registry diagnostics.
 *
 * Original request (2026-07-18): "replace the project WebUI Stores route with the canonical Context surface."
 */
import {
  Archive,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  Network,
  Settings,
  SlidersHorizontal,
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
  | '/archive'
  | '/context'
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
  { to: '/archive', icon: Archive, label: 'Archive', defaultArea: 'main' },
  // 6.9 Context 取代项目 Stores 页（root/Reference/registry 只读诊断）。
  { to: '/context', icon: Network, label: 'Context', defaultArea: 'main' },
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
