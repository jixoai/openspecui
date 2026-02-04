import { useDarkMode } from '@/lib/use-dark-mode'
import { useServerStatus } from '@/lib/use-server-status'
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { navItems, settingsItem } from './nav-items'
import { StatusIndicator } from './status-bar'

/** Mobile header with hamburger menu */
export function MobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const isDark = useDarkMode()
  const serverStatus = useServerStatus()
  const pageTitle = serverStatus.dirName ?? 'OpenSpec'

  // Get base path from runtime configuration
  const basePath = window.__OPENSPEC_BASE_PATH__ || '/'

  return (
    <>
      <header className="mobile-header border-border bg-background flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="hover:bg-muted -ml-1.5 rounded-md p-1.5"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-nav text-[12px] tracking-[0.04em]">{pageTitle}</span>
        </div>
        <StatusIndicator />
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="animate-in fade-in absolute inset-0 bg-black/50 duration-200"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="bg-background border-border animate-in slide-in-from-left relative flex w-64 max-w-[80vw] flex-col border-r p-4 duration-200">
            <div className="mb-6 flex items-center justify-between">
              <img
                src={
                  isDark
                    ? `${basePath}openspec_pixel_dark.svg`
                    : `${basePath}openspec_pixel_light.svg`
                }
                alt="OpenSpec"
                className="h-5"
              />
              <button
                onClick={() => setMenuOpen(false)}
                className="hover:bg-muted rounded-md p-1.5"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="flex-1 space-y-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground flex items-center gap-2 rounded-md px-3 py-2"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="font-nav text-[12px] tracking-[0.04em]">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-border border-t pt-4">
              <Link
                to={settingsItem.to}
                onClick={() => setMenuOpen(false)}
                className="hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground flex items-center gap-2 rounded-md px-3 py-2"
              >
                <settingsItem.icon className="h-4 w-4 shrink-0" />
                <span className="font-nav text-[12px] tracking-[0.04em]">{settingsItem.label}</span>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
