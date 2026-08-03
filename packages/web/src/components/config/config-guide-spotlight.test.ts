/**
 * Orthogonal intents (created 2026-08-03 Asia/Shanghai):
 * 1. Prove one SVG even-odd path leaves a bevel-shaped interactive hole.
 * 2. Prove zero corner radii produce the Safari-compatible square fallback.
 *
 * Original request (2026-08-03): replace the four-block Guide mask with one SVG path that mirrors bevel corners.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createConfigGuideSpotlightPaths,
  readConfigGuideSpotlightGeometry,
  type ConfigGuideSpotlightGeometry,
} from './config-guide-spotlight'

function geometry(
  corners: NonNullable<ConfigGuideSpotlightGeometry['hole']>['corners']
): ConfigGuideSpotlightGeometry {
  return {
    viewportWidth: 100,
    viewportHeight: 80,
    hole: {
      top: 20,
      right: 70,
      bottom: 60,
      left: 10,
      width: 60,
      height: 40,
      corners,
    },
  }
}

describe('Config Guide SVG spotlight geometry', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('builds one even-odd mask around an asymmetric bevel hole', () => {
    expect(
      createConfigGuideSpotlightPaths(
        geometry({
          topLeft: { x: 8, y: 6 },
          topRight: { x: 7, y: 5 },
          bottomRight: { x: 6, y: 4 },
          bottomLeft: { x: 5, y: 3 },
        })
      )
    ).toEqual({
      holePath: 'M 18 20 H 63 L 70 25 V 56 L 64 60 H 15 L 10 57 V 26 L 18 20 Z',
      maskPath:
        'M 0 0 H 100 V 80 H 0 Z M 18 20 H 63 L 70 25 V 56 L 64 60 H 15 L 10 57 V 26 L 18 20 Z',
    })
  })

  it('uses a square hole when bevel support resolves every corner to zero', () => {
    expect(
      createConfigGuideSpotlightPaths(
        geometry({
          topLeft: { x: 0, y: 0 },
          topRight: { x: 0, y: 0 },
          bottomRight: { x: 0, y: 0 },
          bottomLeft: { x: 0, y: 0 },
        })
      ).holePath
    ).toBe('M 10 20 H 70 L 70 20 V 60 L 70 60 H 10 L 10 60 V 20 L 10 20 Z')
  })

  it('reads each computed bevel radius from the target element', () => {
    vi.stubGlobal('CSS', { supports: vi.fn(() => true) })
    const target = document.createElement('section')
    target.style.borderTopLeftRadius = '8px 6px'
    target.style.borderTopRightRadius = '7px 5px'
    target.style.borderBottomRightRadius = '6px 4px'
    target.style.borderBottomLeftRadius = '5px 3px'
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 60, 40))
    document.body.append(target)

    expect(readConfigGuideSpotlightGeometry(target, 0).hole?.corners).toEqual({
      topLeft: { x: 8, y: 6 },
      topRight: { x: 7, y: 5 },
      bottomRight: { x: 6, y: 4 },
      bottomLeft: { x: 5, y: 3 },
    })
  })

  it('forces square corners when the browser does not support corner-shape bevel', () => {
    vi.stubGlobal('CSS', { supports: vi.fn(() => false) })
    const target = document.createElement('section')
    target.style.borderRadius = '8px'
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 60, 40))
    document.body.append(target)

    expect(readConfigGuideSpotlightGeometry(target, 0).hole?.corners).toEqual({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 0, y: 0 },
      bottomRight: { x: 0, y: 0 },
      bottomLeft: { x: 0, y: 0 },
    })
  })
})
