import { describe, expect, it } from 'vitest'
import { resolveTabCarouselDirection } from './tab-direction'

describe('resolveTabCarouselDirection', () => {
  const tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as const

  it('returns forward when moving to a later tab', () => {
    expect(resolveTabCarouselDirection(tabs, 'a', 'c')).toBe('forward')
  })

  it('returns backward when moving to an earlier tab', () => {
    expect(resolveTabCarouselDirection(tabs, 'c', 'a')).toBe('backward')
  })

  it('returns null when current and next tab are the same', () => {
    expect(resolveTabCarouselDirection(tabs, 'b', 'b')).toBeNull()
  })

  it('returns null when tab ids are missing', () => {
    expect(resolveTabCarouselDirection(tabs, 'x', 'b')).toBeNull()
    expect(resolveTabCarouselDirection(tabs, 'a', 'y')).toBeNull()
  })
})
