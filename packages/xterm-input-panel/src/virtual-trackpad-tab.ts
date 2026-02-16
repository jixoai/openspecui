import { LitElement, css, html } from 'lit'
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import { onThemeChange, resolvePixiTheme, type PixiTheme } from './pixi-theme.js'

// Gesture thresholds
const DRAG_THRESHOLD = 8
const LONG_PRESS_MS = 500
const DOUBLE_TAP_MS = 300
const SCROLL_STEP = 20

// Edge zone infinite sliding
const EDGE_TICK_MS = 16 // ~60fps emission rate during infinite slide
const EDGE_MIN_SPEED = 1 // px/tick at zone boundary (depth=0)
const EDGE_MAX_SPEED = 12 // px/tick at actual edge (depth=1)

// Edge zone adaptive sizing: clamp(minPx, pct * min(w,h), maxPx)
const EDGE_MIN_PX = 20
const EDGE_PCT = 0.15
const EDGE_MAX_PX = 60

// Base glow alpha when dragging (before edge proximity boosts it)
const GLOW_BASE = 0.15

/**
 * Virtual trackpad — pure gesture input device.
 *
 * Gesture model mirrors a real laptop trackpad:
 *
 * Single-finger gestures:
 * - Slide → `trackpad:move` { dx, dy }           Move the cursor (no button pressed)
 * - Tap (touch + release, no movement) → `trackpad:tap`    Left click
 * - Tap, then tap-and-hold, then slide → drag gesture:
 *     `trackpad:drag-start` → `trackpad:drag-move` { dx, dy } → `trackpad:drag-end`
 *     This is mousedown + mousemove(buttons=1) + mouseup — used for text selection.
 * - Double-tap (two quick taps) → `trackpad:double-tap`    Double-click (select word)
 * - Long press (>500ms) → `trackpad:long-press`            Right-click
 *
 * Two-finger gestures:
 * - Vertical slide → `trackpad:scroll` { deltaY }          Scroll
 * - Tap (two fingers touch + release, little movement) → `trackpad:two-finger-tap`  Right-click
 */
export class VirtualTrackpadTab extends LitElement {
  static get properties() {
    return {
      floating: { type: Boolean },
    }
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
    }

    .pixi-host {
      position: relative;
      width: 100%;
      height: 100%;
    }

