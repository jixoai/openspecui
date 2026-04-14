import { Tabs, type Tab } from '@/components/tabs'
import { isStaticMode, setStaticMode } from '@/lib/static-mode'
import { getRouterContext } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { useRoutedCarouselTabs } from './tabs'

function RoutedTabsTestRouter({ children }: { children: ReactNode }) {
  const RouterContext = getRouterContext()
  const listenersRef = useRef(new Set<() => void>())
  const storeStateRef = useRef({
    location: {
      pathname: '/browser-test',
      searchStr: '?gitPane=diff',
      hash: '',
      state: undefined as unknown,
    },
  })

  const router = useMemo(
    () => ({
      __store: {
        state: storeStateRef.current,
        subscribe(listener: () => void) {
          listenersRef.current.add(listener)
          return () => {
            listenersRef.current.delete(listener)
          }
        },
      },
      navigate({ href, state }: { href: string; replace?: boolean; state?: unknown }) {
        const url = new URL(href, 'http://browser.test')
        storeStateRef.current.location = {
          pathname: url.pathname,
          searchStr: url.search,
          hash: url.hash,
          state,
        }

        for (const listener of listenersRef.current) {
          listener()
        }
      },
    }),
    []
  )

  return <RouterContext.Provider value={router as never}>{children}</RouterContext.Provider>
}

function RoutedTabsBrowserHarness() {
  const previousStaticModeRef = useRef(isStaticMode())

  useEffect(() => {
    setStaticMode(true)
    return () => {
      setStaticMode(previousStaticModeRef.current)
    }
  }, [])

  const routedTabs = useMemo(
    () =>
      [{ id: 'diff' as const }, { id: 'files' as const }] satisfies Array<{
        id: 'diff' | 'files'
      }>,
    []
  )
  const { onTabChange, selectedTab, tabsRef } = useRoutedCarouselTabs({
    queryKey: 'gitPane',
    tabs: routedTabs,
    initialTab: 'diff',
    viewportSelector: '.main-content',
  })

  const tabs = useMemo<Tab[]>(
    () => [
      {
        id: 'diff',
        label: 'Diff',
        content: (
          <div className="space-y-2 py-4">
            {Array.from({ length: 24 }, (_, index) => (
              <div
                key={`diff-row-${index + 1}`}
                className="rounded-md border border-zinc-500/15 px-3 py-2 text-sm"
              >
                Diff row {index + 1}
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'files',
        label: 'Files',
        unmountOnHide: true,
        content: (
          <div className="py-4">
            <div
              data-tab-scroll-root="true"
              data-testid="files-scroll-root"
              className="rounded-md border border-zinc-500/15"
              style={{ height: '160px', overflowY: 'auto' }}
            >
              <div className="space-y-1 p-2">
                {Array.from({ length: 40 }, (_, index) => (
                  <div
                    key={`file-row-${index + 1}`}
                    className="rounded-md border border-zinc-500/10 px-2 py-1 text-sm"
                  >
                    File row {index + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div
      className="main-content"
      style={{ width: '480px', height: '320px', overflowY: 'auto', padding: '16px' }}
    >
      <div style={{ height: '72px' }} />
      <Tabs ref={tabsRef} tabs={tabs} selectedTab={selectedTab} onTabChange={onTabChange} />
      <div style={{ height: '240px' }} />
    </div>
  )
}

describe('useRoutedCarouselTabs browser', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('restores marked inner scroll roots after a remount in a real browser', async () => {
    render(
      <RoutedTabsTestRouter>
        <RoutedTabsBrowserHarness />
      </RoutedTabsTestRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Files' }))

    const firstScrollRoot = await screen.findByTestId('files-scroll-root')
    firstScrollRoot.scrollTop = 240
    firstScrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }))
    expect(firstScrollRoot.scrollTop).toBe(240)

    fireEvent.click(screen.getByRole('button', { name: 'Diff' }))

    await waitFor(() => {
      expect(screen.queryByTestId('files-scroll-root')).toBeNull()
    })

    await new Promise((resolve) => {
      window.setTimeout(resolve, 360)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(screen.getByTestId('files-scroll-root').scrollTop).toBe(240)
    })
  })
})
