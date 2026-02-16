/**
 * Theme bridge: reads CSS custom properties from component scope,
 * converts oklch → hex for PixiJS, and notifies components on theme changes.
 */

export interface PixiTheme {
  background: number // --terminal
  surface: number // --muted
  surfaceBorder: number // --border
  keyNormal: number // slightly lighter than --muted
  keyModifier: number // between surface and keyNormal
  keyPressed: number // lighter still
  text: number // --terminal-foreground
  textMuted: number // --muted-foreground
  accent: number // --primary
  accentFg: number // --primary-foreground
  feedbackColor: number // --primary (for trackpad touch feedback)
  hintText: number // dimmed text for trackpad hints
}

// --- oklch → hex conversion via canvas ---

let _cvs: HTMLCanvasElement | null = null
let _ctx: CanvasRenderingContext2D | null = null

function getConversionContext(): CanvasRenderingContext2D {
  if (!_ctx) {
    _cvs = document.createElement('canvas')
    _cvs.width = 1
    _cvs.height = 1
    _ctx = _cvs.getContext('2d')!
  }
  return _ctx
}

/** Convert any CSS color string to a 0xRRGGBB number via canvas normalization. */
export function cssColorToHex(cssColor: string): number | null {
  if (!cssColor || cssColor === '') return null
  const ctx = getConversionContext()
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = '#000000' // reset
  ctx.fillStyle = cssColor
  const normalized = ctx.fillStyle
  // Canvas normalizes to #rrggbb or rgb(...)
  if (normalized.startsWith('#')) {
    return parseInt(normalized.slice(1), 16)
  }
  // Parse rgb(r, g, b)
  const m = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m) {
    return (parseInt(m[1]) << 16) | (parseInt(m[2]) << 8) | parseInt(m[3])
  }
  return null
}

/** Read a CSS custom property from computed style and convert to hex. */
function cssVarToHex(style: CSSStyleDeclaration, varName: string, fallback: number): number {
  const value = style.getPropertyValue(varName).trim()
  if (!value) return fallback
  const hex = cssColorToHex(value)
  return hex ?? fallback
}

/** Blend two hex colors by a factor (0 = a, 1 = b). */
export function blendHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff,
    ag = (a >> 8) & 0xff,
    ab = a & 0xff
  const br = (b >> 16) & 0xff,
    bg = (b >> 8) & 0xff,
    bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

/** Build the current PixiTheme from scoped CSS custom properties. */
export function resolvePixiTheme(scope: Element = document.documentElement): PixiTheme {
  const style = getComputedStyle(scope)
  const background = cssVarToHex(style, '--terminal', 0x1a1a1a)
  const surface = cssVarToHex(style, '--muted', 0x222222)
  const border = cssVarToHex(style, '--border', 0x555555)
  const fg = cssVarToHex(
    style,
    '--terminal-foreground',
    cssVarToHex(style, '--foreground', 0xffffff)
  )
  const mutedFg = cssVarToHex(style, '--muted-foreground', 0x888888)
  const primary = cssVarToHex(style, '--primary', 0xe04a2f)
  const primaryFg = cssVarToHex(style, '--primary-foreground', 0xffffff)

  // Derive key colors from surface
  const keyNormal = blendHex(surface, fg, 0.12)
  const keyModifier = blendHex(surface, fg, 0.06)
  const keyPressed = blendHex(surface, fg, 0.25)

  return {
    background,
    surface,
    surfaceBorder: border,
    keyNormal,
    keyModifier,
    keyPressed,
    text: fg,
    textMuted: mutedFg,
    accent: primary,
    accentFg: primaryFg,
    feedbackColor: primary,
    hintText: blendHex(surface, mutedFg, 0.5),
  }
}

// --- Theme change observation ---

type ThemeCallback = (theme: PixiTheme) => void

interface ThemeSubscriber {
  callback: ThemeCallback
  scope: Element
}

const subscribers = new Set<ThemeSubscriber>()
let observer: MutationObserver | null = null
let mediaQuery: MediaQueryList | null = null

function notifyAll(): void {
  for (const subscriber of subscribers) {
    subscriber.callback(resolvePixiTheme(subscriber.scope))
  }
}

function ensureObserver(): void {
  if (observer) return

  // Watch class attribute changes on <html> (e.g. .dark toggle)
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        notifyAll()
        return
      }
    }
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  // Also watch prefers-color-scheme changes
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', notifyAll)
}

function maybeCleanupObserver(): void {
  if (subscribers.size > 0) return
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (mediaQuery) {
    mediaQuery.removeEventListener('change', notifyAll)
    mediaQuery = null
  }
}

/** Subscribe to theme changes. Returns an unsubscribe function. */
export function onThemeChange(
  callback: ThemeCallback,
  scope: Element = document.documentElement
): () => void {
  const subscriber: ThemeSubscriber = { callback, scope }
  subscribers.add(subscriber)
  ensureObserver()
  return () => {
    subscribers.delete(subscriber)
    maybeCleanupObserver()
  }
}
