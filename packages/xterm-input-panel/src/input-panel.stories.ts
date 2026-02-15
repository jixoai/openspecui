import type { Meta, StoryObj } from '@storybook/web-components-vite'
import type { LitElement } from 'lit'
import { html } from 'lit'
import { expect, fn } from 'storybook/test'

// Register all custom elements
import './index.js'

/** Helper to get a Lit element and wait for it to be ready */
async function getLitElement(container: HTMLElement, selector: string) {
  const el = container.querySelector(selector) as LitElement
  await el.updateComplete
  return el
}

const meta: Meta = {
  title: 'InputPanel',
  tags: ['autodocs'],
  decorators: [
    (story) => html`
      <div style="width: 400px; height: 300px; background: #1a1a1a; color: #fff; font-family: monospace;">
        ${story()}
      </div>
    `,
  ],
}

export default meta

/**
 * The main InputPanel container with toolbar tabs and content area.
 * Default tab is "input" (Input Method).
 */
export const Default: StoryObj = {
  render: () => html`
    <input-panel layout="fixed" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys"></virtual-keyboard-tab>
      <virtual-trackpad-tab slot="trackpad"></virtual-trackpad-tab>
    </input-panel>
  `,
}

/**
 * InputPanel in floating layout mode (renders as dialog).
 */
export const FloatingLayout: StoryObj = {
  render: () => html`
    <input-panel layout="floating" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys" floating></virtual-keyboard-tab>
      <virtual-trackpad-tab slot="trackpad" floating></virtual-trackpad-tab>
    </input-panel>
  `,
}

/**
 * InputPanel starts on the "keys" tab (Virtual Keyboard).
 */
export const KeysTab: StoryObj = {
  render: () => html`
    <input-panel layout="fixed" active-tab="keys" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys"></virtual-keyboard-tab>
      <virtual-trackpad-tab slot="trackpad"></virtual-trackpad-tab>
    </input-panel>
  `,
}

/**
 * InputPanel starts on the "trackpad" tab (Virtual Trackpad).
 */
export const TrackpadTab: StoryObj = {
  render: () => html`
    <input-panel layout="fixed" active-tab="trackpad" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys"></virtual-keyboard-tab>
      <virtual-trackpad-tab slot="trackpad"></virtual-trackpad-tab>
    </input-panel>
  `,
}

/**
 * InputPanel starts on the "settings" tab.
 */
export const SettingsTab: StoryObj = {
  render: () => html`
    <input-panel layout="fixed" active-tab="settings" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys"></virtual-keyboard-tab>
      <virtual-trackpad-tab slot="trackpad"></virtual-trackpad-tab>
    </input-panel>
  `,
}

/**
 * Verifies that tab switching works by clicking the "Keys" tab button.
 * Now expects 4 tab buttons (Input, Keys, Trackpad, Settings).
 */
export const TabSwitching: StoryObj = {
  render: () => html`
    <input-panel layout="fixed" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys"></virtual-keyboard-tab>
      <virtual-trackpad-tab slot="trackpad"></virtual-trackpad-tab>
    </input-panel>
  `,
  play: async ({ canvasElement }) => {
    const panel = await getLitElement(canvasElement, 'input-panel')

    const shadow = panel.shadowRoot!
    const tabButtons = shadow.querySelectorAll('.tab-btn')
    expect(tabButtons.length).toBe(4)

    // Click "Keys" tab
    const keysTab = tabButtons[1] as HTMLButtonElement
    keysTab.click()
    await panel.updateComplete

    // Verify the active attribute changed
    expect(keysTab.hasAttribute('data-active')).toBe(true)
  },
}

/**
 * Verifies that the close button dispatches the `input-panel:close` event.
 */
export const CloseEvent: StoryObj = {
  render: () => html`
    <input-panel layout="fixed" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
    </input-panel>
  `,
  play: async ({ canvasElement }) => {
    const panel = await getLitElement(canvasElement, 'input-panel')

    const closeHandler = fn()
    panel.addEventListener('input-panel:close', closeHandler)

    const shadow = panel.shadowRoot!
    const closeBtn = shadow.querySelector('.icon-btn:last-child') as HTMLButtonElement
    closeBtn.click()

    expect(closeHandler).toHaveBeenCalledTimes(1)
    panel.removeEventListener('input-panel:close', closeHandler)
  },
}

/**
 * Verifies that the layout toggle dispatches the `input-panel:layout-change` event.
 * Pin/float button is now icon-only (no text label).
 */
export const LayoutToggle: StoryObj = {
  render: () => html`
    <input-panel layout="fixed" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
    </input-panel>
  `,
  play: async ({ canvasElement }) => {
    const panel = await getLitElement(canvasElement, 'input-panel')

    let receivedLayout = ''
    panel.addEventListener('input-panel:layout-change', ((e: CustomEvent) => {
      receivedLayout = e.detail.layout
    }) as EventListener)

    const shadow = panel.shadowRoot!
    // Pin/float is first icon-btn in action-group
    const layoutBtn = shadow.querySelector('.action-group .icon-btn') as HTMLButtonElement

    layoutBtn.click()
    await panel.updateComplete

    expect(receivedLayout).toBe('floating')
  },
}

/**
 * Floating layout with resize handles visible at the four corners.
 */
export const FloatingResize: StoryObj = {
  render: () => html`
    <input-panel layout="floating" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys" floating></virtual-keyboard-tab>
      <virtual-trackpad-tab slot="trackpad" floating></virtual-trackpad-tab>
    </input-panel>
  `,
  play: async ({ canvasElement }) => {
    const panel = await getLitElement(canvasElement, 'input-panel')
    const shadow = panel.shadowRoot!
    const dialog = shadow.querySelector('.panel-dialog') as HTMLDialogElement
    expect(dialog).toBeTruthy()

    const handles = shadow.querySelectorAll('.resize-handle')
    expect(handles.length).toBe(4)

    // Verify each corner class exists
    expect(shadow.querySelector('.resize-tl')).toBeTruthy()
    expect(shadow.querySelector('.resize-tr')).toBeTruthy()
    expect(shadow.querySelector('.resize-bl')).toBeTruthy()
    expect(shadow.querySelector('.resize-br')).toBeTruthy()
  },
}
