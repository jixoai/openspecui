import { X } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ForwardedRef,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { useHeadStyle } from './use-head-style'

export interface Tab {
  id: string
  label: ReactNode
  icon?: ReactNode
  content: ReactNode
  /** Unmount the tab content when hidden to avoid heavy components lingering (e.g., Monaco) */
  unmountOnHide?: boolean
  /** Show a close button on this tab */
  closable?: boolean
  /** Close button visibility behavior */
  closeButtonVisibility?: 'hover' | 'always'
}

export type TabsVariant = 'default' | 'terminal'

interface TabsProps {
  tabs: Tab[]
  /** Controlled selected tab id */
  selectedTab?: string
  onTabChange?: (id: string) => void
  /** Called when a closable tab's close button is clicked */
  onTabClose?: (id: string) => void
  /** Called with the reordered tab id list after a drag-and-drop reorder */
  onTabOrderChange?: (orderedTabIds: string[]) => void
  /** Extra content rendered at the end of the tab bar (e.g. a "+" button) */
  actions?: ReactNode
  /** Called when the tabs bar is double-clicked (usually on empty space) */
  onTabBarDoubleClick?: () => void
  className?: string
  variant?: TabsVariant
}

export interface TabsHandle {
  root: HTMLElement | null
  getTrigger: (tabId: string) => HTMLElement | null
  getPanel: (tabId: string) => HTMLElement | null
  getHeaderShell: () => HTMLElement | null
  getHeaderForeground: () => HTMLElement | null
  getSelectionIndicator: () => HTMLElement | null
  getActiveTabId: () => string | null
}

interface DropIndicator {
  position: 'before' | 'after'
  tabId: string
}

let _draggedTabId: string | null = null

const tabsStyleText = (id: string) => {
  const anchorName = `--tabs-button-${id}`
  return String.raw`
    #${id} .tabs-button {
      anchor-name: ${anchorName};
      overflow-x: auto;
      scroll-behavior: smooth;
      overscroll-behavior-x: contain;
      scroll-snap-type: x mandatory;
      position: relative;
    }

    #${id} .tabs-button > button {
      scroll-snap-align: start;
      text-align: center;
    }

    #${id} .tabs-button::scroll-button(*) {
      position-anchor: ${anchorName};
      position: absolute;
      align-self: anchor-center;
      border: 0;
      font-size: 1.2rem;
      background: none;
      z-index: 2;
      color: currentColor;
    }

    #${id} .tabs-button::scroll-button(*):disabled {
      opacity: 0;
    }

    #${id} .tabs-button::scroll-button(left) {
      content: '◄';
      right: calc(anchor(left) - 0.5rem);
      transform: scaleX(0.5);
    }

    #${id} .tabs-button::scroll-button(right) {
      content: '►';
      left: calc(anchor(right) - 0.5rem);
      transform: scaleX(0.5);
    }

    #${id} .tabs-strip {
      background-image: linear-gradient(
        to bottom,
        transparent,
        transparent calc(100% - 1px),
        var(--border) calc(100% - 1px),
        var(--border)
      );
    }
  `
}

function buildReorderedTabIds(
  currentTabIds: readonly string[],
  draggedTabId: string,
  targetTabId: string,
  position: 'before' | 'after'
): string[] {
  if (draggedTabId === targetTabId) {
    return [...currentTabIds]
  }

  const remaining = currentTabIds.filter((tabId) => tabId !== draggedTabId)
  const targetIndex = remaining.indexOf(targetTabId)
  if (targetIndex < 0) {
    return [...currentTabIds]
  }

  const insertIndex = position === 'before' ? targetIndex : targetIndex + 1
  remaining.splice(insertIndex, 0, draggedTabId)
  return remaining
}

function buildStableContentTabIds(
  previousTabIds: readonly string[],
  currentTabIds: readonly string[]
): string[] {
  const currentTabIdSet = new Set(currentTabIds)
  const retained = previousTabIds.filter((tabId) => currentTabIdSet.has(tabId))
  const additions = currentTabIds.filter((tabId) => !retained.includes(tabId))
  return [...retained, ...additions]
}

/**
 * Tabs component with React 19 Activity for state preservation.
 * Hidden tabs are pre-rendered at lower priority and preserve their state.
 * Supports both controlled and uncontrolled active tab.
 */
