import { Outlet, useRouterState } from '@tanstack/react-router'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileHeader } from './mobile-header'
import { MobileTabBar } from './mobile-tabbar'
import { DesktopStatusBar } from './status-bar'
import { GlobalArchiveModal } from '@/components/global-archive-modal'
import { StaticModeBanner } from '@/components/StaticModeBanner'
import { flushSync } from 'react-dom'
import { useLayoutEffect, useState } from 'react'

type ViewTransitionCapableDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => { finished: Promise<unknown> }
}

function ViewTransitionOutlet() {
  // Ignore hash-only changes to avoid triggering view transitions on in-page anchor jumps
  const locationKey = useRouterState({
    select: (state) => `${state.location.pathname}${state.location.search}`,
  })
  const [renderKey, setRenderKey] = useState(locationKey)

  useLayoutEffect(() => {
    if (locationKey === renderKey) return
    const doc = document as ViewTransitionCapableDocument
    const performUpdate = () => setRenderKey(locationKey)

    if (typeof doc.startViewTransition === 'function') {
      document.documentElement.dataset.vtRunning = '1'
      const transition = doc.startViewTransition(() => {
        flushSync(performUpdate)
      })
      transition.finished
        .catch(() => {
          /* swallow errors; fallback already applied */
        })
        .finally(() => {
          delete document.documentElement.dataset.vtRunning
        })
    } else {
      performUpdate()
    }
  }, [locationKey, renderKey])

  return <Outlet key={renderKey} />
}

/** Root layout with responsive navigation */
export function RootLayout() {
  return (
    <div className="fixed inset-0 @container/app" style={{ containerName: 'app' }}>
      <div className="app-layout h-full">
        <DesktopSidebar />
        <div className="app-body flex flex-col flex-1 min-h-0">
          <StaticModeBanner />
          <MobileHeader />
          <main className="main-content flex flex-col view-transition-route">
            <ViewTransitionOutlet />
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
