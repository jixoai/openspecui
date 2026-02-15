import { getBasePath, isStaticMode } from '@/lib/static-mode'
import { useDarkMode } from '@/lib/use-dark-mode'
import { useNavLayout } from '@/lib/use-nav-controller'
import { Link } from '@tanstack/react-router'
import { AreaNav } from './area-nav'
import { navItems, settingsItem } from './nav-items'

/** Desktop sidebar navigation */
export function DesktopSidebar() {
  const isDark = useDarkMode()
  const navLayout = useNavLayout()
  const basePath = getBasePath()
  const isStatic = isStaticMode()

  return (
    <nav className="desktop-sidebar border-border bg-muted/30 flex w-64 shrink-0 flex-col border-r p-4">
      <div className="mb-6">
        <img
          src={
            isDark ? `${basePath}openspec_pixel_dark.svg` : `${basePath}openspec_pixel_light.svg`
          }
          alt="OpenSpec"
          className="h-6"
        />
      </div>

      {isStatic ? (
        /* Static mode: simple nav list */
        <div className="flex flex-1 flex-col">
          <ul className="flex-1 space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
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
              className="hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground flex items-center gap-2 rounded-md px-3 py-2"
            >
              <settingsItem.icon className="h-4 w-4 shrink-0" />
              <span className="font-nav text-base tracking-[0.04em]">{settingsItem.label}</span>
            </Link>
          </div>
        </div>
      ) : (
        /* IDE mode: split nav with drag-and-drop — all items draggable between areas */
        <div className="flex flex-1 flex-col gap-2">
          {/* Main area tabs (including Settings) */}
          <div className="flex-1">
            <AreaNav area="main" tabs={navLayout.mainTabs} className="h-full" />
          </div>

          {/* Bottom area tabs (always rendered as drop target) */}
          <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
            Bottom
          </div>
          <div className="border-border border-t pt-2">
            <AreaNav area="bottom" tabs={navLayout.bottomTabs} />
          </div>
        </div>
      )}
    </nav>
  )
}
