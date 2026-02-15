import { navController, type TabId } from '@/lib/nav-controller'
import { useNavLayout } from '@/lib/use-nav-controller'
import { Link } from '@tanstack/react-router'
import { GripVertical } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { allNavItems, type NavItem } from './nav-items'

interface AreaNavProps {
  area: 'main' | 'bottom'
  tabs: readonly TabId[]
  /** Additional className for the root <ul> (e.g. "h-full" to fill container) */
  className?: string
  /** Force all items to render as <Link> instead of <button> for bottom area (mobile) */
  useLinks?: boolean
  /** Called after an item is clicked/navigated to (e.g. to close mobile menu) */
  onNavigate?: () => void
}

// Module-level: track which tab is currently being dragged (shared between AreaNav instances)
let _draggedTabId: TabId | null = null

/**
 * Draggable nav section for an area.
 * Uses HTML5 Drag and Drop to move tabs between areas and reorder within an area.
 */
export function AreaNav({ area, tabs, className, useLinks, onNavigate }: AreaNavProps) {
  const [dragOverArea, setDragOverArea] = useState(false)
  const [dropIndicator, setDropIndicator] = useState<{
    index: number
    position: 'before' | 'after'
  } | null>(null)
  const dropIndicatorRef = useRef<{ index: number; position: 'before' | 'after' } | null>(null)
  const { bottomLocation } = useNavLayout()

  const activeBottomTabId =
    area === 'bottom'
      ? (tabs.find(
          (t) => bottomLocation.pathname === t || bottomLocation.pathname.startsWith(t + '/')
        ) ?? null)
      : null

  const updateIndicator = useCallback(
    (value: { index: number; position: 'before' | 'after' } | null) => {
      dropIndicatorRef.current = value
      setDropIndicator(value)
    },
    []
  )

  const handleDragStart = useCallback((e: React.DragEvent, tabId: TabId) => {
    if (!e.dataTransfer) return
    _draggedTabId = tabId
    e.dataTransfer.setData('text/plain', tabId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragEnd = useCallback(() => {
    _draggedTabId = null
  }, [])

  const handleAreaDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverArea(true)
  }, [])

  const handleAreaDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOverArea(false)
        updateIndicator(null)
      }
    },
    [updateIndicator]
  )

  const handleItemDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'

      // Don't show indicator on the item being dragged (same-area no-op)
      if (tabs[index] === _draggedTabId) {
        updateIndicator(null)
        return
      }

      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const position: 'before' | 'after' = e.clientY < midY ? 'before' : 'after'
      updateIndicator({ index, position })
      setDragOverArea(true)
    },
    [tabs, updateIndicator]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const tabId = e.dataTransfer.getData('text/plain') as TabId
      const indicator = dropIndicatorRef.current
      setDragOverArea(false)
      updateIndicator(null)
      _draggedTabId = null

      if (!tabId) return

      const isFromThisArea = tabs.includes(tabId)
      // Read target tab id from indicator (using pre-mutation tabs)
      const targetTab = indicator != null ? tabs[indicator.index] : undefined

      if (!isFromThisArea) {
        navController.moveTab(tabId, area)
      }

      // Reorder to place at the correct position
      if (targetTab && targetTab !== tabId) {
        const currentTabs = [
          ...(area === 'main' ? navController.mainTabs : navController.bottomTabs),
        ]
        const remaining = currentTabs.filter((t) => t !== tabId)
        const targetIndex = remaining.indexOf(targetTab)
        if (targetIndex >= 0) {
          const insertIndex = indicator!.position === 'before' ? targetIndex : targetIndex + 1
          remaining.splice(insertIndex, 0, tabId)
          navController.reorder(area, remaining)
        }
      }
    },
    [area, tabs, updateIndicator]
  )

  const items = tabs
    .map((tabId) => allNavItems.find((n) => n.to === tabId))
    .filter(Boolean) as NavItem[]

  const shouldUseLink = area === 'main' || useLinks

  return (
    <ul
      className={`min-h-[2rem] space-y-1 ${dragOverArea ? 'bg-muted/50 rounded-md' : ''} ${className ?? ''}`}
      onDragOver={handleAreaDragOver}
      onDragLeave={handleAreaDragLeave}
      onDrop={handleDrop}
    >
      {items.map((item, index) => {
        const isActiveBottom = area === 'bottom' && item.to === activeBottomTabId
        const showLineBefore = dropIndicator?.index === index && dropIndicator.position === 'before'
        const showLineAfter = dropIndicator?.index === index && dropIndicator.position === 'after'

        return (
          <li
            key={item.to}
            draggable
            onDragStart={(e) => handleDragStart(e, item.to as TabId)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleItemDragOver(e, index)}
            className="group relative cursor-grab"
          >
            {showLineBefore && (
              <div className="bg-border -top-0.25 pointer-events-none absolute left-4 right-4 h-0.5 -translate-y-0.5 rounded" />
            )}
            {shouldUseLink ? (
              <Link
                to={item.to}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onClick={onNavigate}
                className="hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground flex items-center gap-2 rounded-md px-3 py-2"
              >
                <GripVertical className="-ml-2.5 -mr-1.5 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40" />
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="font-nav text-base tracking-[0.04em]">{item.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (isActiveBottom) {
                    navController.deactivateBottom()
                  } else {
                    navController.activateBottom(item.to)
                  }
                  onNavigate?.()
                }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left ${
                  isActiveBottom ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <GripVertical className="-ml-2.5 -mr-1.5 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40" />
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="font-nav text-base tracking-[0.04em]">{item.label}</span>
              </button>
            )}

            {showLineAfter && (
              <div className="bg-border -bottom-0.25 pointer-events-none absolute left-4 right-4 h-0.5 translate-y-0.5 rounded" />
            )}
          </li>
        )
      })}
    </ul>
  )
}
