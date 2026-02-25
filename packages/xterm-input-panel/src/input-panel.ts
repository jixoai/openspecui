import { LitElement, css, html } from 'lit'
import {
  iconCombine,
  iconKeyboard,
  iconMove,
  iconPin,
  iconPinOff,
  iconSettings,
  iconType,
  iconX,
} from './icons.js'

export type InputPanelTab = 'input' | 'keys' | 'shortcuts' | 'trackpad' | 'settings'
export type InputPanelLayout = 'fixed' | 'floating'

interface FloatingGeometry {
  leftPct: number // 0-100, vw%
  topPct: number // 0-100, vh%
  widthPct: number // 20-95, vw%
  heightPct: number // 15-85, vh%
}

const MIN_WIDTH_PX = 300
const MIN_HEIGHT_PX = 150
const MAX_WIDTH_PCT = 95
const MAX_HEIGHT_PCT = 85

const SETTINGS_KEY = 'xtermInputPanelSettings'

function mergeSettings(updates: Record<string, unknown>) {
  try {
    const existing = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, ...updates }))
  } catch {
    /* ignore */
  }
}

function loadSettings(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
  } catch {
    return {}
  }
}

/**
 * Main InputPanel container with toolbar and tab switching.
 *
 * Dispatches:
 * - `input-panel:send` — CustomEvent<{ data: string }> when input should be written to terminal
 * - `input-panel:close` — CustomEvent when the panel should close
 * - `input-panel:layout-change` — CustomEvent<{ layout: InputPanelLayout }> when layout mode changes
 */
