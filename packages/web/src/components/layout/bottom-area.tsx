import { RouterProvider, type AnyRouter } from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'
import { useNavLayout } from '@/lib/use-nav-controller'
import { navController } from '@/lib/nav-controller'
import { allNavItems } from './nav-items'

/**
 * Bottom area root layout — rendered by the bottom router.
 * Shows a tab bar for bottom-area tabs + Outlet.
 */
export function BottomArea() {
  const { bottomTabs, bottomLocation } = useNavLayout()

  // Determine which bottom tab is active based on bottomLocation
  const activeTabId = bottomTabs.find((t) =>
    bottomLocation.pathname === t || bottomLocation.pathname.startsWith(t + '/')
  ) ?? bottomTabs[0]

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar for bottom area tabs */}
      {bottomTabs.length > 1 && (
        <div className="border-border bg-background flex shrink-0 items-center gap-1 border-b px-1">
          {bottomTabs.map((tabId) => {
            const item = allNavItems.find((n) => n.to === tabId)
            if (!item) return null
            const isActive = tabId === activeTabId
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => navController.activateBottom(tabId)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition ${
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Route content */}
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  )
}

// --- Bottom router ref (set by App.tsx to avoid circular imports) ---

let _bottomRouter: AnyRouter | null = null

export function setBottomRouter(router: AnyRouter | null): void {
  _bottomRouter = router
}

/**
 * BottomAreaRouter — mounts the bottom router's RouterProvider.
 * Rendered inside root-layout when bottomTabs.length > 0.
 */
export function BottomAreaRouter({ height }: { height: number }) {
  if (!_bottomRouter) return null

  return (
    <div className="bottom-area shrink-0" style={{ height, minHeight: 100 }}>
      <RouterProvider router={_bottomRouter} />
    </div>
  )
}
