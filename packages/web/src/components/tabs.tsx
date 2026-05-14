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
import { cn } from '../lib/utils'
import { useHeadStyle } from './use-head-style'

export interface Tab {
  id: string
  label: ReactNode
  /** Native hover title for the whole tab trigger */
  title?: string
  icon?: ReactNode
  /** Top-right adornment anchored to the whole tab trigger */
  badge?: ReactNode
  content: ReactNode
  /** Unmount the tab content when hidden to avoid heavy components lingering (e.g., Monaco) */
  unmountOnHide?: boolean
  /** Show a close button on this tab */
  closable?: boolean
  /** Close button visibility behavior */
  closeButtonVisibility?: 'hover' | 'always'
}

export interface TabsClassNames {
  header?: string
  headerShell?: string
  headerForeground?: string
  headerFrame?: string
  strip?: string
  list?: string
  buttonBase?: string
  buttonInner?: string
  activeButton?: string
  inactiveButton?: string
  activeButtonInner?: string
  inactiveButtonInner?: string
  actions?: string
  actionsDivider?: string
  closeButtonActive?: string
  closeButtonInactive?: string
  selectionTrack?: string
  selectionIndicatorViewport?: string
  selectionIndicator?: string
}

export type TabsSelectionIndicatorLayout = 'underline' | 'overlay'

