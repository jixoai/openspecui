import { CliHealthGate } from '@/components/cli-health-gate'
import { GlobalArchiveModal } from '@/components/global-archive-modal'
import { StaticModeBanner } from '@/components/StaticModeBanner'
import { ResizeHandle } from '@/components/terminal/resize-handle'
import { useNavLayout } from '@/lib/use-nav-controller'
import { isStaticMode } from '@/lib/static-mode'
import { Outlet } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { BottomAreaRouter } from './bottom-area'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileHeader } from './mobile-header'
import { MobileTabBar } from './mobile-tabbar'
import { DesktopStatusBar } from './status-bar'

/** Root layout with responsive navigation */
export function RootLayout() {
  const navLayout = useNavLayout()
  const isStatic = isStaticMode()
  const hasMainContent = isStatic || navLayout.mainTabs.length > 0
  const hasBottomContent = !isStatic && navLayout.bottomActive
  const [bottomHeight, setBottomHeight] = useState(300)

  const handleResize = useCallback((height: number) => {
    setBottomHeight(height)
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
            {hasMainContent && (
              <main className={`main-content view-transition-route flex min-h-0 flex-col ${hasBottomContent ? 'flex-1' : 'flex-1'}`}>
                <Outlet />
              </main>
            )}
            {hasMainContent && hasBottomContent && (
              <ResizeHandle onResize={handleResize} />
            )}
            {hasBottomContent && (
              <BottomAreaRouter height={hasMainContent ? bottomHeight : undefined} />
            )}
          </div>
          <MobileTabBar />
          <DesktopStatusBar />
        </div>
      </div>

      <GlobalArchiveModal />
    </div>
  )
}
