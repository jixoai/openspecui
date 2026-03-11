import { describe, expect, it } from 'vitest'
import {
  computeHostedAppDisplayMode,
  computeTitlebarInsets,
  EMPTY_TITLEBAR_INSETS,
  isBeforeInstallPromptEvent,
  readHostedAppTitlebarInsets,
} from './pwa-runtime'

describe('hosted app pwa runtime helpers', () => {
  it('detects browser, standalone, and overlay display modes', () => {
    const runtime = {
      matchMedia: (query: string) => ({
        matches: query === '(display-mode: standalone)',
      }),
      innerWidth: 1280,
    }

    expect(computeHostedAppDisplayMode(runtime)).toBe('standalone')
    expect(
      computeHostedAppDisplayMode({
        ...runtime,
        matchMedia: () => ({ matches: false }),
        windowControlsOverlay: {
          visible: true,
          getTitlebarAreaRect: () => ({ x: 72, y: 0, width: 1120, height: 48 }),
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      })
    ).toBe('window-controls-overlay')
    expect(
      computeHostedAppDisplayMode({
        ...runtime,
        matchMedia: () => ({ matches: false }),
      })
    ).toBe('browser')
  })

  it('computes titlebar insets from the overlay rect', () => {
    expect(computeTitlebarInsets({ x: 80, y: 0, width: 1080, height: 44 }, 1280)).toEqual({
      left: 80,
      right: 120,
      top: 0,
      height: 44,
    })
  })

  it('returns empty insets when overlay is not visible', () => {
    expect(
      readHostedAppTitlebarInsets({
        matchMedia: () => ({ matches: false }),
        innerWidth: 1280,
        windowControlsOverlay: {
          visible: false,
          getTitlebarAreaRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      })
    ).toEqual(EMPTY_TITLEBAR_INSETS)
  })

  it('recognizes deferred install prompt events', () => {
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: 'accepted'; platform: 'web' }>
    }
    event.prompt = async () => {}
    event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' })

    expect(isBeforeInstallPromptEvent(event)).toBe(true)
    expect(isBeforeInstallPromptEvent(new Event('click'))).toBe(false)
  })
})
