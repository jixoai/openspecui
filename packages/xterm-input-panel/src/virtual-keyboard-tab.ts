import { LitElement, css, html } from 'lit'
import {
  Application,
  CanvasTextMetrics,
  Container,
  FederatedPointerEvent,
  Graphics,
  Text,
  TextStyle,
} from 'pixi.js'
import { onThemeChange, resolvePixiTheme, type PixiTheme } from './pixi-theme.js'
import { detectHostPlatform, type PlatformMode } from './platform.js'
import { LAYOUTS, type KeyDef, type ModifierKey } from './virtual-keyboard-layouts.js'

const KEY_PADDING = 3
const KEY_RADIUS = 4
const REPEAT_DELAY_MS = 400
const REPEAT_INTERVAL_MS = 80
const SWIPE_SHIFT_THRESHOLD = 14
const DUAL_LABEL_MIN_SIZE = 18
const DUAL_LABEL_MIN_RATIO = 0.92

interface RenderedKey {
  container: Container
  gfx: Graphics
  primaryText: Text
  secondaryText: Text | null
  def: KeyDef
  row: number
  col: number
  width: number
  height: number
}

interface KeyDisplay {
  single: string
  top?: string
  bottom?: string
  topActive: boolean
}

export class VirtualKeyboardTab extends LitElement {
  static get properties() {
    return {
      floating: { type: Boolean },
      platform: { type: String, reflect: true },
    }
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
    }
  `

  declare floating: boolean
  declare platform: PlatformMode

  private _app: Application | null = null
  private _container: Container | null = null
  private _keys: RenderedKey[] = []
  private _modifiers: Record<ModifierKey, boolean> = {
    ctrl: false,
    alt: false,
    meta: false,
    shift: false,
    caps: false,
  }
  private _resizeObserver: ResizeObserver | null = null
  private _theme: PixiTheme = resolvePixiTheme(this)
  private _unsubTheme: (() => void) | null = null
  private _repeatTimer: ReturnType<typeof setTimeout> | null = null
  private _repeatInterval: ReturnType<typeof setInterval> | null = null

  private _activeKey: RenderedKey | null = null
  private _activeStartY = 0
  private _activeSwipeShift = false
  private _activePointerId: number | null = null
  private _stickyModifierMode = false

  constructor() {
    super()
    this.floating = false
    this.platform = 'auto'
  }

  async connectedCallback() {
    super.connectedCallback()
    this._theme = resolvePixiTheme(this)
    this._unsubTheme = onThemeChange((theme) => {
      this._theme = theme
      this._layoutKeys()
    }, this)
    await this.updateComplete
    await this._initPixi()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelRepeat()
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
    this._unsubTheme?.()
    this._unsubTheme = null
    this._app?.destroy()
    this._app = null
    this._container = null
    this._activeKey = null
    this._activePointerId = null
  }

  private getRows(): KeyDef[][] {
    const hostPlatform =
      this.platform === 'windows' || this.platform === 'macos' || this.platform === 'common'
        ? this.platform
        : detectHostPlatform()
    return LAYOUTS[hostPlatform]
  }

  private async _initPixi() {
    const host = this.shadowRoot?.querySelector('.pixi-host') as HTMLElement
    if (!host) return

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

    const canvas = app.canvas as HTMLCanvasElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })

    const width = host.clientWidth
    const height = host.clientHeight
    if (width > 0 && height > 0) {
      app.renderer.resize(width, height)
    }

    this._container = new Container()
    app.stage.addChild(this._container)
    app.stage.eventMode = 'static'
    app.stage.hitArea = app.screen
    app.stage.on('globalpointermove', (event: FederatedPointerEvent) => {
      this._onActivePointerMove(event)
    })
    app.stage.on('pointerup', () => {
      this._onActivePointerUp()
    })
    app.stage.on('pointerupoutside', () => {
      this._onActivePointerUp()
    })
    app.stage.on('pointercancel', () => {
      this._onActivePointerUp()
    })
    this._layoutKeys()

    this._resizeObserver = new ResizeObserver(() => {
      const nextWidth = host.clientWidth
      const nextHeight = host.clientHeight
      if (nextWidth > 0 && nextHeight > 0) {
        app.renderer.resize(nextWidth, nextHeight)
        this._layoutKeys()
      }
    })
    this._resizeObserver.observe(host)
  }

  private _layoutKeys() {
    const app = this._app
    const container = this._container
    if (!app || !container) return

    container.removeChildren()
    this._keys = []

    const rows = this.getRows()
    const width = app.screen.width
    const height = app.screen.height
    const rowCount = rows.length
    const rowHeight = (height - KEY_PADDING * (rowCount + 1)) / rowCount

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = rows[rowIndex] ?? []
      const totalUnits = row.reduce((sum, def) => sum + (def.w ?? 1), 0)
      const keyUnitWidth = (width - KEY_PADDING * (row.length + 1)) / totalUnits
      let x = KEY_PADDING

      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        const def = row[colIndex]!
        const keyWidth = keyUnitWidth * (def.w ?? 1)
        const y = KEY_PADDING + rowIndex * (rowHeight + KEY_PADDING)

        const keyContainer = new Container()
        keyContainer.x = x
        keyContainer.y = y
        keyContainer.eventMode = 'static'
        keyContainer.cursor = 'pointer'

        const gfx = new Graphics()
        keyContainer.addChild(gfx)

        const primaryText = new Text({
          text: '',
          style: new TextStyle({
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 13,
            fill: this._theme.text,
            align: 'center',
          }),
        })
        primaryText.anchor.set(0.5)
        keyContainer.addChild(primaryText)

        let secondaryText: Text | null = null
        if (
          this._shouldShowDualLabels(keyWidth, rowHeight) &&
          !def.modifier &&
          Boolean(def.shift)
        ) {
          primaryText.style = new TextStyle({
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 10,
            fill: this._theme.text,
            align: 'center',
          })
          primaryText.x = keyWidth / 2
          primaryText.y = rowHeight * 0.35

          secondaryText = new Text({
            text: '',
            style: new TextStyle({
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 10,
              fill: this._theme.textMuted,
              align: 'center',
            }),
          })
          secondaryText.anchor.set(0.5)
          secondaryText.x = keyWidth / 2
          secondaryText.y = rowHeight * 0.74
          keyContainer.addChild(secondaryText)
        } else {
          primaryText.x = keyWidth / 2
          primaryText.y = rowHeight / 2
        }

        container.addChild(keyContainer)

        const rendered: RenderedKey = {
          container: keyContainer,
          gfx,
          primaryText,
          secondaryText,
          def,
          row: rowIndex,
          col: colIndex,
          width: keyWidth,
          height: rowHeight,
        }

        this._updateKeyVisual(rendered, {
          pressed: false,
          forceShift: false,
        })

        keyContainer.on('pointerdown', (e: FederatedPointerEvent) => {
          this._onKeyDown(rendered, e)
        })
        keyContainer.on('pointermove', (e: FederatedPointerEvent) => {
          this._onKeyMove(rendered, e)
        })
        keyContainer.on('pointerup', () => this._onKeyUp(rendered))
        keyContainer.on('pointerupoutside', () => this._onKeyUp(rendered))
        keyContainer.on('pointerleave', () => this._onKeyLeave(rendered))

        this._keys.push(rendered)
        x += keyWidth + KEY_PADDING
      }
    }
  }

  private _drawKey(
    gfx: Graphics,
    width: number,
    height: number,
    options: {
      pressed: boolean
      modifier: boolean
      modifierActive: boolean
      forceShift: boolean
    }
  ) {
    const { pressed, modifier, modifierActive, forceShift } = options
    const bg = pressed
      ? this._theme.keyPressed
      : modifier
        ? modifierActive
          ? this._theme.keyPressed
          : this._theme.keyModifier
        : this._theme.keyNormal

    gfx.clear()
    gfx.roundRect(0, 0, width, height, KEY_RADIUS)
    gfx.fill({ color: bg })
    gfx.stroke({
      color: forceShift ? this._theme.accent : this._theme.surfaceBorder,
      width: forceShift ? 1.5 : 1,
    })
  }

  private _measureTextWidth(text: Text): number {
    const content = typeof text.text === 'string' ? text.text : String(text.text ?? '')
    if (!content) return 0
    try {
      return CanvasTextMetrics.measureText(content, text.style).width
    } catch {
      return text.width / Math.max(text.scale.x, 0.0001)
    }
  }

  private _fitText(text: Text, maxWidth: number, minScale = 0.45) {
    if (maxWidth <= 0) return
    text.scale.set(1)
    const width = this._measureTextWidth(text)
    if (width <= maxWidth) {
      return
    }
    const scale = Math.max(minScale, maxWidth / width)
    text.scale.set(scale)
  }

  private _isLetterKey(def: KeyDef): boolean {
    return def.data.length === 1 && /[a-z]/i.test(def.data)
  }

  private _shouldShowDualLabels(keyWidth: number, keyHeight: number): boolean {
    if (keyHeight < DUAL_LABEL_MIN_SIZE) {
      return false
    }
    return keyHeight / keyWidth >= DUAL_LABEL_MIN_RATIO
  }

  private _isShifted(def: KeyDef, forceShift: boolean): boolean {
    const baseShift = this._modifiers.shift || forceShift
    if (this._isLetterKey(def) && this._modifiers.caps) {
      return !baseShift
    }
    return baseShift
  }

  private _resolveDisplay(def: KeyDef, forceShift: boolean): KeyDisplay {
    if (this._isLetterKey(def)) {
      const upper = def.shift?.label ?? def.label.toUpperCase()
      const lower = def.label.toLowerCase()
      const topActive = this._isShifted(def, forceShift)
      return {
        single: topActive ? upper : lower,
        top: upper,
        bottom: lower,
        topActive,
      }
    }

    if (def.shift) {
      const topActive = this._isShifted(def, forceShift)
      return {
        single: topActive ? def.shift.label : def.label,
        top: def.shift.label,
        bottom: def.label,
        topActive,
      }
    }

    return {
      single: def.label,
      topActive: false,
    }
  }

  private _updateKeyVisual(
    rendered: RenderedKey,
    options: {
      pressed: boolean
      forceShift: boolean
    }
  ) {
    const { def, primaryText, secondaryText, gfx, width, height } = rendered
    const modifier = Boolean(def.modifier || def.special === 'chord')
    const modifierActive = def.modifier
      ? this._modifiers[def.modifier]
      : def.special === 'chord'
        ? this._stickyModifierMode
        : false
    const display = this._resolveDisplay(def, options.forceShift)

    this._drawKey(gfx, width, height, {
      pressed: options.pressed,
      modifier,
      modifierActive,
      forceShift: options.forceShift,
    })

    if (secondaryText && display.top && display.bottom) {
      primaryText.text = display.top
      secondaryText.text = display.bottom
      this._fitText(primaryText, width - 8)
      this._fitText(secondaryText, width - 8)

      if (options.pressed) {
        primaryText.style.fill = this._theme.accentFg
        secondaryText.style.fill = this._theme.accentFg
      } else if (display.topActive) {
        primaryText.style.fill = this._theme.text
        secondaryText.style.fill = this._theme.textMuted
      } else {
        primaryText.style.fill = this._theme.textMuted
        secondaryText.style.fill = this._theme.text
      }
      return
    }

    primaryText.text = display.single
    this._fitText(primaryText, width - 8)
    if (options.pressed) {
      primaryText.style.fill = this._theme.accentFg
      return
    }

    if (modifierActive) {
      primaryText.style.fill = this._theme.accent
      return
    }

    primaryText.style.fill = this._theme.text
  }

  private _canSwipeShift(def: KeyDef): boolean {
    return !def.modifier && (Boolean(def.shift) || this._isLetterKey(def))
  }

  private _onKeyDown(rendered: RenderedKey, event: FederatedPointerEvent) {
    const { def } = rendered

    if (def.special === 'chord') {
      this._stickyModifierMode = !this._stickyModifierMode
      if (!this._stickyModifierMode) {
        this._resetTransientModifiers()
      }
      this._vibrate(10)
      this._layoutKeys()
      return
    }

    if (def.modifier) {
      this._modifiers[def.modifier] = !this._modifiers[def.modifier]
      this._vibrate(10)
      this._layoutKeys()
      return
    }

    this._activeKey = rendered
    this._setPointerCapture(event.pointerId)
    this._activeStartY = event.global?.y ?? 0
    this._activeSwipeShift = false

    this._updateKeyVisual(rendered, { pressed: true, forceShift: false })
    this._vibrate(5)

    this._cancelRepeat()
    this._repeatTimer = setTimeout(() => {
      this._repeatTimer = null
      this._repeatInterval = setInterval(() => {
        this._sendKey(def, this._activeSwipeShift)
        this._vibrate(3)
      }, REPEAT_INTERVAL_MS)
    }, REPEAT_DELAY_MS)
  }

  private _onActivePointerMove(event: FederatedPointerEvent) {
    const activeKey = this._activeKey
    if (!activeKey) return
    this._onKeyMove(activeKey, event)
  }

  private _onActivePointerUp() {
    const activeKey = this._activeKey
    if (!activeKey) return
    this._onKeyUp(activeKey)
  }

  private _onKeyMove(rendered: RenderedKey, event: FederatedPointerEvent) {
    if (this._activeKey !== rendered) return
    if (!this._canSwipeShift(rendered.def)) return

    const pointerY = event.global?.y ?? this._activeStartY
    const nextSwipeShift = this._activeStartY - pointerY >= SWIPE_SHIFT_THRESHOLD
    if (nextSwipeShift === this._activeSwipeShift) return

    this._activeSwipeShift = nextSwipeShift
    this._updateKeyVisual(rendered, {
      pressed: true,
      forceShift: this._activeSwipeShift,
    })
  }

  private _onKeyLeave(rendered: RenderedKey) {
    if (this._activeKey !== rendered) return
  }

  private _resetTransientModifiers() {
    if (this._stickyModifierMode) {
      return
    }
    this._modifiers.ctrl = false
    this._modifiers.alt = false
    this._modifiers.meta = false
    this._modifiers.shift = false
  }

  private _onKeyUp(rendered: RenderedKey) {
    this._cancelRepeat()

    if (rendered.def.modifier) return
    if (this._activeKey !== rendered) return

    const forceShift = this._activeSwipeShift
    this._activeKey = null
    this._activeSwipeShift = false

    this._updateKeyVisual(rendered, {
      pressed: false,
      forceShift: false,
    })

    this._sendKey(rendered.def, forceShift)
    this._resetTransientModifiers()
    this._layoutKeys()
    this._releasePointerCapture()
  }

  private _resolveOutputData(def: KeyDef, forceShift: boolean): string {
    if (this._isLetterKey(def)) {
      const upper = def.shift?.data ?? def.data.toUpperCase()
      const lower = def.data.toLowerCase()
      return this._isShifted(def, forceShift) ? upper : lower
    }

    if (this._isShifted(def, forceShift) && def.shift) {
      return def.shift.data
    }

    return def.data
  }

  private _sendKey(def: KeyDef, forceShift: boolean) {
    let data = this._resolveOutputData(def, forceShift)
    if (!data) return

    if (this._modifiers.ctrl && data.length === 1) {
      const code = data.toUpperCase().charCodeAt(0) - 64
      if (code > 0 && code < 32) {
        data = String.fromCharCode(code)
      }
    }

    if (this._modifiers.alt || this._modifiers.meta) {
      data = `\x1b${data}`
    }

    this.dispatchEvent(
      new CustomEvent('input-panel:send', {
        detail: { data },
        bubbles: true,
        composed: true,
      })
    )
  }

  private _cancelRepeat() {
    if (this._repeatTimer) {
      clearTimeout(this._repeatTimer)
      this._repeatTimer = null
    }
    if (this._repeatInterval) {
      clearInterval(this._repeatInterval)
      this._repeatInterval = null
    }
  }

  private _setPointerCapture(pointerId: number) {
    this._activePointerId = pointerId
    const canvas = this._app?.canvas as HTMLCanvasElement | undefined
    if (!canvas?.setPointerCapture) return
    try {
      canvas.setPointerCapture(pointerId)
    } catch {
      // ignore pointer capture failures
    }
  }

  private _releasePointerCapture() {
    const pointerId = this._activePointerId
    this._activePointerId = null
    if (pointerId == null) return
    const canvas = this._app?.canvas as HTMLCanvasElement | undefined
    if (!canvas?.releasePointerCapture) return
    try {
      if (!canvas.hasPointerCapture?.(pointerId)) return
      canvas.releasePointerCapture(pointerId)
    } catch {
      // ignore pointer capture failures
    }
  }

  private _vibrate(ms: number) {
    try {
      navigator.vibrate?.(ms)
    } catch {
      // ignore
    }
  }

  render() {
    return html`<div class="pixi-host" style="width:100%;height:100%"></div>`
  }
}

customElements.define('virtual-keyboard-tab', VirtualKeyboardTab)
