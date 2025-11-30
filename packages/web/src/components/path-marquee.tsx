import { useState, useRef, useEffect, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'

interface PathMarqueeProps {
  /** The path to display */
  path: string
  /** Maximum width of the container (default: 300px) */
  maxWidth?: number | string
  /** Animation duration in seconds (default: 10) */
  duration?: number
  /** Gap between repeated content (default: 20px) */
  gap?: number
  /** Additional className for the container */
  className?: string
}

/**
 * A marquee component for displaying long paths with auto-scrolling animation.
 * - Pure CSS animation using ::after pseudo-element
 * - Pauses on hover
 * - Click to copy path
 * - Only animates when content overflows
 */
export function PathMarquee({
  path,
  maxWidth = 300,
  duration = 10,
  gap = 20,
  className = '',
}: PathMarqueeProps) {
  const [copied, setCopied] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Check if content overflows and needs animation
  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const contentWidth = contentRef.current.scrollWidth
        setShouldAnimate(contentWidth > containerWidth)
      }
    }

    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [path])

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(path)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy path:', err)
    }
  }, [path])

  const maxWidthStyle = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth

  return (
    <button
      onClick={handleCopy}
      className={`group flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 rounded transition-colors ${className}`}
      title={`${path}\n\nClick to copy`}
    >
      {/* Marquee container */}
      <div
        ref={containerRef}
        className="overflow-hidden whitespace-nowrap relative"
        style={{ maxWidth: maxWidthStyle }}
      >
        {/* Animated content */}
        <div
          ref={contentRef}
          data-content={path}
          className={`inline-block relative ${shouldAnimate ? 'animate-marquee group-hover:[animation-play-state:paused]' : ''}`}
          style={
            shouldAnimate
              ? {
                  '--marquee-duration': `${duration}s`,
                  '--marquee-gap': `${gap}px`,
                } as React.CSSProperties
              : undefined
          }
        >
          {path}
        </div>
      </div>

      {/* Copy indicator */}
      <span className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </span>
    </button>
  )
}
