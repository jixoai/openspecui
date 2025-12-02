import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MarkdownContent } from './markdown-content'
import { generateTimelineScope, Toc, type TocItem } from './toc'
import { slugify, TocCollector, TocLevelProvider, TocProvider, useTocContext } from './toc-context'

// ============================================================================
// Types
// ============================================================================

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

interface HeadingProps {
  id?: string
  children?: ReactNode
  className?: string
}

type HeadingComponent = (props: HeadingProps) => ReactNode

interface SectionProps {
  children?: ReactNode
  className?: string
}

type SectionComponent = (props: SectionProps) => ReactNode

export interface BuilderComponents {
  H1: HeadingComponent
  H2: HeadingComponent
  H3: HeadingComponent
  H4: HeadingComponent
  H5: HeadingComponent
  H6: HeadingComponent
  /** Section 会自动将内部内容的 ToC 层级 +1 */
  Section: SectionComponent
}

export type MarkdownBuilderFn = (components: BuilderComponents) => ReactNode

export interface MarkdownViewerProps {
  /** Markdown 内容：字符串或 Builder 函数 */
  markdown: string | MarkdownBuilderFn
  className?: string
  /** 渲染和 ToC 建立完成后回调（用于外层占位控制） */
  onReady?: () => void
}

// ============================================================================
// MarkdownViewer - 主组件
// ============================================================================

/**
 * 统一的 Markdown 文档查看器，支持 ToC 侧边栏和嵌套。
 *
 * 两种使用模式：
 * 1. 字符串模式：`<MarkdownViewer markdown="# Hello" />`
 * 2. Builder 模式：`<MarkdownViewer markdown={({ H1, Section }) => <H1>Hello</H1>} />`
 *
 * 嵌套时自动检测父级 Context，只渲染内容不显示 ToC sidebar。
 */
export function MarkdownViewer({ markdown, className = '', onReady }: MarkdownViewerProps) {
  const parentCtx = useTocContext()
  const isNested = !!parentCtx

  if (isNested) {
    // 嵌套模式：只渲染内容，向父级贡献 ToC items
    return <NestedMarkdownViewer markdown={markdown} className={className} />
  }

  // 顶层模式：渲染完整布局（content + ToC sidebar）
  return <RootMarkdownViewer markdown={markdown} className={className} onReady={onReady} />
}

// ============================================================================
// RootMarkdownViewer - 顶层模式
// ============================================================================

function RootMarkdownViewer({ markdown, className, onReady }: MarkdownViewerProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const collectorRef = useRef<TocCollector>(null!)
  const readyCalledRef = useRef(false)

  // 每次渲染前重置 collector
  collectorRef.current = new TocCollector()
  const collector = collectorRef.current

  // 渲染后（首帧前）同步更新 tocItems，避免移动端 ToC 迟到导致的布局抖动
  useLayoutEffect(() => {
    const newItems = collectorRef.current.getItems()
    setTocItems((prev) => {
      if (arraysEqual(prev, newItems)) return prev
      return newItems
    })
  })

  // 通知外层：内容与 ToC 已经挂载（首个 effect 后触发一次）
  useEffect(() => {
    if (readyCalledRef.current) return
    readyCalledRef.current = true
    onReady?.()
  }, [onReady, tocItems])

  const timelineScope = useMemo(() => generateTimelineScope(tocItems), [tocItems])

  // 渲染内容（在 TocProvider 内部，这样嵌套的 MarkdownViewer 能获取 Context）
  const content =
    typeof markdown === 'string' ? (
      <StringMarkdownContent markdown={markdown} collector={collector} levelOffset={0} />
    ) : (
      <BuilderMarkdownContent builder={markdown} collector={collector} levelOffset={0} />
    )

  return (
    <TocProvider collector={collector} levelOffset={0} isRoot>
      <div className={`@container-[size] h-full ${className}`}>
        <style>{viewerStyles}</style>
        <MarkdownContainer className="viewer-layout gap-6" timelineScope={timelineScope}>
          <Toc items={tocItems} className="viewer-toc" />
          <div className="viewer-content min-w-0">{content}</div>
        </MarkdownContainer>
      </div>
    </TocProvider>
  )
}

// ============================================================================
// NestedMarkdownViewer - 嵌套模式
// ============================================================================

function NestedMarkdownViewer({ markdown, className }: MarkdownViewerProps) {
  const ctx = useTocContext()!
  const { collector, levelOffset } = ctx

  // 嵌套模式：使用父级的 collector，但应用当前的 levelOffset
  return typeof markdown === 'string' ? (
    <StringMarkdownContent
      markdown={markdown}
      className={className}
      collector={collector}
      levelOffset={levelOffset}
    />
  ) : (
    <BuilderMarkdownContent
      builder={markdown}
      className={className}
      collector={collector}
      levelOffset={levelOffset}
    />
  )
}

// ============================================================================
// StringMarkdownContent - 字符串模式内容
// ============================================================================

