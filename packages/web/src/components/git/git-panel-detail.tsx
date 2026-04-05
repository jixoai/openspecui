import { ErrorBoundary } from '@/components/error-boundary'
import { Tabs } from '@/components/tabs'
import { trpcClient } from '@/lib/trpc'
import { useRoutedCarouselTabs } from '@/lib/view-transitions/tabs'
import type {
  DashboardGitEntry,
  GitEntryFilePatch,
  GitEntryFileSummary,
  GitEntrySelector,
} from '@openspecui/core'
import { useQueries } from '@tanstack/react-query'
import { AlertCircle, Files, GitCommitHorizontal, ListTree, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import {
  buildIntersectionThresholds,
  findVerticalScrollContainer,
  isVerticalScrollIntentKey,
  pickRevealTargetId,
  useIntersectionVisibilityMap,
  useViewportConstrainedHeight,
  type VisibilityBatchEntry,
} from '../scroll-spy'
import { GitFileTree, type GitFileTreeRevealRequest } from './git-file-tree'
import { GitPatchCard, type GitPatchCardStatus } from './git-patch-card'
import { DiffStat, GitFilesBadge, formatRelatedChanges } from './git-shared'

const WIDE_DETAIL_MIN_WIDTH = 960
const DIFF_SCROLL_PADDING = 12
const DIFF_SCROLL_ALIGNMENT_TOLERANCE = 16
const DIFF_SCROLL_DEADLINE_MS = 4_000
const FILE_TREE_NARROW_MARGIN_BLOCK = 12
const PATCH_PREFETCH_ROOT_MARGIN = '180px 0px'
const VISIBILITY_THRESHOLDS = buildIntersectionThresholds(20)

interface GitEntryPatchResponse {
  file: GitEntryFilePatch | null
}

type GitPatchLoader = (options: {
  selector: GitEntrySelector
  fileId: string
}) => Promise<GitEntryPatchResponse | null>

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

function isSameFileDiff(
  left: GitEntryFileSummary['diff'],
  right: GitEntryFileSummary['diff']
): boolean {
  if (left.state !== right.state) return false
  if (left.files !== right.files) return false

  if (left.state !== 'ready' || right.state !== 'ready') {
    return true
  }

  return left.insertions === right.insertions && left.deletions === right.deletions
}

function isScrollIntentEventKey(event: KeyboardEvent<HTMLElement>): boolean {
  return isVerticalScrollIntentKey(event.key)
}

function detectDiffScrollRoot(cardNodes: Iterable<HTMLElement>): HTMLElement | null {
  for (const node of cardNodes) {
    const root = findVerticalScrollContainer(node, { allowNonScrollable: true })
    if (root) {
      return root
    }
  }

  return null
}

function scrollCardIntoView(
  node: HTMLElement,
  fallbackRoot: HTMLElement | null,
  topOffset: number
): void {
  const scrollContainer =
    findVerticalScrollContainer(node, { allowNonScrollable: true }) ??
    findVerticalScrollContainer(fallbackRoot, { allowNonScrollable: true })

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
    findVerticalScrollContainer(node, { allowNonScrollable: true }) ??
    findVerticalScrollContainer(fallbackRoot, { allowNonScrollable: true })
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

function GitFileTreeFallback({
  files,
  onSelectFile,
}: {
  files: GitEntryFileSummary[]
  onSelectFile: (fileId: string) => void
}) {
  return (
    <div className="rounded-md border border-dashed border-zinc-500/25 p-3">
      <div className="text-muted-foreground mb-2 text-xs">
        File tree is temporarily unavailable. Use the file list below.
      </div>
      <div className="space-y-1">
        {files.map((file) => (
          <button
            key={file.fileId}
            type="button"
            onClick={() => onSelectFile(file.fileId)}
            className="hover:bg-muted/40 block w-full rounded-md px-2 py-1.5 text-left text-sm"
          >
            {file.displayPath}
          </button>
        ))}
      </div>
    </div>
  )
}

export function GitEntryDetailPanel({
  selector,
  entry,
  files,
  eagerFiles = [],
  projectDir,
  isLoading,
  error,
  showEntrySummary = true,
  patchLoader,
}: {
  selector: GitEntrySelector | null
  entry: DashboardGitEntry | null
  files: GitEntryFileSummary[]
  eagerFiles?: GitEntryFilePatch[]
  projectDir?: string | null
  isLoading: boolean
  error: Error | null
  showEntrySummary?: boolean
  patchLoader?: GitPatchLoader
}) {
  const { ref, wide } = useWideDetailLayout()
  const selectorKey = selectorCacheKey(selector)
  const paneTabs = useMemo<Array<{ id: 'diff' | 'files' }>>(
    () => [{ id: 'diff' }, { id: 'files' }],
    []
  )
  const {
    tabsRef,
    selectedTab: activePane,
    setSelectedTab,
    onTabChange,
  } = useRoutedCarouselTabs({
    queryKey: 'gitPane',
    tabs: paneTabs,
    initialTab: 'diff',
  })
  const [requestedFileIds, setRequestedFileIds] = useState<string[]>([])
  const [diffScrollOffset, setDiffScrollOffset] = useState(DIFF_SCROLL_PADDING)
  const [diffScrollRoot, setDiffScrollRoot] = useState<HTMLElement | null>(null)
  const [treeRevealRequest, setTreeRevealRequest] = useState<GitFileTreeRevealRequest | null>(null)
  const cardNodesRef = useRef(new Map<string, HTMLElement>())
  const pendingScrollFileIdRef = useRef<string | null>(null)
  const pendingScrollDeadlineRef = useRef(0)
  const pendingScrollFrameRef = useRef<number | null>(null)
  const diffViewportRef = useRef<HTMLDivElement | null>(null)
  const tabsRootRef = useRef<HTMLDivElement | null>(null)
  const treeRevealNonceRef = useRef(0)
  const revealNavigationSourceRef = useRef<'diff' | 'tree' | null>(null)
  const [wideTreeViewportNode, setWideTreeViewportNode] = useState<HTMLDivElement | null>(null)
  const wideTreeHeight = useViewportConstrainedHeight({
    target: wideTreeViewportNode,
    enabled: wide,
  })
  const eagerFileIdSet = useMemo(() => new Set(eagerFiles.map((file) => file.fileId)), [eagerFiles])

  const markTreeNavigation = useCallback(() => {
    revealNavigationSourceRef.current = 'tree'
  }, [])

  const markDiffNavigation = useCallback(() => {
    revealNavigationSourceRef.current = 'diff'
  }, [])

  const requestPatch = useCallback(
    (fileId: string) => {
      if (eagerFileIdSet.has(fileId)) {
        return
      }

      setRequestedFileIds((current) => (current.includes(fileId) ? current : [...current, fileId]))
    },
    [eagerFileIdSet]
  )

  const fileIds = useMemo(() => files.map((file) => file.fileId), [files])

  const loadPatch = useCallback(
    async (fileId: string) => {
      if (!selector) {
        return null
      }

      if (patchLoader) {
        return patchLoader({ selector, fileId })
      }

      return trpcClient.git.getEntryPatch.query({ selector, fileId })
    },
    [patchLoader, selector]
  )

  useEffect(() => {
    setSelectedTab('diff')
    setRequestedFileIds([])
    setDiffScrollRoot(null)
    setTreeRevealRequest(null)
    revealNavigationSourceRef.current = null
    cardNodesRef.current.clear()
    pendingScrollFileIdRef.current = null
    pendingScrollDeadlineRef.current = 0
    if (pendingScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingScrollFrameRef.current)
      pendingScrollFrameRef.current = null
    }
  }, [selectorKey, setSelectedTab])

  useEffect(() => {
    setRequestedFileIds((current) => {
      const next = current.filter(
        (fileId) => !eagerFileIdSet.has(fileId) && files.some((file) => file.fileId === fileId)
      )
      return next.length === current.length &&
        next.every((fileId, index) => fileId === current[index])
        ? current
        : next
    })
  }, [eagerFileIdSet, files])

  const requestedOrderedFileIds = useMemo(
    () =>
      files
        .map((file) => file.fileId)
        .filter((fileId) => !eagerFileIdSet.has(fileId) && requestedFileIds.includes(fileId)),
    [eagerFileIdSet, files, requestedFileIds]
  )

  const patchQueries = useQueries({
    queries: requestedOrderedFileIds.map((fileId) => ({
      queryKey: ['git', 'patch', selectorKey, fileId],
      queryFn: () => loadPatch(fileId),
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

    for (const file of eagerFiles) {
      map.set(file.fileId, {
        status: 'ready',
        file,
        error: null,
      })
    }

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
  }, [eagerFiles, patchQueries, requestedOrderedFileIds])

  const patchLayoutVersion = useMemo(
    () =>
      [
        eagerFiles
          .map((file) => `${file.fileId}:${file.state}:${file.patch?.length ?? 0}`)
          .join('|'),
        patchQueries
          .map(
            (query) =>
              `${query.status}:${query.fetchStatus}:${query.dataUpdatedAt}:${query.errorUpdatedAt}`
          )
          .join('|'),
      ].join('|'),
    [eagerFiles, patchQueries]
  )

  const treeFiles = useMemo(
    () =>
      files.map((file) => {
        const patchFile = patchStateByFileId.get(file.fileId)?.file
        if (!patchFile) {
          return file
        }

        if (isSameFileDiff(file.diff, patchFile.diff)) {
          return file
        }

        return {
          ...file,
          diff: patchFile.diff,
        }
      }),
    [files, patchStateByFileId]
  )

  const handlePrefetchVisible = useCallback(
    (entries: VisibilityBatchEntry<string>[]) => {
      for (const { id } of entries) {
        requestPatch(id)
      }
    },
    [requestPatch]
  )

  const handleFilesBecameVisible = useCallback((entries: VisibilityBatchEntry<string>[]) => {
    if (revealNavigationSourceRef.current !== 'diff') {
      return
    }

    const revealFileId = pickRevealTargetId(entries)
    if (!revealFileId) {
      return
    }

    treeRevealNonceRef.current += 1
    setTreeRevealRequest({
      fileId: revealFileId,
      nonce: treeRevealNonceRef.current,
    })
  }, [])

  const { ratioById: visibilityRatioByFileId, setObservedNode: setVisibleObservedNode } =
    useIntersectionVisibilityMap<string>({
      ids: fileIds,
      root: diffScrollRoot,
      threshold: VISIBILITY_THRESHOLDS,
      onBecomeVisible: handleFilesBecameVisible,
    })

  const treeVisibilityRatioByFileId = useMemo<ReadonlyMap<string, number>>(() => {
    if (visibilityRatioByFileId.size > 0 || !treeRevealRequest) {
      return visibilityRatioByFileId
    }

    return new Map([[treeRevealRequest.fileId, 1]])
  }, [treeRevealRequest, visibilityRatioByFileId])

  const { setObservedNode: setPrefetchObservedNode } = useIntersectionVisibilityMap<string>({
    ids: fileIds,
    root: diffScrollRoot,
    rootMargin: PATCH_PREFETCH_ROOT_MARGIN,
    threshold: [0],
    onBecomeVisible: handlePrefetchVisible,
  })

  const syncDetailOffsets = useCallback(() => {
    const nextOffset = wide
      ? DIFF_SCROLL_PADDING
      : (() => {
          const strip = tabsRootRef.current?.querySelector<HTMLElement>('.tabs-strip')
          const stripHeight = strip ? Math.ceil(strip.getBoundingClientRect().height) : 0
          return stripHeight > 0 ? stripHeight + DIFF_SCROLL_PADDING : DIFF_SCROLL_PADDING
        })()

    setDiffScrollOffset((currentOffset) =>
      currentOffset === nextOffset ? currentOffset : nextOffset
    )
  }, [wide])

  useEffect(() => {
    syncDetailOffsets()

    if (wide) return
    if (typeof ResizeObserver === 'undefined') return

    const strip = tabsRootRef.current?.querySelector<HTMLElement>('.tabs-strip')
    if (!strip) return

    const observer = new ResizeObserver(() => {
      syncDetailOffsets()
    })

    const handleWindowResize = () => {
      syncDetailOffsets()
    }

    observer.observe(strip)
    window.addEventListener('resize', handleWindowResize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [syncDetailOffsets, wide])

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
      requestPatch(fileId)
      queueScrollToFile(fileId)
      if (!wide) {
        setSelectedTab('diff')
      }
    },
    [queueScrollToFile, requestPatch, setSelectedTab, wide]
  )

  const registerCardNode = useCallback(
    (fileId: string, node: HTMLElement | null) => {
      setVisibleObservedNode(fileId, node)
      setPrefetchObservedNode(fileId, node)

      if (!node) {
        cardNodesRef.current.delete(fileId)
        return
      }

      cardNodesRef.current.set(fileId, node)
      setDiffScrollRoot(
        (currentRoot) =>
          currentRoot ?? findVerticalScrollContainer(node, { allowNonScrollable: true })
      )
    },
    [setPrefetchObservedNode, setVisibleObservedNode]
  )

  useEffect(() => {
    if (!diffScrollRoot) {
      return
    }

    const handleScroll = () => {
      if (revealNavigationSourceRef.current !== 'tree') {
        revealNavigationSourceRef.current = 'diff'
      }
    }

    diffScrollRoot.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      diffScrollRoot.removeEventListener('scroll', handleScroll)
    }
  }, [diffScrollRoot])

  useEffect(() => {
    if (diffScrollRoot || cardNodesRef.current.size === 0) {
      return
    }

    const resolveRoot = () => {
      const nextRoot = detectDiffScrollRoot(cardNodesRef.current.values())
      if (nextRoot) {
        setDiffScrollRoot(nextRoot)
      }
    }

    resolveRoot()
    const frame = window.requestAnimationFrame(resolveRoot)

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [diffScrollRoot, patchLayoutVersion])

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

  const wideTreeContent =
    isLoading && files.length === 0 ? (
      <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
        Loading changed files…
      </div>
    ) : (
      <div
        ref={setWideTreeViewportNode}
        data-testid="git-file-tree-viewport"
        className="min-h-0 shrink-0 pb-1"
        style={wideTreeHeight != null ? { height: `${wideTreeHeight}px` } : undefined}
      >
        <ErrorBoundary
          fallback={<GitFileTreeFallback files={treeFiles} onSelectFile={handleSelectFile} />}
        >
          <GitFileTree
            files={treeFiles}
            projectDir={projectDir}
            visibilityRatioByFileId={treeVisibilityRatioByFileId}
            onSelectFile={handleSelectFile}
            revealRequest={treeRevealRequest}
            className="h-full min-h-0"
            onUserScrollIntent={markTreeNavigation}
          />
        </ErrorBoundary>
      </div>
    )

  const narrowTreeContent =
    isLoading && files.length === 0 ? (
      <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
        Loading changed files…
      </div>
    ) : (
      <div className="py-3" style={{ marginBlock: `${FILE_TREE_NARROW_MARGIN_BLOCK}px` }}>
        <ErrorBoundary
          fallback={<GitFileTreeFallback files={treeFiles} onSelectFile={handleSelectFile} />}
        >
          <GitFileTree
            files={treeFiles}
            projectDir={projectDir}
            visibilityRatioByFileId={treeVisibilityRatioByFileId}
            onSelectFile={handleSelectFile}
            revealRequest={treeRevealRequest}
            onUserScrollIntent={markTreeNavigation}
          />
        </ErrorBoundary>
      </div>
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
          <section className="sticky top-0 flex min-h-0 self-start">
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ListTree className="h-4 w-4 shrink-0" />
                <span>File Tree</span>
              </div>
              {wideTreeContent}
            </div>
          </section>
          <section
            className="min-w-0 space-y-2"
            onKeyDownCapture={(event) => {
              if (isScrollIntentEventKey(event)) {
                markDiffNavigation()
              }
            }}
            onPointerDownCapture={markDiffNavigation}
            onTouchMoveCapture={markDiffNavigation}
            onWheelCapture={markDiffNavigation}
          >
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
            ref={tabsRef}
            variant="default"
            selectedTab={activePane}
            onTabChange={onTabChange}
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
                content: narrowTreeContent,
              },
            ]}
          />
        </div>
      )}
    </div>
  )
}
