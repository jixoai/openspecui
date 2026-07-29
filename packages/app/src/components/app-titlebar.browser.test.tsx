/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the overlay titlebar occupies a distinct visual row before Workspace tabs in Chromium.
 * 2. Prove the visible App chrome remains page-contained without horizontal overflow.
 *
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 * Owner acceptance boundary (2026-07-20): This is component evidence, not final OpenTray walkthrough.
 */
import { TerminalTabs } from '@openspecui/web-src/components/terminal/terminal-tabs'
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import '../index.css'
import { AppTitlebar } from './app-titlebar'

afterEach(async () => {
  cleanup()
  await page.viewport(1280, 720)
})

describe('AppTitlebar browser boundary', () => {
  it('keeps a visible self-drawn OpenTray titlebar above Workspace tabs at narrow width', async () => {
    await page.viewport(320, 720)
    const view = render(
      <main className="flex h-48 w-full min-w-0 flex-col overflow-hidden">
        <AppTitlebar
          onPointerDown={() => {}}
          presentation={{
            kind: 'opentray',
            insets: { left: 0, right: 180, top: 0, height: 32 },
          }}
        />
        <TerminalTabs
          className="min-h-0 flex-1"
          selectedTab="workspace"
          tabs={[
            {
              id: 'workspace',
              label: 'Workspace',
              content: <div>Workspace content</div>,
            },
          ]}
        />
      </main>
    )

    const titlebar = view.getByRole('banner', { name: 'Application titlebar' })
    const tabs = view.container.querySelector<HTMLElement>('.tabs-header')
    expect(tabs).not.toBeNull()
    expect(titlebar.compareDocumentPosition(tabs!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(titlebar.getBoundingClientRect().height).toBeGreaterThanOrEqual(40)
    expect(getComputedStyle(titlebar).borderBottomWidth).toBe('1px')
    expect(titlebar.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      tabs!.getBoundingClientRect().top
    )
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })
})
