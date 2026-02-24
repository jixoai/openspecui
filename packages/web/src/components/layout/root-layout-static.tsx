import { Outlet } from '@tanstack/react-router'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileHeader } from './mobile-header'
import { MobileTabBar } from './mobile-tabbar'
import { PopAreaRouter } from './pop-area'
import { DesktopStatusBar } from './status-bar'

/** Root layout for static mode (SSG): no terminal-only UI wiring. */
export function RootLayoutStatic() {
  return (
    <div className="@container/app fixed inset-0" style={{ containerName: 'app' }}>
      <div className="app-layout h-full">
        <DesktopSidebar />
        <div className="app-body flex min-h-0 flex-1 flex-col">
          <MobileHeader />
          <main className="main-content scrollbar-thin scrollbar-track-transparent view-transition-route flex min-h-0 flex-1 flex-col">
            <Outlet />
          </main>
          <MobileTabBar />
          <DesktopStatusBar />
        </div>
      </div>
      <PopAreaRouter />
    </div>
  )
}
