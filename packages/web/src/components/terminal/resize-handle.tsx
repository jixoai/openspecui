import { useCallback, useRef } from 'react'

interface ResizeHandleProps {
  onResize: (height: number) => void
  minHeight?: number
  maxHeight?: number
}

export function ResizeHandle({ onResize, minHeight = 100, maxHeight }: ResizeHandleProps) {
  const dragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)
  const handleRef = useRef<HTMLDivElement>(null)

  const computeHeight = useCallback(
    (clientY: number) => {
      const delta = startY.current - clientY
      const newHeight = Math.max(minHeight, startHeight.current + delta)
      const max = maxHeight ?? window.innerHeight * 0.7
      onResize(Math.min(newHeight, max))
    },
    [minHeight, maxHeight, onResize]
  )

  const initDrag = useCallback((clientY: number) => {
    dragging.current = true
    startY.current = clientY
    const panel = handleRef.current?.nextElementSibling as HTMLElement | null
    startHeight.current = panel?.offsetHeight ?? 300
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  // --- Mouse handlers ---

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return
      computeHeight(e.clientY)
    },
    [computeHeight]
  )

  const onMouseUp = useCallback(() => {
    dragging.current = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [onMouseMove])

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      initDrag(e.clientY)
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [initDrag, onMouseMove, onMouseUp]
  )

  // --- Touch handlers ---

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!dragging.current) return
      computeHeight(e.touches[0].clientY)
    },
    [computeHeight]
  )

  const onTouchEnd = useCallback(() => {
    dragging.current = false
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onTouchEnd)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [onTouchMove])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault()
      initDrag(e.touches[0].clientY)
      document.addEventListener('touchmove', onTouchMove, { passive: false })
      document.addEventListener('touchend', onTouchEnd)
    },
    [initDrag, onTouchMove, onTouchEnd]
  )

  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className="border-border group flex h-1.5 shrink-0 cursor-row-resize items-center justify-center border-t transition hover:bg-muted/50"
    >
      <div className="bg-muted-foreground/30 group-hover:bg-muted-foreground/60 h-0.5 w-8 rounded-full transition" />
    </div>
  )
}