function TabsImpl(
  {
    tabs,
    selectedTab: controlled,
    onTabChange,
    onTabClose,
    onTabOrderChange,
    actions,
    onTabBarDoubleClick,
    className = '',
    variant = 'default',
  }: TabsProps,
  ref: ForwardedRef<TabsHandle>
) {
  const [uncontrolled, setUncontrolled] = useState<string>(tabs[0]?.id ?? '')
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const dropIndicatorRef = useRef<DropIndicator | null>(null)
  const contentOrderRef = useRef<string[]>(tabs.map((tab) => tab.id))
  const rootRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const headerShellRef = useRef<HTMLDivElement | null>(null)
  const headerForegroundRef = useRef<HTMLDivElement | null>(null)
  const selectionIndicatorRef = useRef<HTMLDivElement | null>(null)
  const tabsButtonRef = useRef<HTMLDivElement | null>(null)
  const triggerRefs = useRef(new Map<string, HTMLButtonElement | null>())
  const panelRefs = useRef(new Map<string, HTMLDivElement | null>())
  const activeTab = controlled ?? uncontrolled
  const reorderable = typeof onTabOrderChange === 'function' && tabs.length > 1
  const tabIds = tabs.map((tab) => tab.id)
  const tabLayoutSignature = tabIds.join('|')
  const tabsById = useMemo(() => new Map(tabs.map((tab) => [tab.id, tab] as const)), [tabs])
  const contentTabIds = useMemo(() => {
    const nextOrder = buildStableContentTabIds(contentOrderRef.current, tabIds)
    contentOrderRef.current = nextOrder
    return nextOrder
  }, [tabIds])
  const contentTabs = contentTabIds
    .map((tabId) => tabsById.get(tabId))
    .filter((tab): tab is Tab => tab !== undefined)
  const id = useId().replace(/:/g, '_')
  const headStyleText = useMemo(() => tabsStyleText(id), [id])
  useHeadStyle(`tabs:${id}`, headStyleText)

  useImperativeHandle(
    ref,
    () => ({
      get root() {
        return rootRef.current
      },
      getTrigger(tabId: string) {
        return triggerRefs.current.get(tabId) ?? null
      },
      getPanel(tabId: string) {
        return panelRefs.current.get(tabId) ?? null
      },
      getHeaderShell() {
        return headerShellRef.current
      },
      getHeaderForeground() {
        return headerForegroundRef.current
      },
      getSelectionIndicator() {
        return selectionIndicatorRef.current
      },
      getActiveTabId() {
        return activeTab || null
      },
    }),
    [activeTab]
  )

  const syncSelectionIndicator = useCallback(() => {
    const indicator = selectionIndicatorRef.current
    const header = headerRef.current
    const activeTrigger = activeTab ? triggerRefs.current.get(activeTab) : null

    if (!indicator) {
      return
    }

    if (variant !== 'default' || !header || !activeTrigger) {
      indicator.style.opacity = '0'
      indicator.style.width = '0px'
      indicator.style.height = '0px'
      indicator.style.transform = 'translate(0px, 0px)'
      return
    }

    const headerRect = header.getBoundingClientRect()
    const triggerRect = activeTrigger.getBoundingClientRect()

    indicator.style.opacity = '1'
    indicator.style.width = `${triggerRect.width}px`
    indicator.style.height = `${triggerRect.height}px`
    indicator.style.transform = `translate(${triggerRect.left - headerRect.left}px, ${
      triggerRect.top - headerRect.top
    }px)`
  }, [activeTab, variant])

  useLayoutEffect(() => {
    syncSelectionIndicator()
  }, [syncSelectionIndicator, tabLayoutSignature])

  useLayoutEffect(() => {
    if (variant !== 'default') {
      return
    }

    const tabsButton = tabsButtonRef.current
    if (!tabsButton) {
      return
    }

    const handleScroll = () => {
      syncSelectionIndicator()
    }

    tabsButton.addEventListener('scroll', handleScroll, { passive: true })

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        tabsButton.removeEventListener('scroll', handleScroll)
      }
    }

    const observer = new ResizeObserver(() => {
      syncSelectionIndicator()
    })

    observer.observe(tabsButton)
    if (headerRef.current) {
      observer.observe(headerRef.current)
    }

    const activeTrigger = activeTab ? triggerRefs.current.get(activeTab) : null
    if (activeTrigger) {
      observer.observe(activeTrigger)
    }

    return () => {
      tabsButton.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [activeTab, syncSelectionIndicator, tabLayoutSignature, variant])

  const handleChange = (id: string) => {
    if (!controlled) {
      setUncontrolled(id)
    }
    onTabChange?.(id)
  }

  const updateIndicator = useCallback((indicator: DropIndicator | null) => {
    dropIndicatorRef.current = indicator
    setDropIndicator(indicator)
  }, [])

  const resetDragState = useCallback(() => {
    _draggedTabId = null
    updateIndicator(null)
  }, [updateIndicator])

  const commitReorder = useCallback(
    (targetTabId: string, position: 'before' | 'after') => {
      if (!reorderable || !_draggedTabId) {
        return
      }

      const nextTabIds = buildReorderedTabIds(tabIds, _draggedTabId, targetTabId, position)
      const changed = nextTabIds.some((tabId, index) => tabId !== tabIds[index])
      if (changed) {
        onTabOrderChange?.(nextTabIds)
      }
    },
    [onTabOrderChange, reorderable, tabIds]
  )

  const handleDragStart = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>, tabId: string) => {
      if (!reorderable || !event.dataTransfer) {
        return
      }

      _draggedTabId = tabId
      event.dataTransfer.setData('text/plain', tabId)
      event.dataTransfer.effectAllowed = 'move'
    },
    [reorderable]
  )

  const handleDragEnd = useCallback(() => {
    resetDragState()
  }, [resetDragState])

  const handleItemDragOver = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>, tabId: string) => {
      if (!reorderable || !_draggedTabId) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'

      if (tabId === _draggedTabId) {
        updateIndicator(null)
        return
      }

      const rect = event.currentTarget.getBoundingClientRect()
      const midX = rect.left + rect.width / 2
      const position: 'before' | 'after' = event.clientX < midX ? 'before' : 'after'
      updateIndicator({ tabId, position })
    },
    [reorderable, updateIndicator]
  )

  const handleItemDrop = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>, tabId: string) => {
      if (!reorderable) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      const indicator = dropIndicatorRef.current
      commitReorder(tabId, indicator?.tabId === tabId ? indicator.position : 'after')
      resetDragState()
    },
    [commitReorder, reorderable, resetDragState]
  )

  const handleListDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!reorderable) {
        return
      }

      event.preventDefault()
      if (_draggedTabId && dropIndicatorRef.current === null) {
        const remaining = tabIds.filter((tabId) => tabId !== _draggedTabId)
        remaining.push(_draggedTabId)
        const changed = remaining.some((tabId, index) => tabId !== tabIds[index])
        if (changed) {
          onTabOrderChange?.(remaining)
        }
      }
      resetDragState()
    },
    [onTabOrderChange, reorderable, resetDragState, tabIds]
  )

  const handleListDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!reorderable || !_draggedTabId) {
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    },
    [reorderable]
  )

  if (tabs.length === 0) return null

  const headerClassName =
    variant === 'terminal'
      ? 'tabs-header bg-terminal text-terminal-foreground sticky top-0 z-20 flex min-w-0 items-stretch'
      : 'tabs-header relative sticky top-0 z-20 min-w-0'

  const stripClassName =
    variant === 'terminal'
      ? 'tabs-strip min-w-0 flex-1 bg-terminal px-4'
      : 'tabs-strip min-w-0 flex-1 rounded-l-md px-4'

  const listClassName =
    variant === 'terminal'
      ? 'tabs-button scrollbar-none flex min-w-0 gap-1 overflow-x-auto pt-2'
      : 'tabs-button scrollbar-none flex min-w-0 gap-1 overflow-x-auto'

  const buttonBaseClassName = `group relative z-10 m-0 flex h-full shrink-0 items-center gap-2 px-2 text-sm font-medium transition-colors ${variant === 'terminal' ? 'rounded-t-[8px] py-1' : 'py-2'}`

  const activeButtonClassName =
    variant === 'terminal'
      ? 'tab-selected bg-background text-foreground'
      : 'tab-selected text-foreground'

  const inactiveButtonClassName =
    variant === 'terminal'
      ? 'bg-terminal text-terminal-foreground/80 hover:bg-terminal hover:text-terminal-foreground'
      : 'text-muted-foreground hover:bg-background/35 hover:text-foreground'

  const actionsClassName =
    variant === 'terminal'
      ? 'tabs-actions border-border bg-terminal text-terminal-foreground flex shrink-0 items-center border-b px-1'
      : 'tabs-actions border-zinc-500/15 flex shrink-0 items-center rounded-r-md border-l px-1'

  const handleTabBarDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onTabBarDoubleClick) return
    if ((event.target as HTMLElement).closest('[data-tab-item="true"]')) return
    onTabBarDoubleClick()
  }

  const tabButtons = tabs.map((tab) => {
    const dragIndicatorStyle: CSSProperties | undefined =
      dropIndicator?.tabId === tab.id
        ? {
            boxShadow:
              dropIndicator.position === 'before'
                ? 'inset 2px 0 0 var(--border)'
                : 'inset -2px 0 0 var(--border)',
          }
        : undefined

    return (
      <button
        key={tab.id}
        ref={(element) => {
          triggerRefs.current.set(tab.id, element)
        }}
        data-tab-item="true"
        data-tab-id={tab.id}
        draggable={reorderable}
        onClick={() => handleChange(tab.id)}
        onDragStart={(event) => handleDragStart(event, tab.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(event) => handleItemDragOver(event, tab.id)}
        onDrop={(event) => handleItemDrop(event, tab.id)}
        className={`${buttonBaseClassName} ${
          activeTab === tab.id ? activeButtonClassName : inactiveButtonClassName
        } ${reorderable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={dragIndicatorStyle}
      >
        {tab.icon}
        {tab.label}
        {tab.closable && onTabClose && (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation()
              onTabClose(tab.id)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation()
                onTabClose(tab.id)
              }
            }}
            draggable={false}
            className={`hover:text-foreground -mr-1 rounded p-0.5 transition ${
              tab.closeButtonVisibility === 'always'
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 [button:hover>&]:opacity-100'
            } ${activeTab === tab.id ? 'text-current/80' : 'text-muted-foreground'}`}
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>
    )
  })

  return (
    <div
      id={id}
      ref={rootRef}
      data-tabs-variant={variant}
      className={`relative isolate flex min-h-0 min-w-0 flex-1 flex-col ${className}`}
    >
      <div ref={headerRef} className={headerClassName}>
        {variant === 'default' ? (
          <>
            <div
              ref={headerShellRef}
              data-tabs-header-shell="true"
              className="tabs-header-shell bg-card/95 pointer-events-none absolute inset-0 z-0 rounded-md border border-zinc-500/15 shadow-[inset_0_-1px_0_color-mix(in_srgb,var(--border)_85%,transparent)] backdrop-blur-sm"
            />
            <div className="pointer-events-none absolute inset-0 z-10">
              <div
                ref={selectionIndicatorRef}
                data-tabs-selection-indicator="true"
                aria-hidden="true"
                className="tabs-selection-indicator border-primary bg-background/70 duration-280 absolute left-0 top-0 rounded-md border-b-2 opacity-0 shadow-[inset_0_-1px_0_color-mix(in_srgb,var(--border)_85%,transparent)] transition-[transform,width,height,opacity] ease-[cubic-bezier(0.22,1,0.36,1)]"
              />
            </div>
            <div
              ref={headerForegroundRef}
              data-tabs-header-foreground="true"
              className="tabs-header-foreground relative z-20 flex min-w-0 items-stretch"
            >
              <div className={stripClassName}>
                <div
                  ref={tabsButtonRef}
                  className={listClassName}
                  onDoubleClick={handleTabBarDoubleClick}
                  onDragOver={handleListDragOver}
                  onDrop={handleListDrop}
                >
                  {tabButtons}
                </div>
              </div>
              {actions && (
                <div data-tabs-actions="true" className={actionsClassName}>
                  {actions}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={stripClassName}>
              <div
                ref={tabsButtonRef}
                className={listClassName}
                onDoubleClick={handleTabBarDoubleClick}
                onDragOver={handleListDragOver}
                onDrop={handleListDrop}
              >
                {tabButtons}
              </div>
            </div>
            {actions && (
              <div data-tabs-actions="true" className={actionsClassName}>
                {actions}
              </div>
            )}
          </>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {contentTabs.map((tab) =>
          tab.unmountOnHide ? (
            activeTab === tab.id && (
              <div
                key={tab.id}
                ref={(element) => {
                  panelRefs.current.set(tab.id, element)
                }}
                data-tab-panel={tab.id}
                data-tab-panel-state="active"
                className="flex min-h-0 flex-1 flex-col"
              >
                {tab.content}
              </div>
            )
          ) : (
            <div
              key={tab.id}
              ref={(element) => {
                panelRefs.current.set(tab.id, element)
              }}
              data-tab-panel={tab.id}
              data-tab-panel-state={activeTab === tab.id ? 'active' : 'inactive'}
              aria-hidden={activeTab === tab.id ? undefined : true}
              className={
                activeTab === tab.id
                  ? 'relative flex min-h-0 flex-1 flex-col'
                  : 'pointer-events-none absolute inset-0 flex min-h-0 flex-col overflow-hidden opacity-0'
              }
            >
              {tab.content}
            </div>
          )
        )}
      </div>
    </div>
  )
}

export const Tabs = forwardRef<TabsHandle, TabsProps>(TabsImpl)
