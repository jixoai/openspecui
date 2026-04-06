import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizeHandleProps {
  onResize: (height: number) => void
  minHeight?: number
  maxHeight?: number
}

export function ResizeHandle({ onResize, minHeight = 100, maxHeight }: ResizeHandleProps) {
  const startY = useRef(0)
  const startHeight = useRef(0)
  const slotRef = useRef<HTMLDivElement>(null)
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
    startY.current = clientY
    const panel = slotRef.current?.nextElementSibling as HTMLElement | null
    startHeight.current = panel?.offsetHeight ?? 300
    setIsDragging(true)
    document.body.style.userSelect = 'none'
  }, [])

  const stopDrag = useCallback(() => {
    setIsDragging(false)
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const onMouseMove = (event: MouseEvent) => {
      computeHeight(event.clientY)
    }
    const onMouseUp = () => {
      stopDrag()
    }
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      event.preventDefault()
      computeHeight(touch.clientY)
    }
    const onTouchEnd = () => {
      stopDrag()
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [computeHeight, isDragging, stopDrag])

  useEffect(() => {
    return () => {
      document.body.style.userSelect = ''
    }
  }, [])

  const onMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      initDrag(event.clientY)
    },
    [initDrag]
  )

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0]
      if (!touch) return
      event.preventDefault()
      initDrag(touch.clientY)
    },
    [initDrag]
  )

  return (
    <div ref={slotRef} className="border-border relative h-2 shrink-0 border-t">
      <div
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
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
