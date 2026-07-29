/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the Workspace tab surface contains narrow-width overflow in its internal strip.
 * 2. Prove tab trigger, browser action, and close remain separate native controls in Chromium.
 *
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
      <main data-testid="workspace-surface" className="flex h-48 w-full min-w-0 overflow-hidden">
        <TerminalTabs
          className="h-full min-w-0"
          selectedTab="a"
          onTabClose={close}
          tabs={['a', 'b', 'c'].map((id) => ({
            id,
            label: <span className="min-w-0 truncate">Workspace {id.toUpperCase()}</span>,
            action: (
              <WorkspaceTabBrowserAction
                label={`Workspace ${id.toUpperCase()}`}
                workspaceId={`workspace-${id}`}
                pending={false}
                onOpen={open}
              />
            ),
            closable: true,
            closeButtonVisibility: 'always' as const,
            content: <div>Workspace {id} content</div>,
          }))}
        />
      </main>
    )

    const surface = view.getByTestId('workspace-surface')
    const strip = view.container.querySelector<HTMLElement>('.tabs-button')
    expect(strip).not.toBeNull()
    expect(surface.scrollWidth).toBeLessThanOrEqual(surface.clientWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    expect(strip!.scrollWidth).toBeGreaterThan(strip!.clientWidth)

    const item = view.container.querySelector<HTMLElement>('[data-tab-item="true"]')
    expect(item).not.toBeNull()
    const controls = within(item!).getAllByRole('button')
    expect(controls).toHaveLength(3)
    expect(controls.every((control) => control.parentElement !== controls[0])).toBe(true)
  })
})
