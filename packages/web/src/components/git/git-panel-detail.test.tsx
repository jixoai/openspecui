import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GitEntryDetailPanel } from './git-panel-detail'

const getEntryPatchMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    git: {
      getEntryPatch: {
        query: getEntryPatchMock,
      },
    },
  },
}))

vi.mock('@/components/tabs', () => ({
  Tabs: ({
    tabs,
    selectedTab,
    onTabChange,
  }: {
    tabs: Array<{ id: string; label: string; content: ReactNode }>
    selectedTab?: string
    onTabChange?: (id: string) => void
  }) => {
    const activeTab = tabs.find((tab) => tab.id === selectedTab) ?? tabs[0] ?? null
    return (
      <div data-testid="tabs" data-active-tab={activeTab?.id ?? ''}>
        <div className="tabs-strip">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => onTabChange?.(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            data-tab-panel={tab.id}
            hidden={tab.id !== activeTab?.id}
            aria-hidden={tab.id !== activeTab?.id}
          >
            {tab.content}
          </div>
        ))}
      </div>
    )
  },
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function renderWithQueryClient(children: ReactNode) {
  const queryClient = createQueryClient()
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>)
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const baseEntry = {
  type: 'commit' as const,
  hash: 'abc12345',
  title: 'feat: add git panel',
  committedAt: 1,
  relatedChanges: ['add-git-panel-worktree-handoff'],
  diff: { files: 1, insertions: 3, deletions: 1 },
}

const baseFile = {
  fileId: 'file-1',
  source: 'tracked' as const,
  path: 'src/git-panel.ts',
  displayPath: 'src/git-panel.ts',
  previousPath: null,
  changeType: 'modified' as const,
  diff: { state: 'ready' as const, files: 1, insertions: 3, deletions: 1 },
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  getEntryPatchMock.mockResolvedValue({
    entry: baseEntry,
    file: {
      ...baseFile,
      patch: [
        'diff --git a/src/git-panel.ts b/src/git-panel.ts',
        '@@ -1 +1 @@',
        '+export const value = 1',
      ].join('\n'),
      state: 'available' as const,
    },
  })
})

