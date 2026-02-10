import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

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
  position: { x: number; y: number } | null
  onClose: () => void
}

export function ContextMenu({ open, items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [adjustedPosition, setAdjustedPosition] = useState<{ x: number; y: number } | null>(null)

  const visibleItems = useMemo(() => items.filter((item) => item.label.length > 0), [items])
  const shouldRender = open && !!position && visibleItems.length > 0

  useLayoutEffect(() => {
    if (!open || !position) {
      setAdjustedPosition(null)
      return
    }
    const menu = menuRef.current
    if (!menu) {
      setAdjustedPosition(position)
      return
    }

    const rect = menu.getBoundingClientRect()
    const margin = 12
    const maxX = window.innerWidth - rect.width - margin
    const maxY = window.innerHeight - rect.height - margin

    const x = Math.max(margin, Math.min(position.x, maxX))
    const y = Math.max(margin, Math.min(position.y, maxY))
    setAdjustedPosition({ x, y })
  }, [open, position])

  useEffect(() => {
    const menu = menuRef.current
    if (!menu || !open) return

    const handleToggle = (event: Event) => {
      if (!(event instanceof Event)) return
      // Popover toggle events include newState when supported.
      const target = event.target
      if (target instanceof HTMLElement && !target.matches(':popover-open')) {
        onClose()
      }
    }

    const handleScroll = () => onClose()

    menu.addEventListener('toggle', handleToggle)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)

    return () => {
      menu.removeEventListener('toggle', handleToggle)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [open, onClose])

  const menuStyle =
    adjustedPosition ??
    position ?? {
      x: 0,
      y: 0,
    }
  const menuStyleValues = { left: menuStyle.x, top: menuStyle.y }

  useEffect(() => {
    const menu = menuRef.current as (HTMLDivElement & {
      showPopover?: () => void
      hidePopover?: () => void
    }) | null
    if (!menu) return
    if (shouldRender) {
      if (!menu.matches(':popover-open')) {
        menu.showPopover?.()
      }
    } else {
      if (menu.matches(':popover-open')) {
        menu.hidePopover?.()
      }
    }
  }, [shouldRender, position, adjustedPosition])

  const styles = String.raw

  if (!shouldRender) return null

  return (
    <>
      <style>{styles`
        .context-menu-anchor {
          position: fixed;
          width: 1px;
          height: 1px;
          anchor-name: --context-menu-anchor;
          pointer-events: none;
          z-index: 50;
        }
        .context-menu-popover {
          position: fixed;
          inset: auto;
        }
        @supports (position-anchor: --context-menu-anchor) {
          .context-menu-popover {
            position-anchor: --context-menu-anchor;
            top: anchor(bottom);
            left: anchor(left);
          }
        }
      `}</style>
      <div
        ref={anchorRef}
        className="context-menu-anchor"
        style={menuStyleValues}
        aria-hidden
      />
      <div
        ref={menuRef}
        popover="auto"
        className="context-menu-popover border-border bg-card text-foreground z-50 min-w-[180px] rounded-md border p-1 shadow-lg"
        style={menuStyleValues}
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
