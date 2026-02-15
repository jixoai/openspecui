import { navController, type TabId } from '@/lib/nav-controller'
import { Link } from '@tanstack/react-router'
import { GripVertical } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { allNavItems, type NavItem } from './nav-items'

interface AreaNavProps {
  area: 'main' | 'bottom'
  tabs: readonly TabId[]
}

/**
 * Draggable nav section for an area.
 * Uses HTML5 Drag and Drop to move tabs between main and bottom areas.
 */
export function AreaNav({ area, tabs }: AreaNavProps) {
  const [dragOverArea, setDragOverArea] = useState(false)
  const dragSourceRef = useRef<TabId | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, tabId: TabId) => {
    dragSourceRef.current = tabId
    e.dataTransfer.setData('text/plain', tabId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverArea(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverArea(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOverArea(false)
      const tabId = e.dataTransfer.getData('text/plain') as TabId
      if (tabId) {
        navController.moveTab(tabId, area)
      }
    },
    [area]
  )

  const items = tabs
    .map((tabId) => allNavItems.find((n) => n.to === tabId))
    .filter(Boolean) as NavItem[]

  return (
    <ul
      className={`space-y-1 ${dragOverArea ? 'bg-muted/50 rounded-md' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {items.map((item) => (
        <li key={item.to} className="group">
          {area === 'main' ? (
            <div className="flex items-center">
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, item.to as TabId)}
                className="cursor-grab opacity-0 group-hover:opacity-40 hover:opacity-80 p-0.5"
              >
                <GripVertical className="h-3 w-3" />
              </div>
              <Link
                to={item.to}
                className="hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground flex flex-1 items-center gap-2 rounded-md px-2 py-2"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="font-nav text-base tracking-[0.04em]">{item.label}</span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center">
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, item.to as TabId)}
                className="cursor-grab opacity-0 group-hover:opacity-40 hover:opacity-80 p-0.5"
              >
                <GripVertical className="h-3 w-3" />
              </div>
              <button
                type="button"
                onClick={() => navController.activateBottom(item.to)}
                className="hover:bg-muted flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-left"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="font-nav text-base tracking-[0.04em]">{item.label}</span>
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
