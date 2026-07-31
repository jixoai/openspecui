/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove the Workspace tab surface contains narrow-width overflow in its internal strip.
 * 2. Prove tab trigger, browser action, and close remain separate native controls in Chromium.
 * 3. Prove the selected-tab surface cannot paint over its foreground content.
 * 4. Prove Home is content-sized and inactive color fills the complete tab item.
 * 5. Prove the tab strip cannot scroll vertically and Close has stable hover-only chrome.
 *
 * Owner correction (2026-07-31): "Workspaces-tabs-bar 的背景色和前景色有问题"
 * Owner correction (2026-07-31): Close uses hover-only chrome and the tab strip never scrolls vertically.
 * Owner acceptance boundary (2026-07-20): This is component evidence, not final App walkthrough.
 */
import { TerminalTabs } from '@openspecui/web-src/components/terminal/terminal-tabs'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import '../index.css'
import { WorkspaceTabBrowserAction } from './workspace-tab-browser-action'

afterEach(async () => {
  cleanup()
  await page.viewport(1280, 720)
})

describe('Workspace tabs browser boundary', () => {
  it('keeps a 320px surface page-contained while the tab strip owns inline overflow', async () => {
    await page.viewport(320, 720)
    const open = vi.fn()
    const close = vi.fn()
    const view = render(
      <main
        data-testid="workspace-surface"
        className="hosted-shell-root flex h-48 w-full min-w-0 overflow-hidden"
      >
        <TerminalTabs
          className="hosted-shell-tabs h-full min-w-0"
          selectedTab="workspace-home"
          onTabClose={close}
          tabs={[
            {
              id: 'workspace-home',
              label: <span>Home</span>,
              closable: false,
              content: <div>Home content</div>,
            },
            ...['a', 'b', 'c'].map((id) => ({
              id,
              label: <span className="min-w-0 truncate">Workspace {id.toUpperCase()}</span>,
              closable: true,
              closeButtonVisibility: 'always' as const,
              content: <div>Workspace {id} content</div>,
            })),
          ]}
          actions={
            <WorkspaceTabBrowserAction
              label="Workspace A"
              workspaceId="workspace-a"
              pending={false}
              onOpen={open}
            />
          }
        />
      </main>
    )

    const surface = view.getByTestId('workspace-surface')
    const strip = view.container.querySelector<HTMLElement>('.tabs-button')
    expect(strip).not.toBeNull()
    expect(surface.scrollWidth).toBeLessThanOrEqual(surface.clientWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    expect(strip!.scrollWidth).toBeGreaterThan(strip!.clientWidth)
    expect(strip!.scrollHeight).toBeLessThanOrEqual(strip!.clientHeight)
    strip!.scrollTop = 12
    expect(strip!.scrollTop).toBe(0)

    const homeItem = view.container.querySelector<HTMLElement>(
      '[data-tab-item="true"][data-tab-id="workspace-home"]'
    )
    const item = view.container.querySelector<HTMLElement>(
      '[data-tab-item="true"][data-tab-id="a"]'
    )
    expect(homeItem).not.toBeNull()
    expect(item).not.toBeNull()
    expect(homeItem!.getBoundingClientRect().width).toBeLessThan(
      item!.getBoundingClientRect().width
    )
    const selectionIndicator = view.container.querySelector<HTMLElement>(
      '[data-tabs-selection-indicator="true"]'
    )
    expect(selectionIndicator).not.toBeNull()
    expect(Number(getComputedStyle(item!).zIndex)).toBeGreaterThan(
      Number(getComputedStyle(selectionIndicator!.parentElement!).zIndex)
    )
    const inactiveInner = item!.querySelector<HTMLElement>('[data-tabs-button-inner="true"]')
    expect(getComputedStyle(item!).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(inactiveInner!).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    const controls = within(item!).getAllByRole('button')
    expect(controls).toHaveLength(2)
    expect(controls.every((control) => control.parentElement !== controls[0])).toBe(true)
    const closeButton = within(item!).getByRole('button', { name: 'Close a' })
    const closeStyle = getComputedStyle(closeButton)
    expect(closeStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(closeStyle.width).toBe('23px')
    expect(closeStyle.height).toBe('24px')
    expect(closeStyle.alignSelf).toBe('center')
    expect(closeStyle.borderTopLeftRadius).toBe('6px')
    expect(closeStyle.borderTopRightRadius).toBe('0px')
    await page.getByRole('button', { name: 'Close a' }).hover()
    expect(getComputedStyle(closeButton).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(
      view.container.querySelector('[data-tabs-actions="true"] [data-workspace-browser-action]')
    ).toBeTruthy()
  })
})
