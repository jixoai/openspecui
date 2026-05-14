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

  it('renders trigger title and badge on the whole tab button', () => {
    const titledTabs: Tab[] = [
      {
        id: 'a',
        label: 'Alpha',
        title: 'Full Alpha title',
        badge: <span aria-label="Alpha badge">2</span>,
        content: <div>A</div>,
      },
    ]

    const { container, getByLabelText, getByTitle } = render(
      <Tabs tabs={titledTabs} selectedTab="a" />
    )

    const trigger = getByTitle('Full Alpha title')
    expect(trigger.tagName).toBe('BUTTON')
    expect(getByLabelText('Alpha badge').closest('[data-tabs-badge="true"]')).toBeTruthy()
    expect(container.querySelector('[data-tabs-badge="true"]')?.parentElement).toBe(trigger)
  })

  it('supports slot-style class overrides and indicator toggles', () => {
    const { container } = render(
      <Tabs
        tabs={tabs}
        selectedTab="a"
        actions={<button type="button">+</button>}
        showHeaderShell={false}
        showSelectionIndicator={false}
        decorateStrip={false}
        classNames={{
          header: 'bg-terminal text-terminal-foreground',
          strip: 'px-4',
          list: 'pt-2',
          headerFrame: 'items-end',
          buttonBase: 'rounded-t-[8px] py-1',
          buttonInner: 'gap-3 px-3',
          activeButton: 'bg-terminal-foreground/10 text-terminal-foreground',
          inactiveButton:
            'bg-terminal text-terminal-foreground/72 hover:bg-terminal-foreground/10 hover:text-terminal-foreground',
          activeButtonInner: '[transform:translateY(0)]',
          inactiveButtonInner: '[transform:translateY(0.25em)]',
          actions: 'bg-terminal border-terminal-foreground/20 text-terminal-foreground',
          actionsDivider: 'bg-terminal-foreground/20',
          selectionTrack: 'bg-terminal-foreground/20',
          selectionIndicatorViewport: 'inset-0',
          closeButtonActive: 'text-terminal-foreground/70 hover:text-terminal-foreground',
          closeButtonInactive: 'text-terminal-foreground/50 hover:text-terminal-foreground',
        }}
        selectionIndicatorLayout="overlay"
      />
    )

    const header = container.querySelector('.tabs-header')
    expect(header?.className).toContain('bg-terminal')
    const strip = container.querySelector('.tabs-strip')
    expect(strip?.className).not.toContain('bg-terminal')
    expect(container.firstElementChild?.getAttribute('data-tabs-strip-decoration')).toBe('off')
    expect(container.querySelector('[data-tabs-header-shell="true"]')).toBeNull()

    const selected = within(container).getByRole('button', { name: 'A' })
    expect(selected.className).toContain('bg-terminal-foreground/10')
    expect(selected.className).toContain('text-terminal-foreground')
    expect(selected.className).toContain('rounded-t-[8px]')
    expect(selected.querySelector('[data-tabs-button-inner="true"]')?.className).toContain(
      '[transform:translateY(0)]'
    )

    const unselected = within(container).getByRole('button', { name: 'B' })
    expect(unselected.className).toContain('bg-terminal')
    expect(unselected.className).toContain('text-terminal-foreground/72')
    expect(unselected.querySelector('[data-tabs-button-inner="true"]')?.className).toContain(
      '[transform:translateY(0.25em)]'
    )

    const actions = container.querySelector('[data-tabs-actions="true"]')
    expect(actions?.className).toContain('bg-terminal')
    expect(actions?.className).toContain('border-terminal-foreground/20')
    expect(container.querySelector('[data-tabs-selection-indicator="true"]')).toBeNull()
  })

  it('renders the default variant with a surfaced header background', () => {
    const { container } = render(<Tabs tabs={tabs} selectedTab="a" actions={<button>x</button>} />)

    const header = container.querySelector('.tabs-header')
    expect(header?.className).toContain('sticky')

    const headerShell = container.querySelector('[data-tabs-header-shell="true"]')
    expect(headerShell?.className).toContain('bg-card/95')
    expect(headerShell?.className).toContain('rounded-t-md')
    expect(headerShell?.className).toContain('rounded-b-none')

    const indicator = container.querySelector('[data-tabs-selection-indicator="true"]')
    expect(indicator).not.toBeNull()

    const actions = container.querySelector('[data-tabs-actions="true"]')
    expect(actions?.className).toContain('tabs-actions')
    expect(container.querySelector('.tabs-selection-track')).not.toBeNull()
    expect(container.querySelector('.tabs-actions-divider')).not.toBeNull()
    expect(container.querySelector('.tabs-actions-divider')?.className).toContain('inset-y-0')
    expect(
      container
        .querySelector('.tabs-strip')
        ?.contains(container.querySelector('[data-tabs-selection-indicator="true"]') as Node)
    ).toBe(true)
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

        if (this.classList.contains('tabs-header-frame')) {
          return rect(20, 40, 320, 44)
        }

        if (this.classList.contains('tabs-strip')) {
          return rect(30, 40, 210, 44)
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
      expect(indicator?.style.transform).toBe('translateX(16px)')
      expect(indicator?.style.width).toBe('60px')
      expect(indicator?.style.height).toBe('')

      rerender(<Tabs ref={handleRef} tabs={tabs} selectedTab="b" actions={<button>x</button>} />)

      expect(indicator?.style.transform).toBe('translateX(108px)')
      expect(indicator?.style.width).toBe('76px')

      const resizedTabs: Tab[] = [
        { id: 'a', label: 'A', content: <div>A content</div> },
        { id: 'b', label: 'B resized', content: <div>B content</div> },
      ]

      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: function mockResizedGetBoundingClientRect(this: HTMLElement) {
          if (this.classList.contains('tabs-header')) {
            return rect(20, 40, 320, 44)
          }

          if (this.classList.contains('tabs-header-frame')) {
            return rect(20, 40, 320, 44)
          }

          if (this.classList.contains('tabs-strip')) {
            return rect(30, 40, 210, 44)
          }

          if (this.dataset.tabId === 'a') {
            return rect(36, 40, 80, 36)
          }

          if (this.dataset.tabId === 'b') {
            return rect(128, 40, 140, 36)
          }

          return originalGetBoundingClientRect.call(this)
        },
      })

      rerender(
        <Tabs ref={handleRef} tabs={resizedTabs} selectedTab="b" actions={<button>x</button>} />
      )

      expect(indicator?.style.width).toBe('120px')
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
