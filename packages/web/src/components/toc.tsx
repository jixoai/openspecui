import { ChevronDown, List } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

export interface TocItem {
  id: string
  label: string
  level?: number // 1 = h1, 2 = h2, etc. Default 1
}

/** 树形结构节点，用于嵌套渲染 */
export interface TocNode {
  item: TocItem
  /** 原始 index，用于 CSS timeline binding */
  index: number
  children: TocNode[]
}

/**
 * 将扁平的 TocItem[] 根据 level 构建为树形结构。
 * level 更大的项成为前一个 level 更小项的子节点。
 */
export function buildTocTree(items: TocItem[]): TocNode[] {
  const roots: TocNode[] = []
  const stack: TocNode[] = []

  items.forEach((item, index) => {
    const node: TocNode = { item, index, children: [] }
    const level = item.level ?? 1

    // 找到合适的父节点：level 必须比当前小
    while (stack.length > 0) {
      const parent = stack[stack.length - 1]
      const parentLevel = parent.item.level ?? 1
      if (parentLevel < level) {
        // 找到父节点
        parent.children.push(node)
        stack.push(node)
        return
      }
      // 父节点 level >= 当前 level，弹出继续找
      stack.pop()
    }

    // 没有合适的父节点，作为根节点
    roots.push(node)
    stack.push(node)
  })

  return roots
}

interface TocProps {
  items: TocItem[]
  /** Default collapsed state on mobile */
  defaultCollapsed?: boolean
  className?: string
}

/**
 * Table of Contents component with CSS view-timeline scroll highlighting.
 * Uses container queries for responsive layout.
 *
 * 支持树形嵌套结构：根据 TocItem.level 自动构建父子关系，
 * 渲染为语义化的 `<ul><li>` 嵌套结构。
 *
 * Usage:
 * 1. Pass tocItems to MarkdownViewer for timeline-scope binding
 * 2. Use TocSection for each section to bind viewTimelineName
 * 3. The ToC links will automatically highlight based on scroll position
 */
