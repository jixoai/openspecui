import { Tabs } from '@/components/tabs'
import { trpcClient } from '@/lib/trpc'
import type {
  DashboardGitEntry,
  GitEntryFilePatch,
  GitEntryFileSummary,
  GitEntrySelector,
} from '@openspecui/core'
import { useQueries } from '@tanstack/react-query'
import { AlertCircle, Files, GitCommitHorizontal, ListTree, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { GitFileTree } from './git-file-tree'
import { GitPatchCard, type GitPatchCardStatus } from './git-patch-card'
import { DiffStat, GitFilesBadge, formatRelatedChanges } from './git-shared'

const INITIAL_PATCH_REQUEST_COUNT = 2
const WIDE_DETAIL_MIN_WIDTH = 960
const DIFF_SCROLL_PADDING = 12
const DIFF_SCROLL_ALIGNMENT_TOLERANCE = 16
const DIFF_SCROLL_DEADLINE_MS = 4_000

function useWideDetailLayout() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [wide, setWide] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      setWide((entry?.contentRect.width ?? 0) >= WIDE_DETAIL_MIN_WIDTH)
    })

    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  return { ref, wide }
}

function selectorCacheKey(selector: GitEntrySelector | null): string {
  if (!selector) return 'none'
  return selector.type === 'commit' ? `commit:${selector.hash}` : 'uncommitted'
}

function findVerticalScrollContainer(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null

  while (current) {
    const style = window.getComputedStyle(current)
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current
    }
    current = current.parentElement
  }

  return null
}

function scrollCardIntoView(
  node: HTMLElement,
  fallbackRoot: HTMLElement | null,
  topOffset: number
): void {
  const scrollContainer =
    findVerticalScrollContainer(node) ?? findVerticalScrollContainer(fallbackRoot)

  if (!scrollContainer) {
    node.scrollIntoView({ block: 'start', behavior: 'auto' })
    return
  }

  const nodeRect = node.getBoundingClientRect()
  const containerRect = scrollContainer.getBoundingClientRect()
  const nextTop = scrollContainer.scrollTop + nodeRect.top - containerRect.top - topOffset

  scrollContainer.scrollTo({
    top: Math.max(nextTop, 0),
    behavior: 'auto',
  })
}

function isCardAligned(
  node: HTMLElement,
  fallbackRoot: HTMLElement | null,
  topOffset: number
): boolean {
  const scrollContainer =
    findVerticalScrollContainer(node) ?? findVerticalScrollContainer(fallbackRoot)
  const nodeRect = node.getBoundingClientRect()

  if (!scrollContainer) {
    return Math.abs(nodeRect.top - topOffset) <= DIFF_SCROLL_ALIGNMENT_TOLERANCE
  }

  const containerRect = scrollContainer.getBoundingClientRect()
  const targetTop = containerRect.top + topOffset
  return Math.abs(nodeRect.top - targetTop) <= DIFF_SCROLL_ALIGNMENT_TOLERANCE
}

function entryIcon(entry: DashboardGitEntry) {
  return entry.type === 'commit' ? (
    <GitCommitHorizontal className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
  ) : (
    <LoaderCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
  )
}

