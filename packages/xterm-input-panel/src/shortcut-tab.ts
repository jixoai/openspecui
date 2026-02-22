import { css, html, LitElement } from 'lit'
import { createElement, SquareSlash, SquareTerminal } from 'lucide'
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
import {
  buildShortcutPages,
  type ShortcutAction,
  type ShortcutItem,
  type ShortcutPage,
} from './shortcut-pages.js'

const GRID_GAP = 8
const GRID_PADDING = 10
const CARD_RADIUS = 8

const CLAUDE_ICON_URL = new URL('./brand-icons/claude.png', import.meta.url).href
const CODEX_ICON_URL = new URL('./brand-icons/codex.png', import.meta.url).href
const GEMINI_ICON_URL = new URL('./brand-icons/gemini.png', import.meta.url).href

interface RenderedShortcut {
  item: ShortcutItem
  container: Container
  gfx: Graphics
  width: number
  height: number
}

export class ShortcutTab extends LitElement {
  static get properties() {
    return {
      platform: { type: String, reflect: true },
      activePageId: { type: String, attribute: 'active-page' },
    }
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .layout {
      height: 100%;
      min-height: 0;
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
    }

    .pages {
      border-right: 1px solid var(--border, #333);
      padding: 8px 6px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      min-height: 0;
      align-items: center;
    }

    .page-btn {
      width: 40px;
      height: 40px;
      border: 1px solid var(--border, #333);
      border-radius: 6px;
      background: var(--muted, #2a2a2a);
      color: var(--muted-foreground, #aaa);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      cursor: pointer;
      transition:
        border-color 0.15s,
        color 0.15s,
        background 0.15s;
    }

    .page-btn:hover {
      border-color: var(--primary, #e04a2f);
      color: var(--foreground, #fff);
    }

    .page-btn[data-active] {
      border-color: var(--primary, #e04a2f);
      background: color-mix(in srgb, var(--primary, #e04a2f), transparent 85%);
      color: var(--foreground, #fff);
    }

    .canvas-wrap {
      position: relative;
      min-height: 0;
    }

    .pixi-host {
      width: 100%;
      height: 100%;
    }

    .page-logo {
      width: 20px;
      height: 20px;
      object-fit: contain;
      display: block;
    }

    .page-vector {
      display: inline-flex;
      width: 20px;
      height: 20px;
      align-items: center;
      justify-content: center;
      color: currentColor;
    }

    .page-vector svg {
      width: 18px;
      height: 18px;
      stroke-width: 2;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `

  declare platform: PlatformMode
  declare activePageId: string

  private _app: Application | null = null
  private _container: Container | null = null
  private _resizeObserver: ResizeObserver | null = null
  private _theme: PixiTheme = resolvePixiTheme(this)
  private _unsubTheme: (() => void) | null = null
  private _renderedItems: RenderedShortcut[] = []

  constructor() {
    super()
    this.platform = 'auto'
    this.activePageId = ''
  }

  async connectedCallback() {
    super.connectedCallback()
    this._theme = resolvePixiTheme(this)
    this._unsubTheme = onThemeChange((theme) => {
      this._theme = theme
      this._layoutPage()
    }, this)
    this._ensureActivePage()
    await this.updateComplete
    await this._initPixi()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
    this._unsubTheme?.()
    this._unsubTheme = null
    this._app?.destroy()
    this._app = null
    this._container = null
    this._renderedItems = []
  }

  protected updated(changed: Map<string, unknown>) {
    super.updated(changed)
    if (changed.has('platform')) {
      this._ensureActivePage()
      this._layoutPage()
    }
    if (changed.has('activePageId')) {
      this._layoutPage()
    }
  }

  private _hostPlatform() {
    if (this.platform === 'windows' || this.platform === 'macos' || this.platform === 'common') {
      return this.platform
    }
    return detectHostPlatform()
  }

  private _pages(): ShortcutPage[] {
    return buildShortcutPages(this._hostPlatform())
  }

  private _activePage(): ShortcutPage {
    const pages = this._pages()
    return pages.find((page) => page.id === this.activePageId) ?? pages[0]!
  }

  private _ensureActivePage() {
    const pages = this._pages()
    if (!pages.length) return
    const exists = pages.some((page) => page.id === this.activePageId)
    if (!exists) {
      this.activePageId = pages[0]!.id
    }
  }

  private async _initPixi() {
    const host = this.shadowRoot?.querySelector('.pixi-host') as HTMLElement
    if (!host) return

    const app = new Application()
    await app.init({
      background: this._theme.background,
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
    canvas.addEventListener('contextmenu', (event) => event.preventDefault())

    const width = host.clientWidth
    const height = host.clientHeight
    if (width > 0 && height > 0) {
      app.renderer.resize(width, height)
    }

    this._container = new Container()
    app.stage.addChild(this._container)
    this._layoutPage()

    this._resizeObserver = new ResizeObserver(() => {
      const nextWidth = host.clientWidth
      const nextHeight = host.clientHeight
      if (nextWidth > 0 && nextHeight > 0) {
        app.renderer.resize(nextWidth, nextHeight)
        this._layoutPage()
      }
    })
    this._resizeObserver.observe(host)
  }

  private _drawCard(gfx: Graphics, width: number, height: number, pressed: boolean) {
    gfx.clear()
    gfx.roundRect(0, 0, width, height, CARD_RADIUS)
    gfx.fill({
      color: pressed ? this._theme.keyPressed : this._theme.keyNormal,
    })
    gfx.stroke({
      color: pressed ? this._theme.accent : this._theme.surfaceBorder,
      width: pressed ? 1.5 : 1,
    })
  }

  private _drawDpad(gfx: Graphics, width: number, height: number, pressed: boolean) {
    const radius = Math.min(width, height) * 0.42
    const cx = width / 2
    const cy = height / 2

    gfx.clear()
    gfx.roundRect(0, 0, width, height, CARD_RADIUS)
    gfx.fill({ color: this._theme.keyNormal })
    gfx.stroke({ color: this._theme.surfaceBorder, width: 1 })

    gfx.circle(cx, cy, radius)
    gfx.fill({ color: pressed ? this._theme.keyPressed : this._theme.keyModifier })
    gfx.stroke({ color: this._theme.surfaceBorder, width: 1 })

    gfx.moveTo(cx - radius, cy)
    gfx.lineTo(cx + radius, cy)
    gfx.moveTo(cx, cy - radius)
    gfx.lineTo(cx, cy + radius)
    gfx.stroke({ color: this._theme.surfaceBorder, width: 1 })
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

  private _fitText(text: Text, maxWidth: number, minScale = 0.5) {
    if (maxWidth <= 0) return
    text.scale.set(1)
    const width = this._measureTextWidth(text)
    if (width <= maxWidth) {
      return
    }
    const scale = Math.max(minScale, maxWidth / width)
    text.scale.set(scale)
  }

  private _layoutPage() {
    const app = this._app
    const container = this._container
    if (!app || !container) return

    container.removeChildren()
    this._renderedItems = []

    const page = this._activePage()
    const width = app.screen.width
    const height = app.screen.height

    const cellWidth = (width - GRID_PADDING * 2 - GRID_GAP * (page.cols - 1)) / page.cols
    const cellHeight = (height - GRID_PADDING * 2 - GRID_GAP * (page.rows - 1)) / page.rows

    for (const item of page.items) {
      const cols = item.cols ?? 1
      const rows = item.rows ?? 1
      const x = GRID_PADDING + item.col * (cellWidth + GRID_GAP)
      const y = GRID_PADDING + item.row * (cellHeight + GRID_GAP)
      const cardWidth = cellWidth * cols + GRID_GAP * (cols - 1)
      const cardHeight = cellHeight * rows + GRID_GAP * (rows - 1)

      const itemContainer = new Container()
      itemContainer.x = x
      itemContainer.y = y
      itemContainer.eventMode = 'static'
      itemContainer.cursor = 'pointer'

      const gfx = new Graphics()
      itemContainer.addChild(gfx)

      if (item.kind === 'dpad') {
        this._drawDpad(gfx, cardWidth, cardHeight, false)
      } else {
        this._drawCard(gfx, cardWidth, cardHeight, false)
      }

      const label = new Text({
        text: item.label,
        style: new TextStyle({
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: cardHeight > 48 ? 12 : 11,
          fill: this._theme.text,
          align: 'center',
        }),
      })

      if (item.kind === 'dpad') {
        label.anchor.set(0.5)
        label.x = cardWidth / 2
        label.y = cardHeight / 2
      } else {
        label.anchor.set(0.5)
        label.x = cardWidth / 2
        label.y = cardHeight / 2
      }
      this._fitText(label, cardWidth - 12)
      itemContainer.addChild(label)

      itemContainer.on('pointerdown', () => {
        if (item.kind === 'dpad') {
          this._drawDpad(gfx, cardWidth, cardHeight, true)
        } else {
          this._drawCard(gfx, cardWidth, cardHeight, true)
        }
      })

      itemContainer.on('pointerleave', () => {
        if (item.kind === 'dpad') {
          this._drawDpad(gfx, cardWidth, cardHeight, false)
        } else {
          this._drawCard(gfx, cardWidth, cardHeight, false)
        }
      })

      itemContainer.on('pointerupoutside', () => {
        if (item.kind === 'dpad') {
          this._drawDpad(gfx, cardWidth, cardHeight, false)
        } else {
          this._drawCard(gfx, cardWidth, cardHeight, false)
        }
      })

      itemContainer.on('pointerup', (event: FederatedPointerEvent) => {
        if (item.kind === 'dpad') {
          this._drawDpad(gfx, cardWidth, cardHeight, false)
        } else {
          this._drawCard(gfx, cardWidth, cardHeight, false)
        }
        void this._activateShortcut(item, event, cardWidth, cardHeight, itemContainer)
      })

      container.addChild(itemContainer)
      this._renderedItems.push({
        item,
        container: itemContainer,
        gfx,
        width: cardWidth,
        height: cardHeight,
      })
    }
  }

  private _send(data: string) {
    this.dispatchEvent(
      new CustomEvent('input-panel:send', {
        detail: { data },
        bubbles: true,
        composed: true,
      })
    )
  }

  private async _handleCommand(command: 'copy' | 'paste' | 'select-all') {
    if (command === 'copy') {
      const selection = window.getSelection()?.toString() ?? ''
      if (!selection) return
      try {
        await navigator.clipboard.writeText(selection)
      } catch {
        document.execCommand('copy')
      }
      return
    }

    if (command === 'paste') {
      try {
        const text = await navigator.clipboard.readText()
        if (text) this._send(text)
      } catch {
        // ignore clipboard permission failures
      }
      return
    }

    const active = document.activeElement
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      active.select()
      return
    }
    document.execCommand('selectAll')
  }

  private _dpadData(
    event: FederatedPointerEvent,
    width: number,
    height: number,
    container: Container
  ): string {
    const local = container.toLocal(event.global)
    const dx = local.x - width / 2
    const dy = local.y - height / 2

    if (Math.abs(dx) <= 8 && Math.abs(dy) <= 8) {
      return '\r'
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx < 0 ? '\x1b[D' : '\x1b[C'
    }
    return dy < 0 ? '\x1b[A' : '\x1b[B'
  }

  private async _activateShortcut(
    item: ShortcutItem,
    event: FederatedPointerEvent,
    width: number,
    height: number,
    container: Container
  ) {
    if (item.kind === 'dpad') {
      this._send(this._dpadData(event, width, height, container))
      return
    }

    const action: ShortcutAction | undefined = item.action
    if (!action) return

    if (action.type === 'send') {
      this._send(action.data)
      return
    }

    if (action.type === 'text') {
      this._send(action.text)
      return
    }

    await this._handleCommand(action.command)
  }

  private _setActivePage(pageId: string) {
    if (this.activePageId === pageId) return
    this.activePageId = pageId
  }

  private _renderPageIcon(pageId: string) {
    if (pageId === 'system') {
      return html`<span class="page-vector">${createElement(SquareTerminal)}</span>`
    }
    if (pageId === 'terminal') {
      return html`<span class="page-vector">${createElement(SquareSlash)}</span>`
    }

    if (pageId === 'claude') {
      return html`<img class="page-logo" src=${CLAUDE_ICON_URL} alt="" />`
    }
    if (pageId === 'codex') {
      return html`<img class="page-logo" src=${CODEX_ICON_URL} alt="" />`
    }
    if (pageId === 'gemini') {
      return html`<img class="page-logo" src=${GEMINI_ICON_URL} alt="" />`
    }

    return html`<span class="page-vector">${createElement(SquareSlash)}</span>`
  }

  render() {
    const pages = this._pages()
    const activePage = this._activePage()
    return html`
      <div class="layout">
        <div class="pages">
          ${pages.map(
            (page) => html`
              <button
                type="button"
                class="page-btn"
                title=${page.title}
                aria-label=${page.title}
                ?data-active=${page.id === activePage.id}
                @click=${() => this._setActivePage(page.id)}
              >
                ${this._renderPageIcon(page.id)}
                <span class="sr-only">${page.title}</span>
              </button>
            `
          )}
        </div>
        <div class="canvas-wrap">
          <div class="pixi-host"></div>
        </div>
      </div>
    `
  }
}

customElements.define('shortcut-tab', ShortcutTab)
