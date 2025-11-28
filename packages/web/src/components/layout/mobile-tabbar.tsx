import { Link } from '@tanstack/react-router'
import { navItems } from './nav-items'

/** Mobile bottom tab bar - quick access to main sections */
export function MobileTabBar() {
  return (
    <nav className="mobile-tabbar h-14 border-t border-border bg-background flex items-stretch">
      {navItems.slice(0, 5).map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground [&.active]:text-primary"
        >
          <item.icon className="w-5 h-5" />
          <span className="text-[10px]">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