    /* Single overlay — box-shadow: inset provides a natural inner-shadow halo */
    .edge-glow {
      position: absolute;
      inset: 8px;
      border-radius: 8px;
      pointer-events: none;
      z-index: 1;
    }
  `

  declare floating: boolean

  constructor() {
    super()
    this.floating = false
  }

  private _app: Application | null = null
  private _container: Container | null = null
  private _feedbackGfx: Graphics | null = null
  private _resizeObserver: ResizeObserver | null = null
  private _theme: PixiTheme = resolvePixiTheme(this)
  private _unsubTheme: (() => void) | null = null

  // Gesture state
  private _touchStart: { x: number; y: number; time: number } | null = null
  private _isDragging = false
  private _longPressTimer: ReturnType<typeof setTimeout> | null = null
  private _lastTapTime = 0
  private _lastDragPos = { x: 0, y: 0 }

  // Second-touch detection (tap-then-drag / double-tap)
  private _isSecondTouch = false

  // Two-finger state
  private _twoFingerStart: { y: number; time: number } | null = null
  private _twoFingerMoved = false

  // Edge glow overlay (single element, driven by box-shadow)
  private _edgeOverlay: HTMLElement | null = null
  private _accentRgb = '224,74,47'
  private _edgeSlideInterval: ReturnType<typeof setInterval> | null = null

  async connectedCallback() {
    super.connectedCallback()
    this._theme = resolvePixiTheme(this)
    this._syncAccentRgb()
    this._unsubTheme = onThemeChange((theme) => {
      this._theme = theme
      this._syncAccentRgb()
      this._drawSurface()
    }, this)
    await this.updateComplete
    await this._initPixi()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this._longPressTimer) clearTimeout(this._longPressTimer)
    this._stopEdgeSlide()
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
    this._unsubTheme?.()
    this._unsubTheme = null
    this._app?.destroy()
    this._app = null
    this._container = null
  }

  /** Cache accent color as "r,g,b" string for box-shadow rgba(). */
  private _syncAccentRgb() {
    const hex = this._theme.accent
    const r = (hex >> 16) & 0xff
    const g = (hex >> 8) & 0xff
    const b = hex & 0xff
    this._accentRgb = `${r},${g},${b}`
  }

  private async _initPixi() {
    const host = this.shadowRoot?.querySelector('.pixi-host') as HTMLElement
    if (!host) return

    this._edgeOverlay = this.shadowRoot?.querySelector('.edge-glow') as HTMLElement

    const app = new Application()
    await app.init({
      background: this._theme.background,
      backgroundAlpha: this.floating ? 0 : 1,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: false,
    })

    host.appendChild(app.canvas as HTMLCanvasElement)
    this._app = app

    // CSS sizing: canvas fills host
    const canvas = app.canvas as HTMLCanvasElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // Initial size
    const w = host.clientWidth
    const h = host.clientHeight
    if (w > 0 && h > 0) {
      app.renderer.resize(w, h)
    }

    this._container = new Container()
    app.stage.addChild(this._container)

    this._drawSurface()

    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false })
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false })
    canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false })
    canvas.addEventListener('touchcancel', () => this._onTouchCancel(), { passive: false })

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return
      this._handlePointerStart(e.offsetX, e.offsetY)
    })
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return
      this._handlePointerMove(e.offsetX, e.offsetY)
    })
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return
      this._handlePointerEnd()
    })

    this._resizeObserver = new ResizeObserver(() => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w > 0 && h > 0) {
        app.renderer.resize(w, h)
        this._drawSurface()
      }
    })
    this._resizeObserver.observe(host)
  }

  /** Compute uniform edge zone depth: clamp(EDGE_MIN_PX, EDGE_PCT * min(w,h), EDGE_MAX_PX). */
  private _getEdgeZoneSize(): number {
    const app = this._app
    if (!app) return 40
    const surfaceW = app.screen.width - 16
    const surfaceH = app.screen.height - 16
    return Math.max(EDGE_MIN_PX, Math.min(EDGE_MAX_PX, Math.min(surfaceW, surfaceH) * EDGE_PCT))
  }

  private _drawSurface() {
    const app = this._app
    const container = this._container
    if (!app || !container) return

    container.removeChildren()
    this._feedbackGfx = null

    const theme = this._theme
    const w = app.screen.width
    const h = app.screen.height

    // Background surface
    const surface = new Graphics()
    surface.roundRect(8, 8, w - 16, h - 16, 8)
    surface.fill({ color: theme.surface })
    surface.stroke({ color: theme.surfaceBorder, width: 1 })
    container.addChild(surface)

    // Center hint label
    const hintText = 'Drag: move  |  Tap: click  |  2-finger: scroll'

    const style = new TextStyle({
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      fontSize: 11,
      fill: theme.hintText,
      align: 'center',
    })
    const label = new Text({ text: hintText, style })
    label.anchor.set(0.5)
    label.x = w / 2
    label.y = h / 2
    container.addChild(label)

    // Feedback circle (hidden initially)
    const fb = new Graphics()
    fb.circle(0, 0, 20)
    fb.fill({ color: theme.feedbackColor, alpha: 0 })
    this._feedbackGfx = fb
    container.addChild(fb)
  }

  // --- Touch handlers ---

  private _onTouchStart(e: TouchEvent) {
    e.preventDefault()
    if (e.touches.length === 2) {
      const y = (e.touches[0].clientY + e.touches[1].clientY) / 2
      this._twoFingerStart = { y, time: Date.now() }
      this._twoFingerMoved = false
      this._cancelLongPress()
      // Cancel any single-finger gesture in progress
      this._touchStart = null
      this._isDragging = false
      return
    }
    if (e.touches.length === 1) {
      const t = e.touches[0]
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      this._handlePointerStart(t.clientX - rect.left, t.clientY - rect.top)
    }
  }

  private _onTouchMove(e: TouchEvent) {
    e.preventDefault()
    if (e.touches.length === 2 && this._twoFingerStart) {
      const y = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const dy = y - this._twoFingerStart.y

      if (Math.abs(dy) > SCROLL_STEP) {
        this._twoFingerMoved = true
        this._dispatch('trackpad:scroll', { deltaY: dy })
        this._twoFingerStart = { y, time: this._twoFingerStart.time }
        this._vibrate(5)
      }
      return
    }
    if (e.touches.length === 1) {
      const t = e.touches[0]
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      this._handlePointerMove(t.clientX - rect.left, t.clientY - rect.top)
    }
  }

  private _onTouchEnd(e: TouchEvent) {
    e.preventDefault()
    if (this._twoFingerStart && e.touches.length < 2) {
      // Two-finger tap: both fingers touched and lifted with little/no vertical movement
      if (!this._twoFingerMoved) {
        this._dispatch('trackpad:two-finger-tap', { button: 'right' })
        this._vibrate(15)
      }
      this._twoFingerStart = null
      this._twoFingerMoved = false
      return
    }
    if (e.touches.length === 0) {
      this._handlePointerEnd()
    }
  }

  private _onTouchCancel() {
    this._touchStart = null
    this._isDragging = false
    this._isSecondTouch = false
    this._twoFingerStart = null
    this._twoFingerMoved = false
    this._cancelLongPress()
    this._stopEdgeSlide()
    this._hideGlow()
  }

  // --- Unified pointer logic ---

  private _handlePointerStart(x: number, y: number) {
    const now = Date.now()
    this._touchStart = { x, y, time: now }
    this._lastDragPos = { x, y }
    this._isDragging = false

    // Is this the second touch of a double-tap sequence?
    this._isSecondTouch = now - this._lastTapTime < DOUBLE_TAP_MS

    this._showFeedback(x, y)

    // Long press → right-click (only on fresh touches, not second-touch)
    if (!this._isSecondTouch) {
      this._longPressTimer = setTimeout(() => {
        this._longPressTimer = null
        this._dispatch('trackpad:long-press', { button: 'right' })
        this._vibrate(30)
        this._touchStart = null
      }, LONG_PRESS_MS)
    }
  }

  private _handlePointerMove(x: number, y: number) {
    if (!this._touchStart) return

    const dx = x - this._touchStart.x
    const dy = y - this._touchStart.y

    if (!this._isDragging && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
      this._isDragging = true
      this._lastDragPos = { x, y }
      this._cancelLongPress()

      // Show uniform base inner-shadow glow immediately
      this._applyGlow({ left: 0, right: 0, top: 0, bottom: 0 })

      // Second touch starts dragging → click-drag (for text selection)
      if (this._isSecondTouch) {
        this._dispatch('trackpad:drag-start', {})
      }
    }

    if (this._isDragging) {
      const moveDx = x - this._lastDragPos.x
      const moveDy = y - this._lastDragPos.y
      this._lastDragPos = { x, y }

      if (this._isSecondTouch) {
        // Drag with "button held" — for text selection
        this._dispatch('trackpad:drag-move', { dx: moveDx, dy: moveDy })
      } else {
        // Normal cursor movement
        this._dispatch('trackpad:move', { dx: moveDx, dy: moveDy })
      }

      this._showFeedback(x, y)

      // Edge zone: update glow and start/stop infinite slide
      const depths = this._getEdgeDepths(x, y)
      this._applyGlow(depths)
      const inEdge = depths.left > 0 || depths.right > 0 || depths.top > 0 || depths.bottom > 0
      if (inEdge) {
        this._startEdgeSlide()
      } else {
        this._stopEdgeSlide()
      }
    }
  }

  private _handlePointerEnd() {
    this._cancelLongPress()
    this._hideFeedback()
    this._stopEdgeSlide()
    this._hideGlow()

    if (!this._touchStart) return
    const now = Date.now()

    if (this._isDragging) {
      if (this._isSecondTouch) {
        // End of click-drag
        this._dispatch('trackpad:drag-end', {})
      }
      // End of normal cursor move — no event needed
    } else {
      // No drag happened — it was a tap
      if (this._isSecondTouch) {
        // Quick second tap → double-tap
        this._dispatch('trackpad:double-tap', { button: 'left' })
        this._vibrate(15)
        this._lastTapTime = 0
      } else {
        // Single tap
        this._dispatch('trackpad:tap', { button: 'left' })
        this._vibrate(5)
        this._lastTapTime = now
      }
    }

    this._touchStart = null
    this._isDragging = false
    this._isSecondTouch = false
  }

  // --- Edge zone helpers ---

  private _getEdgeDepths(
    x: number,
    y: number
  ): { left: number; right: number; top: number; bottom: number } {
    const app = this._app
    if (!app) return { left: 0, right: 0, top: 0, bottom: 0 }

    const w = app.screen.width
    const h = app.screen.height
    const pad = 8 // surface padding
    const edge = this._getEdgeZoneSize()

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

    return {
      left: clamp01((edge - (x - pad)) / edge),
      right: clamp01((edge - (w - pad - x)) / edge),
      top: clamp01((edge - (y - pad)) / edge),
      bottom: clamp01((edge - (h - pad - y)) / edge),
    }
  }

  /**
   * Set the inner-shadow glow via 4 directional inset box-shadows on a single overlay.
   * Each edge gets: base alpha + depth * (max - base).
   * box-shadow composites naturally at corners — no hard seams.
   */
  private _applyGlow(depths: { left: number; right: number; top: number; bottom: number }) {
    if (!this._edgeOverlay) return
    const edge = Math.round(this._getEdgeZoneSize())
    const blur = Math.round(edge * 0.8)
    const spread = Math.round(edge * 0.4)
    const rgb = this._accentRgb
    const a = (depth: number) => (GLOW_BASE + depth * (0.55 - GLOW_BASE)).toFixed(2)

    this._edgeOverlay.style.boxShadow = [
      `inset ${edge}px 0 ${blur}px -${spread}px rgba(${rgb},${a(depths.left)})`,
      `inset -${edge}px 0 ${blur}px -${spread}px rgba(${rgb},${a(depths.right)})`,
      `inset 0 ${edge}px ${blur}px -${spread}px rgba(${rgb},${a(depths.top)})`,
      `inset 0 -${edge}px ${blur}px -${spread}px rgba(${rgb},${a(depths.bottom)})`,
    ].join(',')
  }

  /** Remove all glow. */
  private _hideGlow() {
    if (!this._edgeOverlay) return
    this._edgeOverlay.style.boxShadow = 'none'
  }

  private _startEdgeSlide() {
    if (this._edgeSlideInterval) return // already running
    this._edgeSlideInterval = setInterval(() => {
      this._emitEdgeSlide()
    }, EDGE_TICK_MS)
  }

  private _stopEdgeSlide() {
    if (this._edgeSlideInterval) {
      clearInterval(this._edgeSlideInterval)
      this._edgeSlideInterval = null
    }
  }

  private _emitEdgeSlide() {
    const { x, y } = this._lastDragPos
    const depths = this._getEdgeDepths(x, y)

    // Per-axis speed: proportional to depth into edge zone
    const speed = (depth: number) => EDGE_MIN_SPEED + depth * (EDGE_MAX_SPEED - EDGE_MIN_SPEED)
    const dx = depths.right * speed(depths.right) - depths.left * speed(depths.left)
    const dy = depths.bottom * speed(depths.bottom) - depths.top * speed(depths.top)

    if (dx === 0 && dy === 0) return // not in any edge zone

    const eventName = this._isSecondTouch ? 'trackpad:drag-move' : 'trackpad:move'
    this._dispatch(eventName, { dx, dy })
  }

  // --- General helpers ---

  private _dispatch(name: string, detail: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }

  private _cancelLongPress() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer)
      this._longPressTimer = null
    }
  }

  private _showFeedback(x: number, y: number) {
    if (this._feedbackGfx) {
      this._feedbackGfx.x = x
      this._feedbackGfx.y = y
      this._feedbackGfx.alpha = 0.4
    }
  }

  private _hideFeedback() {
    if (this._feedbackGfx) this._feedbackGfx.alpha = 0
  }

  private _vibrate(ms: number) {
    try {
      navigator?.vibrate?.(ms)
    } catch {
      // ignore
    }
  }

  render() {
    return html`
      <div class="pixi-host">
        <div class="edge-glow"></div>
      </div>
    `
  }
}

customElements.define('virtual-trackpad-tab', VirtualTrackpadTab)
