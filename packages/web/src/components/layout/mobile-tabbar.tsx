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
    <nav className="mobile-tabbar border-border bg-background flex h-14 items-stretch border-t">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="text-muted-foreground hover:text-foreground [&.active]:text-primary flex flex-1 flex-col items-center justify-center gap-0.5"
        >
          <item.icon className="h-5 w-5 shrink-0" />
          <span className="font-nav text-[10px] tracking-[0.03em]">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
