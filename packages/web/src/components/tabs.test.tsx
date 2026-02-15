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
    const { container } = render(
      <Tabs
        tabs={tabs}
        onTabBarDoubleClick={onTabBarDoubleClick}
      />,
    )

    const tabsButton = container.querySelector('.tabs-button')
    expect(tabsButton).not.toBeNull()

    fireEvent.doubleClick(tabsButton as Element)

    expect(onTabBarDoubleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onTabBarDoubleClick when double-clicking a tab button', () => {
    const onTabBarDoubleClick = vi.fn()
    const { container } = render(
      <Tabs
        tabs={tabs}
        onTabBarDoubleClick={onTabBarDoubleClick}
      />,
    )

    fireEvent.doubleClick(within(container).getByRole('button', { name: 'A' }))

    expect(onTabBarDoubleClick).not.toHaveBeenCalled()
  })
})
