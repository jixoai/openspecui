import { Tabs, type Tab } from '@/components/tabs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useMemo } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useRoutedCarouselTabs } from './tabs'

const { runViewTransitionMock } = vi.hoisted(() => ({
  runViewTransitionMock: vi.fn(
    ({
      collectAfterEntries,
      collectBeforeEntries,
      update,
    }: {
      collectAfterEntries?: () => unknown
      collectBeforeEntries?: () => unknown
      update: () => void
    }) => {
      collectBeforeEntries?.()
      update()
      collectAfterEntries?.()
      return Promise.resolve()
    }
  ),
}))

vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: () => true,
}))

vi.mock('./runtime', () => ({
  runViewTransition: runViewTransitionMock,
}))

function RoutedTabsResetHarness() {
  const tabs = useMemo(
    () =>
      [{ id: 'diff' as const }, { id: 'files' as const }] satisfies Array<{ id: 'diff' | 'files' }>,
    []
  )
  const { selectedTab, setSelectedTab, onTabChange } = useRoutedCarouselTabs({
    queryKey: 'gitPane',
    tabs,
    initialTab: 'diff',
  })

  useEffect(() => {
    setSelectedTab('diff')
  }, [setSelectedTab])

  return (
    <div>
      <div data-testid="selected-tab">{selectedTab}</div>
      <button type="button" onClick={() => onTabChange('files')}>
        Show files
      </button>
    </div>
  )
}

function RoutedTabsScrollHarness() {
  const tabs = useMemo<Tab[]>(
    () => [
      {
        id: 'diff',
        label: 'Diff',
        content: (
          <div data-testid="diff-content">
            <div style={{ height: '1400px' }} />
          </div>
        ),
      },
      {
        id: 'files',
        label: 'Files',
        content: (
          <div data-testid="files-content">
            <div style={{ height: '900px' }} />
          </div>
        ),
      },
    ],
    []
  )
  const { tabsRef, selectedTab, setSelectedTab, onTabChange } = useRoutedCarouselTabs({
    queryKey: 'gitPane',
    tabs,
    initialTab: 'diff',
    viewportSelector: '.main-content',
  })

  return (
    <div className="main-content" data-testid="viewport" style={{ height: 240, overflowY: 'auto' }}>
      <div data-testid="page-shell">
        <div style={{ height: 120 }} />
        <Tabs ref={tabsRef} tabs={tabs} selectedTab={selectedTab} onTabChange={onTabChange} />
      </div>
      <button type="button" onClick={() => setSelectedTab('diff')}>
        Restore diff
      </button>
      <button type="button" onClick={() => setSelectedTab('files')}>
        Restore files
      </button>
    </div>
  )
}

function RoutedTabsInnerScrollHarness() {
  const tabs = useMemo<Tab[]>(
    () => [
      {
        id: 'diff',
        label: 'Diff',
        content: <div data-testid="diff-content" style={{ height: 320 }} />,
      },
      {
        id: 'files',
        label: 'Files',
        unmountOnHide: true,
        content: (
          <div className="py-3">
            <div
              data-tab-scroll-root="true"
              data-testid="files-scroll-root"
              style={{ height: 160, overflowY: 'auto' }}
            >
              <div style={{ height: 720 }} />
            </div>
          </div>
        ),
      },
    ],
    []
  )
  const { tabsRef, selectedTab, onTabChange } = useRoutedCarouselTabs({
    queryKey: 'gitPane',
    tabs,
    initialTab: 'diff',
    viewportSelector: '.main-content',
  })

  return (
    <div className="main-content" data-testid="viewport" style={{ height: 240, overflowY: 'auto' }}>
      <div style={{ height: 96 }} />
      <Tabs ref={tabsRef} tabs={tabs} selectedTab={selectedTab} onTabChange={onTabChange} />
    </div>
  )
}

