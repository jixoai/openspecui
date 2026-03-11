import { fireEvent, render, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs, type Tab } from './tabs'

const tabs: Tab[] = [
  { id: 'a', label: 'A', content: <div>A content</div> },
  { id: 'b', label: 'B', content: <div>B content</div> },
]

describe('Tabs double-click behavior', () => {
  it('calls onTabBarDoubleClick when double-clicking tab bar empty area', () => {
    const onTabBarDoubleClick = vi.fn()
    const { container } = render(<Tabs tabs={tabs} onTabBarDoubleClick={onTabBarDoubleClick} />)

    const tabsButton = container.querySelector('.tabs-button')
    expect(tabsButton).not.toBeNull()

    fireEvent.doubleClick(tabsButton as Element)

    expect(onTabBarDoubleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onTabBarDoubleClick when double-clicking a tab button', () => {
    const onTabBarDoubleClick = vi.fn()
    const { container } = render(<Tabs tabs={tabs} onTabBarDoubleClick={onTabBarDoubleClick} />)

    fireEvent.doubleClick(within(container).getByRole('button', { name: 'A' }))

    expect(onTabBarDoubleClick).not.toHaveBeenCalled()
  })

  it('supports the terminal variant used by the hosted shell', () => {
    const { container } = render(
      <Tabs
        tabs={tabs}
        variant="terminal"
        selectedTab="a"
        actions={<button type="button">+</button>}
      />
    )

    const root = container.firstElementChild
    expect(root?.getAttribute('data-tabs-variant')).toBe('terminal')

    const selected = within(container).getByRole('button', { name: 'A' })
    expect(selected.className).toContain('bg-background')
    expect(selected.className).toContain('text-foreground')
    expect(selected.className).toContain('rounded-t-[8px]')

    const unselected = within(container).getByRole('button', { name: 'B' })
    expect(unselected.className).toContain('bg-terminal')
    expect(unselected.className).toContain('text-terminal-foreground')

    const actions = container.querySelector('[data-tabs-actions="true"]')
    expect(actions?.className).toContain('bg-terminal')
  })
})
