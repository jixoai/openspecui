import { Tabs, type TabsProps } from '../tabs'

type TerminalTabsProps = Pick<
  TabsProps,
  | 'tabs'
  | 'selectedTab'
  | 'onTabChange'
  | 'onTabClose'
  | 'onTabOrderChange'
  | 'actions'
  | 'onTabBarDoubleClick'
  | 'className'
>

const TERMINAL_CHROME_BORDER = 'border-terminal-foreground/20'
const IOS_TAB_EASE = 'ease-[cubic-bezier(0.22,0.61,0.36,1)]'

export function TerminalTabs({
  tabs,
  selectedTab,
  onTabChange,
  onTabClose,
  onTabOrderChange,
  actions,
  onTabBarDoubleClick,
  className,
}: TerminalTabsProps) {
  return (
    <Tabs
      tabs={tabs}
      selectedTab={selectedTab}
      onTabChange={onTabChange}
      onTabClose={onTabClose}
      onTabOrderChange={onTabOrderChange}
      onTabBarDoubleClick={onTabBarDoubleClick}
      actions={actions}
      className={className}
      showHeaderShell={false}
      showSelectionIndicator
      decorateStrip={false}
      selectionIndicatorLayout="overlay"
      classNames={{
        header: 'bg-terminal text-terminal-foreground',
        headerForeground: 'z-auto flex-1',
        headerFrame: 'items-end',
        strip: `min-w-0 flex-1 items-end border-b ${TERMINAL_CHROME_BORDER} px-4 rounded-none`,
        list: 'flex-1 items-end overflow-y-hidden pt-2',
        buttonBase: `z-20 rounded-t-[8px] border border-b-0 border-transparent px-0 py-0 transition-[color,background-color,border-color] duration-180 ${IOS_TAB_EASE}`,
        buttonInner: `inline-flex h-full items-center gap-2 rounded-t-[8px] px-3 py-1.5 transition-[color,background-color,transform,filter] duration-180 ${IOS_TAB_EASE} will-change-transform`,
        activeButton: 'bg-transparent text-terminal-foreground',
        activeButtonInner: 'bg-transparent text-terminal-foreground [transform:translateY(0)]',
        inactiveButton:
          'bg-transparent text-terminal-foreground/72 hover:border-[color-mix(in_oklab,var(--background)_10%,transparent)] hover:text-terminal-foreground',
        inactiveButtonInner:
          'bg-terminal [filter:brightness(0.9)] [transform:translateY(0.25em)] hover:text-terminal-foreground hover:[filter:brightness(0.96)] hover:[transform:translateY(0.125em)]',
        actions: `${TERMINAL_CHROME_BORDER} bg-terminal text-terminal-foreground border-b rounded-none px-1`,
        selectionIndicatorViewport: 'inset-x-0 top-0 bottom-[-1px] overflow-visible',
        closeButtonActive: 'text-terminal-foreground/70 hover:text-terminal-foreground',
        closeButtonInactive: 'text-terminal-foreground/50 hover:text-terminal-foreground',
        selectionIndicator: `${TERMINAL_CHROME_BORDER} border-x border-t border-b-0 bg-terminal rounded-t-[8px] shadow-[0_1px_0_var(--terminal)] duration-180 ${IOS_TAB_EASE}`,
      }}
    />
  )
}
