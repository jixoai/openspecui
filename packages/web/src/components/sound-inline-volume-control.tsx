import { cn } from '@/lib/utils'
import { ChevronsUpDown } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

interface SoundInlineVolumeControlProps {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

const VOLUME_STEP = 0.01
const DRAG_SENSITIVITY = 160

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

function roundVolume(value: number): number {
  return Number((Math.round(clampVolume(value) / VOLUME_STEP) * VOLUME_STEP).toFixed(2))
}

function getPopoverOpen(element: Element): boolean {
  try {
    return element.matches(':popover-open')
  } catch {
    return false
  }
}

export function SoundInlineVolumeControl({
  label,
  value,
  onChange,
  disabled,
}: SoundInlineVolumeControlProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ startY: number; startValue: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const percent = Math.round(clampVolume(value) * 100)

  const commitVolume = useCallback(
    (nextValue: number) => {
      onChange(clampVolume(roundVolume(nextValue)))
    },
    [onChange]
  )

  const changeVolumeByWheel = useCallback(
    (deltaY: number) => {
      const direction = deltaY > 0 ? -1 : 1
      commitVolume(value + direction * VOLUME_STEP)
    },
    [commitVolume, value]
  )

  const updatePosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const width = 52
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width))
    const top = Math.min(window.innerHeight - 156, Math.max(8, rect.bottom + 6))
    setPosition({ left, top })
  }, [])

  const showPopover = useCallback(() => {
    if (disabled) return
    setOpen(true)
    updatePosition()
  }, [disabled, updatePosition])

  const hidePopover = useCallback(() => {
    if (dragStateRef.current) return
    setOpen(false)
  }, [])

  useLayoutEffect(() => {
    const popover = popoverRef.current as
      | (HTMLDivElement & {
          showPopover?: () => void
          hidePopover?: () => void
        })
      | null
    if (!popover) return
    if (open) {
      updatePosition()
      if (!getPopoverOpen(popover)) popover.showPopover?.()
    } else if (getPopoverOpen(popover)) {
      popover.hidePopover?.()
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (buttonRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (disabled) {
      setOpen(false)
    }
  }, [disabled])

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      changeVolumeByWheel(event.deltaY)
    }
    const options = { passive: false }
    const button = buttonRef.current
    const popover = popoverRef.current
    button?.addEventListener('wheel', handleWheel, options)
    popover?.addEventListener('wheel', handleWheel, options)
    return () => {
      button?.removeEventListener('wheel', handleWheel)
      popover?.removeEventListener('wheel', handleWheel)
    }
  }, [changeVolumeByWheel, open])

  const getVolumeFromTrackPoint = (clientY: number): number | null => {
    const track = trackRef.current
    if (!track) return null
    const rect = track.getBoundingClientRect()
    if (rect.height <= 0) return null
    return 1 - (clientY - rect.top) / rect.height
  }

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    showPopover()
    dragStateRef.current = { startY: event.clientY, startValue: clampVolume(value) }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const beginPopoverDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    showPopover()
    const trackValue = getVolumeFromTrackPoint(event.clientY)
    const startValue = trackValue === null ? clampVolume(value) : roundVolume(trackValue)
    commitVolume(startValue)
    dragStateRef.current = { startY: event.clientY, startValue }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState) return
    const delta = (dragState.startY - event.clientY) / DRAG_SENSITIVITY
    commitVolume(dragState.startValue + delta)
  }

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (!dragStateRef.current) return
    dragStateRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const popoverStyle = position ? { left: position.left, top: position.top } : { left: 0, top: 0 }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={showPopover}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseEnter={showPopover}
        disabled={disabled}
        className={cn(
          'bg-primary text-primary-foreground hover:bg-primary/90 border-l-primary-foreground/30 inline-flex h-9 w-[1.125rem] shrink-0 touch-none select-none items-center justify-center border-l transition',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        aria-controls={`sound-volume-popover-${id}`}
        aria-expanded={open}
        aria-label={`Adjust ${label} volume`}
        title={`${label} volume: ${percent}%`}
      >
        <ChevronsUpDown className="h-3 w-3" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`sound-volume-popover-${id}`}
          ref={popoverRef}
          popover="manual"
          role="slider"
          aria-label={`${label} volume`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          tabIndex={-1}
          onPointerDown={beginPopoverDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onMouseLeave={hidePopover}
          className="border-border bg-popover text-popover-foreground z-50 flex h-36 w-[52px] touch-none select-none flex-col items-center gap-2 rounded-md border p-2 shadow-lg"
          style={{
            position: 'fixed',
            inset: 'auto',
            ...popoverStyle,
          }}
        >
          <div className="text-muted-foreground text-[10px] leading-none">{percent}%</div>
          <div
            ref={trackRef}
            data-sound-volume-track="true"
            className="bg-muted relative min-h-0 w-2 flex-1 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary absolute inset-x-0 bottom-0 rounded-full"
              style={{ height: `${percent}%` }}
            />
          </div>
          <div className="text-muted-foreground text-[10px] leading-none">Vol</div>
        </div>
      )}
    </>
  )
}
