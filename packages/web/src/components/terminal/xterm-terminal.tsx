import { useEffect, useRef } from 'react'
import { terminalController } from '@/lib/terminal-controller'
import '@xterm/xterm/css/xterm.css'

interface Props {
  sessionId: string
}

export function XtermTerminal({ sessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    terminalController.mount(sessionId, el)
    return () => {
      terminalController.unmount(sessionId)
    }
  }, [sessionId])

  return (
    <div ref={containerRef} className="relative h-full w-full" style={{ minHeight: 0 }} />
  )
}
