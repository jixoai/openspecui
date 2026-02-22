import { forwardRef, type ReactNode, type RefObject } from 'react'

export type CliTerminalLine =
  | { id: string; kind: 'ascii'; text: string; tone?: 'success' | 'error' | 'info' }
  | { id: string; kind: 'html'; node: ReactNode }

export interface CliTerminalProps {
  lines: CliTerminalLine[]
  maxHeight?: string
  scrollRef?: RefObject<HTMLDivElement>
}

/**
 * Pure terminal renderer. Accepts ANSI-aware ASCII lines or raw ReactNode lines.
 * It does not own business logic; upstream decides how to format text (e.g., status icons).
 */
export const CliTerminal = forwardRef<HTMLDivElement, CliTerminalProps>(function CliTerminal(
  { lines, maxHeight = '60vh', scrollRef },
  ref
) {
  const containerRef = (scrollRef ?? ref) as RefObject<HTMLDivElement>

  return (
    <div
      ref={containerRef as RefObject<HTMLDivElement>}
      className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700 overflow-auto bg-zinc-900 p-4 font-mono text-sm text-zinc-100"
      style={{ maxHeight }}
    >
      {lines.length === 0 && <span className="text-zinc-500">Waiting to start…</span>}

      {lines.map((line) => {
        if (line.kind === 'html') {
          return (
            <div key={line.id} className="whitespace-pre-wrap break-all">
              {line.node}
            </div>
          )
        }

        const color =
          line.tone === 'success'
            ? 'text-green-400'
            : line.tone === 'error'
              ? 'text-red-400'
              : line.tone === 'info'
                ? 'text-blue-300'
                : undefined

        return (
          <div key={line.id} className="whitespace-pre-wrap break-all">
            <span className={color}>{renderAnsiLine(line.text)}</span>
          </div>
        )
      })}
    </div>
  )
})

/** Simple ANSI color code renderer with a few common colors */
function renderAnsiLine(line: string): ReactNode {
  const parts: ReactNode[] = []
  let currentIndex = 0
  let currentColor: string | null = null

  // eslint-disable-next-line no-control-regex -- ANSI SGR sequence uses ESC control code.
  const regex = /\x1b\[(\d+)m/g
  let match

  while ((match = regex.exec(line)) !== null) {
    if (match.index > currentIndex) {
      const text = line.slice(currentIndex, match.index)
      parts.push(
        currentColor ? (
          <span key={currentIndex} className={currentColor}>
            {text}
          </span>
        ) : (
          text
        )
      )
    }

    const code = parseInt(match[1], 10)
    if (code === 0) currentColor = null
    else if (code === 31) currentColor = 'text-red-400'
    else if (code === 32) currentColor = 'text-green-400'
    else if (code === 33) currentColor = 'text-yellow-400'
    else if (code === 34) currentColor = 'text-blue-400'
    else if (code === 35) currentColor = 'text-fuchsia-300'
    else if (code === 36) currentColor = 'text-cyan-300'
    else if (code === 37 || code === 90) currentColor = 'text-zinc-400'

    currentIndex = match.index + match[0].length
  }

  if (currentIndex < line.length) {
    const text = line.slice(currentIndex)
    parts.push(
      currentColor ? (
        <span key={currentIndex} className={currentColor}>
          {text}
        </span>
      ) : (
        text
      )
    )
  }

  return parts.length > 0 ? parts : line
}
