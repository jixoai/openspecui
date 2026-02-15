import { LitElement, html, css } from 'lit'
import { iconSend } from './icons.js'

/**
 * Input Method tab — textarea + send button + slotted history.
 *
 * Dispatches `input-panel:send` CustomEvent<{ data: string }>.
 * History is decoupled — use `<slot name="history">` to provide history content.
 */
export class InputMethodTab extends LitElement {
  static get properties() {
    return {
      _inputValue: { state: true },
    }
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .input-area {
      display: flex;
      gap: 6px;
      padding: 8px;
      border-bottom: 1px solid var(--border, #333);
    }

    textarea {
      flex: 1;
      min-height: 60px;
      max-height: 120px;
      resize: vertical;
      background: var(--background, #000);
      color: var(--foreground, #fff);
      border: 1px solid var(--border, #333);
      border-radius: 3px;
      padding: 6px 8px;
      font-family: inherit;
      font-size: 13px;
      outline: none;
    }

    textarea:focus {
      border-color: var(--primary, #e04a2f);
    }

    .send-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      align-self: flex-end;
      padding: 6px 16px;
      background: var(--primary, #e04a2f);
      color: var(--primary-foreground, #fff);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      transition: opacity 0.15s;
    }

    .send-btn:hover {
      opacity: 0.85;
    }

    .history-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 4px 8px;
      scrollbar-width: thin;
    }

    .empty-state {
      padding: 16px;
      text-align: center;
      color: var(--muted-foreground, #888);
      font-size: 12px;
    }
  `

  declare _inputValue: string

  constructor() {
    super()
    this._inputValue = ''
  }

  private _onInput(e: Event) {
    this._inputValue = (e.target as HTMLTextAreaElement).value
  }

  private _onKeyDown(e: KeyboardEvent) {
    // Ctrl/Cmd+Enter to send
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      this._send()
    }
  }

  private _send() {
    const text = this._inputValue.trim()
    if (!text) return

    // Dispatch to terminal
    this.dispatchEvent(
      new CustomEvent('input-panel:send', {
        detail: { data: text + '\n' },
        bubbles: true,
        composed: true,
      })
    )

    this._inputValue = ''
  }

  render() {
    return html`
      <div class="input-area">
        <textarea
          placeholder="Type command and press Ctrl+Enter to send..."
          .value=${this._inputValue}
          @input=${this._onInput}
          @keydown=${this._onKeyDown}
        ></textarea>
        <button class="send-btn" @click=${this._send}>${iconSend(14)} Send</button>
      </div>
      <div class="history-list">
        <slot name="history">
          <div class="empty-state">No history</div>
        </slot>
      </div>
    `
  }
}

customElements.define('input-method-tab', InputMethodTab)
