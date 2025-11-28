import {
  FileText,
  GitBranch,
  LayoutDashboard,
  Archive,
  Folder,
  Settings,
  type LucideIcon,
} from 'lucide-react'

/** Valid top-level routes in the application */
type AppRoute = '/' | '/project' | '/specs' | '/changes' | '/archive' | '/settings'

export interface NavItem {
  to: AppRoute
  icon: LucideIcon
  label: string
}

/** Navigation items configuration */
export const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/project', icon: Folder, label: 'Project' },
  { to: '/specs', icon: FileText, label: 'Specs' },
  { to: '/changes', icon: GitBranch, label: 'Changes' },
  { to: '/archive', icon: Archive, label: 'Archive' },
]

export const settingsItem: NavItem = {
  to: '/settings',
  icon: Settings,
  label: 'Settings',
}
