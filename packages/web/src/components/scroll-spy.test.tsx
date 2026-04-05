import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useIntersectionVisibilityMap } from './scroll-spy'

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  readonly observedElements = new Set<Element>()
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  observe(element: Element) {
    this.observedElements.add(element)
  }

  unobserve(element: Element) {
    this.observedElements.delete(element)
  }

  disconnect() {
    this.observedElements.clear()
    MockIntersectionObserver.instances = MockIntersectionObserver.instances.filter(
      (instance) => instance !== this
    )
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  emit(entry: Partial<IntersectionObserverEntry> & { target: Element }) {
    const rect = entry.target.getBoundingClientRect()
    this.callback(
      [
        {
          time: 0,
          rootBounds: null,
          boundingClientRect: rect,
          intersectionRect: rect,
          isIntersecting: true,
          intersectionRatio: 0,
          ...entry,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver
    )
  }

  static reset() {
    MockIntersectionObserver.instances = []
  }
}

describe('useIntersectionVisibilityMap', () => {
  beforeEach(() => {
    MockIntersectionObserver.reset()
    vi.stubGlobal(
      'IntersectionObserver',
      MockIntersectionObserver as unknown as typeof IntersectionObserver
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    MockIntersectionObserver.reset()
  })

  it('does not replace ratio state when the observer reports the same ratios again', () => {
    const { result } = renderHook(() =>
      useIntersectionVisibilityMap<string>({
        ids: ['file-1'],
        threshold: [0, 1],
      })
    )

    const node = document.createElement('div')

    act(() => {
      result.current.setObservedNode('file-1', node)
    })

    const observer = MockIntersectionObserver.instances[0]
    expect(observer).toBeTruthy()

    act(() => {
      observer?.emit({
        target: node,
        isIntersecting: true,
        intersectionRatio: 1,
      })
    })

    const firstMap = result.current.ratioById
    expect(firstMap.get('file-1')).toBe(1)

    act(() => {
      observer?.emit({
        target: node,
        isIntersecting: true,
        intersectionRatio: 1,
      })
    })

    expect(result.current.ratioById).toBe(firstMap)
  })
})
