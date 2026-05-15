import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { navigateHashAnchor } from './anchor-scroll'
import {
  MarkdownContent,
  type MarkdownBlockAnnotation,
  type MarkdownInlineTextAnnotation,
} from './markdown-content'
import { generateTimelineScope, Toc, type TocItem } from './toc'
import { slugify, TocCollector, TocLevelProvider, TocProvider, useTocContext } from './toc-context'

// ============================================================================
// Types
// ============================================================================

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type HeadingDataAttributes = Partial<Record<`data-${string}`, string | number | boolean>>

export interface MarkdownHeadingTransformInput {
  /** Heading level from the markdown source before nested level offsets. */
  sourceLevel: HeadingLevel
  /** Final rendered heading level after nested offsets. */
  level: HeadingLevel
  /** Plain text extracted from the rendered heading children. */
  text: string
  /** Markdown source offset for this heading when the renderer exposes it. */
  sourceStartOffset?: number
  /** Markdown source end offset for this heading when the renderer exposes it. */
  sourceEndOffset?: number
}

export interface MarkdownHeadingTransformResult {
  /** Stable id seed passed into the ToC collector. Duplicate ids still receive suffixes. */
  id?: string
  /** Optional ToC label when navigation text should differ from the visible heading. */
  tocLabel?: string
  /** Optional content appended to the visible heading without changing ToC collection text. */
  suffix?: ReactNode
  className?: string
  dataAttributes?: HeadingDataAttributes
}

export type MarkdownHeadingTransform = (
  input: MarkdownHeadingTransformInput
) => MarkdownHeadingTransformResult | undefined

interface HeadingProps {
  id?: string
  children?: ReactNode
  className?: string
  tocLabel?: string
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
  /** 是否参与 ToC 收集（嵌套预览内容可关闭） */
  collectToc?: boolean
  /** Optional string-markdown heading transform for semantic attributes and ToC labels. */
  headingTransform?: MarkdownHeadingTransform
  /** Inline semantic text spans rendered by MarkdownContent. */
  inlineTextAnnotations?: readonly MarkdownInlineTextAnnotation[]
  /** Block-level semantic attributes rendered by MarkdownContent. */
  blockAnnotations?: readonly MarkdownBlockAnnotation[]
}

const SectionTimelineContext = createContext<number | null>(null)

