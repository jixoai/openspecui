/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the overlay titlebar occupies a distinct visual row before Workspace tabs in Chromium.
 * 2. Prove the visible App chrome remains page-contained without horizontal overflow.
 * 3. Prove compact titlebar geometry preserves the native control safe area.
 *
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 * Owner correction (2026-07-30): "titlebar的高度过高，适当压缩到合理的高度。"
 * Owner correction (2026-07-30): follow skill-creator-v2 horizontal window-controls safe-area behavior.
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
  document.documentElement.style.removeProperty('--app-titlebar-left')
  document.documentElement.style.removeProperty('--app-titlebar-right')
  await page.viewport(1280, 720)
})

describe('AppTitlebar browser boundary', () => {
  it('keeps a visible self-drawn OpenTray titlebar above Workspace tabs at narrow width', async () => {
    await page.viewport(320, 720)
    document.documentElement.style.setProperty('--app-titlebar-left', '76px')
    document.documentElement.style.setProperty('--app-titlebar-right', '84px')
    const view = render(
      <main className="flex h-48 w-full min-w-0 flex-col overflow-hidden">
        <AppTitlebar
          onSettings={() => {}}
          onPointerDown={() => {}}
          presentation={{
            kind: 'opentray',
            insets: { left: 0, right: 180, top: 0, height: 32 },
          }}
          settingsActive={false}
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
    expect(titlebar.getBoundingClientRect().height).toBeGreaterThanOrEqual(32)
    expect(titlebar.getBoundingClientRect().height).toBeLessThanOrEqual(33)
    expect(getComputedStyle(titlebar).paddingLeft).toBe('76px')
    expect(getComputedStyle(titlebar).paddingRight).toBe('84px')
    expect(getComputedStyle(titlebar).borderBottomWidth).toBe('1px')
    expect(titlebar.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      tabs!.getBoundingClientRect().top
    )
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('keeps compact height when native geometry reports a taller control area', () => {
    document.documentElement.style.setProperty('--app-titlebar-left', '84px')
    document.documentElement.style.setProperty('--app-titlebar-right', '124px')
    const view = render(
      <AppTitlebar
        onSettings={() => {}}
        onPointerDown={() => {}}
        presentation={{
          kind: 'opentray',
          insets: { left: 72, right: 80, top: 0, height: 44 },
        }}
        settingsActive={false}
      />
    )

    const titlebar = view.getByRole('banner', { name: 'Application titlebar' })
    expect(titlebar.getBoundingClientRect().height).toBe(32)
    expect(getComputedStyle(titlebar).paddingLeft).toBe('84px')
    expect(getComputedStyle(titlebar).paddingRight).toBe('124px')
  })
})
