import { LitElement, html, css } from 'lit'
import { Application, Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js'
import { resolvePixiTheme, onThemeChange, type PixiTheme } from './pixi-theme.js'

// --- Key definitions ---

interface KeyDef {
  label: string
  /** Data to send. If starts with \x, sent raw. Otherwise sent as-is. */
  data: string
  /** Width multiplier (default 1) */
  w?: number
  /** Whether this is a modifier toggle */
  modifier?: 'ctrl' | 'alt' | 'meta' | 'shift'
  /** Shifted variant of this key */
  shift?: { label: string; data: string }
  /** Special action */
  action?: 'layer-toggle'
}

// --- Layer 1: Terminal keys (existing) ---

const TERMINAL_ROW_0: KeyDef[] = [
  { label: 'QWERTY', data: '', action: 'layer-toggle', w: 1.5 },
  { label: 'Tab', data: '\t', w: 1.2 },
  { label: 'Esc', data: '\x1b', w: 1.2 },
  { label: 'Ctrl', data: '', modifier: 'ctrl', w: 1.2 },
  { label: 'Alt', data: '', modifier: 'alt', w: 1.2 },
  { label: 'Meta', data: '', modifier: 'meta', w: 1.2 },
]

const TERMINAL_ROW_1: KeyDef[] = [
  { label: '`', data: '`' },
  { label: '~', data: '~' },
  { label: '|', data: '|' },
  { label: '\\', data: '\\' },
  { label: '/', data: '/' },
  { label: '{', data: '{' },
  { label: '}', data: '}' },
  { label: '[', data: '[' },
  { label: ']', data: ']' },
  { label: '<', data: '<' },
  { label: '>', data: '>' },
  { label: '_', data: '_' },
]

const TERMINAL_ROW_2: KeyDef[] = [
  { label: '\u2190', data: '\x1b[D' },
  { label: '\u2191', data: '\x1b[A' },
  { label: '\u2193', data: '\x1b[B' },
  { label: '\u2192', data: '\x1b[C' },
  { label: 'Home', data: '\x1b[H', w: 1.3 },
  { label: 'End', data: '\x1b[F', w: 1.3 },
  { label: 'PgUp', data: '\x1b[5~', w: 1.3 },
  { label: 'PgDn', data: '\x1b[6~', w: 1.3 },
]

const TERMINAL_ROW_3: KeyDef[] = [
  { label: 'C-c', data: '\x03', w: 1.2 },
  { label: 'C-d', data: '\x04', w: 1.2 },
  { label: 'C-z', data: '\x1a', w: 1.2 },
  { label: 'C-l', data: '\x0c', w: 1.2 },
  { label: 'C-a', data: '\x01', w: 1.2 },
  { label: 'C-r', data: '\x12', w: 1.2 },
]

const TERMINAL_ROWS = [TERMINAL_ROW_0, TERMINAL_ROW_1, TERMINAL_ROW_2, TERMINAL_ROW_3]

// --- Layer 0: QWERTY keyboard ---

const QWERTY_ROW_NUMBERS: KeyDef[] = [
  { label: '1', data: '1', shift: { label: '!', data: '!' } },
  { label: '2', data: '2', shift: { label: '@', data: '@' } },
  { label: '3', data: '3', shift: { label: '#', data: '#' } },
  { label: '4', data: '4', shift: { label: '$', data: '$' } },
  { label: '5', data: '5', shift: { label: '%', data: '%' } },
  { label: '6', data: '6', shift: { label: '^', data: '^' } },
  { label: '7', data: '7', shift: { label: '&', data: '&' } },
  { label: '8', data: '8', shift: { label: '*', data: '*' } },
  { label: '9', data: '9', shift: { label: '(', data: '(' } },
  { label: '0', data: '0', shift: { label: ')', data: ')' } },
  { label: '-', data: '-', shift: { label: '_', data: '_' } },
  { label: '=', data: '=', shift: { label: '+', data: '+' } },
  { label: 'Bksp', data: '\x7f', w: 1.5 },
]

const QWERTY_ROW_1: KeyDef[] = [
  { label: 'Tab', data: '\t', w: 1.5 },
  { label: 'q', data: 'q', shift: { label: 'Q', data: 'Q' } },
  { label: 'w', data: 'w', shift: { label: 'W', data: 'W' } },
  { label: 'e', data: 'e', shift: { label: 'E', data: 'E' } },
  { label: 'r', data: 'r', shift: { label: 'R', data: 'R' } },
  { label: 't', data: 't', shift: { label: 'T', data: 'T' } },
  { label: 'y', data: 'y', shift: { label: 'Y', data: 'Y' } },
  { label: 'u', data: 'u', shift: { label: 'U', data: 'U' } },
  { label: 'i', data: 'i', shift: { label: 'I', data: 'I' } },
  { label: 'o', data: 'o', shift: { label: 'O', data: 'O' } },
  { label: 'p', data: 'p', shift: { label: 'P', data: 'P' } },
  { label: '[', data: '[', shift: { label: '{', data: '{' } },
  { label: ']', data: ']', shift: { label: '}', data: '}' } },
  { label: '\\', data: '\\', shift: { label: '|', data: '|' } },
]

const QWERTY_ROW_2: KeyDef[] = [
  { label: 'Ctrl', data: '', modifier: 'ctrl', w: 1.7 },
  { label: 'a', data: 'a', shift: { label: 'A', data: 'A' } },
  { label: 's', data: 's', shift: { label: 'S', data: 'S' } },
  { label: 'd', data: 'd', shift: { label: 'D', data: 'D' } },
  { label: 'f', data: 'f', shift: { label: 'F', data: 'F' } },
  { label: 'g', data: 'g', shift: { label: 'G', data: 'G' } },
  { label: 'h', data: 'h', shift: { label: 'H', data: 'H' } },
  { label: 'j', data: 'j', shift: { label: 'J', data: 'J' } },
  { label: 'k', data: 'k', shift: { label: 'K', data: 'K' } },
  { label: 'l', data: 'l', shift: { label: 'L', data: 'L' } },
  { label: ';', data: ';', shift: { label: ':', data: ':' } },
  { label: "'", data: "'", shift: { label: '"', data: '"' } },
  { label: 'Enter', data: '\r', w: 1.7 },
]

const QWERTY_ROW_3: KeyDef[] = [
  { label: 'Shift', data: '', modifier: 'shift', w: 2.2 },
  { label: 'z', data: 'z', shift: { label: 'Z', data: 'Z' } },
  { label: 'x', data: 'x', shift: { label: 'X', data: 'X' } },
  { label: 'c', data: 'c', shift: { label: 'C', data: 'C' } },
  { label: 'v', data: 'v', shift: { label: 'V', data: 'V' } },
  { label: 'b', data: 'b', shift: { label: 'B', data: 'B' } },
  { label: 'n', data: 'n', shift: { label: 'N', data: 'N' } },
  { label: 'm', data: 'm', shift: { label: 'M', data: 'M' } },
  { label: ',', data: ',', shift: { label: '<', data: '<' } },
  { label: '.', data: '.', shift: { label: '>', data: '>' } },
  { label: '/', data: '/', shift: { label: '?', data: '?' } },
  { label: 'Shift', data: '', modifier: 'shift', w: 2.2 },
]

const QWERTY_ROW_SPACE: KeyDef[] = [
  { label: 'Term', data: '', action: 'layer-toggle', w: 1.5 },
  { label: 'Alt', data: '', modifier: 'alt', w: 1.2 },
  { label: 'Meta', data: '', modifier: 'meta', w: 1.2 },
  { label: ' ', data: ' ', w: 4 },
  { label: 'Esc', data: '\x1b', w: 1.2 },
  { label: '\u2190', data: '\x1b[D' },
  { label: '\u2192', data: '\x1b[C' },
]

const QWERTY_ROWS = [QWERTY_ROW_NUMBERS, QWERTY_ROW_1, QWERTY_ROW_2, QWERTY_ROW_3, QWERTY_ROW_SPACE]

// --- Component ---

export class VirtualKeyboardTab extends LitElement {
  static get properties() {
    return {
      floating: { type: Boolean },
      _activeLayer: { state: true },
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
  declare _activeLayer: number

  constructor() {
    super()
    this.floating = false
    this._activeLayer = 0 // 0 = QWERTY, 1 = Terminal
  }

  private _app: Application | null = null
  private _container: Container | null = null
  private _keys: { container: Container; gfx: Graphics; text: Text; def: KeyDef; row: number; col: number }[] = []
  private _modifiers = { ctrl: false, alt: false, meta: false, shift: false }
  private _resizeObserver: ResizeObserver | null = null
  private _theme: PixiTheme = resolvePixiTheme()
  private _unsubTheme: (() => void) | null = null
  private _repeatTimer: ReturnType<typeof setTimeout> | null = null
  private _repeatInterval: ReturnType<typeof setInterval> | null = null
  private _activeKeyDef: KeyDef | null = null

  async connectedCallback() {
    super.connectedCallback()
    this._theme = resolvePixiTheme()
    this._unsubTheme = onThemeChange((theme) => {
      this._theme = theme
      this._layoutKeys()
    })
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
    this._app?.destroy(true)
    this._app = null
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

    // CSS sizing: canvas fills host
    const canvas = app.canvas as HTMLCanvasElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // Prevent passive touch warnings
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })

    // Initial size
    const w = host.clientWidth
    const h = host.clientHeight
    if (w > 0 && h > 0) {
      app.renderer.resize(w, h)
    }

    this._container = new Container()
    app.stage.addChild(this._container)

    this._layoutKeys()

    this._resizeObserver = new ResizeObserver(() => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w > 0 && h > 0) {
        app.renderer.resize(w, h)
        this._layoutKeys()
      }
    })
    this._resizeObserver.observe(host)
  }

  private _getRows(): KeyDef[][] {
    return this._activeLayer === 0 ? QWERTY_ROWS : TERMINAL_ROWS
  }

  private _layoutKeys() {
    const app = this._app
    const container = this._container
    if (!app || !container) return

    container.removeChildren()
    this._keys = []

    const theme = this._theme
    const rows = this._getRows()
    const w = app.screen.width
    const h = app.screen.height
    const numRows = rows.length
    const padding = 3
    const rowHeight = (h - padding * (numRows + 1)) / numRows
    const keyHeight = Math.min(rowHeight, 44)

    for (let r = 0; r < numRows; r++) {
      const row = rows[r]
      const totalW = row.reduce((sum, k) => sum + (k.w ?? 1), 0)
      const keyUnitW = (w - padding * (row.length + 1)) / totalW
      let x = padding

      for (let c = 0; c < row.length; c++) {
        const def = row[c]
        const kw = keyUnitW * (def.w ?? 1)
        const y = padding + r * (keyHeight + padding)

        const isModifier = !!def.modifier
        const isAction = !!def.action
        const isActiveModifier = isModifier && this._modifiers[def.modifier!]

        const gfx = new Graphics()
        this._drawKey(gfx, 0, 0, kw, keyHeight, isActiveModifier, isModifier || isAction)

        // Determine display label (shifted or normal)
        const shiftActive = this._modifiers.shift
        const displayLabel = (shiftActive && def.shift) ? def.shift.label : def.label

        const style = new TextStyle({
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: displayLabel.length > 3 ? 10 : 13,
          fill: isActiveModifier ? theme.accent : theme.text,
          align: 'center',
        })
        const text = new Text({ text: displayLabel, style })
        text.anchor.set(0.5)
        text.x = kw / 2
        text.y = keyHeight / 2

        // Wrap in Container to avoid "addChild: Only Containers" deprecation
        const keyContainer = new Container()
        keyContainer.x = x
        keyContainer.y = y
        keyContainer.eventMode = 'static'
        keyContainer.cursor = 'pointer'
        keyContainer.addChild(gfx)
        keyContainer.addChild(text)
        container.addChild(keyContainer)

        keyContainer.on('pointerdown', (e: FederatedPointerEvent) => this._onKeyDown(def, gfx, text, kw, keyHeight, e))
        keyContainer.on('pointerup', () => this._onKeyUp(def, gfx, text, kw, keyHeight))
        keyContainer.on('pointerupoutside', () => this._onKeyUp(def, gfx, text, kw, keyHeight))
        // Cancel repeat when finger slides off the key (real keyboard behavior)
        keyContainer.on('pointerleave', () => this._onKeyLeave(def, gfx, kw, keyHeight))

        this._keys.push({ container: keyContainer, gfx, text, def, row: r, col: c })
        x += kw + padding
      }
    }
  }

  private _drawKey(gfx: Graphics, x: number, y: number, w: number, h: number, pressed: boolean, isModifier: boolean) {
    const theme = this._theme
    gfx.clear()
    const bg = pressed ? theme.keyPressed : isModifier ? theme.keyModifier : theme.keyNormal
    gfx.roundRect(x, y, w, h, 4)
    gfx.fill({ color: bg })
    gfx.stroke({ color: theme.surfaceBorder, width: 1 })
  }

  private _onKeyDown(def: KeyDef, gfx: Graphics, text: Text, kw: number, kh: number, _e: FederatedPointerEvent) {
    if (def.action === 'layer-toggle') {
      this._drawKey(gfx, 0, 0, kw, kh, true, true)
      this._vibrate(10)
      return
    }

    if (def.modifier) {
      const mod = def.modifier
      this._modifiers[mod] = !this._modifiers[mod]
      // For shift, re-layout to show shifted labels
      if (mod === 'shift') {
        this._layoutKeys()
      } else {
        this._drawKey(gfx, 0, 0, kw, kh, this._modifiers[mod], true)
        text.style.fill = this._modifiers[mod] ? this._theme.accent : this._theme.text
      }
      this._vibrate(10)
      return
    }

    this._drawKey(gfx, 0, 0, kw, kh, true, false)
    this._vibrate(5)
    this._activeKeyDef = def

    // Start key repeat for regular keys (like a real keyboard:
    // initial delay 400ms, then repeat every 80ms)
    this._cancelRepeat()
    this._repeatTimer = setTimeout(() => {
      this._repeatTimer = null
      this._repeatInterval = setInterval(() => {
        this._sendKey(def)
        this._vibrate(3)
      }, 80)
    }, 400)
  }

  /**
   * Finger slid off the key — cancel repeat and restore key visual.
   * Do NOT send the key (real keyboards cancel when you slide off).
   */
  private _onKeyLeave(def: KeyDef, gfx: Graphics, kw: number, kh: number) {
    // Only handle the key that's actively pressed
    if (this._activeKeyDef !== def) return
    this._cancelRepeat()
    this._activeKeyDef = null
    if (!def.modifier && !def.action) {
      this._drawKey(gfx, 0, 0, kw, kh, false, false)
    }
  }

  private _onKeyUp(def: KeyDef, gfx: Graphics, _text: Text, kw: number, kh: number) {
    this._cancelRepeat()

    if (def.action === 'layer-toggle') {
      this._activeLayer = this._activeLayer === 0 ? 1 : 0
      this._layoutKeys()
      this._vibrate(10)
      return
    }

    if (def.modifier) return // modifiers handled in pointerdown

    // If the finger slid off (pointerleave cleared _activeKeyDef),
    // do not send the key on release — the gesture was cancelled.
    if (this._activeKeyDef !== def) {
      this._activeKeyDef = null
      return
    }
    this._activeKeyDef = null

    this._drawKey(gfx, 0, 0, kw, kh, false, false)

    this._sendKey(def)

    // Clear modifiers after use
    this._modifiers = { ctrl: false, alt: false, meta: false, shift: false }
    this._layoutKeys()
  }

  /** Send a key event, applying current modifiers. */
  private _sendKey(def: KeyDef) {
    let data: string
    if (this._modifiers.shift && def.shift) {
      data = def.shift.data
    } else {
      data = def.data
    }

    // Apply ctrl modifier
    if (this._modifiers.ctrl && data.length === 1) {
      const code = data.toUpperCase().charCodeAt(0) - 64
      if (code > 0 && code < 32) {
        data = String.fromCharCode(code)
      }
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

  private _vibrate(ms: number) {
    try {
      navigator?.vibrate?.(ms)
    } catch {
      // ignore
    }
  }

  render() {
    return html`<div class="pixi-host" style="width:100%;height:100%"></div>`
  }
}

customElements.define('virtual-keyboard-tab', VirtualKeyboardTab)
