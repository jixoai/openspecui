import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollResolvedHashTarget } from './anchor-scroll'

function rect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: 0,
    bottom: top,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect
}

describe('anchor-scroll', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('uses target scroll-margin-top when scrolling inside a content container', () => {
    const container = document.createElement('div')
    const target = document.createElement('h2')
    const scrollTo = vi.fn()

    container.scrollTop = 100
    container.scrollTo = scrollTo
    container.getBoundingClientRect = () => rect(10)
    target.getBoundingClientRect = () => rect(210)
    target.style.scrollMarginTop = '64px'

    scrollResolvedHashTarget(target, container)

    expect(scrollTo).toHaveBeenCalledWith({ top: 236, behavior: 'smooth' })
  })
})