export function Toc({ items, defaultCollapsed = true, className = '' }: TocProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const tree = useMemo(() => buildTocTree(items), [items])

  // Return hidden placeholder when empty to keep React children stable
  if (items.length === 0) {
    return <aside className={`hidden ${className}`} />
  }

  return (
    <aside
      className={`toc-root scrollbar-none sticky top-0 z-10 max-h-[calc(100cqh-3rem)] self-start overflow-y-auto ${className}`}
    >
      <style>{tocStyles}</style>

      {/* Narrow: collapsible */}
      <div className="toc-narrow border-border bg-background overflow-hidden rounded border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`text-foreground flex w-full items-center gap-2 px-3 py-2 ${collapsed ? '' : 'border-border border-b'}`}
          aria-label={collapsed ? 'Show table of contents' : 'Hide table of contents'}
        >
          <List className="h-4 w-4" />
          <span className="text-sm">Contents</span>
          <ChevronDown
            className={`ml-auto h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>
        {!collapsed && <TocTree nodes={tree} />}
      </div>

      {/* Wide: always visible */}
      <nav className="toc-wide flex flex-col">
        <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wide">
          <List className="h-3.5 w-3.5" />
          <span>On this page</span>
        </div>
        <div className="scrollbar-thin scrollbar-track-transparent min-h-0 flex-1 overflow-y-auto p-2">
          <TocTree nodes={tree} />
        </div>
      </nav>
    </aside>
  )
}
/**
 * Find the nearest scrollable ancestor element.
 */
function findScrollableParent(element: HTMLElement): HTMLElement | null {
  return element.closest('.toc-root') as HTMLElement
}

/**
 * Scroll element into view within its scrollable container using scrollTo.
 * NOTE: Cannot use scrollIntoView here because it triggers scroll on all ancestor
 * scrollable containers, which interferes with the main content's smooth scrolling
 * when user clicks a ToC link.
 */
function scrollIntoViewWithinContainer(element: HTMLElement) {
  const container = findScrollableParent(element)
  if (!container) return

  // Use getBoundingClientRect to get positions relative to viewport,
  // then calculate the relative position within container
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  // Element's position relative to container's visible area
  const relativeTop = elementRect.top - containerRect.top
  const relativeBottom = elementRect.bottom - containerRect.top

  // Check if element is outside visible area
  if (relativeTop < 0) {
    // Element is above visible area
    container.scrollTo({ top: container.scrollTop + relativeTop, behavior: 'smooth' })
  } else if (relativeBottom > containerRect.height) {
    // Element is below visible area
    container.scrollTo({
      top: container.scrollTop + relativeBottom - containerRect.height,
      behavior: 'smooth',
    })
  }
}

/** 递归渲染树形 ToC 结构 */
function TocTree({ nodes, depth = 0 }: { nodes: TocNode[]; depth?: number }) {
  const handleAnimationStart = useCallback((e: React.AnimationEvent<HTMLAnchorElement>) => {
    if (e.animationName === 'toc-activate') {
      scrollIntoViewWithinContainer(e.currentTarget)
    }
  }, [])

  if (nodes.length === 0) return null

  return (
    <ul className="toc-list">
      {nodes.map((node) => (
        <li key={node.item.id} className="toc-item">
          <a
            href={`#${node.item.id}`}
            className={`toc-link text-muted-foreground hover:text-foreground block overflow-hidden text-ellipsis whitespace-nowrap border-l-2 border-transparent py-1 pr-3 ${
              depth === 0
                ? 'text-[13px]'
                : depth === 1
                  ? 'text-[12px]'
                  : depth === 2
                    ? 'text-[11px]'
                    : 'text-[10px]'
            }`}
            style={
              {
                '--target': `--toc-${node.index}`,
                paddingLeft: `${0.75 + depth * 0.5}rem`,
              } as React.CSSProperties
            }
            title={node.item.label}
            onAnimationStart={handleAnimationStart}
          >
            {node.item.label}
          </a>
          {node.children.length > 0 && <TocTree nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}

const css = String.raw
/** CSS for container queries and scroll-driven ToC highlighting */
const tocStyles = css`
  /* Default: narrow mode (collapsible) */
  .toc-narrow {
    display: block;
  }
  .toc-wide {
    display: none;
  }

  /* Wide container: show sidebar mode */
  @container (min-width: 768px) {
    .toc-narrow {
      display: none;
    }
    .toc-wide {
      display: block;
    }
  }

  /* Tree structure styling */
  .toc-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* Scroll-driven ToC highlighting animation */
  @keyframes toc-activate {
    0%,
    100% {
      color: var(--muted-foreground);
      border-left-color: transparent;
    }
    1%,
    99% {
      color: var(--foreground);
      border-left-color: var(--primary);
    }
  }
  .toc-link {
    animation-timeline: var(--target);
    animation-name: toc-activate;
    animation-fill-mode: both;
    animation-range: cover 0% cover 100%;
  }
`

/**
 * Generate the timeline-scope CSS value for the container.
 * This should be applied to the common ancestor of both ToC and content.
 */
export function generateTimelineScope(items: TocItem[]): string {
  return items.map((_, i) => `--toc-${i}`).join(', ')
}

/**
 * 为 MarkdownViewer 外部的内容提供 ToC 滚动追踪绑定。
 *
 * 使用场景：当内容不在 MarkdownViewer 内部时（如独立的 TasksView 组件），
 * 无法使用 Section + Heading 组件自动集成 ToC，需要手动使用 TocSection
 * 绑定 viewTimelineName 以实现滚动高亮。
 *
 * 如果内容在 MarkdownViewer 内部，应优先使用 Section + H1-H6 组件，
 * 它们会自动处理 ToC 注册和 viewTimelineName 绑定。
 */
interface TocSectionProps {
  /** DOM id for anchor links */
  id: string
  /** Index in the ToC items array for CSS timeline binding */
  index: number
  children: React.ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
}

export function TocSection({
  id,
  index,
  children,
  className = '',
  as: Tag = 'section',
}: TocSectionProps) {
  return (
    <Tag
      id={id}
      className={className}
      style={{ viewTimelineName: `--toc-${index}` } as React.CSSProperties}
    >
      {children}
    </Tag>
  )
}
