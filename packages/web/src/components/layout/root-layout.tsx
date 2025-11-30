import { Outlet } from '@tanstack/react-router'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileHeader } from './mobile-header'
import { MobileTabBar } from './mobile-tabbar'
import { DesktopStatusBar } from './status-bar'
import { GlobalArchiveModal } from '@/components/global-archive-modal'

/** Root layout with responsive navigation */
export function RootLayout() {
  return (
    <div className="fixed inset-0 @container/app" style={{ containerName: 'app' }}>
      <div className="app-layout h-full">
        <DesktopSidebar />
        <div className="app-body flex flex-col flex-1 min-h-0">
          <MobileHeader />
          <main className="main-content flex flex-col">
            <Outlet />
          </main>
          <MobileTabBar />
          <DesktopStatusBar />
        </div>
      </div>
      {/* 全局 Archive Modal - 在 Router 内部渲染 */}
      <GlobalArchiveModal />
    </div>
  )
}
