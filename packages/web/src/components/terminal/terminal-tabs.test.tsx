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
      list: 'flex-1 items-end overflow-y-hidden pt-2',
      buttonBase:
        'z-20 w-[clamp(8.5rem,18vw,13rem)] rounded-t-[8px] border border-b-0 border-transparent px-0 py-0 transition-[color,background-color,border-color] duration-180 ease-[cubic-bezier(0.22,0.61,0.36,1)]',
      buttonInner:
        'grid h-full min-w-0 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-t-[8px] px-3 py-1.5 transition-[color,background-color,transform,filter] duration-180 ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform',
      activeButton: 'bg-transparent text-terminal-foreground',
      activeButtonInner: 'bg-transparent text-terminal-foreground [transform:translateY(0)]',
      inactiveButton:
        'bg-transparent text-terminal-foreground/72 hover:border-[color-mix(in_oklab,var(--background)_10%,transparent)] hover:text-terminal-foreground',
      inactiveButtonInner:
        'bg-terminal [filter:brightness(0.9)] [transform:translateY(0.25em)] hover:text-terminal-foreground hover:[filter:brightness(0.96)] hover:[transform:translateY(0.125em)]',
      selectionIndicatorViewport: 'inset-x-0 top-0 bottom-[-1px] overflow-visible',
      selectionIndicator:
        'border-terminal-foreground/20 border-x border-t border-b-0 bg-terminal rounded-t-[8px] shadow-[0_1px_0_var(--terminal)] duration-180 ease-[cubic-bezier(0.22,0.61,0.36,1)]',
    })
  })
})
