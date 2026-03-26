import { cn } from '@/lib/utils'
import type { GitEntryFileSummary } from '@openspecui/core'
import { FileCode2, FolderClosed, FolderOpen } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

import { revealElementInContainer } from '../scroll-spy'
import { buildGitFileTreeModel, type GitFileTreeNode } from './git-file-tree-model'
import { useGitFileTreeNavigation } from './git-file-tree-navigation'
import {
  buildGitFileTreeVisibleModel,
  type GitFileTreeVisibleItem,
} from './git-file-tree-visible-items'
import { DiffStat } from './git-shared'

const TREE_CONNECTOR_COLUMN_WIDTH = 14
const TREE_BRANCH_END_INSET = 3.5
const EMPTY_VISIBILITY_RATIO_MAP = new Map<string, number>()

function changeTypeTone(changeType: GitEntryFileSummary['changeType']): string {
  switch (changeType) {
    case 'added':
      return 'text-emerald-700 dark:text-emerald-100'
    case 'deleted':
      return 'text-rose-700 dark:text-rose-100'
    case 'renamed':
    case 'copied':
      return 'text-sky-700 dark:text-sky-100'
    case 'modified':
      return 'text-amber-700 dark:text-amber-100'
    default:
      return 'text-zinc-700 dark:text-zinc-100'
  }
}

function renderFileLabel(file: GitEntryFileSummary, fallback: string): string {
  if (!file.previousPath) return fallback

  const previousName = file.previousPath.split('/').filter(Boolean).at(-1) ?? file.previousPath
  if (previousName === fallback) return fallback
  return `${previousName} -> ${fallback}`
}

function areSetsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) {
    return false
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false
    }
  }

  return true
}

function TreeConnector({ guideMask }: { guideMask: boolean[] }) {
  const connectorWidth = guideMask.length * TREE_CONNECTOR_COLUMN_WIDTH

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none shrink-0 self-stretch"
      style={{ width: `${connectorWidth}px` }}
    />
  )
}

interface TreeConnectorMetric {
  key: string
  top: number
  bottom: number
  midY: number
  level: number
  parentKey: string | null
  isLastSibling: boolean
  visibilityRatio: number
}

export interface GitFileTreeRevealRequest {
  fileId: string
  nonce: number
}

function buildEndElbowGeometry(options: {
  x: number
  parentMidY: number
  childMidY: number
  horizontalEndX: number
}) {
  const { x, parentMidY, childMidY, horizontalEndX } = options
  const elbowRadius = Math.min(
    3,
    Math.max(1.75, horizontalEndX - x - 1, Math.min(4, childMidY - parentMidY))
  )
  const startY = Math.max(parentMidY, childMidY - elbowRadius)
  const cornerX = Math.min(horizontalEndX, x + elbowRadius)

  return {
    startY,
    path: [
      `M${x} ${startY}`,
      `Q${x} ${childMidY} ${cornerX} ${childMidY}`,
      horizontalEndX > cornerX ? `H${horizontalEndX}` : '',
    ]
      .filter(Boolean)
      .join(''),
  }
}

function buildBranchPath(options: { x: number; midY: number; horizontalEndX: number }): string {
  const { x, midY, horizontalEndX } = options
  return `M${x} ${midY}H${horizontalEndX}`
}

