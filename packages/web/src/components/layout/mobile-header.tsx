import { getBasePath, isStaticMode } from '@/lib/static-mode'
import { useDarkMode } from '@/lib/use-dark-mode'
import { useNavLayout } from '@/lib/use-nav-controller'
import { useServerStatus } from '@/lib/use-server-status'
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { AreaNav } from './area-nav'
import { navItems, settingsItem } from './nav-items'
import { StatusIndicator } from './status-bar'

/** Mobile header with hamburger menu — matches desktop sidebar structure */
export function MobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const isDark = useDarkMode()
  const serverStatus = useServerStatus()
  const navLayout = useNavLayout()
  const pageTitle = serverStatus.dirName ?? 'OpenSpec'
  const basePath = getBasePath()
  const isStatic = isStaticMode()

  const closeMenu = () => setMenuOpen(false)

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

      {/* Mobile menu overlay — mirrors desktop sidebar layout */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="animate-in fade-in absolute inset-0 bg-black/50 duration-200"
            onClick={closeMenu}
          />
          <nav className="bg-background border-border animate-in slide-in-from-left relative flex h-full w-64 max-w-[80vw] flex-col border-r p-4 duration-200">
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
                onClick={closeMenu}
                className="hover:bg-muted rounded-md p-1.5"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isStatic ? (
              /* Static mode: simple nav list */
              <>
                <ul className="flex-1 space-y-1">
                  {navItems.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={closeMenu}
                        className="hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground flex items-center gap-2 rounded-md px-3 py-2"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="font-nav text-base tracking-[0.04em]">{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="border-border space-y-1 border-t pt-4">
                  <Link
                    to={settingsItem.to}
                    onClick={closeMenu}
                    className="hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground flex items-center gap-2 rounded-md px-3 py-2"
                  >
                    <settingsItem.icon className="h-4 w-4 shrink-0" />
                    <span className="font-nav text-base tracking-[0.04em]">
                      {settingsItem.label}
                    </span>
                  </Link>
                </div>
              </>
            ) : (
              /* IDE mode (mobile): align structure with desktop sidebar */
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="min-h-0 flex-1">
                  <AreaNav area="main" tabs={navLayout.mainTabs} className="h-full overflow-auto" useLinks onNavigate={closeMenu} />
                </div>
                <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                  Bottom
                </div>
                <div className="border-border border-t pt-2">
                  <AreaNav area="bottom" tabs={navLayout.bottomTabs} onNavigate={closeMenu} />
                </div>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  )
}
