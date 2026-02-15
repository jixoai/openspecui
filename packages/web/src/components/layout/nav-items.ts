import {
  FileText,
  GitBranch,
  LayoutDashboard,
  Archive,
  Settings,
  SlidersHorizontal,
  Terminal,
  type LucideIcon,
} from 'lucide-react'

/** Valid top-level routes in the application */
export type AppRoute = '/' | '/config' | '/specs' | '/changes' | '/archive' | '/settings' | '/terminal'

export interface NavItem {
  to: AppRoute
  icon: LucideIcon
  label: string
  /** Which area this tab defaults to */
  defaultArea: 'main' | 'bottom'
}

/** All navigation items — single source of truth */
export const allNavItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', defaultArea: 'main' },
  { to: '/config', icon: SlidersHorizontal, label: 'Config', defaultArea: 'main' },
  { to: '/specs', icon: FileText, label: 'Specs', defaultArea: 'main' },
  { to: '/changes', icon: GitBranch, label: 'Changes', defaultArea: 'main' },
  { to: '/archive', icon: Archive, label: 'Archive', defaultArea: 'main' },
  { to: '/settings', icon: Settings, label: 'Settings', defaultArea: 'main' },
  { to: '/terminal', icon: Terminal, label: 'Terminal', defaultArea: 'bottom' },
]

/** Main nav items (legacy compat) */
export const navItems: NavItem[] = allNavItems.filter((i) => i.defaultArea === 'main' && i.to !== '/settings')

/** Mobile tabbar items — all main + terminal */
export const mobileNavItems: NavItem[] = allNavItems.filter((i) => i.to !== '/settings')

export const settingsItem: NavItem = allNavItems.find((i) => i.to === '/settings')!
