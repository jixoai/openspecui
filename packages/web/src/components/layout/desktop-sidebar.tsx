import { TerminalToggleButton } from '@/components/terminal/terminal-toggle-button'
import { getBasePath } from '@/lib/static-mode'
import { useDarkMode } from '@/lib/use-dark-mode'
import { Link } from '@tanstack/react-router'
import { navItems, settingsItem } from './nav-items'

/** Desktop sidebar navigation */
export function DesktopSidebar() {
  const isDark = useDarkMode()

  // Get base path from runtime configuration
  const basePath = getBasePath()

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
        <TerminalToggleButton className="w-full" />
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
