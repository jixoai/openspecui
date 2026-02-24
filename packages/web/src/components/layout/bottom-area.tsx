import { Outlet, RouterProvider, type AnyRouter } from '@tanstack/react-router'

/**
 * Bottom area root layout — rendered by the bottom router.
 * The sidebar's bottom-area-nav acts as the tab bar, so this
 * component only renders the Outlet.
 */
export function BottomArea() {
  return (
    <div className="scrollbar-thin scrollbar-track-transparent flex h-full min-h-0 flex-col overflow-auto">
      <Outlet />
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
 * When height is provided (both areas active): fixed height, shrink-0.
 * When height is undefined (only bottom active): flex-1, takes all space.
 */
export function BottomAreaRouter({ height }: { height?: number }) {
  if (!_bottomRouter) return null

  return (
    <div
      className={`bottom-area scrollbar-thin scrollbar-track-transparent min-h-0 overflow-auto ${height != null ? 'shrink-0' : 'flex-1'}`}
      style={height != null ? { height, minHeight: 100 } : undefined}
    >
      <RouterProvider router={_bottomRouter} />
    </div>
  )
}
