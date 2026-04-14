import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ForwardedRef,
  type ReactNode,
} from 'react'
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
  Tabs: forwardRef(function MockTabs(
    {
      tabs,
      selectedTab,
      onTabChange,
      className,
    }: {
      tabs: Array<{ id: string; label: string; content: ReactNode }>
      selectedTab?: string
      onTabChange?: (id: string) => void
      className?: string
    },
    ref: ForwardedRef<{
      root: HTMLElement | null
      getTrigger: (tabId: string) => HTMLElement | null
      getPanel: (tabId: string) => HTMLElement | null
      getHeaderShell: () => HTMLElement | null
      getHeaderForeground: () => HTMLElement | null
      getSelectionIndicator: () => HTMLElement | null
      getActiveTabId: () => string | null
    }>
  ) {
    const activeTab = tabs.find((tab) => tab.id === selectedTab) ?? tabs[0] ?? null
    const rootRef = useRef<HTMLDivElement | null>(null)
    const headerShellRef = useRef<HTMLDivElement | null>(null)
    const headerForegroundRef = useRef<HTMLDivElement | null>(null)
    const selectionIndicatorRef = useRef<HTMLDivElement | null>(null)
    const triggerRefs = useRef(new Map<string, HTMLButtonElement | null>())
    const panelRefs = useRef(new Map<string, HTMLDivElement | null>())

    useImperativeHandle(
      ref,
      () => ({
        root: rootRef.current,
        getTrigger: (tabId: string) => triggerRefs.current.get(tabId) ?? null,
        getPanel: (tabId: string) => panelRefs.current.get(tabId) ?? null,
        getHeaderShell: () => headerShellRef.current,
        getHeaderForeground: () => headerForegroundRef.current,
        getSelectionIndicator: () => selectionIndicatorRef.current,
        getActiveTabId: () => activeTab?.id ?? null,
      }),
      [activeTab?.id]
    )

    return (
      <div
        ref={rootRef}
        data-testid="tabs"
        data-active-tab={activeTab?.id ?? ''}
        className={className}
      >
        <div ref={headerShellRef} data-tabs-header-shell="true" />
        <div ref={selectionIndicatorRef} data-tabs-selection-indicator="true" />
        <div ref={headerForegroundRef} data-tabs-header-foreground="true" className="tabs-strip">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(node) => {
                triggerRefs.current.set(tab.id, node)
              }}
              type="button"
              onClick={() => onTabChange?.(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={(node) => {
              panelRefs.current.set(tab.id, node)
            }}
            data-tab-panel={tab.id}
            hidden={tab.id !== activeTab?.id}
            aria-hidden={tab.id !== activeTab?.id}
          >
            {tab.content}
          </div>
        ))}
      </div>
    )
  }),
}))

