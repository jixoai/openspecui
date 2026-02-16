import { LitElement, css, html } from 'lit'

const SETTINGS_KEY = 'xtermInputPanelSettings'

function mergeSettings(updates: Record<string, unknown>) {
  try {
    const existing = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, ...updates }))
  } catch {
    /* ignore */
  }
}

/**
 * InputPanel settings — height/width sliders and vibration intensity.
 *
 * Dispatches `input-panel:settings-change` CustomEvent with updated values.
 */
export class InputPanelSettings extends LitElement {
  static get properties() {
    return {
      fixedHeight: { type: Number, attribute: 'fixed-height' },
      floatingWidth: { type: Number, attribute: 'floating-width' },
      floatingHeight: { type: Number, attribute: 'floating-height' },
      vibrationIntensity: { type: Number, attribute: 'vibration-intensity' },
      historyLimit: { type: Number, attribute: 'history-limit' },
      visible: { type: Boolean },
    }
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .overlay {
      display: none;
      position: relative;
      height: 100%;
      min-height: 0;
      background: var(--terminal, #1a1a1a);
      flex-direction: column;
      padding: 12px;
      gap: 16px;
      overflow-y: auto;
    }

    :host([visible]) .overlay {
      display: flex;
    }

    .setting {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .setting-label {
      font-size: 11px;
      color: var(--muted-foreground, #888);
      display: flex;
      justify-content: space-between;
    }

    .setting-value {
      color: var(--foreground, #fff);
      font-weight: 600;
    }

    input[type='range'] {
      width: 100%;
      accent-color: var(--primary, #e04a2f);
    }
  `

  declare fixedHeight: number
  declare floatingWidth: number
  declare floatingHeight: number
  declare vibrationIntensity: number
  declare historyLimit: number
  declare visible: boolean

  constructor() {
    super()
    this.fixedHeight = 250
    this.floatingWidth = 60
    this.floatingHeight = 30
    this.vibrationIntensity = 50
    this.historyLimit = 50
    this.visible = false
  }

  connectedCallback() {
    super.connectedCallback()
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (typeof data.fixedHeight === 'number') this.fixedHeight = data.fixedHeight
        if (typeof data.floatingWidth === 'number') this.floatingWidth = data.floatingWidth
        if (typeof data.floatingHeight === 'number') {
          // Backward compat: if > 100, treat as px and convert to vh%
          if (data.floatingHeight > 100) {
            this.floatingHeight = Math.round((data.floatingHeight / window.innerHeight) * 100)
          } else {
            this.floatingHeight = data.floatingHeight
          }
        }
        if (typeof data.vibrationIntensity === 'number')
          this.vibrationIntensity = data.vibrationIntensity
        if (typeof data.historyLimit === 'number') this.historyLimit = data.historyLimit
      }
    } catch {
      /* ignore */
    }
  }

  private _emit() {
    mergeSettings({
      fixedHeight: this.fixedHeight,
      floatingWidth: this.floatingWidth,
      floatingHeight: this.floatingHeight,
      vibrationIntensity: this.vibrationIntensity,
      historyLimit: this.historyLimit,
    })
    this.dispatchEvent(
      new CustomEvent('input-panel:settings-change', {
        detail: {
          fixedHeight: this.fixedHeight,
          floatingWidth: this.floatingWidth,
          floatingHeight: this.floatingHeight,
          vibrationIntensity: this.vibrationIntensity,
          historyLimit: this.historyLimit,
        },
        bubbles: true,
        composed: true,
      })
    )
  }

  private _onFixedHeight(e: Event) {
    this.fixedHeight = Number((e.target as HTMLInputElement).value)
    this._emit()
  }

  private _onFloatingWidth(e: Event) {
    this.floatingWidth = Number((e.target as HTMLInputElement).value)
    this._emit()
  }

  private _onFloatingHeight(e: Event) {
    this.floatingHeight = Number((e.target as HTMLInputElement).value)
    this._emit()
  }

  private _onVibration(e: Event) {
    this.vibrationIntensity = Number((e.target as HTMLInputElement).value)
    this._emit()
  }

  private _onHistoryLimit(e: Event) {
    this.historyLimit = Number((e.target as HTMLInputElement).value)
    this._emit()
  }

  render() {
    return html`
      <div class="overlay" part="settings-overlay">
        <div class="setting">
          <label class="setting-label">
            Fixed mode height
            <span class="setting-value">${this.fixedHeight}px</span>
          </label>
          <input
            type="range"
            min="150"
            max="500"
            .value=${String(this.fixedHeight)}
            @input=${this._onFixedHeight}
          />
        </div>

        <div class="setting">
          <label class="setting-label">
            Floating mode width
            <span class="setting-value">${this.floatingWidth}%</span>
          </label>
          <input
            type="range"
            min="20"
            max="95"
            .value=${String(this.floatingWidth)}
            @input=${this._onFloatingWidth}
          />
        </div>

        <div class="setting">
          <label class="setting-label">
            Floating mode height
            <span class="setting-value">${this.floatingHeight}%</span>
          </label>
          <input
            type="range"
            min="15"
            max="85"
            .value=${String(this.floatingHeight)}
            @input=${this._onFloatingHeight}
          />
        </div>

        <div class="setting">
          <label class="setting-label">
            Vibration intensity
            <span class="setting-value">${this.vibrationIntensity}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            .value=${String(this.vibrationIntensity)}
            @input=${this._onVibration}
          />
        </div>

        <div class="setting">
          <label class="setting-label">
            History limit
            <span class="setting-value">${this.historyLimit}</span>
          </label>
          <input
            type="range"
            min="1"
            max="1000"
            .value=${String(this.historyLimit)}
            @input=${this._onHistoryLimit}
          />
        </div>
      </div>
    `
  }
}

customElements.define('input-panel-settings', InputPanelSettings)
