import clsx from 'clsx'
import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  tone?: 'default' | 'destructive'
  onSelect: () => void
}

interface ContextMenuProps {
  open: boolean
  items: ContextMenuItem[]
  anchor: ContextMenuAnchor | null
  wrapperElement?: HTMLElement | null
  boundaryElement?: HTMLElement | null
  /** @deprecated use `anchor` instead */
  position?: { x: number; y: number } | null
  onClose: () => void
}

export type ContextMenuAnchor =
  | { type: 'point'; x: number; y: number }
  | {
      type: 'target'
      element: HTMLElement | null
      placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
    }

export function resolveAnchorPosition(
  anchor: ContextMenuAnchor | null
): { x: number; y: number } | null {
  if (!anchor) return null
  if (anchor.type === 'point') return { x: anchor.x, y: anchor.y }

  const element = anchor.element
  if (!element) return null
  const rect = element.getBoundingClientRect()
  const placement = anchor.placement ?? 'bottom-start'
  switch (placement) {
    case 'bottom-end':
      return { x: rect.right, y: rect.bottom }
    case 'top-start':
      return { x: rect.left, y: rect.top }
    case 'top-end':
      return { x: rect.right, y: rect.top }
    case 'bottom-start':
    default:
      return { x: rect.left, y: rect.bottom }
  }
}

export function clampWithinBounds(
  position: { x: number; y: number },
  menuRect: DOMRect,
  boundaryRect?: DOMRect | null
): { x: number; y: number } {
  const margin = 12
  const left = boundaryRect?.left ?? 0
  const top = boundaryRect?.top ?? 0
  const right = boundaryRect?.right ?? window.innerWidth
  const bottom = boundaryRect?.bottom ?? window.innerHeight

  const minX = left + margin
  const minY = top + margin
  const maxX = Math.max(minX, right - menuRect.width - margin)
  const maxY = Math.max(minY, bottom - menuRect.height - margin)

  return {
    x: Math.max(minX, Math.min(position.x, maxX)),
    y: Math.max(minY, Math.min(position.y, maxY)),
  }
}

export function resolveMenuPosition(
  anchor: ContextMenuAnchor | null,
  anchorPosition: { x: number; y: number },
  menuRect: DOMRect
): { x: number; y: number } {
  if (anchor?.type !== 'target') return anchorPosition

  const placement = anchor.placement ?? 'bottom-start'
  switch (placement) {
    case 'bottom-end':
      return { x: anchorPosition.x - menuRect.width, y: anchorPosition.y }
    case 'top-start':
      return { x: anchorPosition.x, y: anchorPosition.y - menuRect.height }
    case 'top-end':
      return { x: anchorPosition.x - menuRect.width, y: anchorPosition.y - menuRect.height }
    case 'bottom-start':
    default:
      return anchorPosition
  }
}

function isPopoverOpen(element: Element): boolean {
  try {
    return element.matches(':popover-open')
  } catch {
    return false
  }
}