vi.mock('@/lib/view-transitions/tabs', () => ({
  useRoutedCarouselTabs: ({
    tabs,
    initialTab,
  }: {
    tabs: Array<{ id: string }>
    initialTab?: string
  }) => {
    const tabsRef = useRef(null)
    const [selectedTab, setSelectedTab] = useState(initialTab ?? tabs[0]?.id ?? '')

    return {
      tabsRef,
      selectedTab,
      setSelectedTab,
      onTabChange: (nextTabId: string) => setSelectedTab(nextTabId),
    }
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

function stubWideResizeObserver() {
  class MockResizeObserver {
    private readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(target: Element) {
      const element = target as HTMLElement
      this.callback(
        [
          {
            contentRect: {
              width: 1200,
              height: element.clientHeight || 320,
            } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      )
    }

    disconnect() {}
    unobserve() {}
  }

  vi.stubGlobal('ResizeObserver', MockResizeObserver)
}

function stubNarrowResizeObserver() {
  class MockResizeObserver {
    private readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(target: Element) {
      const element = target as HTMLElement
      this.callback(
        [
          {
            contentRect: {
              width: 480,
              height: element.clientHeight || 320,
            } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      )
    }

    disconnect() {}
    unobserve() {}
  }

  vi.stubGlobal('ResizeObserver', MockResizeObserver)
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  readonly observedElements = new Set<Element>()
  readonly options: IntersectionObserverInit
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.callback = callback
    this.options = options
    MockIntersectionObserver.instances.push(this)
  }

  observe(element: Element) {
    this.observedElements.add(element)
  }

  unobserve(element: Element) {
    this.observedElements.delete(element)
  }

  disconnect() {
    this.observedElements.clear()
    MockIntersectionObserver.instances = MockIntersectionObserver.instances.filter(
      (instance) => instance !== this
    )
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  emitVisibleForFile(fileId: string) {
    const node = Array.from(this.observedElements).find(
      (element) =>
        element instanceof HTMLElement &&
        element.tagName === 'SECTION' &&
        element.dataset.fileId === fileId
    )
    if (!(node instanceof HTMLElement)) {
      return
    }

    const rect = node.getBoundingClientRect()
    const root =
      this.options.root instanceof HTMLElement ? this.options.root.getBoundingClientRect() : null

    this.callback(
      [
        {
          target: node,
          time: 0,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: rect,
          intersectionRect: rect,
          rootBounds: root,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver
    )
  }

  static reset() {
    MockIntersectionObserver.instances = []
  }
}

function emitVisibleFileThroughVisibilityObserver(fileId: string) {
  for (const observer of MockIntersectionObserver.instances) {
    if (!Array.isArray(observer.options.threshold) || observer.options.threshold.length <= 1) {
      continue
    }
    observer.emitVisibleForFile(fileId)
  }
}

function hasReadyVisibilityObserver() {
  return MockIntersectionObserver.instances.some(
    (observer) =>
      Array.isArray(observer.options.threshold) &&
      observer.options.threshold.length > 1 &&
      observer.observedElements.size > 0
  )
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

const basePatchFile = {
  ...baseFile,
  patch: [
    'diff --git a/src/git-panel.ts b/src/git-panel.ts',
    '@@ -1 +1 @@',
    '+export const value = 1',
  ].join('\n'),
  state: 'available' as const,
}

const revealFiles = [
  baseFile,
  {
    ...baseFile,
    fileId: 'file-2',
    path: 'src/second-file.ts',
    displayPath: 'src/second-file.ts',
  },
  {
    ...baseFile,
    fileId: 'file-3',
    path: 'src/third-file.ts',
    displayPath: 'src/third-file.ts',
  },
]

const largeDiffFiles = Array.from({ length: 28 }, (_, index) => ({
  ...baseFile,
  fileId: `large-file-${index + 1}`,
  path: `src/large-file-${index + 1}.ts`,
  displayPath: `src/large-file-${index + 1}.ts`,
}))

const largeDiffPatchFiles = largeDiffFiles.map((file, index) => ({
  ...basePatchFile,
  fileId: file.fileId,
  path: file.path,
  displayPath: file.displayPath,
  patch: [
    `diff --git a/${file.path} b/${file.path}`,
    '@@ -1,3 +1,3 @@',
    `-export const before_${index + 1} = 0`,
    `+export const after_${index + 1} = 1`,
    `+export const stable_${index + 1} = true`,
  ].join('\n'),
}))

const replayScrollFiles = [
  {
    ...baseFile,
    fileId: 'replay-app-kernel',
    path: 'packages/app-server/src/app-kernel.ts',
    displayPath: 'packages/app-server/src/app-kernel.ts',
  },
  {
    ...baseFile,
    fileId: 'replay-heartbeat-groups',
    path: 'packages/app-server/src/heartbeat-groups.ts',
    displayPath: 'packages/app-server/src/heartbeat-groups.ts',
  },
  {
    ...baseFile,
    fileId: 'replay-session-runtime',
    path: 'packages/app-server/src/session-runtime.ts',
    displayPath: 'packages/app-server/src/session-runtime.ts',
  },
]

const replayScrollPatchFiles = replayScrollFiles.map((file, index) => ({
  ...basePatchFile,
  fileId: file.fileId,
  path: file.path,
  displayPath: file.displayPath,
  patch: [
    `diff --git a/${file.path} b/${file.path}`,
    '@@ -1,3 +1,3 @@',
    `-export const before_${index + 1} = 0`,
    `+export const after_${index + 1} = 1`,
  ].join('\n'),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  MockIntersectionObserver.reset()
})

beforeEach(() => {
  getEntryPatchMock.mockResolvedValue({
    file: basePatchFile,
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

  it('renders narrow detail as tabs and uses eager patches without refetching', async () => {
    renderWithQueryClient(
      <GitEntryDetailPanel
        selector={{ type: 'commit', hash: baseEntry.hash }}
        entry={baseEntry}
        files={[baseFile]}
        eagerFiles={[basePatchFile]}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByTestId('tabs')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Diff Stream/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /File Tree/i })).toBeTruthy()

    expect(getEntryPatchMock).not.toHaveBeenCalled()

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
        eagerFiles={[
          {
            ...basePatchFile,
            source: 'untracked',
            changeType: 'added',
          },
        ]}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.queryAllByText('loading')).toHaveLength(0)
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    expect(getEntryPatchMock).not.toHaveBeenCalled()
  })

  it('defers file-tree scroll until the diff tab is active', async () => {
    const frameStates: string[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameStates.push(screen.getByTestId('tabs').getAttribute('data-active-tab') ?? '')
      callback(16)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    renderWithQueryClient(
      <GitEntryDetailPanel
        selector={{ type: 'commit', hash: baseEntry.hash }}
        entry={baseEntry}
        files={[baseFile]}
        eagerFiles={[basePatchFile]}
        isLoading={false}
        error={null}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /File Tree/i }))

    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'files')
    })

    fireEvent.click(screen.getByRole('treeitem', { name: /src\/git-panel\.ts/i }))

    await waitFor(() => {
      expect(frameStates.length).toBeGreaterThan(0)
    })

    expect(frameStates.every((state) => state === 'diff')).toBe(true)
  })

  it('does not replay a completed tree-selection diff scroll on later tab activations', async () => {
    const frameQueue: FrameRequestCallback[] = []
    const frameStates: string[] = []

    const flushFrames = (limit = 8) => {
      for (let index = 0; index < limit && frameQueue.length > 0; index += 1) {
        const callback = frameQueue.shift()
        callback?.((index + 1) * 16)
      }
    }

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameStates.push(screen.getByTestId('tabs').getAttribute('data-active-tab') ?? '')
      frameQueue.push(callback)
      return frameQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    renderWithQueryClient(
      <GitEntryDetailPanel
        selector={{ type: 'commit', hash: baseEntry.hash }}
        entry={baseEntry}
        files={[baseFile]}
        eagerFiles={[basePatchFile]}
        isLoading={false}
        error={null}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /File Tree/i }))

    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'files')
    })

    fireEvent.click(screen.getByRole('treeitem', { name: /src\/git-panel\.ts/i }))

    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'diff')
    })

    await act(async () => {
      flushFrames()
    })

    expect(frameStates.length).toBeGreaterThan(0)
    expect(frameStates.every((state) => state === 'diff')).toBe(true)

    const initialFrameCount = frameStates.length

    fireEvent.click(screen.getByRole('button', { name: /File Tree/i }))
    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'files')
    })

    fireEvent.click(screen.getByRole('button', { name: /Diff Stream/i }))
    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'diff')
    })

    await act(async () => {
      flushFrames()
    })

    expect(frameStates).toHaveLength(initialFrameCount)
  })

  it('renders full large narrow diff lists and switches back to diff after tree selection', async () => {
    stubNarrowResizeObserver()
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.dataset.testid === 'scroll-shell') {
          return {
            x: 0,
            y: 40,
            width: 420,
            height: 320,
            top: 40,
            right: 420,
            bottom: 360,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.dataset.testid === 'git-diff-viewport') {
          return {
            x: 0,
            y: 104,
            width: 420,
            height: 240,
            top: 104,
            right: 420,
            bottom: 344,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        return originalGetBoundingClientRect.call(this)
      },
    })

    try {
      renderWithQueryClient(
        <div data-testid="scroll-shell" style={{ height: '320px', overflowY: 'auto' }}>
          <GitEntryDetailPanel
            selector={{ type: 'commit', hash: baseEntry.hash }}
            entry={{
              ...baseEntry,
              diff: { files: largeDiffFiles.length, insertions: 56, deletions: 28 },
            }}
            files={largeDiffFiles}
            eagerFiles={largeDiffPatchFiles}
            isLoading={false}
            error={null}
          />
        </div>
      )
      await waitFor(() => {
        const renderedCount = screen
          .getByTestId('git-diff-viewport')
          .querySelectorAll('section[data-file-id]').length

        expect(renderedCount).toBe(largeDiffFiles.length)
      })

      fireEvent.click(screen.getByRole('button', { name: /File Tree/i }))
      fireEvent.click(screen.getByRole('treeitem', { name: /src\/large-file-28\.ts/i }))

      await waitFor(() => {
        expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'diff')
      })
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        writable: true,
        value: originalGetBoundingClientRect,
      })
    }
  })

  it('scrolls the outer narrow viewport to the selected diff card after tree navigation', async () => {
    stubNarrowResizeObserver()

    const targetFile = largeDiffFiles.at(-1)
    expect(targetFile).toBeTruthy()
    if (!targetFile) {
      return
    }

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(16)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.dataset.testid === 'scroll-shell') {
          return {
            x: 0,
            y: 40,
            width: 420,
            height: 320,
            top: 40,
            right: 420,
            bottom: 360,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.dataset.testid === 'git-diff-viewport') {
          return {
            x: 0,
            y: 104,
            width: 420,
            height: 240,
            top: 104,
            right: 420,
            bottom: 344,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.tagName === 'SECTION' && this.dataset.fileId === targetFile.fileId) {
          return {
            x: 0,
            y: 860,
            width: 420,
            height: 180,
            top: 860,
            right: 420,
            bottom: 1040,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        return originalGetBoundingClientRect.call(this)
      },
    })

    try {
      renderWithQueryClient(
        <div data-testid="scroll-shell" style={{ height: '320px', overflowY: 'auto' }}>
          <GitEntryDetailPanel
            selector={{ type: 'commit', hash: baseEntry.hash }}
            entry={{
              ...baseEntry,
              diff: { files: largeDiffFiles.length, insertions: 56, deletions: 28 },
            }}
            files={largeDiffFiles}
            eagerFiles={largeDiffPatchFiles}
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
        value: 4000,
      })

      const scrollToMock = vi.fn(({ top }: ScrollToOptions) => {
        Object.defineProperty(scrollShell, 'scrollTop', {
          configurable: true,
          value: top ?? 0,
          writable: true,
        })
      })
      Object.defineProperty(scrollShell, 'scrollTo', {
        configurable: true,
        writable: true,
        value: scrollToMock,
      })

      fireEvent.click(screen.getByRole('button', { name: /File Tree/i }))
      fireEvent.click(screen.getByRole('treeitem', { name: new RegExp(targetFile.displayPath) }))

      await waitFor(() => {
        expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'diff')
      })

      await waitFor(() => {
        expect(scrollToMock).toHaveBeenCalled()
      })

      expect(scrollToMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          behavior: 'auto',
          top: expect.any(Number),
        })
      )
      expect(
        (scrollToMock.mock.lastCall?.[0] as ScrollToOptions | undefined)?.top ?? 0
      ).toBeGreaterThan(700)
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        writable: true,
        value: originalGetBoundingClientRect,
      })
    }
  })

  it('retries a tree-selection reveal when another restore rewinds the viewport before verification settles', async () => {
    stubNarrowResizeObserver()

    const frameQueue: FrameRequestCallback[] = []
    const flushNextFrame = () => {
      const callback = frameQueue.shift()
      callback?.(16)
    }

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameQueue.push(callback)
      return frameQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    let scrollShell: HTMLElement | null = null
    const absoluteTopByFileId = new Map([
      ['replay-app-kernel', 544],
      ['replay-heartbeat-groups', 744],
      ['replay-session-runtime', 944],
    ])

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.dataset.testid === 'scroll-shell') {
          return {
            x: 0,
            y: 40,
            width: 420,
            height: 320,
            top: 40,
            right: 420,
            bottom: 360,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.dataset.testid === 'git-diff-viewport') {
          return {
            x: 0,
            y: 104,
            width: 420,
            height: 240,
            top: 104,
            right: 420,
            bottom: 344,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.tagName === 'SECTION') {
          const fileId = this.dataset.fileId
          const absoluteTop = fileId ? absoluteTopByFileId.get(fileId) : null
          if (absoluteTop != null && scrollShell) {
            const top = absoluteTop - scrollShell.scrollTop
            return {
              x: 0,
              y: top,
              width: 420,
              height: 180,
              top,
              right: 420,
              bottom: top + 180,
              left: 0,
              toJSON: () => ({}),
            } satisfies DOMRect
          }
        }

        return originalGetBoundingClientRect.call(this)
      },
    })

    try {
      renderWithQueryClient(
        <div data-testid="scroll-shell" style={{ height: '320px', overflowY: 'auto' }}>
          <GitEntryDetailPanel
            selector={{ type: 'commit', hash: baseEntry.hash }}
            entry={{
              ...baseEntry,
              diff: { files: replayScrollFiles.length, insertions: 9, deletions: 3 },
            }}
            files={replayScrollFiles}
            eagerFiles={replayScrollPatchFiles}
            isLoading={false}
            error={null}
          />
        </div>
      )

      scrollShell = screen.getByTestId('scroll-shell')
      Object.defineProperty(scrollShell, 'clientHeight', {
        configurable: true,
        value: 320,
      })
      Object.defineProperty(scrollShell, 'scrollHeight', {
        configurable: true,
        value: 4000,
      })
      Object.defineProperty(scrollShell, 'scrollTop', {
        configurable: true,
        value: 0,
        writable: true,
      })

      const scrollToMock = vi.fn(({ top }: ScrollToOptions) => {
        Object.defineProperty(scrollShell, 'scrollTop', {
          configurable: true,
          value: top ?? 0,
          writable: true,
        })
      })
      Object.defineProperty(scrollShell, 'scrollTo', {
        configurable: true,
        writable: true,
        value: scrollToMock,
      })

      fireEvent.click(screen.getByRole('button', { name: /File Tree/i }))
      await waitFor(() => {
        expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'files')
      })

      fireEvent.click(
        screen.getByRole('treeitem', { name: /packages\/app-server\/src\/session-runtime\.ts/i })
      )
      await waitFor(() => {
        expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'diff')
      })

      await act(async () => {
        flushNextFrame()
        flushNextFrame()
      })

      const sessionRuntimeTop =
        (scrollToMock.mock.lastCall?.[0] as ScrollToOptions | undefined)?.top ?? null
      expect(sessionRuntimeTop).toEqual(expect.any(Number))
      expect(sessionRuntimeTop).toBeGreaterThan(0)
      expect(scrollShell.scrollTop).toBe(sessionRuntimeTop)

      scrollToMock.mockClear()

      fireEvent.click(screen.getByRole('button', { name: /File Tree/i }))
      await waitFor(() => {
        expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'files')
      })

      fireEvent.click(
        screen.getByRole('treeitem', { name: /packages\/app-server\/src\/app-kernel\.ts/i })
      )
      await waitFor(() => {
        expect(screen.getByTestId('tabs')).toHaveAttribute('data-active-tab', 'diff')
      })

      await act(async () => {
        flushNextFrame()
      })

      const appKernelTop =
        (scrollToMock.mock.lastCall?.[0] as ScrollToOptions | undefined)?.top ?? null
      expect(appKernelTop).toEqual(expect.any(Number))
      expect(appKernelTop).toBeLessThan(sessionRuntimeTop ?? Number.POSITIVE_INFINITY)
      expect(scrollShell.scrollTop).toBe(appKernelTop)

      Object.defineProperty(scrollShell, 'scrollTop', {
        configurable: true,
        value: sessionRuntimeTop,
        writable: true,
      })

      await act(async () => {
        flushNextFrame()
        flushNextFrame()
      })

      const scrollTargets = scrollToMock.mock.calls.map(
        ([options]) => (options as ScrollToOptions | undefined)?.top ?? null
      )
      expect(scrollTargets.filter((top) => top === appKernelTop).length).toBeGreaterThanOrEqual(2)
      expect(scrollShell.scrollTop).toBe(appKernelTop)
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        writable: true,
        value: originalGetBoundingClientRect,
      })
    }
  })

  it('switches to dual-pane layout when the container is wide enough', async () => {
    stubWideResizeObserver()

    renderWithQueryClient(
      <GitEntryDetailPanel
        selector={{ type: 'commit', hash: baseEntry.hash }}
        entry={baseEntry}
        files={[baseFile]}
        eagerFiles={[basePatchFile]}
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

  it('keeps narrow tabs on the page scroll instead of introducing an inner viewport', () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.dataset.testid === 'scroll-shell') {
          return {
            x: 0,
            y: 40,
            width: 420,
            height: 320,
            top: 40,
            right: 420,
            bottom: 360,
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

    fireEvent(window, new Event('resize'))

    expect(screen.queryByTestId('git-pane-tabs-viewport')).toBeNull()
    expect(screen.getByTestId('git-diff-viewport')).not.toHaveClass('overflow-y-auto')

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: originalGetBoundingClientRect,
    })
  })

  it('constrains the wide file-tree viewport to the visible scroll shell height', async () => {
    stubWideResizeObserver()

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
    stubWideResizeObserver()

    const deferredPatch = createDeferred<{
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

  it('does not auto-reveal the tree while tree scrolling owns the navigation intent', async () => {
    stubWideResizeObserver()
    vi.stubGlobal(
      'IntersectionObserver',
      MockIntersectionObserver as unknown as typeof IntersectionObserver
    )

    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.getAttribute('role') === 'tree') {
          return {
            x: 0,
            y: 0,
            width: 320,
            height: 60,
            top: 0,
            right: 320,
            bottom: 60,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.getAttribute('role') === 'treeitem') {
          switch (this.dataset.fileId) {
            case 'file-1':
              return {
                x: 0,
                y: 18,
                width: 320,
                height: 18,
                top: 18,
                right: 320,
                bottom: 36,
                left: 0,
                toJSON: () => ({}),
              } satisfies DOMRect
            case 'file-2':
              return {
                x: 0,
                y: 44,
                width: 320,
                height: 18,
                top: 44,
                right: 320,
                bottom: 62,
                left: 0,
                toJSON: () => ({}),
              } satisfies DOMRect
            case 'file-3':
              return {
                x: 0,
                y: 120,
                width: 320,
                height: 18,
                top: 120,
                right: 320,
                bottom: 138,
                left: 0,
                toJSON: () => ({}),
              } satisfies DOMRect
          }
        }

        if (this.tagName === 'SECTION') {
          const fileId = this.dataset.fileId
          if (fileId === 'file-1') {
            return {
              x: 0,
              y: 0,
              width: 800,
              height: 120,
              top: 0,
              right: 800,
              bottom: 120,
              left: 0,
              toJSON: () => ({}),
            } satisfies DOMRect
          }

          if (fileId === 'file-2') {
            return {
              x: 0,
              y: 130,
              width: 800,
              height: 120,
              top: 130,
              right: 800,
              bottom: 250,
              left: 0,
              toJSON: () => ({}),
            } satisfies DOMRect
          }

          if (fileId === 'file-3') {
            return {
              x: 0,
              y: 260,
              width: 800,
              height: 120,
              top: 260,
              right: 800,
              bottom: 380,
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
        entry={{ ...baseEntry, diff: { files: 3, insertions: 9, deletions: 3 } }}
        files={revealFiles}
        isLoading={false}
        error={null}
        patchLoader={async () => null}
      />
    )

    const tree = await screen.findByRole('tree')
    const treeScrollToMock = vi.fn()
    Object.defineProperty(tree, 'scrollTo', {
      configurable: true,
      writable: true,
      value: treeScrollToMock,
    })

    await waitFor(() => {
      expect(hasReadyVisibilityObserver()).toBe(true)
    })

    fireEvent.wheel(tree, { deltaY: 120 })
    await act(async () => {
      emitVisibleFileThroughVisibilityObserver('file-3')
    })

    expect(treeScrollToMock).not.toHaveBeenCalled()

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: originalGetBoundingClientRect,
    })
  })

  it('reveals the tree when diff scrolling owns the navigation intent', async () => {
    stubWideResizeObserver()
    vi.stubGlobal(
      'IntersectionObserver',
      MockIntersectionObserver as unknown as typeof IntersectionObserver
    )

    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.getAttribute('role') === 'tree') {
          return {
            x: 0,
            y: 0,
            width: 320,
            height: 60,
            top: 0,
            right: 320,
            bottom: 60,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.getAttribute('role') === 'treeitem') {
          switch (this.dataset.fileId) {
            case 'file-1':
              return {
                x: 0,
                y: 18,
                width: 320,
                height: 18,
                top: 18,
                right: 320,
                bottom: 36,
                left: 0,
                toJSON: () => ({}),
              } satisfies DOMRect
            case 'file-2':
              return {
                x: 0,
                y: 44,
                width: 320,
                height: 18,
                top: 44,
                right: 320,
                bottom: 62,
                left: 0,
                toJSON: () => ({}),
              } satisfies DOMRect
            case 'file-3':
              return {
                x: 0,
                y: 120,
                width: 320,
                height: 18,
                top: 120,
                right: 320,
                bottom: 138,
                left: 0,
                toJSON: () => ({}),
              } satisfies DOMRect
          }
        }

        if (this.tagName === 'SECTION') {
          const fileId = this.dataset.fileId
          if (fileId === 'file-1') {
            return {
              x: 0,
              y: 0,
              width: 800,
              height: 120,
              top: 0,
              right: 800,
              bottom: 120,
              left: 0,
              toJSON: () => ({}),
            } satisfies DOMRect
          }

          if (fileId === 'file-2') {
            return {
              x: 0,
              y: 130,
              width: 800,
              height: 120,
              top: 130,
              right: 800,
              bottom: 250,
              left: 0,
              toJSON: () => ({}),
            } satisfies DOMRect
          }

          if (fileId === 'file-3') {
            return {
              x: 0,
              y: 260,
              width: 800,
              height: 120,
              top: 260,
              right: 800,
              bottom: 380,
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
        entry={{ ...baseEntry, diff: { files: 3, insertions: 9, deletions: 3 } }}
        files={revealFiles}
        isLoading={false}
        error={null}
        patchLoader={async () => null}
      />
    )

    const tree = await screen.findByRole('tree')
    const treeScrollToMock = vi.fn()
    Object.defineProperty(tree, 'scrollTo', {
      configurable: true,
      writable: true,
      value: treeScrollToMock,
    })

    await waitFor(() => {
      expect(hasReadyVisibilityObserver()).toBe(true)
    })

    const diffSection = screen.getByText('Diff Stream').closest('section') as HTMLElement
    fireEvent.wheel(diffSection, { deltaY: 120 })
    emitVisibleFileThroughVisibilityObserver('file-3')

    await waitFor(() => {
      expect(treeScrollToMock).toHaveBeenCalled()
    })

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: originalGetBoundingClientRect,
    })
  })
})
