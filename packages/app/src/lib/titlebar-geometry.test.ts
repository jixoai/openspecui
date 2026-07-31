/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove native window-control geometry becomes bounded control-safe titlebar insets.
 *
 * Original request (2026-07-29): "对 opentray 的窗口 overlay-window-controls 的样式适配。"
 * Owner correction (2026-07-31): PWA is retired; preserve only the host-neutral geometry law.
 */
import { describe, expect, it } from 'vitest'
import { computeTitlebarInsets } from './titlebar-geometry'

describe('App titlebar geometry', () => {
  it('adds control margin only where native controls occupy an edge', () => {
    expect(computeTitlebarInsets({ x: 72, y: 0, width: 1000, height: 40 }, 1200)).toEqual({
      left: 76,
      right: 132,
      top: 0,
      height: 40,
    })
  })

  it('clamps invalid negative geometry to zero', () => {
    expect(computeTitlebarInsets({ x: -10, y: -2, width: 1200, height: -1 }, 1200)).toEqual({
      left: 0,
      right: 14,
      top: 0,
      height: 0,
    })
  })
})