describe('GitEntryDetailPanel', () => {
  it('keeps the detail area in loading state instead of flashing empty state', () => {
    renderWithQueryClient(
      <GitEntryDetailPanel
        selector={{ type: 'commit', hash: baseEntry.hash }}
        entry={baseEntry}
        files={[]}
        isLoading
        error={null}
      />
    )

    expect(screen.getAllByText('Loading changed files…')).toHaveLength(2)
    expect(screen.queryByText('No changed files found for this entry.')).toBeNull()
  })

  it('renders narrow detail as tabs and loads patches for visible cards', async () => {
    renderWithQueryClient(
      <GitEntryDetailPanel
        selector={{ type: 'commit', hash: baseEntry.hash }}
        entry={baseEntry}
        files={[baseFile]}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByTestId('tabs')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Diff Stream/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /File Tree/i })).toBeTruthy()

    await waitFor(() => {
      expect(getEntryPatchMock).toHaveBeenCalledWith({
        selector: { type: 'commit', hash: baseEntry.hash },
        fileId: baseFile.fileId,
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /File Tree/i }))
    expect(screen.getByRole('tree').style.maxHeight).toBe('')
    fireEvent.click(screen.getByRole('treeitem', { name: /src\/git-panel\.ts/i }))

    await waitFor(() => {
      expect(screen.getByText('diff --git a/src/git-panel.ts b/src/git-panel.ts')).toBeTruthy()
    })
  })

  it('replaces loading tree stats with resolved patch stats once file detail arrives', async () => {
    const loadingFile = {
      ...baseFile,
      diff: { state: 'loading' as const, files: 1 },
      source: 'untracked' as const,
      changeType: 'added' as const,
    }

    renderWithQueryClient(
      <GitEntryDetailPanel
        selector={{ type: 'uncommitted' }}
        entry={{
          type: 'uncommitted',
          title: 'working tree',
          updatedAt: 1,
          relatedChanges: [],
          diff: { files: 1, insertions: 3, deletions: 1 },
        }}
        files={[loadingFile]}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getAllByText('loading').length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeTruthy()
    })

    expect(screen.queryAllByText('loading')).toHaveLength(0)
  })

  it('defers file-tree scroll until the diff tab is active', async () => {
    const scrollStates: string[] = []
    const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView'
    )
    const originalScrollToDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollTo'
    )
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    const recordScrollState = () => {
      scrollStates.push(screen.getByTestId('tabs').getAttribute('data-active-tab') ?? '')
    }
    const scrollIntoViewMock = vi.fn(function mockScrollIntoView() {
      recordScrollState()
    })
    const scrollToMock = vi.fn(function mockScrollTo() {
      recordScrollState()
    })

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollToMock,
    })
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.tagName === 'SECTION') {
          const title = this.querySelector('header span')?.textContent
          if (title === baseFile.displayPath) {
            return {
              x: 0,
              y: 240,
              width: 600,
              height: 180,
              top: 240,
              right: 600,
              bottom: 420,
              left: 0,
              toJSON: () => ({}),
            } satisfies DOMRect
          }
        }

        return originalGetBoundingClientRect.call(this)
      },
    })

    renderWithQueryClient(
      <GitEntryDetailPanel
        selector={{ type: 'commit', hash: baseEntry.hash }}
        entry={baseEntry}
        files={[baseFile]}
        isLoading={false}
        error={null}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /File Tree/i }))
    fireEvent.click(screen.getByRole('treeitem', { name: /src\/git-panel\.ts/i }))

    await waitFor(() => {
      expect(scrollStates.length).toBeGreaterThan(0)
    })

    expect(scrollStates.every((state) => state === 'diff')).toBe(true)

    if (originalScrollIntoViewDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollIntoView',
        originalScrollIntoViewDescriptor
      )
    } else {
      delete (HTMLElement.prototype as Partial<typeof HTMLElement.prototype>).scrollIntoView
    }

    if (originalScrollToDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollToDescriptor)
    } else {
      delete (HTMLElement.prototype as Partial<typeof HTMLElement.prototype>).scrollTo
    }

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: originalGetBoundingClientRect,
    })
  })

  it('switches to dual-pane layout when the container is wide enough', async () => {
    class MockResizeObserver {
      private readonly callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      observe() {
        this.callback(
          [
            {
              contentRect: { width: 1200 } as DOMRectReadOnly,
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver
        )
      }

      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal('ResizeObserver', MockResizeObserver)

    renderWithQueryClient(
      <GitEntryDetailPanel
        selector={{ type: 'commit', hash: baseEntry.hash }}
        entry={baseEntry}
        files={[baseFile]}
        isLoading={false}
        error={null}
      />
    )

    await waitFor(() => {
      expect(screen.queryByTestId('tabs')).toBeNull()
      expect(screen.getByText('File Tree')).toBeTruthy()
      expect(screen.getByText('Diff Stream')).toBeTruthy()
    })
  })

  it('constrains the wide file-tree viewport to the visible scroll shell height', async () => {
    class MockResizeObserver {
      private readonly callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      observe() {
        this.callback(
          [
            {
              contentRect: { width: 1200 } as DOMRectReadOnly,
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver
        )
      }

      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal('ResizeObserver', MockResizeObserver)

    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.dataset.testid === 'scroll-shell') {
          return {
            x: 0,
            y: 40,
            width: 960,
            height: 320,
            top: 40,
            right: 960,
            bottom: 360,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.dataset.testid === 'git-file-tree-viewport') {
          return {
            x: 0,
            y: 120,
            width: 320,
            height: 80,
            top: 120,
            right: 320,
            bottom: 200,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        return originalGetBoundingClientRect.call(this)
      },
    })

    renderWithQueryClient(
      <div data-testid="scroll-shell" style={{ height: '320px', overflowY: 'auto' }}>
        <GitEntryDetailPanel
          selector={{ type: 'commit', hash: baseEntry.hash }}
          entry={baseEntry}
          files={[baseFile]}
          isLoading={false}
          error={null}
        />
      </div>
    )

    const scrollShell = screen.getByTestId('scroll-shell')
    Object.defineProperty(scrollShell, 'clientHeight', {
      configurable: true,
      value: 320,
    })
    Object.defineProperty(scrollShell, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })

    fireEvent(window, new Event('resize'))

    await waitFor(() => {
      expect(screen.getByTestId('git-file-tree-viewport').style.height).toBe('240px')
    })

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: originalGetBoundingClientRect,
    })
  })

  it('retries wide-layout tree scrolling after patch layout changes', async () => {
    class MockResizeObserver {
      private readonly callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      observe() {
        this.callback(
          [
            {
              contentRect: { width: 1200 } as DOMRectReadOnly,
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver
        )
      }

      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal('ResizeObserver', MockResizeObserver)

    const deferredPatch = createDeferred<{
      entry: typeof baseEntry
      file: typeof baseFile & {
        patch: string
        state: 'available'
      }
    }>()
    getEntryPatchMock.mockReturnValueOnce(deferredPatch.promise)

    const scrollToMock = vi.fn()
    const originalScrollTo = HTMLElement.prototype.scrollTo
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollToMock,
    })

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.dataset.testid === 'scroll-shell') {
          return {
            x: 0,
            y: 120,
            width: 800,
            height: 240,
            top: 120,
            right: 800,
            bottom: 360,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.tagName === 'SECTION') {
          const title = this.querySelector('header span')?.textContent
          if (title === baseFile.displayPath) {
            return {
              x: 0,
              y: 860,
              width: 800,
              height: 180,
              top: 860,
              right: 800,
              bottom: 1040,
              left: 0,
              toJSON: () => ({}),
            } satisfies DOMRect
          }
        }

        return originalGetBoundingClientRect.call(this)
      },
    })

    renderWithQueryClient(
      <div data-testid="scroll-shell" style={{ height: '240px', overflowY: 'auto' }}>
        <div style={{ minHeight: '2000px' }}>
          <GitEntryDetailPanel
            selector={{ type: 'commit', hash: baseEntry.hash }}
            entry={baseEntry}
            files={[baseFile]}
            isLoading={false}
            error={null}
          />
        </div>
      </div>
    )

    const scrollShell = screen.getByTestId('scroll-shell')
    Object.defineProperty(scrollShell, 'clientHeight', {
      configurable: true,
      value: 240,
    })
    Object.defineProperty(scrollShell, 'scrollHeight', {
      configurable: true,
      value: 2000,
    })

    fireEvent.click(screen.getByRole('treeitem', { name: /src\/git-panel\.ts/i }))

    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledTimes(1)
    })

    deferredPatch.resolve({
      entry: baseEntry,
      file: {
        ...baseFile,
        patch: 'diff --git a/src/git-panel.ts b/src/git-panel.ts',
        state: 'available',
      },
    })

    await waitFor(() => {
      expect(scrollToMock.mock.calls.length).toBeGreaterThan(1)
    })

    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: originalScrollTo,
    })
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: originalGetBoundingClientRect,
    })
  })
})
