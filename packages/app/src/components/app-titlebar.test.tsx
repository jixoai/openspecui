/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove self-drawn titlebar presence is exclusive to overlay-capable hosts.
 * 2. Prove titlebar pointer input remains a narrow component-level drag entry.
 * 3. Keep Browser and native-frame hosts free from artificial titlebar space.
 * 4. Prove the branded Settings control remains interactive and separate from drag authority.
 *
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 * Owner correction (2026-07-30): "Settings 入口挪到titlebar右上角；logo要全面应用。"
 * Owner correction (2026-07-30): "titlebar的高度过高，适当压缩到合理的高度。"
 */
// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AppTitlebarPresentation } from '../lib/titlebar-presentation'
import { AppTitlebar } from './app-titlebar'

const ZERO_INSETS = { left: 0, right: 0, top: 0, height: 0 }

function renderTitlebar(
  presentation: AppTitlebarPresentation,
  onPointerDown = vi.fn(),
  onSettings = vi.fn(),
  settingsActive = false
) {
  return {
    onPointerDown,
    onSettings,
    view: render(
      <AppTitlebar
        onSettings={onSettings}
        presentation={presentation}
        onPointerDown={onPointerDown}
        settingsActive={settingsActive}
      />
    ),
  }
}

describe('AppTitlebar', () => {
  it.each<AppTitlebarPresentation>([
    { kind: 'browser', insets: ZERO_INSETS },
    { kind: 'native-frame', insets: ZERO_INSETS },
  ])('does not create an overlay titlebar for $kind', (presentation) => {
    const view = renderTitlebar(presentation)
    expect(view.view.container.querySelector('[data-app-titlebar="true"]')).toBeNull()
    view.view.unmount()
  })

  it.each<AppTitlebarPresentation>([
    { kind: 'pwa-overlay', insets: { left: 16, right: 80, top: 0, height: 36 } },
    { kind: 'opentray', insets: { left: 0, right: 760, top: 0, height: 32 } },
  ])(
    'renders a dedicated $kind titlebar and forwards its blank-surface pointer',
    (presentation) => {
      const { onPointerDown, view } = renderTitlebar(presentation)
      const titlebar = view.getByRole('banner', { name: 'Application titlebar' })

      expect(titlebar.getAttribute('data-app-titlebar')).toBe('true')
      expect(titlebar.getAttribute('data-app-titlebar-kind')).toBe(presentation.kind)
      expect(view.getByText('OpenSpec UI')).toBeTruthy()
      expect(titlebar.querySelector('img[src="/icon.svg"]')).toBeTruthy()
      expect(titlebar.querySelector('img[src="/icon.dark.svg"]')).toBeTruthy()
      fireEvent.pointerDown(titlebar, { clientX: 20, clientY: 12, pointerId: 9 })
      expect(onPointerDown).toHaveBeenCalledOnce()
      view.unmount()
    }
  )

  it('keeps Settings interactive and exposes the active route state', () => {
    const presentation: AppTitlebarPresentation = {
      kind: 'opentray',
      insets: { left: 72, right: 80, top: 0, height: 32 },
    }
    const { onSettings, view } = renderTitlebar(presentation, vi.fn(), vi.fn(), true)
    const settings = view.getByRole('button', { name: 'Settings' })

    expect(settings.getAttribute('aria-current')).toBe('page')
    expect(settings.getAttribute('data-active')).toBe('true')
    fireEvent.click(settings)
    expect(onSettings).toHaveBeenCalledOnce()
  })
})
