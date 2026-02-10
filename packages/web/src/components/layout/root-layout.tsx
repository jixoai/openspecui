import { CliHealthGate } from '@/components/cli-health-gate'
import { GlobalArchiveModal } from '@/components/global-archive-modal'
import { StaticModeBanner } from '@/components/StaticModeBanner'
import { ResizeHandle } from '@/components/terminal/resize-handle'
import { TerminalPanel } from '@/components/terminal/terminal-panel'
import { useTerminalContext } from '@/lib/terminal-context'
import { Outlet } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileHeader } from './mobile-header'
import { MobileTabBar } from './mobile-tabbar'
import { DesktopStatusBar } from './status-bar'

/** Root layout with responsive navigation */
export function RootLayout() {
  const { isOpen } = useTerminalContext()
  const [terminalHeight, setTerminalHeight] = useState(300)

  const handleResize = useCallback((height: number) => {
    setTerminalHeight(height)
  }, [])

  return (
    <div className="@container/app fixed inset-0" style={{ containerName: 'app' }}>
      <div className="app-layout h-full">
        <DesktopSidebar />
        <div className="app-body flex min-h-0 flex-1 flex-col">
          <StaticModeBanner />
          <CliHealthGate />
          <MobileHeader />
          <div className="flex min-h-0 flex-1 flex-col">
            <main className="main-content view-transition-route flex min-h-0 flex-1 flex-col">
              <Outlet />
            </main>
            {isOpen && (
              <>
                <ResizeHandle onResize={handleResize} />
                <div style={{ height: terminalHeight, minHeight: 100 }} className="shrink-0">
                  <TerminalPanel className="h-full" />
                </div>
              </>
            )}
          </div>
          <MobileTabBar />
          <DesktopStatusBar />
        </div>
      </div>
      {/* 全局 Archive Modal - 在 Router 内部渲染 */}
      <GlobalArchiveModal />
    </div>
  )
}