function installScrollableTabLayoutMocks() {
  const viewport = screen.getByTestId('viewport')
  const panelHeights: Record<'diff' | 'files', number> = {
    diff: 1400,
    files: 900,
  }
  const baseOffset = 168
  const viewportHeight = 240
  let viewportScrollTop = 0

  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    writable: true,
    value: function mockGetBoundingClientRect(this: HTMLElement) {
      if (this.dataset.testid === 'viewport') {
        return {
          x: 0,
          y: 0,
          width: 320,
          height: viewportHeight,
          top: 0,
          right: 320,
          bottom: viewportHeight,
          left: 0,
          toJSON: () => ({}),
        } satisfies DOMRect
      }

      if (this.dataset.tabPanel) {
        const panelId = this.dataset.tabPanel as keyof typeof panelHeights
        const fallbackHeight = panelHeights[panelId] ?? viewportHeight
        const height = this.style.height ? Number.parseFloat(this.style.height) : fallbackHeight
        const top = baseOffset - viewportScrollTop
        return {
          x: 0,
          y: top,
          width: 320,
          height,
          top,
          right: 320,
          bottom: top + height,
          left: 0,
          toJSON: () => ({}),
        } satisfies DOMRect
      }

      return originalGetBoundingClientRect.call(this)
    },
  })

  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    get: () => viewportHeight,
  })

  Object.defineProperty(viewport, 'scrollHeight', {
    configurable: true,
    get: () => {
      const activePanel = document.querySelector<HTMLElement>('[data-tab-panel-state="active"]')
      const activePanelId = activePanel?.dataset.tabPanel as keyof typeof panelHeights | undefined
      const fallbackHeight =
        activePanelId != null ? (panelHeights[activePanelId] ?? viewportHeight) : viewportHeight
      const renderedHeight = activePanel?.style.height
        ? Number.parseFloat(activePanel.style.height)
        : fallbackHeight
      return baseOffset + renderedHeight
    },
  })

  Object.defineProperty(viewport, 'scrollTop', {
    configurable: true,
    get: () => viewportScrollTop,
    set: (value: number) => {
      viewportScrollTop = value
    },
  })

  for (const panel of document.querySelectorAll<HTMLElement>('[data-tab-panel]')) {
    const panelId = panel.dataset.tabPanel as keyof typeof panelHeights | undefined
    const naturalHeight =
      panelId != null ? (panelHeights[panelId] ?? viewportHeight) : viewportHeight
    let panelScrollTop = 0

    Object.defineProperty(panel, 'clientHeight', {
      configurable: true,
      get: () => (panel.style.height ? Number.parseFloat(panel.style.height) : naturalHeight),
    })
    Object.defineProperty(panel, 'scrollHeight', {
      configurable: true,
      get: () => naturalHeight,
    })
    Object.defineProperty(panel, 'scrollTop', {
      configurable: true,
      get: () => panelScrollTop,
      set: (value: number) => {
        panelScrollTop = value
      },
    })
  }

  return {
    viewport,
    restore() {
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        writable: true,
        value: originalGetBoundingClientRect,
      })
    },
  }
}

function installInnerScrollTabLayoutMocks() {
  const viewport = screen.getByTestId('viewport')
  const viewportHeight = 240
  const baseOffset = 96
  let viewportScrollTop = 0
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    writable: true,
    value: function mockGetBoundingClientRect(this: HTMLElement) {
      if (this.dataset.testid === 'viewport') {
        return {
          x: 0,
          y: 0,
          width: 320,
          height: viewportHeight,
          top: 0,
          right: 320,
          bottom: viewportHeight,
          left: 0,
          toJSON: () => ({}),
        } satisfies DOMRect
      }

      if (this.dataset.tabPanel === 'diff') {
        const top = baseOffset - viewportScrollTop
        return {
          x: 0,
          y: top,
          width: 320,
          height: 320,
          top,
          right: 320,
          bottom: top + 320,
          left: 0,
          toJSON: () => ({}),
        } satisfies DOMRect
      }

      if (this.dataset.tabPanel === 'files') {
        const top = baseOffset - viewportScrollTop
        return {
          x: 0,
          y: top,
          width: 320,
          height: 184,
          top,
          right: 320,
          bottom: top + 184,
          left: 0,
          toJSON: () => ({}),
        } satisfies DOMRect
      }

      return originalGetBoundingClientRect.call(this)
    },
  })

  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    get: () => viewportHeight,
  })

  Object.defineProperty(viewport, 'scrollHeight', {
    configurable: true,
    get: () => 640,
  })

  Object.defineProperty(viewport, 'scrollTop', {
    configurable: true,
    get: () => viewportScrollTop,
    set: (value: number) => {
      viewportScrollTop = value
    },
  })

  return {
    restore() {
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        writable: true,
        value: originalGetBoundingClientRect,
      })
    },
  }
}

