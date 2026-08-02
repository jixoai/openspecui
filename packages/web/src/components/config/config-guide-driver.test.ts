/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Prove Driver.js remains a lazy presentation adapter with keyboard and reduced-motion controls.
 * 2. Prove unresolved stages hide progression while terminal presentations expose only typed callbacks.
 *
 * Original request (2026-08-02): keep the JavaScript guide library presentation-only and unit tested.
 */
import type { Config, DriveStep } from 'driver.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { presentConfigGuide } from './config-guide-driver'

const { destroyMock, driverFactoryMock, highlightMock } = vi.hoisted(() => ({
  destroyMock: vi.fn(),
  driverFactoryMock: vi.fn(),
  highlightMock: vi.fn(),
}))

vi.mock('driver.js', () => ({
  driver: driverFactoryMock,
}))

vi.mock('driver.js/dist/driver.css', () => ({}))

function latestConfig(): Config {
  const calls = driverFactoryMock.mock.calls as [Config][]
  const config = calls.at(-1)?.[0]
  if (!config) throw new Error('Expected Driver.js config.')
  return config
}

function latestStep(): DriveStep {
  const calls = highlightMock.mock.calls as [DriveStep][]
  const step = calls.at(-1)?.[0]
  if (!step) throw new Error('Expected Driver.js highlight step.')
  return step
}

describe('presentConfigGuide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    driverFactoryMock.mockReturnValue({
      highlight: highlightMock,
      destroy: destroyMock,
    })
  })

  it('keeps a warning stage keyboard-accessible without exposing Next', async () => {
    const element = document.createElement('section')
    const onCancel = vi.fn()
    const onNext = vi.fn()
    const onPrevious = vi.fn()

    const cleanup = await presentConfigGuide({
      kind: 'stage',
      element,
      label: 'Active Root',
      signal: {
        status: 'warning',
        title: 'Review warning',
        detail: 'The current projection retains a warning.',
      },
      canGoBack: true,
      reducedMotion: true,
      onCancel,
      onNext,
      onPrevious,
    })

    expect(latestConfig()).toMatchObject({
      animate: false,
      smoothScroll: false,
      allowKeyboardControl: true,
      allowClose: false,
      showButtons: ['previous', 'close'],
      onNextClick: onNext,
      onPrevClick: onPrevious,
      onCloseClick: onCancel,
    })
    expect(latestStep()).toMatchObject({
      element,
      disableActiveInteraction: false,
      popover: {
        title: 'Active Root',
        description: 'The current projection retains a warning.',
      },
    })

    cleanup()
    expect(destroyMock).toHaveBeenCalledOnce()
  })

  it('exposes Retry only for a typed missing-target failure', async () => {
    await presentConfigGuide({
      kind: 'target-failed',
      label: 'Project Binding',
      canGoBack: false,
      reducedMotion: false,
      onCancel: vi.fn(),
      onNext: vi.fn(),
      onPrevious: vi.fn(),
    })

    expect(latestConfig()).toMatchObject({
      animate: true,
      smoothScroll: true,
      showButtons: ['next', 'close'],
      nextBtnText: 'Retry',
    })
    expect(latestStep().popover).toMatchObject({
      title: 'Project Binding',
      description: expect.stringContaining('semantic Guide target'),
    })
  })
})
