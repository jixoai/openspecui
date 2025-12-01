import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useDarkMode } from '@/lib/use-dark-mode'
import { useServerStatus } from '@/lib/use-server-status'
import { navItems, settingsItem } from './nav-items'
import { StatusIndicator } from './status-bar'

/** Mobile header with hamburger menu */
export function MobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const isDark = useDarkMode()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const serverStatus = useServerStatus()

  // Find current page title, fallback to dirName (project folder name)
  const currentItem = navItems.find((item) => {
    if (item.to === '/') return currentPath === '/'
    return currentPath.startsWith(item.to)
  })
  const pageTitle = currentItem?.label ?? serverStatus.dirName ?? 'OpenSpec'

  return (
    <>
      <header className="mobile-header h-12 border-b border-border bg-background px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-1.5 -ml-1.5 hover:bg-muted rounded-md"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold">{pageTitle}</span>
        </div>
        <StatusIndicator />
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="relative w-64 max-w-[80vw] bg-background border-r border-border p-4 flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-6">
              <img
                src={isDark ? '/openspec_pixel_dark.svg' : '/openspec_pixel_light.svg'}
                alt="OpenSpec"
                className="h-5"
              />
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1.5 hover:bg-muted rounded-md"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-1 flex-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="pt-4 border-t border-border">
              <Link
                to={settingsItem.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground"
              >
                <settingsItem.icon className="w-4 h-4" />
                {settingsItem.label}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
