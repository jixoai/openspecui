import { ChevronDown, List } from 'lucide-react'
import { useCallback, useState } from 'react'

export interface TocItem {
  id: string
  label: string
  level?: number // 1 = h1, 2 = h2, etc. Default 1
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
 * Usage:
 * 1. Pass tocItems to MarkdownViewer for timeline-scope binding
 * 2. Use TocSection for each section to bind viewTimelineName
 * 3. The ToC links will automatically highlight based on scroll position
 */
export function Toc({ items, defaultCollapsed = true, className = '' }: TocProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

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
        {!collapsed && (
          <div className="scrollbar-thin scrollbar-track-transparent max-h-[300px] overflow-y-auto p-2">
            <TocLinks items={items} />
          </div>
        )}
      </div>

      {/* Wide: always visible */}
      <nav className="toc-wide flex flex-col">
        <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wide">
          <List className="h-3.5 w-3.5" />
          <span>On this page</span>
        </div>
        <div className="scrollbar-thin scrollbar-track-transparent min-h-0 flex-1 overflow-y-auto p-2">
          <TocLinks items={items} />
        </div>
      </nav>
    </aside>
  )
}
/**
 * Find the nearest scrollable ancestor element.
 */
function findScrollableParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    const { overflowY } = getComputedStyle(parent)
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
    parent = parent.parentElement
  }
  return null
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

function TocLinks({ items }: { items: TocItem[] }) {
  const handleAnimationStart = useCallback((e: React.AnimationEvent<HTMLAnchorElement>) => {
    if (e.animationName === 'toc-activate') {
      scrollIntoViewWithinContainer(e.currentTarget)
    }
  }, [])

  return (
    <>
      {items.map((item, index) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="toc-link text-muted-foreground hover:text-foreground block overflow-hidden text-ellipsis whitespace-nowrap border-l-2 border-transparent px-3 py-1 text-[13px]"
          style={
            {
              '--target': `--toc-${index}`,
              paddingLeft: item.level === 2 ? '1rem' : item.level === 3 ? '1.25rem' : '0.75rem',
              fontSize: (item.level || 1) > 1 ? '12px' : '13px',
            } as React.CSSProperties
          }
          title={item.label}
          onAnimationStart={handleAnimationStart}
        >
          {item.label}
        </a>
      ))}
    </>
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
 * Section component that automatically binds to ToC scroll tracking.
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