function StringMarkdownContent({
  markdown,
  collector,
  levelOffset,
  className,
}: {
  markdown: string
  collector: TocCollector
  levelOffset: number
  className?: string
}) {
  // 为 markdown 中的标题创建自定义组件
  const components = useMemo(() => {
    const slugCount = new Map<string, number>()

    const createHeading = (level: HeadingLevel) => {
      return function Heading({ children }: { children?: ReactNode }) {
        const text = extractTextFromChildren(children)
        const baseSlug = slugify(text) || 'heading'

        // 处理重复 id
        const count = slugCount.get(baseSlug) ?? 0
        slugCount.set(baseSlug, count + 1)
        const id = count > 0 ? `${baseSlug}-${count + 1}` : baseSlug

        // 应用层级偏移
        const adjustedLevel = Math.min(level + levelOffset, 6) as HeadingLevel
        const { index } = collector.add(text, adjustedLevel, id)

        return (
          <HeadingElement level={adjustedLevel} id={id} index={index}>
            {children}
          </HeadingElement>
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
  }, [collector, levelOffset])

  return (
    <MarkdownContent className={className} components={components}>
      {markdown}
    </MarkdownContent>
  )
}

// ============================================================================
// BuilderMarkdownContent - Builder 模式内容
// ============================================================================

function BuilderMarkdownContent({
  builder,
  collector,
  levelOffset,
  className,
}: {
  builder: MarkdownBuilderFn
  collector: TocCollector
  levelOffset: number
  className?: string
}) {
  // 创建 Builder 组件
  const components = useMemo<BuilderComponents>(() => {
    const slugCount = new Map<string, number>()

    const createHeading = (level: HeadingLevel): HeadingComponent => {
      return function Heading({ id: fixedId, className, children }: HeadingProps) {
        // 从 context 实时获取 levelOffset，支持 Section 嵌套
        const ctx = useTocContext()
        const currentLevelOffset = ctx?.levelOffset ?? levelOffset

        const text = extractTextFromChildren(children)
        const baseSlug = fixedId ?? (slugify(text) || 'heading')

        // 处理重复 id
        const count = slugCount.get(baseSlug) ?? 0
        slugCount.set(baseSlug, count + 1)
        const id = count > 0 ? `${baseSlug}-${count + 1}` : baseSlug

        // 应用层级偏移
        const adjustedLevel = Math.min(level + currentLevelOffset, 6) as HeadingLevel
        const { index } = collector.add(text, adjustedLevel, id)

        return (
          <HeadingElement level={adjustedLevel} id={id} index={index} className={className}>
            {children}
          </HeadingElement>
        )
      }
    }

    const Section: SectionComponent = ({ children, className }) => {
      // Section 通过 TocLevelProvider 提供层级 +1
      return (
        <TocLevelProvider additionalOffset={1}>
          <section className={`markdown-section ${className}`}>{children}</section>
        </TocLevelProvider>
      )
    }

    return {
      H1: createHeading(1),
      H2: createHeading(2),
      H3: createHeading(3),
      H4: createHeading(4),
      H5: createHeading(5),
      H6: createHeading(6),
      Section,
    }
  }, [collector, levelOffset])

  return <div className={`markdown-content ${className}`}>{builder(components)}</div>
}

// ============================================================================
// Helper Components
// ============================================================================

function HeadingElement({
  level,
  id,
  index,
  children,
  className,
}: {
  level: HeadingLevel
  id: string
  index: number
  children?: ReactNode
  className?: string
}) {
  const style = { viewTimelineName: `--toc-${index}` }
  switch (level) {
    case 1:
      return (
        <h1 id={id} className={className} style={style}>
          {children}
        </h1>
      )
    case 2:
      return (
        <h2 id={id} className={className} style={style}>
          {children}
        </h2>
      )
    case 3:
      return (
        <h3 id={id} className={className} style={style}>
          {children}
        </h3>
      )
    case 4:
      return (
        <h4 id={id} className={className} style={style}>
          {children}
        </h4>
      )
    case 5:
      return (
        <h5 id={id} className={className} style={style}>
          {children}
        </h5>
      )
    case 6:
      return (
        <h6 id={id} className={className} style={style}>
          {children}
        </h6>
      )
  }
}

// ============================================================================
// MarkdownContainer - 布局容器
// ============================================================================

interface MarkdownContainerProps {
  children: ReactNode
  className?: string
  /** CSS timeline-scope value for ToC scroll tracking */
  timelineScope?: string
}

/**
 * Shared container for markdown-style content with consistent scrolling and padding.
 */
function MarkdownContainer({ children, className = '', timelineScope }: MarkdownContainerProps) {
  return (
    <div
      className={`scrollbar-thin scrollbar-track-transparent h-full overflow-auto scroll-smooth p-4 ${className}`}
      style={timelineScope ? ({ timelineScope } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}

// ============================================================================
// Utilities
// ============================================================================

/** 从 React children 中提取纯文本 */
function extractTextFromChildren(children: ReactNode): string {
  if (children == null || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('')
  if (typeof children === 'object' && 'props' in children) {
    return extractTextFromChildren(
      (children as { props?: { children?: ReactNode } }).props?.children
    )
  }
  return ''
}

/** 比较两个 TocItem 数组是否相等 */
function arraysEqual(a: TocItem[], b: TocItem[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (item, i) => item.id === b[i].id && item.label === b[i].label && item.level === b[i].level
  )
}

// ============================================================================
// Styles
// ============================================================================

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
