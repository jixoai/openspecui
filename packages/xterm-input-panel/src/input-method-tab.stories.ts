import type { Meta, StoryObj } from '@storybook/web-components-vite'
import type { LitElement } from 'lit'
import { html } from 'lit'
import { expect, fn } from 'storybook/test'

import './input-method-tab.js'

async function getLitElement(container: HTMLElement, selector: string) {
  const el = container.querySelector(selector) as LitElement
  await el.updateComplete
  return el
}

const meta: Meta = {
  title: 'InputMethodTab',
  tags: ['autodocs'],
  decorators: [
    (story) => html`
      <div
        style="width: 400px; height: 250px; background: #1a1a1a; color: #fff; font-family: monospace;"
      >
        ${story()}
      </div>
    `,
  ],
}

export default meta

/**
 * Default Input Method tab with textarea, send button, and empty history slot.
 */
export const Default: StoryObj = {
  render: () => html`<input-method-tab style="height: 100%;"></input-method-tab>`,
}

/**
 * Verifies that typing and clicking Send dispatches `input-panel:send`.
 */
export const SendInput: StoryObj = {
  render: () => html`<input-method-tab style="height: 100%;"></input-method-tab>`,
  play: async ({ canvasElement }) => {
    const tab = await getLitElement(canvasElement, 'input-method-tab')

    const sendHandler = fn()
    tab.addEventListener('input-panel:send', sendHandler)

    const shadow = tab.shadowRoot!
    const textarea = shadow.querySelector('textarea') as HTMLTextAreaElement
    const sendBtn = shadow.querySelector('.send-btn') as HTMLButtonElement

    // Type into the textarea
    textarea.value = 'echo test'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await tab.updateComplete

    // Click send
    sendBtn.click()

    // Wait for _send to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(sendHandler).toHaveBeenCalledTimes(1)
    const detail = (sendHandler.mock.calls[0] as unknown[])[0] as CustomEvent
    expect(detail.detail.data).toBe('echo test\n')

    tab.removeEventListener('input-panel:send', sendHandler)
  },
}

/**
 * Verifies that Ctrl+Enter triggers send.
 */
export const CtrlEnterSend: StoryObj = {
  render: () => html`<input-method-tab style="height: 100%;"></input-method-tab>`,
  play: async ({ canvasElement }) => {
    const tab = await getLitElement(canvasElement, 'input-method-tab')

    const sendHandler = fn()
    tab.addEventListener('input-panel:send', sendHandler)

    const shadow = tab.shadowRoot!
    const textarea = shadow.querySelector('textarea') as HTMLTextAreaElement

    // Type and trigger Ctrl+Enter
    textarea.value = 'ls -la'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await tab.updateComplete

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
      })
    )

    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(sendHandler).toHaveBeenCalledTimes(1)
    const detail = (sendHandler.mock.calls[0] as unknown[])[0] as CustomEvent
    expect(detail.detail.data).toBe('ls -la\n')

    tab.removeEventListener('input-panel:send', sendHandler)
  },
}

/**
 * Verifies that slotted history content renders inside the component.
 */
export const HistorySlot: StoryObj = {
  render: () => html`
    <input-method-tab style="height: 100%;">
      <div slot="history" class="slotted-history">
        <div style="padding: 4px 6px; color: #888; font-size: 12px; cursor: pointer;">
          <span style="font-size: 10px; opacity: 0.6;">14:30</span>
          <span>echo hello world</span>
        </div>
        <div style="padding: 4px 6px; color: #888; font-size: 12px; cursor: pointer;">
          <span style="font-size: 10px; opacity: 0.6;">14:25</span>
          <span>ls -la</span>
        </div>
      </div>
    </input-method-tab>
  `,
  play: async ({ canvasElement }) => {
    await getLitElement(canvasElement, 'input-method-tab')

    // Verify slotted content is visible
    const slottedHistory = canvasElement.querySelector('.slotted-history')
    expect(slottedHistory).not.toBeNull()
    expect(slottedHistory!.textContent).toContain('echo hello world')
    expect(slottedHistory!.textContent).toContain('ls -la')
  },
}