export function GitEntryDetailPanel({
  selector,
  entry,
  files,
  projectDir,
  isLoading,
  error,
  showEntrySummary = true,
}: {
  selector: GitEntrySelector | null
  entry: DashboardGitEntry | null
  files: GitEntryFileSummary[]
  projectDir?: string | null
  isLoading: boolean
  error: Error | null
  showEntrySummary?: boolean
}) {
  const { ref, wide } = useWideDetailLayout()
  const selectorKey = selectorCacheKey(selector)
  const [activePane, setActivePane] = useState<'diff' | 'files'>('diff')
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [requestedFileIds, setRequestedFileIds] = useState<string[]>([])
  const [diffScrollOffset, setDiffScrollOffset] = useState(DIFF_SCROLL_PADDING)
  const cardNodesRef = useRef(new Map<string, HTMLElement>())
  const pendingScrollFileIdRef = useRef<string | null>(null)
  const pendingScrollDeadlineRef = useRef(0)
  const pendingScrollFrameRef = useRef<number | null>(null)
  const diffViewportRef = useRef<HTMLDivElement | null>(null)
  const tabsRootRef = useRef<HTMLDivElement | null>(null)

  const requestPatch = useCallback((fileId: string) => {
    setRequestedFileIds((current) => (current.includes(fileId) ? current : [...current, fileId]))
  }, [])

  useEffect(() => {
    setActivePane('diff')
    setSelectedFileId(null)
    setRequestedFileIds([])
    cardNodesRef.current.clear()
    pendingScrollFileIdRef.current = null
    pendingScrollDeadlineRef.current = 0
    if (pendingScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingScrollFrameRef.current)
      pendingScrollFrameRef.current = null
    }
  }, [selectorKey])

  useEffect(() => {
    if (files.length === 0) return

    setSelectedFileId((current) =>
      current && files.some((file) => file.fileId === current) ? current : files[0]!.fileId
    )

    setRequestedFileIds((current) => {
      const next = new Set(current.filter((fileId) => files.some((file) => file.fileId === fileId)))
      for (const file of files.slice(0, INITIAL_PATCH_REQUEST_COUNT)) {
        next.add(file.fileId)
      }
      for (const file of files) {
        if (file.diff.state !== 'ready') {
          next.add(file.fileId)
        }
      }
      return [...next]
    })
  }, [files])

  const requestedOrderedFileIds = useMemo(
    () => files.map((file) => file.fileId).filter((fileId) => requestedFileIds.includes(fileId)),
    [files, requestedFileIds]
  )

  const patchQueries = useQueries({
    queries: requestedOrderedFileIds.map((fileId) => ({
      queryKey: ['git', 'patch', selectorKey, fileId],
      queryFn: async () => {
        if (!selector) return null
        return trpcClient.git.getEntryPatch.query({ selector, fileId })
      },
      enabled: selector !== null,
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  })

  const patchStateByFileId = useMemo(() => {
    const map = new Map<
      string,
      {
        status: GitPatchCardStatus
        file: GitEntryFilePatch | null
        error: Error | null
      }
    >()

    requestedOrderedFileIds.forEach((fileId, index) => {
      const query = patchQueries[index]
      if (!query) return

      const status: GitPatchCardStatus =
        query.isPending || (query.isFetching && !query.data)
          ? 'loading'
          : query.error
            ? 'error'
            : 'ready'

      map.set(fileId, {
        status,
        file: query.data?.file ?? null,
        error: query.error instanceof Error ? query.error : null,
      })
    })

    return map
  }, [patchQueries, requestedOrderedFileIds])

  const patchLayoutVersion = useMemo(
    () =>
      patchQueries
        .map(
          (query) =>
            `${query.status}:${query.fetchStatus}:${query.dataUpdatedAt}:${query.errorUpdatedAt}`
        )
        .join('|'),
    [patchQueries]
  )

  const treeFiles = useMemo(
    () => files.map((file) => patchStateByFileId.get(file.fileId)?.file ?? file),
    [files, patchStateByFileId]
  )

  const syncDiffScrollOffset = useCallback(() => {
    if (wide) {
      setDiffScrollOffset(DIFF_SCROLL_PADDING)
      return
    }

    const strip = tabsRootRef.current?.querySelector<HTMLElement>('.tabs-strip')
    if (!strip) {
      setDiffScrollOffset(DIFF_SCROLL_PADDING)
      return
    }

    setDiffScrollOffset(Math.ceil(strip.getBoundingClientRect().height) + DIFF_SCROLL_PADDING)
  }, [wide])

  useEffect(() => {
    syncDiffScrollOffset()

    if (wide) return
    if (typeof ResizeObserver === 'undefined') return

    const strip = tabsRootRef.current?.querySelector<HTMLElement>('.tabs-strip')
    if (!strip) return

    const observer = new ResizeObserver(() => {
      syncDiffScrollOffset()
    })

    observer.observe(strip)
    return () => {
      observer.disconnect()
    }
  }, [syncDiffScrollOffset, wide])

  const flushPendingScroll = useCallback(() => {
    if (!wide && activePane !== 'diff') {
      return
    }

    const fileId = pendingScrollFileIdRef.current
    if (!fileId) {
      return
    }

    const node = cardNodesRef.current.get(fileId)
    if (!node) {
      return
    }

    if (
      pendingScrollDeadlineRef.current > 0 &&
      window.performance.now() > pendingScrollDeadlineRef.current
    ) {
      pendingScrollFileIdRef.current = null
      pendingScrollDeadlineRef.current = 0
      return
    }

    if (isCardAligned(node, diffViewportRef.current, diffScrollOffset)) {
      pendingScrollFileIdRef.current = null
      pendingScrollDeadlineRef.current = 0
      return
    }

    scrollCardIntoView(node, diffViewportRef.current, diffScrollOffset)
  }, [activePane, diffScrollOffset, wide])

  const schedulePendingScroll = useCallback(() => {
    if (pendingScrollFrameRef.current !== null) {
      return
    }

    pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
      pendingScrollFrameRef.current = null
      flushPendingScroll()
    })
  }, [flushPendingScroll])

  const queueScrollToFile = useCallback(
    (fileId: string) => {
      pendingScrollFileIdRef.current = fileId
      pendingScrollDeadlineRef.current = window.performance.now() + DIFF_SCROLL_DEADLINE_MS

      if (!wide && activePane !== 'diff') {
        return
      }

      schedulePendingScroll()
    },
    [activePane, schedulePendingScroll, wide]
  )

  useEffect(() => {
    if ((!wide && activePane !== 'diff') || pendingScrollFileIdRef.current === null) return

    schedulePendingScroll()
  }, [activePane, files, patchLayoutVersion, schedulePendingScroll, wide])

  useEffect(
    () => () => {
      if (pendingScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingScrollFrameRef.current)
      }
    },
    []
  )

  const handleSelectFile = useCallback(
    (fileId: string) => {
      setSelectedFileId(fileId)
      requestPatch(fileId)
      queueScrollToFile(fileId)
      if (!wide) {
        setActivePane('diff')
      }
    },
    [queueScrollToFile, requestPatch, wide]
  )

  const registerCardNode = useCallback((fileId: string, node: HTMLElement | null) => {
    if (!node) {
      cardNodesRef.current.delete(fileId)
      return
    }
    cardNodesRef.current.set(fileId, node)
  }, [])

  if (error) {
    return (
      <div className="text-destructive border-current/20 flex items-center gap-2 rounded-md border px-3 py-3 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error.message}
      </div>
    )
  }

  if (isLoading && !entry) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading changed files…
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
        Select an entry to inspect changed files.
      </div>
    )
  }

  const fileTreeContent =
    isLoading && files.length === 0 ? (
      <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
        Loading changed files…
      </div>
    ) : (
      <GitFileTree
        files={treeFiles}
        projectDir={projectDir}
        activeFileId={selectedFileId}
        onSelectFile={handleSelectFile}
      />
    )

  const diffViewportStyle = {
    scrollPaddingTop: `${diffScrollOffset}px`,
  }

  const diffStreamContent =
    isLoading && files.length === 0 ? (
      <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
        Loading changed files…
      </div>
    ) : files.length === 0 ? (
      <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
        No changed files found for this entry.
      </div>
    ) : (
      <div className="space-y-3">
        {files.map((file) => {
          const patchState = patchStateByFileId.get(file.fileId)
          return (
            <GitPatchCard
              key={file.fileId}
              file={patchState?.file ?? file}
              patch={patchState?.file ?? null}
              status={patchState?.status ?? 'idle'}
              error={patchState?.error ?? null}
              onRequest={requestPatch}
              onRegisterCard={registerCardNode}
              scrollMarginTop={diffScrollOffset}
            />
          )
        })}
      </div>
    )

  return (
    <div ref={ref} className="@container min-w-0 space-y-3">
      {showEntrySummary ? (
        <section className="bg-card rounded-md border border-zinc-500/20 px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                {entryIcon(entry)}
                <span className="truncate">{entry.title}</span>
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                {entry.type === 'commit' ? entry.hash : 'working tree'} ·{' '}
                {formatRelatedChanges(entry.relatedChanges)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <GitFilesBadge files={entry.diff.files} />
              <DiffStat diff={entry.diff} />
            </div>
          </div>
        </section>
      ) : null}

      {wide ? (
        <div className="grid min-w-0 gap-3 [grid-template-columns:minmax(18rem,20rem)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ListTree className="h-4 w-4 shrink-0" />
              <span>File Tree</span>
            </div>
            {fileTreeContent}
          </section>
          <section className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Files className="h-4 w-4 shrink-0" />
              <span>Diff Stream</span>
            </div>
            <div ref={diffViewportRef} data-testid="git-diff-viewport" style={diffViewportStyle}>
              {diffStreamContent}
            </div>
          </section>
        </div>
      ) : (
        <div ref={tabsRootRef}>
          <Tabs
            variant="default"
            selectedTab={activePane}
            onTabChange={(tabId) => setActivePane(tabId === 'files' ? 'files' : 'diff')}
            tabs={[
              {
                id: 'diff',
                label: 'Diff Stream',
                icon: <Files className="h-4 w-4" />,
                content: (
                  <div
                    ref={diffViewportRef}
                    data-testid="git-diff-viewport"
                    className="pt-3"
                    style={diffViewportStyle}
                  >
                    {diffStreamContent}
                  </div>
                ),
              },
              {
                id: 'files',
                label: 'File Tree',
                icon: <ListTree className="h-4 w-4" />,
                content: <div className="pt-3">{fileTreeContent}</div>,
              },
            ]}
          />
        </div>
      )}
    </div>
  )
}