describe('useRoutedCarouselTabs', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/git/commit/abc12345?gitPane=diff')
    runViewTransitionMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps tab selection when caller effects depend on setSelectedTab identity', async () => {
    render(<RoutedTabsResetHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Show files' }))

    await waitFor(() => {
      expect(screen.getByTestId('selected-tab').textContent).toBe('files')
    })

    expect(window.location.search).toBe('?gitPane=files')
    expect(runViewTransitionMock).toHaveBeenCalledTimes(1)
  })

  it('collects default header VT layers together with the active panel', async () => {
    runViewTransitionMock.mockImplementationOnce(
      ({
        collectAfterEntries,
        collectBeforeEntries,
        update,
      }: {
        collectAfterEntries?: () => unknown
        collectBeforeEntries?: () => unknown
        update: () => void
      }) => {
        const beforeNames = ((collectBeforeEntries?.() ?? []) as Array<[HTMLElement, string]>)
          .map(([, name]) => name)
          .sort()
        update()
        const afterNames = ((collectAfterEntries?.() ?? []) as Array<[HTMLElement, string]>)
          .map(([, name]) => name)
          .sort()

        expect(beforeNames).toEqual([
          'vt-tab-edge',
          'vt-tab-header-foreground',
          'vt-tab-header-shell',
          'vt-tab-panel',
        ])
        expect(afterNames).toEqual([
          'vt-tab-edge',
          'vt-tab-header-foreground',
          'vt-tab-header-shell',
          'vt-tab-panel',
        ])

        return Promise.resolve()
      }
    )

    render(<RoutedTabsScrollHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(runViewTransitionMock).toHaveBeenCalledTimes(1)
    })
  })

  it('restores page scroll after animated tab switches when viewportSelector is provided', async () => {
    render(<RoutedTabsScrollHarness />)
    const { restore, viewport } = installScrollableTabLayoutMocks()

    try {
      viewport.scrollTop = 420

      fireEvent.click(screen.getByRole('button', { name: 'Files' }))

      await waitFor(() => {
        const activePanel = screen
          .getByTestId('viewport')
          .querySelector<HTMLElement>('[data-tab-panel-state="active"]')
        expect(activePanel?.dataset.tabPanel).toBe('files')
      })

      viewport.scrollTop = 300
      fireEvent.click(screen.getByRole('button', { name: 'Diff' }))

      await waitFor(() => {
        const activePanel = screen
          .getByTestId('viewport')
          .querySelector<HTMLElement>('[data-tab-panel-state="active"]')
        expect(activePanel?.dataset.tabPanel).toBe('diff')
        expect(viewport.scrollTop).toBe(420)
      })

      const activePanel = screen
        .getByTestId('viewport')
        .querySelector<HTMLElement>('[data-tab-panel-state="active"]')
      expect(activePanel?.style.height).toBe('')
      expect(activePanel?.dataset.tabScrollOffset).toBeUndefined()
    } finally {
      restore()
    }
  })

  it('restores page scroll for direct non-animated setSelectedTab calls', async () => {
    render(<RoutedTabsScrollHarness />)
    const { restore, viewport } = installScrollableTabLayoutMocks()

    try {
      viewport.scrollTop = 420

      fireEvent.click(screen.getByRole('button', { name: 'Restore files' }))

      await waitFor(() => {
        const activePanel = screen
          .getByTestId('viewport')
          .querySelector<HTMLElement>('[data-tab-panel-state="active"]')
        expect(activePanel?.dataset.tabPanel).toBe('files')
      })

      viewport.scrollTop = 300
      fireEvent.click(screen.getByRole('button', { name: 'Restore diff' }))

      await waitFor(() => {
        const activePanel = screen
          .getByTestId('viewport')
          .querySelector<HTMLElement>('[data-tab-panel-state="active"]')
        expect(activePanel?.dataset.tabPanel).toBe('diff')
        expect(viewport.scrollTop).toBe(420)
      })
    } finally {
      restore()
    }
  })

  it('restores marked inner scroll roots when the tab panel remounts', async () => {
    render(<RoutedTabsInnerScrollHarness />)
    const { restore } = installInnerScrollTabLayoutMocks()

    try {
      fireEvent.click(screen.getByRole('button', { name: 'Files' }))

      const firstScrollRoot = await screen.findByTestId('files-scroll-root')
      firstScrollRoot.scrollTop = 240

      fireEvent.click(screen.getByRole('button', { name: 'Diff' }))

      await waitFor(() => {
        expect(screen.queryByTestId('files-scroll-root')).toBeNull()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Files' }))

      await waitFor(() => {
        expect(screen.getByTestId('files-scroll-root').scrollTop).toBe(240)
      })
    } finally {
      restore()
    }
  })

  it('ignores stale transition cleanup when a tab is reopened before the prior VT finishes', async () => {
    let resolveFirstTransition: () => void = () => {}
    runViewTransitionMock.mockImplementationOnce(
      ({
        collectAfterEntries,
        collectBeforeEntries,
        update,
      }: {
        collectAfterEntries?: () => unknown
        collectBeforeEntries?: () => unknown
        update: () => void
      }) => {
        collectBeforeEntries?.()
        update()
        collectAfterEntries?.()

        return new Promise<void>((resolve) => {
          resolveFirstTransition = resolve
        })
      }
    )

    render(<RoutedTabsInnerScrollHarness />)
    const { restore } = installInnerScrollTabLayoutMocks()

    try {
      fireEvent.click(screen.getByRole('button', { name: 'Files' }))

      const firstScrollRoot = await screen.findByTestId('files-scroll-root')
      firstScrollRoot.scrollTop = 240

      fireEvent.click(screen.getByRole('button', { name: 'Diff' }))

      await waitFor(() => {
        expect(screen.queryByTestId('files-scroll-root')).toBeNull()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Files' }))

      resolveFirstTransition()

      await waitFor(() => {
        expect(screen.getByTestId('files-scroll-root').scrollTop).toBe(240)
      })
    } finally {
      restore()
    }
  })
})