export function ContextMenu({
  open,
  items,
  anchor,
  wrapperElement,
  boundaryElement,
  position,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const fallbackAnchor = useMemo<ContextMenuAnchor | null>(
    () => (position ? { type: 'point', x: position.x, y: position.y } : null),
    [position]
  )
  const activeAnchor = anchor ?? fallbackAnchor
  const hostElement = wrapperElement ?? boundaryElement ?? null
  const anchorPosition = useMemo(() => resolveAnchorPosition(activeAnchor), [activeAnchor])
  const [adjustedPosition, setAdjustedPosition] = useState<{ x: number; y: number } | null>(null)

  const menuId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const menuDataId = `context-menu-${menuId}`

  const visibleItems = useMemo(() => items.filter((item) => item.label.length > 0), [items])
  const shouldRender = open && !!anchorPosition && visibleItems.length > 0

  useLayoutEffect(() => {
    const menu = menuRef.current as
      | (HTMLDivElement & {
          showPopover?: () => void
          hidePopover?: () => void
        })
      | null
    if (!menu) return
    if (shouldRender) {
      if (!isPopoverOpen(menu)) {
        menu.showPopover?.()
      }
    } else if (isPopoverOpen(menu)) {
      menu.hidePopover?.()
    }
  }, [shouldRender])

  useLayoutEffect(() => {
    if (!open || !anchorPosition) {
      setAdjustedPosition(null)
      return
    }

    const menu = menuRef.current
    if (!menu) {
      setAdjustedPosition(anchorPosition)
      return
    }

    const boundaryRect = hostElement?.getBoundingClientRect() ?? null
    const menuRect = menu.getBoundingClientRect()
    const origin = resolveMenuPosition(activeAnchor, anchorPosition, menuRect)
    const clamped = clampWithinBounds(origin, menuRect, boundaryRect)
    setAdjustedPosition(clamped)
  }, [activeAnchor, anchorPosition, hostElement, open])

  useEffect(() => {
    const handleScroll = () => onClose()

    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!shouldRender) return

    const handlePointerDown = (event: PointerEvent) => {
      // Ignore right-click so contextmenu press/release won't dismiss the menu.
      if (event.button === 2) return
      const target = event.target
      if (!(target instanceof Node)) return
      const menu = menuRef.current
      if (menu?.contains(target)) return
      if (activeAnchor?.type === 'target' && activeAnchor.element?.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeAnchor, onClose, shouldRender])

  useEffect(() => {
    if (!open || activeAnchor?.type !== 'target' || !activeAnchor.element) return
    const target = activeAnchor.element
    const previousActive = target.getAttribute('data-context-menu-active')
    target.setAttribute('data-context-menu-active', 'true')

    return () => {
      if (previousActive === null) {
        target.removeAttribute('data-context-menu-active')
      } else {
        target.setAttribute('data-context-menu-active', previousActive)
      }
    }
  }, [activeAnchor, open])

  const resolvedPosition = adjustedPosition ?? anchorPosition
  const fallbackStyle =
    resolvedPosition === null
      ? { left: 0, top: 0 }
      : { left: resolvedPosition.x, top: resolvedPosition.y }

  if (!shouldRender) return null

  const styles = String.raw

  return (
    <>
      <style>{styles`
        .context-menu-popover[data-context-menu-id='${menuDataId}'] {
          position: absolute;
          inset: auto;
        }
      `}</style>
      <div
        ref={menuRef}
        popover="manual"
        data-context-menu-id={menuDataId}
        className="context-menu-popover border-border bg-card text-foreground scrollbar-thin scrollbar-track-transparent z-50 max-h-[min(420px,calc(100vh-2rem))] min-w-[180px] max-w-[min(420px,calc(100vw-2rem))] overflow-auto rounded-md border p-1 shadow-lg"
        style={fallbackStyle}
      >
        {visibleItems.map((item) => {
          const isDisabled = item.disabled
          const toneClass =
            item.tone === 'destructive' ? 'text-destructive hover:bg-destructive/10' : ''
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (isDisabled) return
                item.onSelect()
                onClose()
              }}
              disabled={isDisabled}
              className={`flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
                isDisabled
                  ? 'text-muted-foreground cursor-not-allowed'
                  : `hover:bg-muted ${toneClass}`
              }`}
            >
              {item.icon && <span className="h-3.5 w-3.5">{item.icon}</span>}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

export const ContextMenuWrapper = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function ContextMenuWrapper({ children, className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-context-menu-wrapper=""
        className={clsx('relative', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

export const ContextMenuTargeter = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  function ContextMenuTargeter({ children, className, ...props }, ref) {
    return (
      <span
        ref={ref}
        data-context-menu-targeter=""
        className={className ?? 'inline-flex'}
        {...props}
      >
        {children}
      </span>
    )
  }
)
