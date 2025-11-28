import { useEffect, useState } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { codeToHtml } from 'shiki'

interface MarkdownContentProps {
  children: string
  className?: string
  /** Additional component overrides for react-markdown */
  components?: Components
}

/**
 * Simple markdown renderer with GFM support and shiki code highlighting.
 * For full markdown viewing with ToC, use MarkdownViewer instead.
 */
export function MarkdownContent({ children, className = '', components }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className} scroll-smooth`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
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
      <pre className="bg-muted/50 border-border overflow-x-auto rounded-md border p-4">
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