export class InputPanel extends LitElement {
  static get properties() {
    return {
      activeTab: { type: String, attribute: 'active-tab' },
      layout: { type: String, reflect: true },
      fixedHeight: { type: Number, attribute: 'fixed-height' },
      historyLimit: { type: Number, attribute: 'history-limit' },
    }
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      --input-panel-fixed-height: 250px;
      --_ip-bg: var(--input-panel-background, var(--terminal, var(--background, #1a1a1a)));
      --_ip-fg: var(
        --input-panel-foreground,
        var(--terminal-foreground, var(--foreground, #ffffff))
      );
      --_ip-primary: var(--input-panel-primary, var(--primary, #e04a2f));
      --_ip-primary-fg: var(--input-panel-primary-foreground, var(--primary-foreground, #ffffff));
      --_ip-border: var(--input-panel-border, color-mix(in srgb, var(--_ip-fg) 24%, transparent));
      --_ip-muted: var(
        --input-panel-muted,
        color-mix(in srgb, var(--_ip-bg) 86%, var(--_ip-fg) 14%)
      );
      --_ip-muted-fg: var(
        --input-panel-muted-foreground,
        color-mix(in srgb, var(--_ip-fg) 62%, transparent)
      );
      --background: var(--_ip-bg);
      --foreground: var(--_ip-fg);
      --primary: var(--_ip-primary);
      --primary-foreground: var(--_ip-primary-fg);
      --border: var(--_ip-border);
      --muted: var(--_ip-muted);
      --muted-foreground: var(--_ip-muted-fg);
      --terminal: var(--_ip-bg);
      --terminal-foreground: var(--_ip-fg);
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
      font-size: 13px;
      color: var(--foreground, #fff);
      background: var(--background, #1a1a1a);
    }

    :host([layout='floating']) {
      display: contents;
    }

    :host([layout='fixed']) {
      height: var(--input-panel-fixed-height);
      min-height: 150px;
      max-height: 500px;
      border-top: 1px solid var(--primary, #e04a2f) !important;
    }

    :host([layout='floating']) .toolbar {
      touch-action: none;
      cursor: grab;
    }

    :host([data-interacting]) .toolbar {
      cursor: grabbing;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
      border-bottom: 1px solid var(--border, #333);
      flex-shrink: 0;
    }

    .tab-group {
      display: flex;
      gap: 2px;
      flex: 1;
    }

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border: 1px solid transparent;
      border-radius: 3px;
      background: transparent;
      color: var(--muted-foreground, #888);
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      white-space: nowrap;
      transition:
        background 0.15s,
        color 0.15s;
    }

    .tab-btn:hover {
      background: var(--muted, #2a2a2a);
      color: var(--foreground, #fff);
    }

    .tab-btn[data-active] {
      background: var(--primary, #e04a2f);
      color: var(--primary-foreground, #fff);
      border-color: var(--primary, #e04a2f);
    }

    .action-group {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .icon-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 3px;
      background: transparent;
      color: var(--muted-foreground, #888);
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s;
    }

    .icon-btn:hover {
      background: var(--muted, #2a2a2a);
      color: var(--foreground, #fff);
    }

    .icon-btn[data-active] {
      color: var(--primary, #e04a2f);
    }

    .content {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      position: relative;
    }

    :host([layout='floating']) .panel-dialog {
      mix-blend-mode: exclusion;
      backdrop-filter: blur(1px);
      -webkit-backdrop-filter: blur(1px);
    }

    .panel-dialog {
      position: fixed;
      margin: 0;
      padding: 0;
      border: 1px solid var(--primary, #e04a2f);
      border-radius: 8px;
      background: var(--background, #1a1a1a);
      color: var(--foreground, #fff);
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
      font-size: 13px;
    }

    .panel-dialog {
      z-index: 9999;
    }

    /* --- Resize handles --- */
    .resize-handle {
      position: absolute;
      width: 14px;
      height: 14px;
      z-index: 10;
      touch-action: none;
      border: 1.5px solid var(--muted-foreground, #888);
      border-color: transparent;
      opacity: 0.4;
      transition:
        border-color 0.15s,
        opacity 0.15s;
    }
    .resize-tl {
      top: 2px;
      left: 2px;
      cursor: nwse-resize;
      border-top-color: var(--muted-foreground, #888);
      border-left-color: var(--muted-foreground, #888);
      border-top-left-radius: 4px;
    }
    .resize-tr {
      top: 2px;
      right: 2px;
      cursor: nesw-resize;
      border-top-color: var(--muted-foreground, #888);
      border-right-color: var(--muted-foreground, #888);
      border-top-right-radius: 4px;
    }
    .resize-bl {
      bottom: 2px;
      left: 2px;
      cursor: nesw-resize;
      border-bottom-color: var(--muted-foreground, #888);
      border-left-color: var(--muted-foreground, #888);
      border-bottom-left-radius: 4px;
    }
    .resize-br {
      bottom: 2px;
      right: 2px;
      cursor: nwse-resize;
      border-bottom-color: var(--muted-foreground, #888);
      border-right-color: var(--muted-foreground, #888);
      border-bottom-right-radius: 4px;
    }

    /* Highlight on hover or while interacting */
    :host([data-interacting]) .resize-tl,
    .resize-tl:hover {
      border-top-color: var(--primary, #e04a2f);
      border-left-color: var(--primary, #e04a2f);
      opacity: 1;
    }
    :host([data-interacting]) .resize-tr,
    .resize-tr:hover {
      border-top-color: var(--primary, #e04a2f);
      border-right-color: var(--primary, #e04a2f);
      opacity: 1;
    }
    :host([data-interacting]) .resize-bl,
    .resize-bl:hover {
      border-bottom-color: var(--primary, #e04a2f);
      border-left-color: var(--primary, #e04a2f);
      opacity: 1;
    }
    :host([data-interacting]) .resize-br,
    .resize-br:hover {
      border-bottom-color: var(--primary, #e04a2f);
      border-right-color: var(--primary, #e04a2f);
      opacity: 1;
    }
  `

  declare activeTab: InputPanelTab
  declare layout: InputPanelLayout
  declare fixedHeight: number
  declare historyLimit: number

  private _dragState: {
    startX: number
    startY: number
    origLeft: number
    origTop: number
  } | null = null

  private _resizeState: {
    corner: 'tl' | 'tr' | 'bl' | 'br'
    startX: number
    startY: number
    origLeft: number
    origTop: number
    origWidth: number
    origHeight: number
  } | null = null

  private _geo: FloatingGeometry = this._defaultGeometry()

  private _boundOnWindowResize = () => this._onWindowResize()
  private _boundOnResizeMove = (e: PointerEvent) => this._onResizeMove(e)
  private _boundOnResizeEnd = () => this._onResizeEnd()

  constructor() {
    super()
    this.activeTab = 'input'
    this.layout = 'floating'
    this.fixedHeight = 250
    this.historyLimit = 50
  }

  connectedCallback() {
    super.connectedCallback()
    this._loadGeometry()
    window.addEventListener('resize', this._boundOnWindowResize)
    this.dispatchEvent(new CustomEvent('input-panel:connected', { bubbles: true, composed: true }))
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.dispatchEvent(
      new CustomEvent('input-panel:disconnected', { bubbles: true, composed: true })
    )
    window.removeEventListener('resize', this._boundOnWindowResize)
    document.removeEventListener('pointermove', this._boundOnResizeMove)
    document.removeEventListener('pointerup', this._boundOnResizeEnd)
  }

  // --- Geometry helpers ---

  private _defaultGeometry(): FloatingGeometry {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768
    const widthPct = Math.min(90, (500 / vw) * 100)
    const heightPct = Math.min(50, (200 / vh) * 100)
    const leftPct = (100 - widthPct) / 2
    const topPct = 100 - heightPct - (20 / vh) * 100
    return { leftPct, topPct, widthPct, heightPct }
  }

  private _loadGeometry() {
    const data = loadSettings()
    this._setFixedHeight(typeof data.fixedHeight === 'number' ? data.fixedHeight : 250)
    this._setHistoryLimit(typeof data.historyLimit === 'number' ? data.historyLimit : 50)

    const hasGeo =
      typeof data.floatingLeft === 'number' &&
      typeof data.floatingTop === 'number' &&
      typeof data.floatingWidth === 'number' &&
      typeof data.floatingHeight === 'number'
    if (hasGeo) {
      let h = data.floatingHeight as number
      // Backward compat: if > 100 treat as px
      if (h > 100) h = Math.round((h / window.innerHeight) * 100)
      this._geo = {
        leftPct: data.floatingLeft as number,
        topPct: data.floatingTop as number,
        widthPct: data.floatingWidth as number,
        heightPct: h,
      }
    } else {
      this._geo = this._defaultGeometry()
    }
  }

  private _setFixedHeight(nextHeight: number) {
    const normalized = Math.max(150, Math.min(500, Math.round(nextHeight)))
    this.fixedHeight = normalized
    this.style.setProperty('--input-panel-fixed-height', `${normalized}px`)
  }

  private _setHistoryLimit(nextLimit: number) {
    this.historyLimit = Math.max(1, Math.min(1000, Math.round(nextLimit)))
  }

  private _saveGeometry() {
    mergeSettings({
      floatingLeft: Math.round(this._geo.leftPct * 10) / 10,
      floatingTop: Math.round(this._geo.topPct * 10) / 10,
      floatingWidth: Math.round(this._geo.widthPct * 10) / 10,
      floatingHeight: Math.round(this._geo.heightPct * 10) / 10,
    })
  }

  private _clampPosition(leftPx: number, topPx: number, wPx: number, hPx: number) {
    const vw = window.innerWidth,
      vh = window.innerHeight
    const maxOverX = wPx / 3,
      maxOverY = hPx / 3
    return {
      left: Math.max(-maxOverX, Math.min(vw - wPx + maxOverX, leftPx)),
      // Top edge: never go above 0 — toolbar must stay accessible for dragging
      top: Math.max(0, Math.min(vh - hPx + maxOverY, topPx)),
    }
  }

  private _applyGeometry(dialog: HTMLDialogElement) {
    const geo = this._geo
    const vw = window.innerWidth,
      vh = window.innerHeight

    // Enforce dynamic min % based on pixel minimums
    const minWidthPct = Math.max(20, (MIN_WIDTH_PX / vw) * 100)
    const minHeightPct = Math.max(15, (MIN_HEIGHT_PX / vh) * 100)
    geo.widthPct = Math.max(minWidthPct, Math.min(MAX_WIDTH_PCT, geo.widthPct))
    geo.heightPct = Math.max(minHeightPct, Math.min(MAX_HEIGHT_PCT, geo.heightPct))

    const wPx = (geo.widthPct / 100) * vw
    const hPx = (geo.heightPct / 100) * vh
    const rawLeft = (geo.leftPct / 100) * vw
    const rawTop = (geo.topPct / 100) * vh
    const { left, top } = this._clampPosition(rawLeft, rawTop, wPx, hPx)

    dialog.style.left = `${left}px`
    dialog.style.top = `${top}px`
    dialog.style.width = `${wPx}px`
    dialog.style.height = `${hPx}px`
    dialog.style.transform = 'none'
    dialog.style.bottom = 'auto'
    dialog.style.maxHeight = 'none'
  }

  private _onWindowResize() {
    if (this.layout !== 'floating') return
    const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
    if (dialog) this._applyGeometry(dialog)
  }

  // --- Tab / layout ---

  private _switchTab(tab: InputPanelTab) {
    this.activeTab = tab
    this.dispatchEvent(
      new CustomEvent('input-panel:tab-change', {
        detail: { tab },
        bubbles: true,
        composed: true,
      })
    )
    this.requestUpdate()
  }

  private _toggleLayout() {
    this.layout = this.layout === 'fixed' ? 'floating' : 'fixed'
    this.dispatchEvent(
      new CustomEvent('input-panel:layout-change', {
        detail: { layout: this.layout },
        bubbles: true,
        composed: true,
      })
    )
    this.requestUpdate()
  }

  private _close() {
    const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
    if (dialog?.open) dialog.close()
    this.dispatchEvent(
      new CustomEvent('input-panel:close', {
        bubbles: true,
        composed: true,
      })
    )
  }

  firstUpdated(changed: Map<string, unknown>) {
    super.firstUpdated(changed)
    if (this.layout === 'floating') {
      const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
      if (dialog && !dialog.open) {
        dialog.show()
        this._applyGeometry(dialog)
      }
    }
  }

  updated(changed: Map<string, unknown>) {
    super.updated(changed)
    if (changed.has('fixedHeight')) {
      this.style.setProperty('--input-panel-fixed-height', `${this.fixedHeight}px`)
    }
    if (this.layout === 'floating') {
      const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
      if (dialog) {
        // Only re-open dialog when layout just switched to floating
        if (changed.has('layout') && !dialog.open) {
          dialog.show()
        }
        if (dialog.open) {
          this._applyGeometry(dialog)
        }
      }
    }
  }

  // --- Dialog drag ---

  private _onToolbarPointerDown(e: PointerEvent) {
    if (this.layout !== 'floating') return
    // Don't intercept clicks on buttons (close, tabs, layout toggle)
    if ((e.target as HTMLElement).closest('button')) return
    const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
    if (!dialog) return

    e.stopPropagation()
    e.preventDefault()

    const rect = dialog.getBoundingClientRect()
    this._dragState = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top,
    }
    this.setAttribute('data-interacting', '')
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  private _onToolbarPointerMove(e: PointerEvent) {
    if (!this._dragState) return
    e.stopPropagation()
    e.preventDefault()
    const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
    if (!dialog) return

    const dx = e.clientX - this._dragState.startX
    const dy = e.clientY - this._dragState.startY
    const wPx = (this._geo.widthPct / 100) * window.innerWidth
    const hPx = (this._geo.heightPct / 100) * window.innerHeight
    const { left, top } = this._clampPosition(
      this._dragState.origLeft + dx,
      this._dragState.origTop + dy,
      wPx,
      hPx
    )

    dialog.style.transform = 'none'
    dialog.style.left = `${left}px`
    dialog.style.top = `${top}px`
    dialog.style.bottom = 'auto'
  }

  private _onToolbarPointerUp() {
    if (!this._dragState) return
    this._dragState = null
    this.removeAttribute('data-interacting')

    // Convert final px position back to % and save
    const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
    if (dialog) {
      const rect = dialog.getBoundingClientRect()
      this._geo.leftPct = (rect.left / window.innerWidth) * 100
      this._geo.topPct = (rect.top / window.innerHeight) * 100
      this._saveGeometry()
    }
  }

  // --- Dialog resize ---

  private _onResizeStart(e: PointerEvent, corner: 'tl' | 'tr' | 'bl' | 'br') {
    e.stopPropagation()
    e.preventDefault()
    const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
    if (!dialog) return

    const rect = dialog.getBoundingClientRect()
    this._resizeState = {
      corner,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top,
      origWidth: rect.width,
      origHeight: rect.height,
    }
    this.setAttribute('data-interacting', '')
    document.addEventListener('pointermove', this._boundOnResizeMove)
    document.addEventListener('pointerup', this._boundOnResizeEnd)
  }

  private _onResizeMove(e: PointerEvent) {
    if (!this._resizeState) return
    e.preventDefault()
    const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
    if (!dialog) return

    const { corner, startX, startY, origLeft, origTop, origWidth, origHeight } = this._resizeState
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    const vw = window.innerWidth,
      vh = window.innerHeight

    let newLeft = origLeft,
      newTop = origTop,
      newWidth = origWidth,
      newHeight = origHeight

    if (corner === 'br') {
      newWidth = origWidth + dx
      newHeight = origHeight + dy
    } else if (corner === 'bl') {
      newLeft = origLeft + dx
      newWidth = origWidth - dx
      newHeight = origHeight + dy
    } else if (corner === 'tr') {
      newTop = origTop + dy
      newWidth = origWidth + dx
      newHeight = origHeight - dy
    } else {
      // tl
      newLeft = origLeft + dx
      newTop = origTop + dy
      newWidth = origWidth - dx
      newHeight = origHeight - dy
    }

    // Enforce min/max constraints
    newWidth = Math.max(MIN_WIDTH_PX, Math.min((MAX_WIDTH_PCT / 100) * vw, newWidth))
    newHeight = Math.max(MIN_HEIGHT_PX, Math.min((MAX_HEIGHT_PCT / 100) * vh, newHeight))

    // If width/height was clamped, adjust position for corners that move left/top
    if (corner === 'tl' || corner === 'bl') {
      newLeft = origLeft + origWidth - newWidth
    }
    if (corner === 'tl' || corner === 'tr') {
      newTop = origTop + origHeight - newHeight
    }

    const { left, top } = this._clampPosition(newLeft, newTop, newWidth, newHeight)

    dialog.style.left = `${left}px`
    dialog.style.top = `${top}px`
    dialog.style.width = `${newWidth}px`
    dialog.style.height = `${newHeight}px`
    dialog.style.transform = 'none'
    dialog.style.bottom = 'auto'
    dialog.style.maxHeight = 'none'
  }

  private _onResizeEnd() {
    if (!this._resizeState) return
    this._resizeState = null
    this.removeAttribute('data-interacting')
    document.removeEventListener('pointermove', this._boundOnResizeMove)
    document.removeEventListener('pointerup', this._boundOnResizeEnd)

    const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
    if (dialog) {
      const rect = dialog.getBoundingClientRect()
      const vw = window.innerWidth,
        vh = window.innerHeight
      this._geo = {
        leftPct: (rect.left / vw) * 100,
        topPct: (rect.top / vh) * 100,
        widthPct: (rect.width / vw) * 100,
        heightPct: (rect.height / vh) * 100,
      }
      this._saveGeometry()
      this._dispatchSettingsChange()
    }
  }

  private _dispatchSettingsChange() {
    this.dispatchEvent(
      new CustomEvent('input-panel:settings-change', {
        detail: {
          fixedHeight: this.fixedHeight,
          floatingWidth: Math.round(this._geo.widthPct),
          floatingHeight: Math.round(this._geo.heightPct),
          vibrationIntensity: loadSettings().vibrationIntensity ?? 50,
          historyLimit: this.historyLimit,
        },
        bubbles: true,
        composed: true,
      })
    )
  }

  private _onSettingsChange(e: Event) {
    const detail = (e as CustomEvent).detail
    if (typeof detail.fixedHeight === 'number') {
      this._setFixedHeight(detail.fixedHeight)
    }
    if (typeof detail.historyLimit === 'number') {
      this._setHistoryLimit(detail.historyLimit)
    }
    if (typeof detail.floatingWidth === 'number') {
      this._geo.widthPct = detail.floatingWidth
    }
    if (typeof detail.floatingHeight === 'number') {
      this._geo.heightPct = detail.floatingHeight
    }
    this._saveGeometry()
    const dialog = this.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement | null
    if (dialog) this._applyGeometry(dialog)
    this._dispatchSettingsChange()
  }

  render() {
    const tabs: { id: InputPanelTab; label: string; icon: SVGElement }[] = [
      { id: 'input', label: 'Input', icon: iconType() },
      { id: 'keys', label: 'Keys', icon: iconKeyboard() },
      { id: 'shortcuts', label: 'Shortcuts', icon: iconCombine() },
      { id: 'trackpad', label: 'Trackpad', icon: iconMove() },
      { id: 'settings', label: 'Settings', icon: iconSettings() },
    ]

    const inner = html`
      <div
        class="toolbar"
        part="toolbar"
        @pointerdown=${(e: PointerEvent) => this._onToolbarPointerDown(e)}
        @pointermove=${(e: PointerEvent) => this._onToolbarPointerMove(e)}
        @pointerup=${() => this._onToolbarPointerUp()}
      >
        <div class="tab-group">
          ${tabs.map(
            (t) => html`
              <button
                class="tab-btn"
                part="tab-btn"
                ?data-active=${this.activeTab === t.id}
                @click=${() => this._switchTab(t.id)}
              >
                ${t.icon} ${this.activeTab === t.id ? t.label : ''}
              </button>
            `
          )}
        </div>
        <div class="action-group">
          <button class="icon-btn" @click=${this._toggleLayout} title="Toggle layout mode">
            ${this.layout === 'fixed' ? iconPin(14) : iconPinOff(14)}
          </button>
          <button class="icon-btn" part="close-btn" @click=${this._close} title="Close panel">
            ${iconX(14)}
          </button>
        </div>
      </div>
      <div class="content" part="content">
        ${this.activeTab === 'settings'
          ? html`<input-panel-settings
              visible
              fixed-height=${this.fixedHeight}
              history-limit=${this.historyLimit}
              floating-width=${Math.round(this._geo.widthPct)}
              floating-height=${Math.round(this._geo.heightPct)}
              @input-panel:settings-change=${(e: Event) => this._onSettingsChange(e)}
            ></input-panel-settings>`
          : html`<slot name=${this.activeTab}></slot>`}
      </div>
    `

    if (this.layout === 'floating') {
      return html` <dialog class="panel-dialog">
        <div
          class="resize-handle resize-tl"
          @pointerdown=${(e: PointerEvent) => this._onResizeStart(e, 'tl')}
        ></div>
        <div
          class="resize-handle resize-tr"
          @pointerdown=${(e: PointerEvent) => this._onResizeStart(e, 'tr')}
        ></div>
        <div
          class="resize-handle resize-bl"
          @pointerdown=${(e: PointerEvent) => this._onResizeStart(e, 'bl')}
        ></div>
        <div
          class="resize-handle resize-br"
          @pointerdown=${(e: PointerEvent) => this._onResizeStart(e, 'br')}
        ></div>
        ${inner}
      </dialog>`
    }

    return inner
  }
}

customElements.define('input-panel', InputPanel)
