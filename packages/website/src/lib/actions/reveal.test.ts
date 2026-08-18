/**
 * Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
 * 1. Verify the reveal action's observer, rule-variant, and no-observer degradation branches.
 * 2. Verify reduced-motion requests settle content immediately.
 *
 * Original request (2026-08-19): "注意动效要克制" — motion must never gate content visibility.
 */
import { reveal } from '$lib/actions/reveal'
import { describe, expect, it, vi } from 'vitest'

function fakeEntry(target: Element): IntersectionObserverEntry {
  const rect = DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 10 })
  return {
    boundingClientRect: rect,
    intersectionRatio: 1,
    intersectionRect: rect,
    isIntersecting: true,
    rootBounds: null,
    target,
    time: 0,
  }
}

class FakeIntersectionObserver implements IntersectionObserver {
  static last: FakeIntersectionObserver | undefined
  readonly root: Document | Element | null = null
  readonly rootMargin = ''
  readonly thresholds: readonly number[] = []
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    FakeIntersectionObserver.last = this
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  triggerIntersecting(target: Element): void {
    this.callback([fakeEntry(target)], this)
  }
}

describe('reveal action', () => {
  it('reveals immediately when no observer exists', () => {
    const node = document.createElement('div')
    const action = reveal(node)

    expect(node.getAttribute('data-reveal')).toBe('')
    expect(node.classList.contains('is-revealed')).toBe(true)
    action.destroy()
  })

  it('reveals through the observer and marks the rule variant', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    try {
      const node = document.createElement('div')
      const action = reveal(node, { rule: true, delay: 80 })

      expect(node.getAttribute('data-reveal')).toBe('rule')
      expect(node.style.getPropertyValue('--reveal-delay')).toBe('80ms')
      expect(node.classList.contains('is-revealed')).toBe(false)

      FakeIntersectionObserver.last?.triggerIntersecting(node)
      expect(node.classList.contains('is-revealed')).toBe(true)

      action.destroy()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('settles immediately under reduced motion', () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    try {
      const node = document.createElement('div')
      const action = reveal(node)

      expect(node.classList.contains('is-revealed')).toBe(true)
      action.destroy()
    } finally {
      window.matchMedia = original
    }
  })
})
