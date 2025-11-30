import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyablePathProps {
  /** The path to display */
  path: string
  /** Additional className */
  className?: string
}

/**
 * A component for displaying a full path with copy functionality.
 * - Displays full path with word-break
 * - Click to copy
 * - Shows copy confirmation
 */
export function CopyablePath({ path, className = '' }: CopyablePathProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(path)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy path:', err)
    }
  }, [path])

  return (
    <button
      onClick={handleCopy}
      className={`group flex items-start gap-2 text-left cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors ${className}`}
      title="Click to copy"
    >
      <code className="flex-1 text-sm font-mono break-all bg-muted px-2 py-1 rounded">
        {path}
      </code>
      <span className="flex-shrink-0 mt-1 text-muted-foreground group-hover:text-foreground transition-colors">
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </span>
    </button>
  )
}