export interface TabsProps {
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
  classNames?: TabsClassNames
  showHeaderShell?: boolean
  showSelectionIndicator?: boolean
  decorateStrip?: boolean
  selectionIndicatorLayout?: TabsSelectionIndicatorLayout
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
      z-index: 100;
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
    classNames,
    showHeaderShell = true,
    showSelectionIndicator = true,
    decorateStrip = true,
    selectionIndicatorLayout = 'underline',
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
  const headerFrameRef = useRef<HTMLDivElement | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)
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
        return headerShellRef.current ?? stripRef.current
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
    const strip = stripRef.current ?? headerFrameRef.current
    const activeTrigger = activeTab ? triggerRefs.current.get(activeTab) : null

    if (!indicator) {
      return
    }

    if (!showSelectionIndicator || !strip || !activeTrigger) {
      indicator.style.opacity = '0'
      indicator.style.width = '0px'
      indicator.style.height = selectionIndicatorLayout === 'overlay' ? '0px' : ''
      indicator.style.transform =
        selectionIndicatorLayout === 'overlay' ? 'translate(0px, 0px)' : 'translateX(0px)'
      return
    }

    const stripRect = strip.getBoundingClientRect()
    const triggerRect = activeTrigger.getBoundingClientRect()

    if (selectionIndicatorLayout === 'underline') {
      const indicatorStyle = getComputedStyle(indicator)
      const inlineInset =
        parseFloat(indicatorStyle.getPropertyValue('--tabs-selection-inline-inset')) || 10
      const minWidth =
        parseFloat(indicatorStyle.getPropertyValue('--tabs-selection-min-width')) || 40
      const width = Math.max(minWidth, triggerRect.width - inlineInset * 2)
      const translateX = triggerRect.left - stripRect.left + (triggerRect.width - width) / 2

      indicator.style.opacity = '1'
      indicator.style.width = `${width}px`
      indicator.style.height = ''
      indicator.style.transform = `translateX(${translateX}px)`
      return
    }

    indicator.style.opacity = '1'
    indicator.style.width = `${triggerRect.width}px`
    indicator.style.height = `${triggerRect.height + 1}px`
    indicator.style.transform = `translate(${triggerRect.left - stripRect.left}px, ${
      triggerRect.top - stripRect.top
    }px)`
  }, [activeTab, selectionIndicatorLayout, showSelectionIndicator])

  useLayoutEffect(() => {
    syncSelectionIndicator()
  }, [syncSelectionIndicator, tabs])

  useLayoutEffect(() => {
    if (!showSelectionIndicator) {
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
    if (stripRef.current) {
      observer.observe(stripRef.current)
    }
    if (headerFrameRef.current) {
      observer.observe(headerFrameRef.current)
    }

    const activeTrigger = activeTab ? triggerRefs.current.get(activeTab) : null
    if (activeTrigger) {
      observer.observe(activeTrigger)
    }

    return () => {
      tabsButton.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [activeTab, showSelectionIndicator, syncSelectionIndicator, tabLayoutSignature])

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

  const headerClassName = cn(
    'tabs-header relative sticky top-0 z-20 flex min-w-0 items-stretch',
    classNames?.header
  )

  const headerShellClassName = cn(
    selectionIndicatorLayout === 'underline'
      ? 'tabs-header-shell bg-card/95 pointer-events-none absolute inset-0 z-0 rounded-t-md rounded-b-none border border-b-0 border-zinc-500/15 backdrop-blur-sm'
      : 'tabs-header-shell bg-card/95 pointer-events-none absolute inset-0 z-0 rounded-md border border-zinc-500/15 shadow-[inset_0_-1px_0_color-mix(in_srgb,var(--border)_85%,transparent)] backdrop-blur-sm',
    classNames?.headerShell
  )

  const headerForegroundClassName = cn(
    'tabs-header-foreground relative z-20 flex min-w-0 flex-1',
    classNames?.headerForeground
  )

  const headerFrameClassName = cn(
    'tabs-header-frame relative flex min-w-0 flex-1 items-stretch',
    classNames?.headerFrame
  )

  const stripClassName = cn(
    'tabs-strip relative flex min-w-0 flex-1 items-stretch px-4',
    classNames?.strip
  )

  const listClassName = cn(
    'tabs-button scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto',
    classNames?.list
  )

  const buttonBaseClassName = cn(
    'group relative z-10 m-0 flex h-full shrink-0 px-2 py-2 text-sm font-medium transition-colors',
    classNames?.buttonBase
  )

  const buttonInnerClassName = cn(
    'inline-flex h-full items-center gap-2 relative',
    classNames?.buttonInner
  )

  const activeButtonClassName = cn('tab-selected text-foreground', classNames?.activeButton)

  const inactiveButtonClassName = cn(
    'text-muted-foreground hover:text-foreground',
    classNames?.inactiveButton
  )

  const activeButtonInnerClassName = cn(classNames?.activeButtonInner)

  const inactiveButtonInnerClassName = cn(classNames?.inactiveButtonInner)

  const actionsClassName = cn(
    'tabs-actions relative flex shrink-0 items-center px-1',
    classNames?.actions
  )

  const actionsDividerClassName = cn(
    'tabs-actions-divider bg-border/60 absolute inset-y-0 left-0 w-px',
    classNames?.actionsDivider
  )

  const selectionTrackClassName = cn(
    'tabs-selection-track bg-border/85 pointer-events-none absolute inset-x-0 bottom-0 h-px',
    classNames?.selectionTrack
  )

  const selectionIndicatorViewportClassName = cn(
    selectionIndicatorLayout === 'underline'
      ? 'pointer-events-none absolute inset-x-0 top-0 bottom-[-1px] z-10 overflow-hidden'
      : 'pointer-events-none absolute inset-0 z-10 overflow-hidden',
    classNames?.selectionIndicatorViewport
  )

  const selectionIndicatorClassName = cn(
    selectionIndicatorLayout === 'underline'
      ? 'tabs-selection-indicator absolute bottom-0 left-0 h-[3px] rounded-full bg-primary opacity-0 transition-[transform,width,opacity] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)] [--tabs-selection-inline-inset:10px] [--tabs-selection-min-width:40px]'
      : 'tabs-selection-indicator border-primary bg-background/70 duration-280 absolute left-0 top-0 border-b opacity-0 transition-[transform,width,height,opacity] ease-[cubic-bezier(0.22,1,0.36,1)]',
    classNames?.selectionIndicator
  )

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
        title={tab.title}
      >
        <span
          data-tabs-button-inner="true"
          className={`${buttonInnerClassName} ${
            activeTab === tab.id ? activeButtonInnerClassName : inactiveButtonInnerClassName
          }`}
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
              className={`-mr-1 rounded p-0.5 transition ${
                tab.closeButtonVisibility === 'always'
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 [button:hover>&]:opacity-100'
              } ${
                activeTab === tab.id
                  ? cn('text-current/80 hover:text-foreground', classNames?.closeButtonActive)
                  : cn(
                      'text-muted-foreground hover:text-foreground',
                      classNames?.closeButtonInactive
                    )
              }`}
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </span>
        {tab.badge && (
          <span data-tabs-badge="true" className="pointer-events-none absolute right-0 top-0 z-30">
            {tab.badge}
          </span>
        )}
      </button>
    )
  })

  return (
    <div
      id={id}
      ref={rootRef}
      data-tabs-strip-decoration={decorateStrip ? 'on' : 'off'}
      className={`relative isolate flex min-h-0 min-w-0 flex-1 flex-col ${className}`}
    >
      <div ref={headerRef} className={headerClassName}>
        <>
          {showHeaderShell && (
            <div
              ref={headerShellRef}
              data-tabs-header-shell="true"
              className={headerShellClassName}
            />
          )}
          <div
            ref={headerForegroundRef}
            data-tabs-header-foreground="true"
            className={headerForegroundClassName}
          >
            <div ref={headerFrameRef} className={headerFrameClassName}>
              <div ref={stripRef} className={stripClassName}>
                <div
                  ref={tabsButtonRef}
                  className={listClassName}
                  onDoubleClick={handleTabBarDoubleClick}
                  onDragOver={handleListDragOver}
                  onDrop={handleListDrop}
                >
                  {tabButtons}
                </div>
                {showSelectionIndicator && (
                  <div className={selectionIndicatorViewportClassName}>
                    <div
                      ref={selectionIndicatorRef}
                      data-tabs-selection-indicator="true"
                      aria-hidden="true"
                      className={selectionIndicatorClassName}
                    />
                  </div>
                )}
              </div>
              {actions && (
                <div data-tabs-actions="true" className={actionsClassName}>
                  {decorateStrip && <div aria-hidden="true" className={actionsDividerClassName} />}
                  {actions}
                </div>
              )}
              {decorateStrip && <div aria-hidden="true" className={selectionTrackClassName} />}
            </div>
          </div>
        </>
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