function useSectionTimeline(): number | null {
  return useContext(SectionTimelineContext)
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
export function MarkdownViewer({
  markdown,
  className = '',
  onReady,
  collectToc = true,
  headingTransform,
  inlineTextAnnotations,
  blockAnnotations,
}: MarkdownViewerProps) {
  const parentCtx = useTocContext()
  const isNested = !!parentCtx

  if (!collectToc) {
    return (
      <PlainMarkdownViewer
        markdown={markdown}
        className={className}
        headingTransform={headingTransform}
        inlineTextAnnotations={inlineTextAnnotations}
        blockAnnotations={blockAnnotations}
      />
    )
  }

  if (isNested) {
    // 嵌套模式：只渲染内容，向父级贡献 ToC items
    return (
      <NestedMarkdownViewer
        markdown={markdown}
        className={className}
        headingTransform={headingTransform}
        inlineTextAnnotations={inlineTextAnnotations}
        blockAnnotations={blockAnnotations}
      />
    )
  }

  // 顶层模式：渲染完整布局（content + ToC sidebar）
  return (
    <RootMarkdownViewer
      markdown={markdown}
      className={className}
      onReady={onReady}
      headingTransform={headingTransform}
      inlineTextAnnotations={inlineTextAnnotations}
      blockAnnotations={blockAnnotations}
    />
  )
}

// ============================================================================
// PlainMarkdownViewer - 不参与 ToC 收集
// ============================================================================

function PlainMarkdownViewer({
  markdown,
  className = '',
  headingTransform,
  inlineTextAnnotations,
  blockAnnotations,
}: Pick<
  MarkdownViewerProps,
  'markdown' | 'className' | 'headingTransform' | 'inlineTextAnnotations' | 'blockAnnotations'
>) {
  if (typeof markdown === 'string') {
    return (
      <StringMarkdownContent
        markdown={markdown}
        className={className}
        collector={new TocCollector()}
        levelOffset={0}
        headingTransform={headingTransform}
        inlineTextAnnotations={inlineTextAnnotations}
        blockAnnotations={blockAnnotations}
        collectToc={false}
      />
    )
  }
  return <PlainBuilderMarkdownContent builder={markdown} className={className} />
}

function PlainBuilderMarkdownContent({
  builder,
  className,
}: {
  builder: MarkdownBuilderFn
  className?: string
}) {
  const components = useMemo<BuilderComponents>(() => {
    const slugCount = new Map<string, number>()

    const createHeading = (level: HeadingLevel): HeadingComponent => {
      return function Heading({ id: fixedId, className, children }: HeadingProps) {
        const text = extractTextFromChildren(children)
        const baseSlug = fixedId ?? (slugify(text) || 'heading')

        const count = slugCount.get(baseSlug) ?? 0
        slugCount.set(baseSlug, count + 1)
        const id = count > 0 ? `${baseSlug}-${count + 1}` : baseSlug

        return (
          <HeadingElement level={level} id={id} className={className}>
            {children}
          </HeadingElement>
        )
      }
    }

    const Section: SectionComponent = ({ children, className }) => (
      <section className={className ? `markdown-section ${className}` : 'markdown-section'}>
        {children}
      </section>
    )

    return {
      H1: createHeading(1),
      H2: createHeading(2),
      H3: createHeading(3),
      H4: createHeading(4),
      H5: createHeading(5),
      H6: createHeading(6),
      Section,
    }
  }, [])

  return <div className={`markdown-content ${className}`}>{builder(components)}</div>
}

// ============================================================================
// RootMarkdownViewer - 顶层模式
// ============================================================================

function RootMarkdownViewer({
  markdown,
  className,
  onReady,
  headingTransform,
  inlineTextAnnotations,
  blockAnnotations,
}: MarkdownViewerProps) {
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
      <StringMarkdownContent
        markdown={markdown}
        collector={collector}
        levelOffset={0}
        headingTransform={headingTransform}
        inlineTextAnnotations={inlineTextAnnotations}
        blockAnnotations={blockAnnotations}
      />
    ) : (
      <BuilderMarkdownContent builder={markdown} collector={collector} levelOffset={0} />
    )

  return (
    <TocProvider collector={collector} levelOffset={0} isRoot>
      <div className={`@container-[size] h-full ${className}`}>
        <style>{viewerStyles}</style>
        <MarkdownContainer
          className="viewer-scroll toc-page-layout viewer-layout gap-6"
          timelineScope={timelineScope}
          enableHashNavigation
        >
          <Toc items={tocItems} className="toc-page-sidebar viewer-toc" />
          <div className="toc-page-content viewer-content min-w-0">{content}</div>
        </MarkdownContainer>
      </div>
    </TocProvider>
  )
}

// ============================================================================
// NestedMarkdownViewer - 嵌套模式
// ============================================================================

