import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

interface ResizeHandleProps {
  onResize: (height: number) => void
  minHeight?: number
  maxHeight?: number
}

export function ResizeHandle({ onResize, minHeight = 100, maxHeight }: ResizeHandleProps) {
  const dragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)
  const slotRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

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
    const panel = slotRef.current?.nextElementSibling as HTMLElement | null
    startHeight.current = panel?.offsetHeight ?? 300
    setIsDragging(true)
    document.body.style.userSelect = 'none'
  }, [])

  const stopDrag = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    setIsDragging(false)
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    return () => {
      document.body.style.userSelect = ''
    }
  }, [])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      initDrag(event.clientY)
    },
    [initDrag]
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      computeHeight(event.clientY)
    },
    [computeHeight]
  )

  const onPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId)
      }
      stopDrag()
    },
    [stopDrag]
  )

  return (
    <div ref={slotRef} className="border-border relative h-2 shrink-0 border-t">
      <div
        ref={handleRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={stopDrag}
        className={`group absolute inset-x-0 -bottom-1 -top-1 z-10 flex cursor-row-resize touch-none items-center justify-center transition-colors ${
          isDragging ? 'bg-muted/50' : 'hover:bg-muted/50'
        }`}
      >
        <div
          className={`h-0.5 w-8 rounded-full transition-colors ${
            isDragging
              ? 'bg-muted-foreground/80'
              : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/60'
          }`}
        />
      </div>
    </div>
  )
}
