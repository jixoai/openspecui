import { describe, expect, it } from 'vitest'
import { clampWithinBounds, resolveAnchorPosition, type ContextMenuAnchor } from './context-menu'

function createRect(rect: Partial<DOMRect>): DOMRect {
  return {
    x: rect.x ?? 0,
    y: rect.y ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    top: rect.top ?? 0,
    left: rect.left ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
    toJSON: () => ({}),
  } as DOMRect
}

describe('context menu anchor math', () => {
  it('resolves target anchor bottom-end position from element rect', () => {
    const targetRect = createRect({
      left: 120,
      top: 40,
      right: 180,
      bottom: 88,
      width: 60,
      height: 48,
    })
    const element = {
      getBoundingClientRect: () => targetRect,
    } as HTMLElement

    const anchor: ContextMenuAnchor = {
      type: 'target',
      element,
      placement: 'bottom-end',
    }

    expect(resolveAnchorPosition(anchor)).toEqual({ x: 180, y: 88 })
  })

  it('clamps position within wrapper rect with margin', () => {
    const raw = { x: 5, y: 8 }
    const menuRect = createRect({ width: 100, height: 80, left: 0, top: 0, right: 100, bottom: 80 })
    const boundaryRect = createRect({
      left: 100,
      top: 50,
      right: 240,
      bottom: 220,
      width: 140,
      height: 170,
    })

    expect(clampWithinBounds(raw, menuRect, boundaryRect)).toEqual({
      x: 112,
      y: 62,
    })
  })
})
