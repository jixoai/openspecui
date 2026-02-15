import { getBasePath, isStaticMode } from '@/lib/static-mode'
import { useNavLayout } from '@/lib/use-nav-controller'
import { useDarkMode } from '@/lib/use-dark-mode'
import { Link } from '@tanstack/react-router'
import { navItems, settingsItem } from './nav-items'
import { AreaNav } from './area-nav'

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
      ) : (
        /* IDE mode: split nav with drag-and-drop */
        <div className="flex flex-1 flex-col gap-2">
          {/* Main area tabs */}
          <div className="flex-1">
            <AreaNav area="main" tabs={navLayout.mainTabs} />
          </div>

          {/* Bottom area tabs */}
          {navLayout.bottomTabs.length > 0 && (
            <div className="border-border border-t pt-2">
              <div className="text-muted-foreground mb-1 px-2 text-[10px] font-medium uppercase tracking-wider">
                Bottom
              </div>
              <AreaNav area="bottom" tabs={navLayout.bottomTabs} />
            </div>
          )}
        </div>
      )}

      <div className="border-border space-y-1 border-t pt-4">
        <Link
          to={settingsItem.to}
          className="hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground flex items-center gap-2 rounded-md px-3 py-2"
        >
          <settingsItem.icon className="h-4 w-4 shrink-0" />
          <span className="font-nav text-base tracking-[0.04em]">{settingsItem.label}</span>
        </Link>
      </div>
    </nav>
  )
}
