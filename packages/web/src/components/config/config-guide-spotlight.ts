/**
 * Orthogonal intents (created 2026-08-03 Asia/Shanghai):
 * 1. Read viewport-relative Guide target geometry without mutating the target element.
 * 2. Resolve project bevel corners from computed border radii with a square unsupported-browser fallback.
 * 3. Generate one SVG even-odd mask path plus its matching bevel outline path.
 *
 * Original request (2026-08-03): replace the four-block Guide mask with one SVG path that mirrors bevel corners.
 */

export interface ConfigGuideSpotlightCorner {
  x: number
  y: number
}

export interface ConfigGuideSpotlightCorners {
  topLeft: ConfigGuideSpotlightCorner
  topRight: ConfigGuideSpotlightCorner
  bottomRight: ConfigGuideSpotlightCorner
  bottomLeft: ConfigGuideSpotlightCorner
}

export interface ConfigGuideSpotlightHole {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
  corners: ConfigGuideSpotlightCorners
}

export interface ConfigGuideSpotlightGeometry {
  viewportWidth: number
  viewportHeight: number
  hole: ConfigGuideSpotlightHole | null
}

export interface ConfigGuideSpotlightPaths {
  holePath: string | null
  maskPath: string
}

const SQUARE_CORNERS: ConfigGuideSpotlightCorners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 0, y: 0 },
  bottomRight: { x: 0, y: 0 },
  bottomLeft: { x: 0, y: 0 },
}

function coordinate(value: number): string {
  return Number(value.toFixed(3)).toString()
}

function radiusValue(value: string, reference: number): number {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 0
  return value.trim().endsWith('%') ? (parsed / 100) * reference : parsed
}

function cornerRadius(value: string, width: number, height: number): ConfigGuideSpotlightCorner {
  const [horizontal = '0', vertical = horizontal] = value
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '/')
  return {
    x: Math.max(0, radiusValue(horizontal, width)),
    y: Math.max(0, radiusValue(vertical, height)),
  }
}

function normalizeCorners(
  corners: ConfigGuideSpotlightCorners,
  width: number,
  height: number
): ConfigGuideSpotlightCorners {
  const ratios = [
    width / Math.max(width, corners.topLeft.x + corners.topRight.x),
    width / Math.max(width, corners.bottomLeft.x + corners.bottomRight.x),
    height / Math.max(height, corners.topLeft.y + corners.bottomLeft.y),
    height / Math.max(height, corners.topRight.y + corners.bottomRight.y),
  ]
  const scale = Math.min(1, ...ratios)
  const scaleCorner = ({ x, y }: ConfigGuideSpotlightCorner): ConfigGuideSpotlightCorner => ({
    x: x * scale,
    y: y * scale,
  })
  return {
    topLeft: scaleCorner(corners.topLeft),
    topRight: scaleCorner(corners.topRight),
    bottomRight: scaleCorner(corners.bottomRight),
    bottomLeft: scaleCorner(corners.bottomLeft),
  }
}

function readCorners(
  element: HTMLElement,
  width: number,
  height: number
): ConfigGuideSpotlightCorners {
  if (typeof CSS === 'undefined' || !CSS.supports?.('corner-shape', 'bevel')) {
    return SQUARE_CORNERS
  }
  const style = window.getComputedStyle(element)
  return normalizeCorners(
    {
      topLeft: cornerRadius(style.borderTopLeftRadius, width, height),
      topRight: cornerRadius(style.borderTopRightRadius, width, height),
      bottomRight: cornerRadius(style.borderBottomRightRadius, width, height),
      bottomLeft: cornerRadius(style.borderBottomLeftRadius, width, height),
    },
    width,
    height
  )
}

/** Read one immutable viewport/target snapshot for the Guide SVG overlay. */
export function readConfigGuideSpotlightGeometry(
  element: HTMLElement | undefined,
  padding: number
): ConfigGuideSpotlightGeometry {
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  if (!element?.isConnected) return { viewportWidth, viewportHeight, hole: null }

  const bounds = element.getBoundingClientRect()
  const left = Math.max(0, bounds.left - padding)
  const top = Math.max(0, bounds.top - padding)
  const right = Math.min(viewportWidth, bounds.right + padding)
  const bottom = Math.min(viewportHeight, bounds.bottom + padding)
  if (right <= left || bottom <= top) return { viewportWidth, viewportHeight, hole: null }

  return {
    viewportWidth,
    viewportHeight,
    hole: {
      top,
      right,
      bottom,
      left,
      width: right - left,
      height: bottom - top,
      corners: readCorners(element, bounds.width, bounds.height),
    },
  }
}

function createHolePath(hole: ConfigGuideSpotlightHole): string {
  const { top, right, bottom, left, corners } = hole
  return [
    `M ${coordinate(left + corners.topLeft.x)} ${coordinate(top)}`,
    `H ${coordinate(right - corners.topRight.x)}`,
    `L ${coordinate(right)} ${coordinate(top + corners.topRight.y)}`,
    `V ${coordinate(bottom - corners.bottomRight.y)}`,
    `L ${coordinate(right - corners.bottomRight.x)} ${coordinate(bottom)}`,
    `H ${coordinate(left + corners.bottomLeft.x)}`,
    `L ${coordinate(left)} ${coordinate(bottom - corners.bottomLeft.y)}`,
    `V ${coordinate(top + corners.topLeft.y)}`,
    `L ${coordinate(left + corners.topLeft.x)} ${coordinate(top)}`,
    'Z',
  ].join(' ')
}

/** Generate matching SVG paths; `evenodd` turns the second path into the interactive hole. */
export function createConfigGuideSpotlightPaths(
  geometry: ConfigGuideSpotlightGeometry
): ConfigGuideSpotlightPaths {
  const outerPath = `M 0 0 H ${coordinate(geometry.viewportWidth)} V ${coordinate(geometry.viewportHeight)} H 0 Z`
  const holePath = geometry.hole ? createHolePath(geometry.hole) : null
  return { holePath, maskPath: holePath ? `${outerPath} ${holePath}` : outerPath }
}
