import { Link } from '@tanstack/react-router'
import { useDarkMode } from '@/lib/use-dark-mode'
import { navItems, settingsItem } from './nav-items'

/** Desktop sidebar navigation */
export function DesktopSidebar() {
  const isDark = useDarkMode()

  return (
    <nav className="desktop-sidebar w-64 border-r border-border bg-muted/30 p-4 flex flex-col shrink-0">
      <div className="mb-6">
        <img
          src={isDark ? '/openspec_pixel_dark.svg' : '/openspec_pixel_light.svg'}
          alt="OpenSpec"
          className="h-6"
        />
      </div>
      <ul className="space-y-1 flex-1">
        {navItems.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
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
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground"
        >
          <settingsItem.icon className="w-4 h-4" />
          {settingsItem.label}
        </Link>
      </div>
    </nav>
  )
}
