/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove supported browsers commit sidebar state inside the native View Transition callback.
 * 2. Prove unsupported and reduced-motion environments update immediately without transition metadata.
 * 3. Prove superseded transitions cannot clear the active transition direction.
 *
 * Owner correction (2026-07-31): "使用VT的话，首先要把transform动画关闭。"
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runSidebarViewTransition } from './sidebar-view-transition'

interface ControlledTransition extends ViewTransition {
  finish(): void
}

function createControlledTransition(): ControlledTransition {
  let finish = () => {}
  const finished = new Promise<void>((resolve) => {
    finish = resolve
  })
  return {
    finished,
    finish,
    ready: Promise.resolve(),
    skipTransition: vi.fn(),
    types: new Set<string>(),
    updateCallbackDone: Promise.resolve(),
  }
}

const originalMatchMedia = window.matchMedia

describe('runSidebarViewTransition', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    delete document.documentElement.dataset.sidebarVt
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    Reflect.deleteProperty(document, 'startViewTransition')
    delete document.documentElement.dataset.sidebarVt
    vi.restoreAllMocks()
  })

  it('commits the state update inside the native transition callback', async () => {
    const transition = createControlledTransition()
    const update = vi.fn()
    const startViewTransition = vi.fn((callback: ViewTransitionUpdateCallback) => {
      expect(document.documentElement.dataset.sidebarVt).toBe('collapse')
      callback()
      return transition
    })
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    })

    runSidebarViewTransition({ direction: 'collapse', update })

    expect(startViewTransition).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.sidebarVt).toBe('collapse')
    transition.finish()
    await transition.finished
    await Promise.resolve()
    expect(document.documentElement.dataset.sidebarVt).toBeUndefined()
  })

  it('updates atomically without metadata when native transitions are unavailable', () => {
    const update = vi.fn()

    runSidebarViewTransition({ direction: 'expand', update })

    expect(update).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.sidebarVt).toBeUndefined()
  })

  it('skips native transitions when reduced motion is preferred', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    const update = vi.fn()
    const startViewTransition = vi.fn()
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    })

    runSidebarViewTransition({ direction: 'expand', update })

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.sidebarVt).toBeUndefined()
  })

  it('keeps the newer direction when a rapid toggle supersedes the active transition', async () => {
    const first = createControlledTransition()
    const second = createControlledTransition()
    const transitions = [first, second]
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn((callback: ViewTransitionUpdateCallback) => {
        callback()
        const transition = transitions.shift()
        if (!transition) throw new Error('Expected a controlled sidebar transition.')
        return transition
      }),
    })

    runSidebarViewTransition({ direction: 'collapse', update: vi.fn() })
    runSidebarViewTransition({ direction: 'expand', update: vi.fn() })

    expect(first.skipTransition).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.sidebarVt).toBe('expand')
    first.finish()
    await first.finished
    await Promise.resolve()
    expect(document.documentElement.dataset.sidebarVt).toBe('expand')
    second.finish()
    await second.finished
    await Promise.resolve()
    expect(document.documentElement.dataset.sidebarVt).toBeUndefined()
  })
})
