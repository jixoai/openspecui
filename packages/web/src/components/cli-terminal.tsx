import { forwardRef, type ReactNode, type RefObject } from 'react'

export type TerminalStatus = 'running' | 'success' | 'error'

export interface CliTerminalProps {
  lines: string[]
  status: TerminalStatus
  exitCode: number | null
  isSuccessView?: boolean
  maxHeight?: string
  scrollRef?: RefObject<HTMLDivElement>
}

/** Pure terminal renderer (no dialog). Keeps scrollable area with ANSI color support. */
export const CliTerminal = forwardRef<HTMLDivElement, CliTerminalProps>(function CliTerminal(
  { lines, status, exitCode, maxHeight = '60vh', scrollRef },
  ref
) {
  const containerRef = (scrollRef ?? ref) as RefObject<HTMLDivElement>

  return (
    <div
      ref={containerRef as RefObject<HTMLDivElement>}
      className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700 overflow-auto bg-zinc-900 p-4 font-mono text-sm text-zinc-100"
      style={{ maxHeight }}
    >
      {lines.length === 0 && status === 'running' && <span className="text-zinc-500">Starting...</span>}
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre-wrap break-all">
          {renderAnsiLine(line)}
        </div>
      ))}
      {status === 'success' && (
        <div className="mt-2 text-green-400">Process exited with code {exitCode}</div>
      )}
      {status === 'error' && exitCode !== null && (
        <div className="mt-2 text-red-400">Process exited with code {exitCode}</div>
      )}
      {status === 'error' && exitCode === null && (
        <div className="mt-2 text-red-400">Process exited with unknown code</div>
      )}
    </div>
  )
})

/** Simple ANSI color code renderer */
function renderAnsiLine(line: string): ReactNode {
  const parts: ReactNode[] = []
  let currentIndex = 0
  let currentColor: string | null = null

  const regex = /\x1b\[(\d+)m/g
  let match

  while ((match = regex.exec(line)) !== null) {
    if (match.index > currentIndex) {
      const text = line.slice(currentIndex, match.index)
      parts.push(currentColor ? <span key={currentIndex} className={currentColor}>{text}</span> : text)
    }

    const code = parseInt(match[1], 10)
    if (code === 0) currentColor = null
    else if (code === 31) currentColor = 'text-red-400'
    else if (code === 32) currentColor = 'text-green-400'
    else if (code === 33) currentColor = 'text-yellow-400'
    else if (code === 34) currentColor = 'text-blue-400'

    currentIndex = match.index + match[0].length
  }

  if (currentIndex < line.length) {
    const text = line.slice(currentIndex)
    parts.push(currentColor ? <span key={currentIndex} className={currentColor}>{text}</span> : text)
  }

  return parts.length > 0 ? parts : line
}