function NestedMarkdownViewer({
  markdown,
  className,
  headingTransform,
  inlineTextAnnotations,
  blockAnnotations,
}: MarkdownViewerProps) {
  const ctx = useTocContext()!
  const { collector, levelOffset } = ctx

  // 嵌套模式：使用父级的 collector，但应用当前的 levelOffset
  return typeof markdown === 'string' ? (
    <StringMarkdownContent
      markdown={markdown}
      className={className}
      collector={collector}
      levelOffset={levelOffset}
      headingTransform={headingTransform}
      inlineTextAnnotations={inlineTextAnnotations}
      blockAnnotations={blockAnnotations}
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
  headingTransform,
  inlineTextAnnotations,
  blockAnnotations,
  collectToc = true,
}: {
  markdown: string
  collector: TocCollector
  levelOffset: number
  className?: string
  headingTransform?: MarkdownHeadingTransform
  inlineTextAnnotations?: readonly MarkdownInlineTextAnnotation[]
  blockAnnotations?: readonly MarkdownBlockAnnotation[]
  collectToc?: boolean
}) {
  // 为 markdown 中的标题创建自定义组件
  const components = useMemo(() => {
    const createHeading = (level: HeadingLevel) => {
      return function Heading({ children, node }: { children?: ReactNode; node?: unknown }) {
        const text = extractTextFromChildren(children)
        const sectionTimelineIndex = useSectionTimeline()
        const sourceRange = getMarkdownNodeSourceRange(node)

        // 由共享 collector 分配全局唯一 id，避免 ToC 与 DOM id 不一致
        const adjustedLevel = Math.min(level + levelOffset, 6) as HeadingLevel
        const transform = headingTransform?.({
          sourceLevel: level,
          level: adjustedLevel,
          text,
          ...(sourceRange.start !== undefined ? { sourceStartOffset: sourceRange.start } : {}),
          ...(sourceRange.end !== undefined ? { sourceEndOffset: sourceRange.end } : {}),
        })
        const tocLabel = transform?.tocLabel ?? text

        const registration =
          collectToc === false
            ? collector.add(tocLabel, adjustedLevel, transform?.id)
            : sectionTimelineIndex === null
              ? collector.add(tocLabel, adjustedLevel, transform?.id)
              : collector.bindSectionHeading(
                  sectionTimelineIndex,
                  tocLabel,
                  adjustedLevel,
                  transform?.id
                )

        return (
          <HeadingElement
            level={adjustedLevel}
            id={registration.id}
            timelineIndex={registration.timelineIndex}
            bindTimeline={collectToc !== false && registration.binding === 'heading'}
            className={transform?.className}
            dataAttributes={transform?.dataAttributes}
            suffix={transform?.suffix}
          >
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
  }, [collector, levelOffset, headingTransform, collectToc])

  return (
    <MarkdownContent
      className={className}
      components={components}
      inlineTextAnnotations={inlineTextAnnotations}
      blockAnnotations={blockAnnotations}
    >
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
    const createHeading = (level: HeadingLevel): HeadingComponent => {
      return function Heading({ id: fixedId, className, children, tocLabel }: HeadingProps) {
        // 从 context 实时获取 levelOffset，支持 Section 嵌套
        const ctx = useTocContext()
        const currentLevelOffset = ctx?.levelOffset ?? levelOffset
        const sectionTimelineIndex = useSectionTimeline()

        const text = extractTextFromChildren(children)
        const label = tocLabel ?? text

        // 由共享 collector 分配最终 id，确保 ToC 与 DOM 一致
        const adjustedLevel = Math.min(level + currentLevelOffset, 6) as HeadingLevel
        const registration =
          sectionTimelineIndex === null
            ? collector.add(label, adjustedLevel, fixedId)
            : collector.bindSectionHeading(sectionTimelineIndex, label, adjustedLevel, fixedId)

        return (
          <HeadingElement
            level={adjustedLevel}
            id={registration.id}
            timelineIndex={registration.timelineIndex}
            bindTimeline={registration.binding === 'heading'}
            className={className}
          >
            {children}
          </HeadingElement>
        )
      }
    }

    const Section: SectionComponent = ({ children, className }) => {
      const sectionTimelineIndex = collector.reserveSection()

      // Section 通过 TocLevelProvider 提供层级 +1，并承担 timeline 绑定
      return (
        <TocLevelProvider additionalOffset={1}>
          <SectionTimelineContext.Provider value={sectionTimelineIndex}>
            <SectionElement timelineIndex={sectionTimelineIndex} className={className}>
              {children}
            </SectionElement>
          </SectionTimelineContext.Provider>
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

function SectionElement({
  timelineIndex,
  children,
  className,
}: {
  timelineIndex: number
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      className={className ? `markdown-section ${className}` : 'markdown-section'}
      style={{ viewTimelineName: `--toc-${timelineIndex}` } as React.CSSProperties}
    >
      {children}
    </section>
  )
}

function HeadingElement({
  level,
  id,
  timelineIndex,
  bindTimeline = false,
  children,
  suffix,
  className,
  dataAttributes,
}: {
  level: HeadingLevel
  id: string
  timelineIndex?: number
  bindTimeline?: boolean
  children?: ReactNode
  suffix?: ReactNode
  className?: string
  dataAttributes?: HeadingDataAttributes
}) {
  const style =
    bindTimeline && timelineIndex !== undefined
      ? ({ viewTimelineName: `--toc-${timelineIndex}` } as React.CSSProperties)
      : undefined

  switch (level) {
    case 1:
      return (
        <h1 id={id} className={className} style={style} {...dataAttributes}>
          {children}
          {suffix ? ' ' : null}
          {suffix}
        </h1>
      )
    case 2:
      return (
        <h2 id={id} className={className} style={style} {...dataAttributes}>
          {children}
          {suffix ? ' ' : null}
          {suffix}
        </h2>
      )
    case 3:
      return (
        <h3 id={id} className={className} style={style} {...dataAttributes}>
          {children}
          {suffix ? ' ' : null}
          {suffix}
        </h3>
      )
    case 4:
      return (
        <h4 id={id} className={className} style={style} {...dataAttributes}>
          {children}
          {suffix ? ' ' : null}
          {suffix}
        </h4>
      )
    case 5:
      return (
        <h5 id={id} className={className} style={style} {...dataAttributes}>
          {children}
          {suffix ? ' ' : null}
          {suffix}
        </h5>
      )
    case 6:
      return (
        <h6 id={id} className={className} style={style} {...dataAttributes}>
          {children}
          {suffix ? ' ' : null}
          {suffix}
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
  enableHashNavigation?: boolean
}

/**
 * Shared container for markdown-style content with consistent scrolling and padding.
 */
function MarkdownContainer({
  children,
  className = '',
  timelineScope,
  enableHashNavigation = false,
}: MarkdownContainerProps) {
  const handleAnchorClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!enableHashNavigation) return

    const target = event.target
    if (!(target instanceof Element)) return

    const anchor = target.closest('a[href^="#"]')
    if (!(anchor instanceof HTMLAnchorElement)) return

    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const hash = anchor.getAttribute('href')
    if (!hash || !hash.startsWith('#')) return

    const didNavigate = navigateHashAnchor(anchor, hash)
    if (!didNavigate) return

    event.preventDefault()
  }

  return (
    <div
      className={`scrollbar-thin scrollbar-track-transparent h-full overflow-auto scroll-smooth p-4 ${className}`}
      style={timelineScope ? ({ timelineScope } as React.CSSProperties) : undefined}
      onClickCapture={handleAnchorClickCapture}
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

function getMarkdownNodeSourceRange(node: unknown): { start?: number; end?: number } {
  if (!node || typeof node !== 'object' || !('position' in node)) return {}
  const position = (node as { position?: unknown }).position
  if (!position || typeof position !== 'object') return {}
  const start = readMarkdownNodeOffset(position, 'start')
  const end = readMarkdownNodeOffset(position, 'end')
  return {
    ...(start !== undefined ? { start } : {}),
    ...(end !== undefined ? { end } : {}),
  }
}

function readMarkdownNodeOffset(position: object, key: 'start' | 'end'): number | undefined {
  if (!(key in position)) return undefined
  const point = (position as Record<typeof key, unknown>)[key]
  if (!point || typeof point !== 'object' || !('offset' in point)) return undefined
  const offset = (point as { offset?: unknown }).offset
  return typeof offset === 'number' ? offset : undefined
}

/** 比较两个 TocItem 数组是否相等 */
function arraysEqual(a: TocItem[], b: TocItem[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (item, i) =>
      item.id === b[i].id &&
      item.label === b[i].label &&
      item.level === b[i].level &&
      item.timelineIndex === b[i].timelineIndex
  )
}

// ============================================================================
// Styles
// ============================================================================

const css = String.raw
/** CSS for container queries layout */
const viewerStyles = css`
  /* MarkdownViewer keeps layout hooks local; shared ToC geometry lives in index.css. */
`
