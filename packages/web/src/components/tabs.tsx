import { X } from 'lucide-react'
import {
  Activity,
  useId,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'

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

interface TabsProps {
  tabs: Tab[]
  /** Controlled selected tab id */
  selectedTab?: string
  onTabChange?: (id: string) => void
  /** Called when a closable tab's close button is clicked */
  onTabClose?: (id: string) => void
  /** Extra content rendered at the end of the tab bar (e.g. a "+" button) */
  actions?: ReactNode
  /** Called when the tabs bar is double-clicked (usually on empty space) */
  onTabBarDoubleClick?: () => void
  className?: string
}

const tabsStyle = (id: string) => {
  const css = String.raw
  const anchorName = `--tabs-button-${id}`
  return (
    <style>
      {css`
        #${id} {
          .tabs-button {
            anchor-name: ${anchorName};
          }
          .tabs-button::scroll-button(*) {
            position-anchor: ${anchorName};
          }
        }
      ` +
        css`
          #${id} {
            .tabs-button {
              overflow-x: auto;
              scroll-behavior: smooth;
              overscroll-behavior-x: contain;
              scroll-snap-type: x mandatory;
              position: relative;
              & > button {
                scroll-snap-align: start;
                text-align: center;
                &.tab-selected {
                  background-image: linear-gradient(
                    to bottom,
                    transparent,
                    transparent calc(100% - 2px),
                    var(--primary) calc(100% - 2px),
                    var(--primary)
                  );
                }
              }
            }
            .tabs-strip {
              background-image: linear-gradient(
                to bottom,
                transparent,
                transparent calc(100% - 1px),
                var(--border) calc(100% - 1px),
                var(--border)
              );
            }
            .tabs-button::scroll-button(*) {
              position: absolute;
              align-self: anchor-center;
              border: 0;
              font-size: 1.2rem;
              background: none;
              z-index: 2;
              color: currentColor;
            }
            .tabs-button::scroll-button(*):disabled {
              opacity: 0;
            }
            .tabs-button::scroll-button(left) {
              content: '◄';
              right: calc(anchor(left) - 0.5rem);
              transform: scaleX(0.5);
            }

            .tabs-button::scroll-button(right) {
              content: '►';
              left: calc(anchor(right) - 0.5rem);
              transform: scaleX(0.5);
            }
          }
        `}
    </style>
  )
}

/**
 * Tabs component with React 19 Activity for state preservation.
 * Hidden tabs are pre-rendered at lower priority and preserve their state.
 * Supports both controlled and uncontrolled active tab.
 */
export function Tabs({
  tabs,
  selectedTab: controlled,
  onTabChange,
  onTabClose,
  actions,
  onTabBarDoubleClick,
  className = '',
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState<string>(tabs[0]?.id ?? '')
  const activeTab = controlled ?? uncontrolled

  const handleChange = (id: string) => {
    if (!controlled) {
      setUncontrolled(id)
    }
    onTabChange?.(id)
  }

  if (tabs.length === 0) return null

  const id = useId()

  const style = useMemo(() => tabsStyle(id), [id])
  const handleTabBarDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onTabBarDoubleClick) return
    if ((e.target as HTMLElement).closest('[data-tab-item="true"]')) return
    onTabBarDoubleClick()
  }

  return (
    <div id={id} className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${className}`}>
      {style}
      {/* Tab header: scrollable tabs + fixed actions */}
      <div className="z-2 bg-background sticky top-0 flex min-w-0 items-stretch">
        <div className="tabs-strip min-w-0 flex-1 px-4">
          <div
            className="tabs-button scrollbar-none flex min-w-0 gap-1 overflow-x-auto"
            onDoubleClick={handleTabBarDoubleClick}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                data-tab-item="true"
                onClick={() => handleChange(tab.id)}
                className={`m-0 flex h-full shrink-0 items-center gap-2 px-2 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'tab-selected text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.closable && onTabClose && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onTabClose(tab.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation()
                        onTabClose(tab.id)
                      }
                    }}
                    className={`text-muted-foreground hover:text-foreground -mr-1 rounded p-0.5 transition ${
                      tab.closeButtonVisibility === 'always'
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100 [button:hover>&]:opacity-100'
                    }`}
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        {actions && (
          <div className="border-border bg-background flex shrink-0 items-center border-b px-1">
            {actions}
          </div>
        )}
      </div>

      {/* Tab content with Activity for state preservation */}
      {tabs.map((tab) =>
        tab.unmountOnHide ? (
          activeTab === tab.id && (
            <div key={tab.id} className="flex min-h-0 flex-1 flex-col">
              {tab.content}
            </div>
          )
        ) : (
          <Activity key={tab.id} mode={activeTab === tab.id ? 'visible' : 'hidden'}>
            <div className="flex min-h-0 flex-1 flex-col">{tab.content}</div>
          </Activity>
        )
      )}
    </div>
  )
}
