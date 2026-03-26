import type {
  DashboardGitEntry,
  GitEntryFilePatch,
  GitEntryFileSummary,
  GitEntrySelector,
} from '@openspecui/core'
import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { renderReactStory } from '@/storybook/render-react-story'

import { GitEntryDetailPanel } from './git-panel-detail'

const storyEntry: DashboardGitEntry = {
  type: 'commit',
  hash: '9f8e7d6c',
  title: 'feat: tighten git detail scroll behavior',
  committedAt: Date.UTC(2026, 2, 26),
  relatedChanges: ['add-git-panel-worktree-handoff'],
  diff: {
    files: 48,
    insertions: 432,
    deletions: 117,
  },
}

const storySelector: GitEntrySelector = {
  type: 'commit',
  hash: storyEntry.hash,
}

const storyFiles: GitEntryFileSummary[] = Array.from({ length: 48 }, (_, index) => ({
  fileId: `file-${index + 1}`,
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

const storyPatchesByFileId = new Map<string, GitEntryFilePatch>(
  storyFiles.map((file, index) => [
    file.fileId,
    {
      ...file,
      state: 'available',
      patch: [
        `diff --git a/${file.path} b/${file.path}`,
        'index 0000000..1111111 100644',
        `--- a/${file.path}`,
        `+++ b/${file.path}`,
        '@@ -1,6 +1,6 @@',
        ...Array.from(
          { length: 12 + (index % 5) * 8 },
          (_, lineIndex) =>
            `${lineIndex % 2 === 0 ? '+' : '-'} line ${lineIndex + 1} for ${file.fileId}`
        ),
      ].join('\n'),
    },
  ])
)

function requireStoryShell(node: Element | null): HTMLElement {
  const shell = node?.closest<HTMLElement>('[data-testid="git-detail-story-shell"]') ?? null
  expect(shell).toBeTruthy()

  if (!shell) {
    throw new Error('git detail story shell not found')
  }

  return shell
}

function GitDetailStory({ width }: { width: number }) {
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

  return (
    <QueryClientProvider client={queryClient}>
      <div
        data-testid="git-detail-story-shell"
        style={{
          width: `${width}px`,
          height: '360px',
          overflowY: 'auto',
          padding: '16px',
          background: '#fff',
        }}
      >
        <GitEntryDetailPanel
          selector={storySelector}
          entry={storyEntry}
          files={storyFiles}
          isLoading={false}
          error={null}
          patchLoader={async ({ fileId }) => {
            const file = storyPatchesByFileId.get(fileId) ?? null
            return file ? { entry: storyEntry, file } : null
          }}
        />
      </div>
    </QueryClientProvider>
  )
}

class StoryMockIntersectionObserver {
  static instances: StoryMockIntersectionObserver[] = []

  readonly observedElements = new Set<Element>()
  readonly options: IntersectionObserverInit
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.callback = callback
    this.options = options
    StoryMockIntersectionObserver.instances.push(this)
  }

  observe(element: Element) {
    this.observedElements.add(element)
  }

  unobserve(element: Element) {
    this.observedElements.delete(element)
  }

  disconnect() {
    this.observedElements.clear()
    StoryMockIntersectionObserver.instances = StoryMockIntersectionObserver.instances.filter(
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

  static emitVisible(fileId: string) {
    for (const observer of StoryMockIntersectionObserver.instances) {
      if (!Array.isArray(observer.options.threshold) || observer.options.threshold.length <= 1) {
        continue
      }

      observer.emitVisibleForFile(fileId)
    }
  }

  static reset() {
    StoryMockIntersectionObserver.instances = []
  }
}

function hasReadyStoryVisibilityObserver() {
  return StoryMockIntersectionObserver.instances.some(
    (observer) =>
      Array.isArray(observer.options.threshold) &&
      observer.options.threshold.length > 1 &&
      observer.observedElements.size > 0
  )
}

function GitDetailObserverGuardStory({ width }: { width: number }) {
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
  const originalObserverRef = useRef<typeof IntersectionObserver | null>(null)
  const originalScrollToRef = useRef<HTMLElement['scrollTo'] | null>(null)
  const [treeRevealCallCount, setTreeRevealCallCount] = useState(0)

  useEffect(() => {
    originalObserverRef.current = window.IntersectionObserver
    window.IntersectionObserver =
      StoryMockIntersectionObserver as unknown as typeof IntersectionObserver
    originalScrollToRef.current = HTMLElement.prototype.scrollTo
    HTMLElement.prototype.scrollTo = function patchedScrollTo(
      this: HTMLElement,
      ...args: Parameters<HTMLElement['scrollTo']>
    ) {
      setTreeRevealCallCount((count) => count + 1)
      return originalScrollToRef.current?.apply(this, args)
    } as HTMLElement['scrollTo']

    return () => {
      if (originalObserverRef.current) {
        window.IntersectionObserver = originalObserverRef.current
      }
      if (originalScrollToRef.current) {
        HTMLElement.prototype.scrollTo = originalScrollToRef.current
      }
      StoryMockIntersectionObserver.reset()
    }
  }, [])

  const markTreeInteraction = () => {
    const tree = document.querySelector<HTMLElement>('[role="tree"]')
    if (!tree) {
      return
    }

    tree.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={markTreeInteraction}>
            Mark tree interaction
          </button>
          <button type="button" onClick={() => StoryMockIntersectionObserver.emitVisible('file-1')}>
            Emit file-1 visible
          </button>
          <button
            type="button"
            onClick={() => StoryMockIntersectionObserver.emitVisible('file-48')}
          >
            Emit file-48 visible
          </button>
        </div>
        <output data-testid="tree-reveal-call-count">{treeRevealCallCount}</output>
        <div
          data-testid="git-detail-story-shell"
          style={{
            width: `${width}px`,
            height: '360px',
            overflowY: 'auto',
            padding: '16px',
            background: '#fff',
          }}
        >
          <GitEntryDetailPanel
            selector={storySelector}
            entry={storyEntry}
            files={storyFiles}
            isLoading={false}
            error={null}
            patchLoader={async () => null}
          />
        </div>
      </div>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Git/GitDetailScrollHarness',
  render: () => renderReactStory(<GitDetailStory width={1200} />),
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const WideScrollSpy: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const diffLabel = await canvas.findByText('Diff Stream')
    const shell = requireStoryShell(diffLabel)

    shell.scrollTo({
      top: Math.max(shell.scrollHeight - shell.clientHeight, 0),
      behavior: 'auto',
    })

    await waitFor(() => {
      const treeViewport = canvasElement.querySelector<HTMLElement>(
        '[data-testid="git-file-tree-viewport"]'
      )
      expect(treeViewport).toBeTruthy()

      if (!treeViewport) {
        return
      }

      expect(treeViewport.getAttribute('style') ?? '').toContain('height:')
      const shellRect = shell.getBoundingClientRect()
      const viewportRect = treeViewport.getBoundingClientRect()
      expect(viewportRect.bottom).toBeLessThanOrEqual(shellRect.bottom + 1)
    })
  },
}

export const NarrowTabsScrollSpy: Story = {
  render: () => renderReactStory(<GitDetailStory width={480} />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const diffTab = await canvas.findByRole('button', { name: 'Diff Stream' })
    const shell = requireStoryShell(diffTab)

    shell.scrollTo({
      top: Math.max(shell.scrollHeight - shell.clientHeight, 0),
      behavior: 'auto',
    })

    await userEvent.click(await canvas.findByRole('button', { name: 'File Tree' }))

    await waitFor(() => {
      const tree = canvas.getByRole('tree')
      expect(tree.style.maxHeight).toBe('')
      expect(tree.scrollHeight).toBe(tree.clientHeight)
      expect(shell.scrollHeight).toBeGreaterThan(shell.clientHeight)
    })
  },
}

export const WideTreeManualScrollGuard: Story = {
  render: () => renderReactStory(<GitDetailObserverGuardStory width={1200} />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('tree')

    await waitFor(() => {
      expect(hasReadyStoryVisibilityObserver()).toBe(true)
    })

    await userEvent.click(await canvas.findByRole('button', { name: 'Mark tree interaction' }))
    const initialRevealCallCount = Number(
      (await canvas.findByTestId('tree-reveal-call-count')).textContent ?? '0'
    )
    await userEvent.click(await canvas.findByRole('button', { name: 'Emit file-1 visible' }))

    await waitFor(() => {
      expect(Number(canvas.getByTestId('tree-reveal-call-count').textContent ?? '0')).toBe(
        initialRevealCallCount
      )
    })
  },
}
