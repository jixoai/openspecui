import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type JSX,
  type ReactNode,
} from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { codeToHtml } from 'shiki'

type InlineAnnotationDataAttributes = Partial<Record<`data-${string}`, string | number | boolean>>
type BlockAnnotationDataAttributes = Partial<Record<`data-${string}`, string | number | boolean>>

export interface MarkdownInlineTextAnnotation {
  text: string
  className: string
  dataAttributes?: InlineAnnotationDataAttributes
}

export interface MarkdownBlockAnnotation {
  sourceStartOffset: number
  sourceKind?: string
  className?: string
  dataAttributes?: BlockAnnotationDataAttributes
}

interface MarkdownContentProps {
  children: string
  className?: string
  /** Additional component overrides for react-markdown */
  components?: Components
  /** Inline text spans discovered by the reading model and projected into CSS. */
  inlineTextAnnotations?: readonly MarkdownInlineTextAnnotation[]
  /** Block-level semantic attributes discovered from source Markdown facts. */
  blockAnnotations?: readonly MarkdownBlockAnnotation[]
}

/**
 * Simple markdown renderer with GFM support and shiki code highlighting.
 * For full markdown viewing with ToC, use MarkdownViewer instead.
 */
export function MarkdownContent({
  children,
  className = '',
  components,
  inlineTextAnnotations = [],
  blockAnnotations = [],
}: MarkdownContentProps) {
  const blockAnnotationByOffset = useMemo(
    () =>
      new Map(
        blockAnnotations.map((annotation) => [createBlockAnnotationKey(annotation), annotation])
      ),
    [blockAnnotations]
  )
  const annotationComponents = useMemo(
    () => createAnnotationComponents(inlineTextAnnotations, blockAnnotationByOffset),
    [inlineTextAnnotations, blockAnnotationByOffset]
  )

  return (
    <div className={`markdown-content ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          ...annotationComponents,
          code: CodeBlock,
          pre: ({ children }) => <>{children}</>,
          ...components,
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}

export function renderInlineAnnotatedChildren(
  children: ReactNode,
  annotations: readonly MarkdownInlineTextAnnotation[]
): ReactNode {
  if (annotations.length === 0) return children

  if (typeof children === 'string' || typeof children === 'number') {
    return renderInlineAnnotatedText(String(children), annotations)
  }

  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <Fragment key={`inline-node-${index}`}>
        {renderInlineAnnotatedChildren(child, annotations)}
      </Fragment>
    ))
  }

  return children
}

function renderInlineAnnotatedText(
  text: string,
  annotations: readonly MarkdownInlineTextAnnotation[]
): ReactNode {
  const pattern = createInlineAnnotationPattern(annotations)
  if (!pattern) return text

  const annotationByText = new Map(annotations.map((annotation) => [annotation.text, annotation]))
  const nodes: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const matchText = match[0]
    const start = match.index ?? 0
    const annotation = annotationByText.get(matchText)
    if (!annotation) continue

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start))
    }

    nodes.push(
      <span
        key={`inline-annotation-${start}-${matchText}`}
        className={annotation.className}
        {...annotation.dataAttributes}
      >
        {matchText}
      </span>
    )
    lastIndex = start + matchText.length
  }

  if (lastIndex === 0) return text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function createInlineAnnotationPattern(
  annotations: readonly MarkdownInlineTextAnnotation[]
): RegExp | undefined {
  const terms = Array.from(new Set(annotations.map((annotation) => annotation.text.trim())))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)

  if (terms.length === 0) return undefined
  return new RegExp(`\\b(${terms.map(escapeRegExp).join('|')})\\b`, 'g')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type MarkdownComponentProps<Tag extends keyof JSX.IntrinsicElements> =
  ComponentPropsWithoutRef<Tag> & { node?: unknown }

function getMarkdownNodeSourceStartOffset(node: unknown): number | undefined {
  if (!node || typeof node !== 'object' || !('position' in node)) return undefined
  const position = (node as { position?: unknown }).position
  if (!position || typeof position !== 'object' || !('start' in position)) return undefined
  const start = (position as { start?: unknown }).start
  if (!start || typeof start !== 'object' || !('offset' in start)) return undefined
  const offset = (start as { offset?: unknown }).offset
  return typeof offset === 'number' ? offset : undefined
}

function getBlockAnnotation(
  node: unknown,
  annotationByOffset: ReadonlyMap<string, MarkdownBlockAnnotation>,
  sourceKind?: string
): MarkdownBlockAnnotation | undefined {
  const sourceStartOffset = getMarkdownNodeSourceStartOffset(node)
  if (sourceStartOffset === undefined) return undefined

  return (
    (sourceKind
      ? annotationByOffset.get(createBlockAnnotationKey({ sourceStartOffset, sourceKind }))
      : undefined) ?? annotationByOffset.get(createBlockAnnotationKey({ sourceStartOffset }))
  )
}

function createBlockAnnotationKey(
  annotation: Pick<MarkdownBlockAnnotation, 'sourceStartOffset' | 'sourceKind'>
): string {
  return `${annotation.sourceStartOffset}:${annotation.sourceKind ?? '*'}`
}

function mergeClassName(...classNames: Array<string | undefined>): string | undefined {
  const merged = classNames.filter(Boolean).join(' ')
  return merged || undefined
}

function createAnnotationComponents(
  inlineAnnotations: readonly MarkdownInlineTextAnnotation[],
  blockAnnotationByOffset: ReadonlyMap<string, MarkdownBlockAnnotation>
): Components {
  if (inlineAnnotations.length === 0 && blockAnnotationByOffset.size === 0) return {}

  const render = (children: ReactNode) => renderInlineAnnotatedChildren(children, inlineAnnotations)

  return {
    p: ({ children, node, ...props }: MarkdownComponentProps<'p'>) => {
      const annotation = getBlockAnnotation(node, blockAnnotationByOffset, 'paragraph')
      return (
        <p
          {...props}
          {...annotation?.dataAttributes}
          className={mergeClassName(props.className, annotation?.className)}
        >
          {render(children)}
        </p>
      )
    },
    ul: ({ children, node, ...props }: MarkdownComponentProps<'ul'>) => {
      const annotation = getBlockAnnotation(node, blockAnnotationByOffset, 'list')
      return (
        <ul
          {...props}
          {...annotation?.dataAttributes}
          className={mergeClassName(props.className, annotation?.className)}
        >
          {children}
        </ul>
      )
    },
    ol: ({ children, node, ...props }: MarkdownComponentProps<'ol'>) => {
      const annotation = getBlockAnnotation(node, blockAnnotationByOffset, 'list')
      return (
        <ol
          {...props}
          {...annotation?.dataAttributes}
          className={mergeClassName(props.className, annotation?.className)}
        >
          {children}
        </ol>
      )
    },
    li: ({ children, node, className, ...props }: MarkdownComponentProps<'li'>) => {
      const annotation = getBlockAnnotation(node, blockAnnotationByOffset, 'listItem')
      return (
        <li
          {...props}
          {...annotation?.dataAttributes}
          className={mergeClassName(className, annotation?.className)}
        >
          {render(children)}
        </li>
      )
    },
    strong: ({ children, node, ...props }: MarkdownComponentProps<'strong'>) => {
      void node
      return <strong {...props}>{render(children)}</strong>
    },
    em: ({ children, node, ...props }: MarkdownComponentProps<'em'>) => {
      void node
      return <em {...props}>{render(children)}</em>
    },
    a: ({ children, node, ...props }: MarkdownComponentProps<'a'>) => {
      void node
      return <a {...props}>{render(children)}</a>
    },
    blockquote: ({ children, node, ...props }: MarkdownComponentProps<'blockquote'>) => {
      const annotation = getBlockAnnotation(node, blockAnnotationByOffset, 'blockquote')
      return (
        <blockquote
          {...props}
          {...annotation?.dataAttributes}
          className={mergeClassName(props.className, annotation?.className)}
        >
          {children}
        </blockquote>
      )
    },
    table: ({ children, node, ...props }: MarkdownComponentProps<'table'>) => {
      const annotation = getBlockAnnotation(node, blockAnnotationByOffset, 'table')
      return (
        <table
          {...props}
          {...annotation?.dataAttributes}
          className={mergeClassName(props.className, annotation?.className)}
        >
          {children}
        </table>
      )
    },
    th: ({ children, node, ...props }: MarkdownComponentProps<'th'>) => {
      void node
      return <th {...props}>{render(children)}</th>
    },
    td: ({ children, node, ...props }: MarkdownComponentProps<'td'>) => {
      void node
      return <td {...props}>{render(children)}</td>
    },
  }
}

interface CodeBlockProps {
  children?: React.ReactNode
  className?: string
  node?: unknown
}

/** Shared code block component with shiki syntax highlighting */
export function CodeBlock({ children, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null)
  const code = String(children).replace(/\n$/, '')
  const match = /language-(\w+)/.exec(className || '')
  const lang = match ? match[1] : undefined

  // Check if this is inline code (no language, short content)
  const isInline = !lang && !code.includes('\n')

  useEffect(() => {
    if (isInline) return

    let mounted = true
    const highlight = async () => {
      try {
        const result = await codeToHtml(code, {
          lang: lang || 'text',
          themes: {
            light: 'github-light',
            dark: 'github-dark',
          },
        })
        if (mounted) setHtml(result)
      } catch {
        // Fallback for unknown languages
        const result = await codeToHtml(code, {
          lang: 'text',
          themes: {
            light: 'github-light',
            dark: 'github-dark',
          },
        })
        if (mounted) setHtml(result)
      }
    }
    highlight()
    return () => {
      mounted = false
    }
  }, [code, lang, isInline])

  if (isInline) {
    return (
      <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-sm">
        {code}
      </code>
    )
  }

  if (!html) {
    return (
      <pre className="readonly-code-surface overflow-x-auto rounded-md p-4">
        <code className="text-foreground font-mono text-sm">{code}</code>
      </pre>
    )
  }

  return (
    <div
      className="shiki-wrapper overflow-x-auto rounded-md text-sm [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
