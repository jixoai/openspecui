import { GitEntryDetailPanel } from '@/components/git/git-panel-detail'
import { Tabs, type Tab } from '@/components/tabs'
import { isStaticMode, setStaticMode } from '@/lib/static-mode'
import type {
  DashboardGitEntry,
  GitEntryFilePatch,
  GitEntryFileSummary,
  GitEntrySelector,
} from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getRouterContext } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { useRoutedCarouselTabs } from './tabs'

function RoutedTabsTestRouter({
  children,
  initialSearch = '?gitPane=diff',
}: {
  children: ReactNode
  initialSearch?: string
}) {
  const RouterContext = getRouterContext()
  const listenersRef = useRef(new Set<() => void>())
  const storeStateRef = useRef({
    location: {
      pathname: '/browser-test',
      searchStr: initialSearch,
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

function RoutedTabsViewportScrollHarness() {
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
          <div>
            {Array.from({ length: 500 }, (_, index) => (
              <div
                key={`diff-row-${index + 1}`}
                style={{ height: '20px', borderBottom: '1px solid transparent' }}
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
        content: (
          <div>
            {Array.from({ length: 100 }, (_, index) => (
              <div
                key={`file-row-${index + 1}`}
                style={{ height: '30px', borderBottom: '1px solid transparent' }}
              >
                File row {index + 1}
              </div>
            ))}
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div
      className="main-content"
      data-testid="viewport-scroll-root"
      style={{ width: '480px', height: '320px', overflowY: 'auto', padding: '16px' }}
    >
      <div style={{ height: '72px' }} />
      <Tabs ref={tabsRef} tabs={tabs} selectedTab={selectedTab} onTabChange={onTabChange} />
      <div style={{ height: '240px' }} />
    </div>
  )
}

function RoutedTabsUnstableViewportSelectorHarness() {
  const previousStaticModeRef = useRef(isStaticMode())
  const [rerenderCount, setRerenderCount] = useState(0)

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
  const viewportSelector = rerenderCount % 2 === 0 ? ['.main-content'] : ['.main-content']
  const { onTabChange, selectedTab, tabsRef } = useRoutedCarouselTabs({
    queryKey: 'gitPane',
    tabs: routedTabs,
    initialTab: 'diff',
    viewportSelector,
  })

  const tabs = useMemo<Tab[]>(
    () => [
      {
        id: 'diff',
        label: 'Diff',
        content: (
          <div>
            {Array.from({ length: 500 }, (_, index) => (
              <div
                key={`unstable-diff-row-${index + 1}`}
                style={{ height: '20px', borderBottom: '1px solid transparent' }}
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
        content: (
          <div>
            {Array.from({ length: 100 }, (_, index) => (
              <div
                key={`unstable-file-row-${index + 1}`}
                style={{ height: '30px', borderBottom: '1px solid transparent' }}
              >
                File row {index + 1}
              </div>
            ))}
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div
      className="main-content"
      data-testid="unstable-selector-viewport-scroll-root"
      style={{ width: '480px', height: '320px', overflowY: 'auto', padding: '16px' }}
    >
      <button type="button" onClick={() => setRerenderCount((current) => current + 1)}>
        Rerender
      </button>
      <div style={{ height: '72px' }} />
      <Tabs ref={tabsRef} tabs={tabs} selectedTab={selectedTab} onTabChange={onTabChange} />
      <div style={{ height: '240px' }} />
    </div>
  )
}

const commitDetailEntry: DashboardGitEntry = {
  type: 'commit',
  hash: 'abc12345',
  title: 'feat: preserve commit detail tab scroll',
  committedAt: Date.UTC(2026, 3, 14),
  relatedChanges: ['commit-detail-vt-scroll'],
  diff: {
    files: 24,
    insertions: 168,
    deletions: 42,
  },
}

const commitDetailSelector: GitEntrySelector = {
  type: 'commit',
  hash: commitDetailEntry.hash,
}

const commitDetailFiles: GitEntryFileSummary[] = Array.from({ length: 24 }, (_, index) => ({
  fileId: `commit-detail-file-${index + 1}`,
  source: 'tracked',
  path: `src/features/group-${Math.floor(index / 4) + 1}/file-${index + 1}.tsx`,
  displayPath: `src/features/group-${Math.floor(index / 4) + 1}/file-${index + 1}.tsx`,
  previousPath: null,
  changeType:
    index % 4 === 0
      ? 'added'
      : index % 4 === 1
        ? 'modified'
        : index % 4 === 2
          ? 'deleted'
          : 'renamed',
  diff: {
    state: 'ready',
    files: 1,
    insertions: 4 + index,
    deletions: index % 3,
  },
}))

const commitDetailPatches: GitEntryFilePatch[] = commitDetailFiles.map((file, index) => ({
  ...file,
  state: 'available',
  patch: [
    `diff --git a/${file.path} b/${file.path}`,
    'index 0000000..1111111 100644',
    `--- a/${file.path}`,
    `+++ b/${file.path}`,
    '@@ -1,6 +1,6 @@',
    ...Array.from(
      { length: 8 + (index % 5) * 4 },
      (_, lineIndex) =>
        `${lineIndex % 2 === 0 ? '+' : '-'} line ${lineIndex + 1} for ${file.fileId}`
    ),
  ].join('\n'),
}))

function RoutedCommitDetailBrowserHarness() {
  const previousStaticModeRef = useRef(isStaticMode())
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: Number.POSITIVE_INFINITY,
          },
        },
      }),
    []
  )

  useEffect(() => {
    setStaticMode(true)
    return () => {
      setStaticMode(previousStaticModeRef.current)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ width: '480px', height: '320px' }}>
        <div className="bottom-area min-h-0 shrink-0 overflow-auto">
          <div
            data-testid="commit-detail-scroll-root"
            className="scrollbar-thin scrollbar-track-transparent flex h-full min-h-0 flex-col overflow-auto"
            style={{ height: '300px' }}
          >
            <div className="flex flex-col gap-4 p-4">
              <div className="vt-detail-content">
                <GitEntryDetailPanel
                  selector={commitDetailSelector}
                  entry={commitDetailEntry}
                  files={commitDetailFiles}
                  eagerFiles={commitDetailPatches}
                  isLoading={false}
                  error={null}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </QueryClientProvider>
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

  it('preserves per-tab viewport scroll positions across 10 animated switches in a real browser', async () => {
    render(
      <RoutedTabsTestRouter>
        <RoutedTabsViewportScrollHarness />
      </RoutedTabsTestRouter>
    )

    const viewport = await screen.findByTestId('viewport-scroll-root')
    const diffScrollSequence = [180, 840, 1280, 1960, 2480, 3120, 3880, 4520, 5160, 5880]
    const fileScrollSequence = [120, 260, 420, 760, 980, 1240, 1480, 1720, 1960, 2280]
    const getActivePanel = () =>
      viewport.querySelector<HTMLElement>('[data-tab-panel-state="active"]')?.dataset.tabPanel

    viewport.scrollTop = diffScrollSequence[0]
    expect(viewport.scrollTop).toBe(diffScrollSequence[0])

    fireEvent.click(await screen.findByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('files')
    })

    viewport.scrollTop = fileScrollSequence[0]
    expect(viewport.scrollTop).toBe(fileScrollSequence[0])

    for (let iteration = 0; iteration < 10; iteration += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Diff' }))

      await waitFor(() => {
        expect(getActivePanel()).toBe('diff')
        expect(viewport.scrollTop).toBe(diffScrollSequence[iteration])
      })

      viewport.scrollTop = diffScrollSequence[(iteration + 1) % diffScrollSequence.length]
      expect(viewport.scrollTop).toBe(
        diffScrollSequence[(iteration + 1) % diffScrollSequence.length]
      )

      fireEvent.click(screen.getByRole('button', { name: 'Files' }))

      await waitFor(() => {
        expect(getActivePanel()).toBe('files')
        expect(viewport.scrollTop).toBe(fileScrollSequence[iteration])
      })

      viewport.scrollTop = fileScrollSequence[(iteration + 1) % fileScrollSequence.length]
      expect(viewport.scrollTop).toBe(
        fileScrollSequence[(iteration + 1) % fileScrollSequence.length]
      )
    }
  })

  it('preserves per-tab viewport scroll positions for commit detail in a real browser', async () => {
    render(
      <RoutedTabsTestRouter>
        <RoutedCommitDetailBrowserHarness />
      </RoutedTabsTestRouter>
    )

    const viewport = await screen.findByTestId('commit-detail-scroll-root')
    const getActivePanel = () =>
      viewport.querySelector<HTMLElement>('[data-tab-panel-state="active"]')?.dataset.tabPanel

    viewport.scrollTop = 1400
    expect(viewport.scrollTop).toBe(1400)

    fireEvent.click(await screen.findByRole('button', { name: 'File Tree' }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('files')
      expect(viewport.scrollTop).toBe(1400)
    })

    viewport.scrollTop = 300
    expect(viewport.scrollTop).toBe(300)

    fireEvent.click(screen.getByRole('button', { name: 'Diff Stream' }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('diff')
      expect(viewport.scrollTop).toBe(1400)
    })

    viewport.scrollTop = 1700
    expect(viewport.scrollTop).toBe(1700)

    fireEvent.click(screen.getByRole('button', { name: 'File Tree' }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('files')
      expect(viewport.scrollTop).toBe(300)
    })
  })

  it('preserves commit detail viewport scroll when the route starts on file tree', async () => {
    render(
      <RoutedTabsTestRouter initialSearch="?gitPane=files">
        <RoutedCommitDetailBrowserHarness />
      </RoutedTabsTestRouter>
    )

    const viewport = await screen.findByTestId('commit-detail-scroll-root')
    const getActivePanel = () =>
      viewport.querySelector<HTMLElement>('[data-tab-panel-state="active"]')?.dataset.tabPanel

    await waitFor(() => {
      expect(getActivePanel()).toBe('files')
    })

    viewport.scrollTop = 300
    expect(viewport.scrollTop).toBe(300)

    fireEvent.click(screen.getByRole('button', { name: 'Diff Stream' }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('diff')
      expect(viewport.scrollTop).toBe(300)
    })

    viewport.scrollTop = 1200
    expect(viewport.scrollTop).toBe(1200)

    fireEvent.click(screen.getByRole('button', { name: 'File Tree' }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('files')
      expect(viewport.scrollTop).toBe(300)
    })
  })

  it('keeps commit detail viewport user-scrollable after tree-to-diff reveal in a real browser', async () => {
    render(
      <RoutedTabsTestRouter initialSearch="?gitPane=files">
        <RoutedCommitDetailBrowserHarness />
      </RoutedTabsTestRouter>
    )

    const viewport = await screen.findByTestId('commit-detail-scroll-root')
    const targetFile = commitDetailFiles.at(-1)
    expect(targetFile).toBeTruthy()
    if (!targetFile) {
      return
    }

    const getActivePanel = () =>
      viewport.querySelector<HTMLElement>('[data-tab-panel-state="active"]')?.dataset.tabPanel

    await waitFor(() => {
      expect(getActivePanel()).toBe('files')
    })

    fireEvent.click(screen.getByRole('treeitem', { name: targetFile.displayPath }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('diff')
      expect(viewport.scrollTop).toBeGreaterThan(400)
    })

    const revealedScrollTop = viewport.scrollTop
    const nextScrollTop = revealedScrollTop + 180
    viewport.scrollTop = nextScrollTop
    viewport.dispatchEvent(new Event('scroll', { bubbles: true }))

    await waitFor(() => {
      expect(viewport.scrollTop).toBe(nextScrollTop)
    })

    await new Promise((resolve) => {
      window.setTimeout(resolve, 360)
    })

    expect(viewport.scrollTop).toBe(nextScrollTop)
  })

  it('does not restore stale viewport scroll when selector arrays rerender with the same values', async () => {
    render(
      <RoutedTabsTestRouter>
        <RoutedTabsUnstableViewportSelectorHarness />
      </RoutedTabsTestRouter>
    )

    const viewport = await screen.findByTestId('unstable-selector-viewport-scroll-root')
    const getActivePanel = () =>
      viewport.querySelector<HTMLElement>('[data-tab-panel-state="active"]')?.dataset.tabPanel

    viewport.scrollTop = 880
    expect(viewport.scrollTop).toBe(880)

    fireEvent.click(await screen.findByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('files')
      expect(viewport.scrollTop).toBe(880)
    })

    viewport.scrollTop = 260
    expect(viewport.scrollTop).toBe(260)

    fireEvent.click(screen.getByRole('button', { name: 'Diff' }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('diff')
      expect(viewport.scrollTop).toBe(880)
    })

    const nextScrollTop = 1120
    viewport.scrollTop = nextScrollTop
    expect(viewport.scrollTop).toBe(nextScrollTop)

    fireEvent.click(screen.getByRole('button', { name: 'Rerender' }))

    await waitFor(() => {
      expect(viewport.scrollTop).toBe(nextScrollTop)
    })

    await new Promise((resolve) => {
      window.setTimeout(resolve, 360)
    })

    expect(viewport.scrollTop).toBe(nextScrollTop)
  })

  it('restores the file tree viewport after returning from a tree-to-diff reveal', async () => {
    render(
      <RoutedTabsTestRouter initialSearch="?gitPane=files">
        <RoutedCommitDetailBrowserHarness />
      </RoutedTabsTestRouter>
    )

    const viewport = await screen.findByTestId('commit-detail-scroll-root')
    const targetFile = commitDetailFiles.at(-1)
    expect(targetFile).toBeTruthy()
    if (!targetFile) {
      return
    }

    const getActivePanel = () =>
      viewport.querySelector<HTMLElement>('[data-tab-panel-state="active"]')?.dataset.tabPanel

    await waitFor(() => {
      expect(getActivePanel()).toBe('files')
      expect(viewport.scrollTop).toBe(0)
    })

    fireEvent.click(screen.getByRole('treeitem', { name: targetFile.displayPath }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('diff')
      expect(viewport.scrollTop).toBeGreaterThan(400)
    })

    fireEvent.click(screen.getByRole('button', { name: 'File Tree' }))

    await waitFor(() => {
      expect(getActivePanel()).toBe('files')
      expect(viewport.scrollTop).toBeLessThan(80)
    })

    const treeRoot = await screen.findByRole('tree', { name: 'Changed files' })
    const treeRect = treeRoot.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()

    expect(treeRect.bottom).toBeGreaterThan(viewportRect.top + 20)
    expect(treeRect.top).toBeLessThan(viewportRect.bottom - 20)
  })
})
