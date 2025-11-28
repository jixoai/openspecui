import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MarkdownContent } from './markdown-content'
import { generateTimelineScope, Toc, type TocItem } from './toc'

interface MarkdownViewerProps {
  /** Markdown text to render (auto-generates ToC from headings) */
  markdown?: string
  /** Custom content (use with toc prop for custom ToC) */
  children?: ReactNode
  /** Custom ToC element (if not provided, auto-generates from markdown headings) */
  toc?: ReactNode
  /** ToC items for timeline-scope binding (required when using custom toc) */
  tocItems?: TocItem[]
  className?: string
}

/**
 * Unified viewer with ToC sidebar.
 * Supports two modes:
 * 1. Markdown mode: pass `markdown` string, ToC auto-generated from headings
 * 2. Custom mode: pass `children` + `toc` + `tocItems` for custom content with custom ToC
 */
export function MarkdownViewer({
  markdown,
  children,
  toc,
  tocItems: externalTocItems,
  className = '',
}: MarkdownViewerProps) {
  const [autoTocItems, setAutoTocItems] = useState<TocItem[]>([])

  // Collect ToC items during render from actual heading components
  const tocItemsRef = useRef<TocItem[]>([])
  const headingIndexRef = useRef(0)

  // Reset refs before each render
  tocItemsRef.current = []
  headingIndexRef.current = 0

  // Create heading components with ToC integration (only used in markdown mode)
  const headingComponents = useMemo(() => {
    const createHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      return function Heading({ children: content }: { children?: ReactNode }) {
        const index = headingIndexRef.current++
        const label = String(content)
        // Generate slug from heading text for anchor links
        const slug = label
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
          .replace(/^-|-$/g, '')
        const id = slug || `heading-${index}`

        // Collect ToC item during render
        tocItemsRef.current.push({ id, label, level })

        return (
          <Tag id={id} style={{ viewTimelineName: `--toc-${index}` }}>
            {content}
          </Tag>
        )
      }
    }

    return {
      h1: createHeading(1),
      h2: createHeading(2),
      h3: createHeading(3),
      h4: createHeading(4),
      h5: createHeading(5),
      h6: createHeading(6),
    }
  }, [])

  // Update ToC items after render - compare to avoid infinite loop
  // Using useLayoutEffect to sync before paint, with markdown as dependency
  // since ToC items only change when markdown content changes
  useEffect(() => {
    if (toc) return // Skip auto-generation when using custom toc

    const newItems = tocItemsRef.current
    if (newItems.length === 0) return

    // Only update if items changed (compare by id+label)
    const hasChanged =
      newItems.length !== autoTocItems.length ||
      newItems.some((item, i) => item.id !== autoTocItems[i]?.id || item.label !== autoTocItems[i]?.label)

    if (hasChanged) {
      setAutoTocItems([...newItems])
    }
  }, [markdown, toc, autoTocItems])

  // Determine which ToC items to use for timeline-scope
  const tocItems = externalTocItems ?? autoTocItems
  const timelineScope = useMemo(() => generateTimelineScope(tocItems), [tocItems])

  // Determine which ToC to render - always render Toc component to keep children stable
  const tocElement = toc ?? <Toc items={autoTocItems} className="viewer-toc" />

  // Determine content
  const content = markdown ? (
    <MarkdownContent className="viewer-content min-w-0" components={headingComponents}>
      {markdown}
    </MarkdownContent>
  ) : (
    <div className="viewer-content min-w-0">{children}</div>
  )

  return (
    <div className={`@container-[size] h-full ${className}`}>
      <style>{viewerStyles}</style>
      <MarkdownContainer className="viewer-layout gap-6" timelineScope={timelineScope}>
        {tocElement}
        {content}
      </MarkdownContainer>
    </div>
  )
}

interface MarkdownContainerProps {
  children: ReactNode
  className?: string
  /** CSS timeline-scope value for ToC scroll tracking */
  timelineScope?: string
}

/**
 * Shared container for markdown-style content with consistent scrolling and padding.
 */
export function MarkdownContainer({ children, className = '', timelineScope }: MarkdownContainerProps) {
  return (
    <div
      className={`scrollbar-thin scrollbar-track-transparent h-full overflow-auto scroll-smooth p-6 ${className}`}
      style={timelineScope ? ({ timelineScope } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}

const css = String.raw
/** CSS for container queries layout */
const viewerStyles = css`
  /* Container query based layout */
  .viewer-layout {
    display: block;
  }
  .viewer-toc {
    margin-bottom: 1rem;
  }

  /* Wide container: grid layout with ToC on right */
  @container (min-width: 768px) {
    .viewer-layout {
      display: grid;
      grid-template-columns: 1fr 180px;
    }
    .viewer-toc {
      order: 2;
      margin-bottom: 0;
    }
    .viewer-content {
      order: 1;
    }
  }
`