function TreeConnectorOverlay({
  metrics,
  width,
  height,
}: {
  metrics: TreeConnectorMetric[]
  width: number
  height: number
}) {
  if (metrics.length === 0 || width <= 0 || height <= 0) {
    return null
  }

  const rowsByKey = new Map(metrics.map((metric) => [metric.key, metric]))
  const childrenByParentKey = new Map<string, TreeConnectorMetric[]>()

  for (const metric of metrics) {
    if (!metric.parentKey) continue

    const group = childrenByParentKey.get(metric.parentKey) ?? []
    group.push(metric)
    childrenByParentKey.set(metric.parentKey, group)
  }

  return (
    <svg
      aria-hidden="true"
      className="text-border/50 pointer-events-none absolute inset-0 block h-full w-full overflow-visible"
      style={{ height: `${height}px` }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {Array.from(childrenByParentKey.entries()).map(([parentKey, children]) => {
        const parentMetric = rowsByKey.get(parentKey)
        if (!parentMetric || children.length === 0) {
          return null
        }

        const firstChild = children[0]
        const lastChild = children.at(-1)
        if (!firstChild || !lastChild) {
          return null
        }

        const x =
          (firstChild.level - 2) * TREE_CONNECTOR_COLUMN_WIDTH +
          TREE_CONNECTOR_COLUMN_WIDTH / 2 +
          0.5
        const horizontalEndX =
          (firstChild.level - 1) * TREE_CONNECTOR_COLUMN_WIDTH - TREE_BRANCH_END_INSET
        const endElbow = buildEndElbowGeometry({
          x,
          parentMidY: parentMetric.midY,
          childMidY: lastChild.midY,
          horizontalEndX,
        })

        return (
          <g key={`group-${parentKey}`}>
            {endElbow.startY > parentMetric.midY ? (
              <path
                d={`M${x} ${parentMetric.midY}V${endElbow.startY}`}
                opacity={0.34}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            {children.slice(0, -1).map((child) => (
              <path
                key={`branch-${child.key}`}
                d={buildBranchPath({
                  x,
                  midY: child.midY,
                  horizontalEndX,
                })}
                opacity={0.22 + child.visibilityRatio * 0.34}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <path
              d={endElbow.path}
              opacity={0.3 + lastChild.visibilityRatio * 0.32}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
    </svg>
  )
}

function GitFileTreeItem({
  item,
  focused,
  onItemClick,
  onItemFocus,
  onItemKeyDown,
  registerItemRef,
  registerOverlayItemRef,
}: {
  item: GitFileTreeVisibleItem
  focused: boolean
  onItemClick: (key: string) => void
  onItemFocus: (key: string) => void
  onItemKeyDown: (event: ReactKeyboardEvent<HTMLElement>, key: string) => void
  registerItemRef: (key: string) => (node: HTMLElement | null) => void
  registerOverlayItemRef: (key: string) => (node: HTMLElement | null) => void
}) {
  const label =
    item.kind === 'directory' ? item.node.name : renderFileLabel(item.node.file, item.node.name)
  const connectorWidth = item.guideMask.length * TREE_CONNECTOR_COLUMN_WIDTH
  const visibilityRatio = item.visibilityRatio
  const highlightOpacity = visibilityRatio <= 0 ? 0 : Math.min(0.88, 0.22 + visibilityRatio * 0.66)

  return (
    <div
      id={`git-file-tree-item-${encodeURIComponent(item.key)}`}
      data-file-id={item.kind === 'file' ? item.node.file.fileId : undefined}
      data-visibility-ratio={visibilityRatio.toFixed(3)}
      ref={(node) => {
        registerItemRef(item.key)(node)
        registerOverlayItemRef(item.key)(node)
      }}
      role="treeitem"
      tabIndex={focused ? 0 : -1}
      aria-label={item.kind === 'directory' ? item.node.name : item.node.file.displayPath}
      aria-level={item.level}
      aria-setsize={item.setSize}
      aria-posinset={item.posInSet}
      aria-expanded={item.kind === 'directory' ? item.expanded : undefined}
      onClick={() => onItemClick(item.key)}
      onFocus={() => onItemFocus(item.key)}
      onKeyDown={(event) => onItemKeyDown(event, item.key)}
      className={cn(
        'relative grid min-w-0 cursor-default grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-1.5 rounded-md py-0.5 text-left outline-none transition-colors',
        'focus-visible:ring-ring/60 focus-visible:ring-2',
        item.kind === 'directory'
          ? 'text-foreground hover:bg-muted/35'
          : 'text-foreground/90 hover:bg-muted/35'
      )}
      title={item.kind === 'directory' ? item.node.name : item.node.file.displayPath}
    >
      {highlightOpacity > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 rounded-md',
            item.kind === 'directory'
              ? 'bg-primary/10 ring-primary/10 ring-1'
              : 'bg-primary/16 ring-primary/15 ring-1'
          )}
          style={{
            left: `${Math.max(0, connectorWidth - 1)}px`,
            right: 0,
            opacity: highlightOpacity,
          }}
        />
      ) : null}

      <TreeConnector guideMask={item.guideMask} />

      {item.kind === 'directory' ? (
        <div
          className={cn(
            'relative z-10 flex min-w-0 items-start gap-1.5 text-[11px] font-medium transition-colors',
            visibilityRatio > 0 ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {item.expanded ? (
            <FolderOpen
              className="mt-0.5 h-3.5 w-3.5 shrink-0 transition-opacity"
              style={{ opacity: Math.min(1, 0.65 + visibilityRatio * 0.35) }}
            />
          ) : (
            <FolderClosed
              className="mt-0.5 h-3.5 w-3.5 shrink-0 transition-opacity"
              style={{ opacity: Math.min(1, 0.65 + visibilityRatio * 0.35) }}
            />
          )}
          <span className="min-w-0 leading-4 [overflow-wrap:anywhere]">{label}</span>
        </div>
      ) : (
        <div className="relative z-10 flex min-w-0 items-start gap-1.5">
          <FileCode2
            className={cn(
              'mt-0.5 h-3.5 w-3.5 shrink-0 transition-colors',
              visibilityRatio > 0 ? 'text-primary' : changeTypeTone(item.node.file.changeType)
            )}
            style={{ opacity: Math.min(1, 0.7 + visibilityRatio * 0.3) }}
          />
          <span
            className={cn(
              'min-w-0 text-[11px] leading-4 transition-colors [overflow-wrap:anywhere]',
              visibilityRatio > 0 ? 'text-foreground font-medium' : ''
            )}
          >
            {label}
          </span>
        </div>
      )}

      <div
        className={cn(
          'relative z-10 flex min-h-4 shrink-0 items-center gap-1 transition-opacity',
          visibilityRatio > 0 ? 'text-foreground/80' : 'text-muted-foreground'
        )}
        style={{ opacity: Math.min(1, 0.68 + visibilityRatio * 0.32) }}
      >
        <DiffStat diff={item.node.diff} />
      </div>
    </div>
  )
}

function GitFileTreeNodes({
  nodes,
  itemsByKey,
  focusedKey,
  onItemClick,
  onItemFocus,
  onItemKeyDown,
  registerItemRef,
  registerOverlayItemRef,
}: {
  nodes: GitFileTreeNode[]
  itemsByKey: ReadonlyMap<string, GitFileTreeVisibleItem>
  focusedKey: string | null
  onItemClick: (key: string) => void
  onItemFocus: (key: string) => void
  onItemKeyDown: (event: ReactKeyboardEvent<HTMLElement>, key: string) => void
  registerItemRef: (key: string) => (node: HTMLElement | null) => void
  registerOverlayItemRef: (key: string) => (node: HTMLElement | null) => void
}) {
  return (
    <div>
      {nodes.map((node) => {
        const item = itemsByKey.get(node.key)
        if (!item) return null

        return (
          <div key={node.key}>
            <GitFileTreeItem
              item={item}
              focused={focusedKey === item.key}
              onItemClick={onItemClick}
              onItemFocus={onItemFocus}
              onItemKeyDown={onItemKeyDown}
              registerItemRef={registerItemRef}
              registerOverlayItemRef={registerOverlayItemRef}
            />

            {node.kind === 'directory' &&
            item.kind === 'directory' &&
            item.expanded &&
            node.children.length > 0 ? (
              <div role="group">
                <GitFileTreeNodes
                  nodes={node.children}
                  itemsByKey={itemsByKey}
                  focusedKey={focusedKey}
                  onItemClick={onItemClick}
                  onItemFocus={onItemFocus}
                  onItemKeyDown={onItemKeyDown}
                  registerItemRef={registerItemRef}
                  registerOverlayItemRef={registerOverlayItemRef}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function GitFileTree({
  files,
  projectDir,
  visibilityRatioByFileId = EMPTY_VISIBILITY_RATIO_MAP,
  onSelectFile,
  revealRequest = null,
  className,
}: {
  files: GitEntryFileSummary[]
  projectDir?: string | null
  visibilityRatioByFileId?: ReadonlyMap<string, number>
  onSelectFile: (fileId: string) => void
  revealRequest?: GitFileTreeRevealRequest | null
  className?: string
}) {
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())
  const treeRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const treeContentRef = useRef<HTMLDivElement | null>(null)
  const overlayItemNodesRef = useRef<Map<string, HTMLElement>>(new Map())
  const lastHandledRevealNonceRef = useRef<number | null>(null)
  const [connectorMetrics, setConnectorMetrics] = useState<TreeConnectorMetric[]>([])
  const [connectorWidth, setConnectorWidth] = useState(0)
  const [connectorHeight, setConnectorHeight] = useState(0)
  const tree = useMemo(() => buildGitFileTreeModel(files, { projectDir }), [files, projectDir])

  const toggleDirectory = useCallback((key: string) => {
    setCollapsedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])
  const visibleModel = useMemo(
    () => buildGitFileTreeVisibleModel(tree, collapsedKeys, visibilityRatioByFileId),
    [collapsedKeys, tree, visibilityRatioByFileId]
  )

  useEffect(() => {
    setCollapsedKeys((current) => {
      const next = new Set([...current].filter((key) => visibleModel.directoryKeys.has(key)))
      if (areSetsEqual(current, next)) {
        return current
      }
      return next
    })
  }, [visibleModel.directoryKeys])

  const { focusedKey, handleItemClick, handleItemFocus, handleItemKeyDown, registerItemRef } =
    useGitFileTreeNavigation({
      items: visibleModel.items,
      itemsByKey: visibleModel.itemsByKey,
      parentByKey: visibleModel.parentByKey,
      treeRef,
      onToggleDirectory: toggleDirectory,
      onSelectFile,
    })

  const registerOverlayItemRef = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (!node) {
        overlayItemNodesRef.current.delete(key)
        return
      }

      overlayItemNodesRef.current.set(key, node)
    },
    []
  )

  useEffect(() => {
    if (!revealRequest) {
      return
    }

    if (lastHandledRevealNonceRef.current === revealRequest.nonce) {
      return
    }

    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) {
      return
    }

    let itemKey = visibleModel.keyByFileId.get(revealRequest.fileId) ?? null
    while (itemKey && !visibleModel.itemsByKey.has(itemKey)) {
      itemKey = visibleModel.parentByKey.get(itemKey) ?? null
    }

    if (!itemKey) {
      return
    }

    const itemNode = overlayItemNodesRef.current.get(itemKey)
    if (!itemNode) {
      return
    }

    revealElementInContainer({
      container: scrollContainer,
      element: itemNode,
      behavior: 'auto',
      margin: 12,
    })
    lastHandledRevealNonceRef.current = revealRequest.nonce
  }, [revealRequest, visibleModel.itemsByKey, visibleModel.keyByFileId, visibleModel.parentByKey])

  useLayoutEffect(() => {
    const contentNode = treeContentRef.current
    if (!contentNode) {
      setConnectorMetrics([])
      setConnectorHeight(0)
      return
    }

    const updateOverlay = () => {
      const contentRect = contentNode.getBoundingClientRect()
      const nextMetrics = visibleModel.items.flatMap<TreeConnectorMetric>((item) => {
        if (item.guideMask.length === 0) {
          return []
        }

        const node = overlayItemNodesRef.current.get(item.key)
        if (!node) {
          return []
        }

        const rowRect = node.getBoundingClientRect()
        const top = rowRect.top - contentRect.top
        const bottom = rowRect.bottom - contentRect.top

        return [
          {
            key: item.key,
            top,
            bottom,
            midY: top + rowRect.height / 2,
            level: item.level,
            parentKey: item.parentKey,
            isLastSibling: item.isLastSibling,
            visibilityRatio: item.visibilityRatio,
          },
        ]
      })

      setConnectorMetrics(nextMetrics)
      setConnectorWidth(contentNode.clientWidth)
      setConnectorHeight(contentNode.scrollHeight)
    }

    updateOverlay()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      updateOverlay()
    })

    observer.observe(contentNode)
    return () => {
      observer.disconnect()
    }
  }, [visibleModel.items])

  if (files.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
        No changed files found for this entry.
      </div>
    )
  }

  return (
    <div
      ref={treeRef}
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-md border border-zinc-500/15 bg-zinc-500/5',
        className
      )}
    >
      <div
        ref={scrollContainerRef}
        role="tree"
        aria-label="Changed files"
        className="scrollbar-thin scrollbar-track-transparent min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
      >
        <div ref={treeContentRef} className="relative">
          <TreeConnectorOverlay
            metrics={connectorMetrics}
            width={connectorWidth}
            height={connectorHeight}
          />
          <GitFileTreeNodes
            nodes={tree}
            itemsByKey={visibleModel.itemsByKey}
            focusedKey={focusedKey}
            onItemClick={handleItemClick}
            onItemFocus={handleItemFocus}
            onItemKeyDown={handleItemKeyDown}
            registerItemRef={registerItemRef}
            registerOverlayItemRef={registerOverlayItemRef}
          />
        </div>
      </div>
    </div>
  )
}
