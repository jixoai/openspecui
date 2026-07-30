/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the compatible `navigator.window` bridge projection supplies measured safe-area geometry.
 * 2. Prove host-declared chrome converges from fallback after the native bridge arrives late.
 *
 * Owner correction (2026-07-30): native controls must never overlap titlebar content.
 */
// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OpenTrayWindowLike } from './titlebar-presentation'
import { resolveTitlebarOpenTrayWindow, useTitlebarPresentation } from './use-titlebar-presentation'

const navigatorWindowDescriptor = Object.getOwnPropertyDescriptor(navigator, 'window')
const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth')

afterEach(() => {
  cleanup()
  if (navigatorWindowDescriptor) {
    Object.defineProperty(navigator, 'window', navigatorWindowDescriptor)
  } else {
    Reflect.deleteProperty(navigator, 'window')
  }
  if (innerWidthDescriptor) Object.defineProperty(window, 'innerWidth', innerWidthDescriptor)
})

describe('App titlebar bridge readiness', () => {
  it('resolves the compatible navigator.window projection', () => {
    const nativeWindow: OpenTrayWindowLike = {}
    expect(resolveTitlebarOpenTrayWindow({ window: nativeWindow })).toBe(nativeWindow)
  })

  it('replaces fallback padding when the native overlay bridge arrives after mount', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
    const { result } = renderHook(() => useTitlebarPresentation(true))

    expect(result.current.presentation).toEqual({
      kind: 'opentray',
      insets: { left: 8, right: 8, top: 0, height: 0 },
    })

    Object.defineProperty(navigator, 'window', {
      configurable: true,
      value: {
        overlay: {
          visible: true,
          getTitlebarAreaRect: vi.fn(async () => ({ x: 72, y: 0, width: 1080, height: 44 })),
          listen: vi.fn(async () => () => {}),
        },
      } satisfies OpenTrayWindowLike,
    })

    await waitFor(() => {
      expect(result.current.presentation).toEqual({
        kind: 'opentray',
        insets: { left: 76, right: 132, top: 0, height: 44 },
      })
    })
  })
})
