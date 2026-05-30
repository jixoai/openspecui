import { useEffect, useRef } from 'react'

interface Props {
  sessionId: string
}

interface ActiveTouch {
  identifier: number
  startX: number
  startY: number
}

interface TouchPoint {
  identifier: number
  clientX: number
  clientY: number
}

interface TouchListLike {
  length: number
  item?: (index: number) => TouchPoint | null
  [index: number]: TouchPoint
}

const CLICK_MOVEMENT_THRESHOLD = 8

function findTouch(touches: TouchListLike, identifier: number): TouchPoint | null {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item?.(index) ?? touches[index]
    if (touch?.identifier === identifier) return touch
  }
  return null
}

function firstTouch(touches: TouchListLike): TouchPoint | null {
  return touches.item?.(0) ?? touches[0] ?? null
}

function movementExceeded(active: ActiveTouch, touch: TouchPoint): boolean {
  const dx = touch.clientX - active.startX
  const dy = touch.clientY - active.startY
  return Math.sqrt(dx * dx + dy * dy) > CLICK_MOVEMENT_THRESHOLD
}

function shouldHandleTouchStart(host: HTMLElement, target: EventTarget | null): boolean {
  if (!(target instanceof Node) || !host.contains(target)) return false
  if (target instanceof Element && target.closest('input-panel')) return false

  const terminalElement = host.querySelector('.xterm') ?? host.querySelector('.xterm-screen')
  if (!terminalElement) return true
  return target === host || terminalElement.contains(target)
}

function resolveMouseTarget(host: HTMLElement, clientX: number, clientY: number): Element {
  const hit = document.elementFromPoint(clientX, clientY)

  if (hit && host.contains(hit) && !hit.classList.contains('terminal-touch-mouse-overlay')) {
    return hit
  }
  return host.querySelector('.xterm-screen') ?? host
}

function dispatchMouseEvent(
  target: Element,
  type: 'mousedown' | 'mousemove' | 'mouseup' | 'click',
  touch: TouchPoint,
  opts: { buttons: number; detail?: number }
): void {
  const eventView = target.ownerDocument.defaultView ?? window
  target.dispatchEvent(
    new eventView.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
      buttons: opts.buttons,
      detail: opts.detail ?? 1,
    })
  )
}

export function TerminalTouchMouseOverlay({ sessionId }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const activeTouchRef = useRef<ActiveTouch | null>(null)
  const movedRef = useRef(false)

  useEffect(() => {
    const overlay = overlayRef.current
    const host = overlay?.parentElement
    if (!host) return

    const stopTouch = (event: TouchEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !shouldHandleTouchStart(host, event.target)) return
      stopTouch(event)

      const touch = firstTouch(event.touches)
      if (!touch) return

      activeTouchRef.current = {
        identifier: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
      }
      movedRef.current = false

      dispatchMouseEvent(
        resolveMouseTarget(host, touch.clientX, touch.clientY),
        'mousedown',
        touch,
        {
          buttons: 1,
        }
      )
    }

    const handleTouchMove = (event: TouchEvent) => {
      const active = activeTouchRef.current
      if (!active) return
      stopTouch(event)

      const touch = findTouch(event.touches, active.identifier)
      if (!touch) return

      if (movementExceeded(active, touch)) {
        movedRef.current = true
      }
      dispatchMouseEvent(
        resolveMouseTarget(host, touch.clientX, touch.clientY),
        'mousemove',
        touch,
        {
          buttons: 1,
        }
      )
    }

    const finishTouch = (event: TouchEvent, emitClick: boolean) => {
      const active = activeTouchRef.current
      if (!active) return
      stopTouch(event)

      const touch = findTouch(event.changedTouches, active.identifier)
      if (!touch) return

      const target = resolveMouseTarget(host, touch.clientX, touch.clientY)
      dispatchMouseEvent(target, 'mouseup', touch, { buttons: 0 })
      if (emitClick && !movedRef.current) {
        dispatchMouseEvent(target, 'click', touch, { buttons: 0 })
      }

      activeTouchRef.current = null
      movedRef.current = false
    }

    const handleTouchEnd = (event: TouchEvent) => finishTouch(event, true)
    const handleTouchCancel = (event: TouchEvent) => finishTouch(event, false)

    host.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false })
    host.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false })
    host.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false })
    host.addEventListener('touchcancel', handleTouchCancel, { capture: true, passive: false })

    return () => {
      host.removeEventListener('touchstart', handleTouchStart, { capture: true })
      host.removeEventListener('touchmove', handleTouchMove, { capture: true })
      host.removeEventListener('touchend', handleTouchEnd, { capture: true })
      host.removeEventListener('touchcancel', handleTouchCancel, { capture: true })
    }
  }, [])

  return (
    <div
      ref={overlayRef}
      data-testid={`terminal-touch-mouse-overlay-${sessionId}`}
      className="terminal-touch-mouse-overlay absolute inset-0 z-20 bg-transparent"
      aria-hidden="true"
    />
  )
}
