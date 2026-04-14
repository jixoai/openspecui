import { createEvent, fireEvent, render, within } from '@testing-library/react'
import { createRef, useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs, type Tab, type TabsHandle } from './tabs'

const tabs: Tab[] = [
  { id: 'a', label: 'A', content: <div>A content</div> },
  { id: 'b', label: 'B', content: <div>B content</div> },
]

function createDataTransfer() {
  const data = new Map<string, string>()
  return {
    dropEffect: 'move',
    effectAllowed: 'all',
    clearData: vi.fn((type?: string) => {
      if (type) {
        data.delete(type)
        return
      }
      data.clear()
    }),
    getData: vi.fn((type: string) => data.get(type) ?? ''),
    setData: vi.fn((type: string, value: string) => {
      data.set(type, value)
    }),
  }
}

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
    expect(container.querySelector('[data-tabs-selection-indicator="true"]')).toBeNull()
  })

  it('renders the default variant with a surfaced header background', () => {
    const { container } = render(<Tabs tabs={tabs} selectedTab="a" actions={<button>x</button>} />)

    const header = container.querySelector('.tabs-header')
    expect(header?.className).toContain('sticky')

    const headerShell = container.querySelector('[data-tabs-header-shell="true"]')
    expect(headerShell?.className).toContain('bg-card/95')
    expect(headerShell?.className).toContain('rounded-md')

    const indicator = container.querySelector('[data-tabs-selection-indicator="true"]')
    expect(indicator).not.toBeNull()

    const actions = container.querySelector('[data-tabs-actions="true"]')
    expect(actions?.className).toContain('border-l')
  })

  it('exposes default VT layer handles and syncs the selection indicator to the active tab', () => {
    const handleRef = createRef<TabsHandle>()
    const rect = (left: number, top: number, width: number, height: number) =>
      ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
      }) satisfies DOMRect

    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.classList.contains('tabs-header')) {
          return rect(20, 40, 320, 44)
        }

        if (this.dataset.tabId === 'a') {
          return rect(36, 40, 80, 36)
        }

        if (this.dataset.tabId === 'b') {
          return rect(128, 40, 96, 36)
        }

        return originalGetBoundingClientRect.call(this)
      },
    })

    try {
      const { container, rerender } = render(
        <Tabs ref={handleRef} tabs={tabs} selectedTab="a" actions={<button>x</button>} />
      )

      const indicator = handleRef.current?.getSelectionIndicator()
      expect(handleRef.current?.getHeaderShell()).toBe(
        container.querySelector('[data-tabs-header-shell="true"]')
      )
      expect(handleRef.current?.getHeaderForeground()).toBe(
        container.querySelector('[data-tabs-header-foreground="true"]')
      )
      expect(indicator?.style.transform).toBe('translate(16px, 0px)')
      expect(indicator?.style.width).toBe('80px')
      expect(indicator?.style.height).toBe('36px')

      rerender(<Tabs ref={handleRef} tabs={tabs} selectedTab="b" actions={<button>x</button>} />)

      expect(indicator?.style.transform).toBe('translate(108px, 0px)')
      expect(indicator?.style.width).toBe('96px')
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: originalGetBoundingClientRect,
      })
    }
  })

  it('mounts tab styles in document head instead of rendering style text in the body', () => {
    const { container } = render(<Tabs tabs={tabs} />)

    expect(container.querySelector('style')).toBeNull()

    const style = document.head.querySelector('[data-head-style^="tabs:"]')
    expect(style).not.toBeNull()
    expect(style?.textContent).toContain('.tabs-button')
  })

  it('reorders tabs via drag and drop when onTabOrderChange is provided', () => {
    const onTabOrderChange = vi.fn()
    const { container } = render(<Tabs tabs={tabs} onTabOrderChange={onTabOrderChange} />)

    const tabA = within(container).getByRole('button', { name: 'A' })
    const tabB = within(container).getByRole('button', { name: 'B' })
    const dataTransfer = createDataTransfer()

    Object.defineProperty(tabB, 'getBoundingClientRect', {
      value: () => ({
        width: 100,
        height: 32,
        top: 0,
        left: 100,
        right: 200,
        bottom: 32,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      }),
    })

    fireEvent(tabA, createEvent.dragStart(tabA, { dataTransfer }))
    fireEvent.dragOver(tabB, { dataTransfer, clientX: 190 })
    fireEvent.drop(tabB, { dataTransfer, clientX: 190 })

    expect(onTabOrderChange).toHaveBeenCalledWith(['b', 'a'])
  })

  it('preserves mounted content instances when header order changes', () => {
    const mounts = vi.fn<(id: string) => void>()

    function PersistentPane(props: { id: string }) {
      useEffect(() => {
        mounts(props.id)
      }, [props.id])

      return <div>{props.id} content</div>
    }

    const { rerender } = render(
      <Tabs
        tabs={[
          { id: 'a', label: 'A', content: <PersistentPane id="a" /> },
          { id: 'b', label: 'B', content: <PersistentPane id="b" /> },
        ]}
        selectedTab="a"
        onTabOrderChange={() => {}}
      />
    )

    const initialMountCount = mounts.mock.calls.length
    expect(initialMountCount).toBeGreaterThan(0)

    rerender(
      <Tabs
        tabs={[
          { id: 'b', label: 'B', content: <PersistentPane id="b" /> },
          { id: 'a', label: 'A', content: <PersistentPane id="a" /> },
        ]}
        selectedTab="a"
        onTabOrderChange={() => {}}
      />
    )

    expect(mounts.mock.calls).toHaveLength(initialMountCount)
  })
})
