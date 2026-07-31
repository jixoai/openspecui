/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove TerminalTabs projects shared Tabs through terminal-palette chrome.
 * 2. Prove fixed-width tab items contain sibling actions without widening the page owner or splitting their surface color.
 * 3. Prove tab foreground content remains above the animated selection surface without vertical strip scrolling.
 *
 * Owner direction (2026-07-29): Workspace tabs expose an Open in browser icon button.
 * Owner correction (2026-07-31): "Workspaces-tabs-bar 的背景色和前景色有问题"
 * Owner correction (2026-07-31): The Workspace background fills its complete tab item.
 * Owner correction (2026-07-31): Close has hover-only chrome and the tabs container cannot scroll vertically.
 */
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TerminalTabs } from './terminal-tabs'

const tabsPropsSpy = vi.hoisted(() => vi.fn())

vi.mock('@/components/tabs', () => ({
  Tabs: (props: {
    showHeaderShell?: boolean
    showSelectionIndicator?: boolean
    decorateStrip?: boolean
    classNames?: Record<string, string | undefined>
    actions?: ReactNode
    onTabOrderChange?: (orderedTabIds: string[]) => void
  }) => {
    tabsPropsSpy(props)
    return <div data-testid="tabs-root">{props.actions}</div>
  },
}))

describe('TerminalTabs', () => {
  it('configures shared Tabs with terminal-specific chrome styling', () => {
    render(
      <TerminalTabs
        tabs={[
          { id: 'a', label: 'A', content: <div>A</div> },
          { id: 'b', label: 'B', content: <div>B</div> },
        ]}
        selectedTab="a"
        onTabOrderChange={() => {}}
        actions={<button type="button">+</button>}
      />
    )

    expect(tabsPropsSpy).toHaveBeenCalledTimes(1)
    expect(tabsPropsSpy.mock.calls[0]?.[0].showHeaderShell).toBe(false)
    expect(tabsPropsSpy.mock.calls[0]?.[0].showSelectionIndicator).toBe(true)
    expect(tabsPropsSpy.mock.calls[0]?.[0].decorateStrip).toBe(false)
    expect(tabsPropsSpy.mock.calls[0]?.[0].selectionIndicatorLayout).toBe('overlay')
    expect(tabsPropsSpy.mock.calls[0]?.[0].classNames).toMatchObject({
      header: 'bg-terminal text-terminal-foreground',
      headerForeground: 'z-auto flex-1',
      headerFrame: 'items-end',
      strip: 'min-w-0 flex-1 items-end border-b border-terminal-foreground/20 px-4 rounded-none',
      list: 'flex-1 items-end overflow-y-clip pt-2 [&::scroll-button(*)]:mt-3',
      item: 'z-20 w-[clamp(8.5rem,18vw,13rem)] rounded-t-[8px] transition-[background-color,transform,filter] duration-180 ease-[cubic-bezier(0.22,0.61,0.36,1)]',
      activeItem: 'bg-transparent [filter:brightness(1)] [transform:translateY(0)]',
      inactiveItem: 'bg-terminal [filter:brightness(0.9)] hover:[filter:brightness(0.96)]',
      buttonBase:
        'z-20 rounded-tl-[8px] border border-b-0 border-transparent px-0 py-0 transition-[color,background-color,border-color] duration-180 ease-[cubic-bezier(0.22,0.61,0.36,1)]',
      buttonInner:
        'grid h-full min-w-0 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-t-[8px] px-3 py-1.5 transition-[color,background-color,transform,filter] duration-180 ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform',
      activeButton: 'bg-transparent text-terminal-foreground',
      activeButtonInner: 'bg-transparent text-terminal-foreground [transform:translateY(0)]',
      inactiveButton:
        'bg-transparent text-terminal-foreground/72 hover:border-[color-mix(in_oklab,var(--background)_10%,transparent)] hover:text-terminal-foreground',
      inactiveButtonInner: 'hover:text-terminal-foreground',
      tabActions: 'px-0.5',
      closeButtonActive:
        'h-6 w-[23px] self-center [--tabs-close-radius:6px_0_0_6px] bg-transparent text-terminal-foreground/70 hover:bg-terminal-foreground/20 hover:text-terminal-foreground',
      closeButtonInactive:
        'h-6 w-[23px] self-center [--tabs-close-radius:6px_0_0_6px] bg-transparent text-terminal-foreground/50 hover:bg-terminal-foreground/20 hover:text-terminal-foreground',
      selectionIndicatorViewport:
        'inset-x-0 top-0 bottom-[-1px] overflow-visible overflow-x-hidden',
      selectionIndicator:
        'border-terminal-foreground/20 border-x border-t border-b-0 bg-terminal rounded-t-[8px] shadow-[0_1px_0_var(--terminal)] duration-180 ease-[cubic-bezier(0.22,0.61,0.36,1)]',
    })
  })
})
