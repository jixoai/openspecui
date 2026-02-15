import { useNavLayout } from '@/lib/use-nav-controller'
import { isStaticMode } from '@/lib/static-mode'
import { Link } from '@tanstack/react-router'
import { allNavItems, mobileNavItems } from './nav-items'

/** Mobile bottom tab bar - quick access to main sections */
export function MobileTabBar() {
  const navLayout = useNavLayout()
  const isStatic = isStaticMode()

  // In static mode, use the hardcoded mobileNavItems
  // In IDE mode, show mainTabs from navController
  const items = isStatic
    ? mobileNavItems
    : navLayout.mainTabs
        .map((tabId) => allNavItems.find((n) => n.to === tabId))
        .filter((item): item is NonNullable<typeof item> => item != null)

  return (
    <nav className="mobile-tabbar h-14 border-t border-border bg-background flex items-stretch">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground [&.active]:text-primary"
        >
          <item.icon className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-nav tracking-[0.03em]">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
