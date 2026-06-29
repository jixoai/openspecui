import {
  Archive,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  Settings,
  SlidersHorizontal,
  Terminal,
  Warehouse,
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
  | '/stores'
  | '/settings'
  | '/terminal'

export interface NavItem {
  to: AppRoute
  icon: LucideIcon
  label: string
  /** Which area this tab defaults to */
  defaultArea: 'main' | 'bottom'
  /**
   * Whether this entry is a beta feature whose visibility is controlled at
   * runtime by fault tolerance (e.g. Stores hides when its CLI command is
   * unavailable). Non-beta entries are always visible.
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
  { to: '/stores', icon: Warehouse, label: 'Stores', defaultArea: 'main', beta: true },
  { to: '/settings', icon: Settings, label: 'Settings', defaultArea: 'main' },
  { to: '/terminal', icon: Terminal, label: 'Terminal', defaultArea: 'bottom' },
]

/** Main nav items (legacy compat) */
export const navItems: NavItem[] = allNavItems.filter(
  (i) => i.defaultArea === 'main' && i.to !== '/settings'
)

/** Mobile tabbar items — all main + terminal */
export const mobileNavItems: NavItem[] = allNavItems.filter((i) => i.to !== '/settings')

export const settingsItem: NavItem = allNavItems.find((i) => i.to === '/settings')!
