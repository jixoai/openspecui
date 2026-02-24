import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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

function toLocalPointStyle(
  point: { x: number; y: number },
  wrapperElement?: HTMLElement | null
): CSSProperties {
  if (!wrapperElement) {
    return { position: 'fixed', left: point.x, top: point.y }
  }
  const rect = wrapperElement.getBoundingClientRect()
  return {
    position: 'absolute',
    left: point.x - rect.left + wrapperElement.scrollLeft,
    top: point.y - rect.top + wrapperElement.scrollTop,
  }
}

function getPlacement(
  anchor: ContextMenuAnchor | null
): 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' {
  if (anchor?.type === 'target') return anchor.placement ?? 'bottom-start'
  return 'bottom-start'
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
  const anchorName = `--context-menu-anchor-${menuId}`
  const menuDataId = `context-menu-${menuId}`
  const placement = getPlacement(activeAnchor)

  const visibleItems = useMemo(() => items.filter((item) => item.label.length > 0), [items])
  const shouldRender = open && !!anchorPosition && visibleItems.length > 0

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
    const clamped = clampWithinBounds(anchorPosition, menu.getBoundingClientRect(), boundaryRect)
    setAdjustedPosition(clamped)
  }, [anchorPosition, hostElement, open])

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
    const previousAnchorName = target.style.getPropertyValue('anchor-name')
    const previousPriority = target.style.getPropertyPriority('anchor-name')
    target.style.setProperty('anchor-name', anchorName)

    return () => {
      if (previousAnchorName) {
        target.style.setProperty('anchor-name', previousAnchorName, previousPriority)
      } else {
        target.style.removeProperty('anchor-name')
      }
    }
  }, [activeAnchor, anchorName, open])

  const resolvedPosition = adjustedPosition ?? anchorPosition
  const fallbackStyle =
    resolvedPosition === null
      ? { left: 0, top: 0 }
      : { left: resolvedPosition.x, top: resolvedPosition.y }

  const syntheticAnchorStyle =
    activeAnchor?.type === 'point' && anchorPosition
      ? toLocalPointStyle(anchorPosition, hostElement)
      : null

  useEffect(() => {
    const menu = menuRef.current as
      | (HTMLDivElement & {
          showPopover?: () => void
          hidePopover?: () => void
        })
      | null
    if (!menu) return
    if (shouldRender) {
      if (!menu.matches(':popover-open')) {
        menu.showPopover?.()
      }
    } else if (menu.matches(':popover-open')) {
      menu.hidePopover?.()
    }
  }, [shouldRender])

  if (!shouldRender) return null

  const styles = String.raw

  const anchorPlacementCSS =
    placement === 'top-start'
      ? 'bottom: anchor(top); left: anchor(left); top: auto; right: auto;'
      : placement === 'top-end'
        ? 'bottom: anchor(top); left: anchor(right); top: auto; right: auto;'
        : placement === 'bottom-end'
          ? 'top: anchor(bottom); left: anchor(right); bottom: auto; right: auto;'
          : 'top: anchor(bottom); left: anchor(left); bottom: auto; right: auto;'

  return (
    <>
      <style>{styles`
        .context-menu-anchor[data-context-menu-id='${menuDataId}'] {
          width: 1px;
          height: 1px;
          pointer-events: none;
          z-index: 50;
          anchor-name: ${anchorName};
        }
        .context-menu-popover[data-context-menu-id='${menuDataId}'] {
          position: absolute;
          inset: auto;
        }
        @supports (position-anchor: ${anchorName}) {
          .context-menu-popover[data-context-menu-id='${menuDataId}'] {
            position-anchor: ${anchorName};
            ${anchorPlacementCSS}
          }
        }
        @supports (position-try-fallbacks: --context-menu-right-bottom) {
          @position-try --context-menu-right-bottom {
            top: anchor(bottom);
            left: anchor(right);
            right: auto;
            bottom: auto;
          }
          @position-try --context-menu-left-bottom {
            top: anchor(bottom);
            right: anchor(left);
            left: auto;
            bottom: auto;
          }
          @position-try --context-menu-left-top {
            bottom: anchor(top);
            right: anchor(left);
            left: auto;
            top: auto;
          }
          @position-try --context-menu-right-top {
            bottom: anchor(top);
            left: anchor(right);
            right: auto;
            top: auto;
          }
          .context-menu-popover[data-context-menu-id='${menuDataId}'] {
            position-try-fallbacks:
              --context-menu-right-bottom,
              --context-menu-left-bottom,
              --context-menu-left-top,
              --context-menu-right-top;
          }
        }
      `}</style>
      {syntheticAnchorStyle && (
        <div
          data-context-menu-id={menuDataId}
          className="context-menu-anchor"
          style={syntheticAnchorStyle}
          aria-hidden
        />
      )}
      <div
        ref={menuRef}
        popover="manual"
        data-context-menu-id={menuDataId}
        className="context-menu-popover border-border bg-card text-foreground z-50 min-w-[180px] rounded-md border p-1 shadow-lg"
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
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
                isDisabled
                  ? 'text-muted-foreground cursor-not-allowed'
                  : `hover:bg-muted ${toneClass}`
              }`}
            >
              {item.icon && <span className="h-3.5 w-3.5">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

export const ContextMenuWrapper = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function ContextMenuWrapper({ children, className, ...props }, ref) {
    const mergedClassName = className ? `relative ${className}` : 'relative'
    return (
      <div ref={ref} data-context-menu-wrapper="" className={mergedClassName} {...props}>
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
