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

function pointer(target: Element, type: string, x: number, y: number, id = 1) {
  target.dispatchEvent(
    new PointerEvent(type, {
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType: 'mouse',
      bubbles: true,
      cancelable: true,
    })
  )
}

function expectFloatingDialogVisible(dialog: HTMLDialogElement) {
  expect(dialog.open || dialog.matches(':popover-open')).toBe(true)
  expect(dialog.matches(':modal')).toBe(false)
}

const meta: Meta = {
  title: 'InputPanel',
  tags: ['autodocs'],
  decorators: [
    (story) => html`
      <div
        style="width: 400px; height: 300px; background: #1a1a1a; color: #fff; font-family: monospace;"
      >
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
      <shortcut-tab slot="shortcuts"></shortcut-tab>
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
      <shortcut-tab slot="shortcuts"></shortcut-tab>
      <virtual-trackpad-tab slot="trackpad" floating></virtual-trackpad-tab>
    </input-panel>
  `,
  play: async ({ canvasElement }) => {
    const panel = await getLitElement(canvasElement, 'input-panel')
    const dialog = panel.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement
    expect(dialog).toBeTruthy()
    expectFloatingDialogVisible(dialog)
    const moveBar = panel.shadowRoot?.querySelector('.move-bar') as HTMLElement
    expect(moveBar).toBeTruthy()

    const dialogStyles = getComputedStyle(dialog)
    expect(dialogStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(dialogStyles.borderTopWidth).toBe('1px')
    expect(dialogStyles.borderRadius).toBe('8px')

    const moveBarRect = moveBar.getBoundingClientRect()
    const dialogRect = dialog.getBoundingClientRect()
    expect(moveBarRect.top).toBeLessThan(dialogRect.top)

    const styles = getComputedStyle(dialog) as CSSStyleDeclaration & {
      webkitBackdropFilter?: string
    }
    expect(styles.mixBlendMode).toBe('exclusion')
    expect(
      styles.backdropFilter.includes('blur(1px)') ||
        styles.webkitBackdropFilter?.includes('blur(1px)')
    ).toBe(true)
  },
}

/**
 * InputPanel starts on the "keys" tab (Virtual Keyboard).
 */
export const KeysTab: StoryObj = {
  render: () => html`
    <input-panel layout="fixed" active-tab="keys" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys"></virtual-keyboard-tab>
      <shortcut-tab slot="shortcuts"></shortcut-tab>
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
      <shortcut-tab slot="shortcuts"></shortcut-tab>
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
      <shortcut-tab slot="shortcuts"></shortcut-tab>
      <virtual-trackpad-tab slot="trackpad"></virtual-trackpad-tab>
    </input-panel>
  `,
}

/**
 * Verifies that tab switching works by clicking the "Keys" tab button.
 * Now expects 5 tab buttons (Input, Keys, Shortcuts, Trackpad, Settings).
 */
export const TabSwitching: StoryObj = {
  render: () => html`
    <input-panel layout="fixed" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys"></virtual-keyboard-tab>
      <shortcut-tab slot="shortcuts"></shortcut-tab>
      <virtual-trackpad-tab slot="trackpad"></virtual-trackpad-tab>
    </input-panel>
  `,
  play: async ({ canvasElement }) => {
    const panel = await getLitElement(canvasElement, 'input-panel')

    const shadow = panel.shadowRoot!
    const tabButtons = shadow.querySelectorAll('.tab-btn')
    expect(tabButtons.length).toBe(5)

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
      <shortcut-tab slot="shortcuts"></shortcut-tab>
      <virtual-trackpad-tab slot="trackpad" floating></virtual-trackpad-tab>
    </input-panel>
  `,
  play: async ({ canvasElement }) => {
    const panel = await getLitElement(canvasElement, 'input-panel')
    const shadow = panel.shadowRoot!
    const dialog = shadow.querySelector('.panel-dialog') as HTMLDialogElement
    expect(dialog).toBeTruthy()
    expectFloatingDialogVisible(dialog)

    const handles = shadow.querySelectorAll('.resize-handle')
    expect(handles.length).toBe(4)

    // Verify each corner class exists
    expect(shadow.querySelector('.resize-tl')).toBeTruthy()
    expect(shadow.querySelector('.resize-tr')).toBeTruthy()
    expect(shadow.querySelector('.resize-bl')).toBeTruthy()
    expect(shadow.querySelector('.resize-br')).toBeTruthy()
  },
}

/**
 * Floating panel moves through the protruding move bar and toolbar blank space.
 */
export const FloatingDragHandles: StoryObj = {
  render: () => html`
    <input-panel layout="floating" style="height: 100%;">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys" floating></virtual-keyboard-tab>
      <shortcut-tab slot="shortcuts"></shortcut-tab>
      <virtual-trackpad-tab slot="trackpad" floating></virtual-trackpad-tab>
    </input-panel>
  `,
  play: async ({ canvasElement }) => {
    const panel = await getLitElement(canvasElement, 'input-panel')
    const shadow = panel.shadowRoot!
    const dialog = shadow.querySelector('.panel-dialog') as HTMLDialogElement
    const moveBar = shadow.querySelector('.move-bar') as HTMLElement
    const toolbar = shadow.querySelector('.toolbar') as HTMLElement
    const layoutBtn = shadow.querySelector('.action-group .icon-btn') as HTMLButtonElement
    expectFloatingDialogVisible(dialog)
    expect(moveBar).toBeTruthy()
    expect(toolbar).toBeTruthy()

    const before = dialog.getBoundingClientRect()
    const handleRect = moveBar.getBoundingClientRect()
    const startX = handleRect.left + handleRect.width / 2
    const startY = handleRect.top + handleRect.height / 2

    pointer(moveBar, 'pointerdown', startX, startY)
    pointer(moveBar, 'pointermove', startX + 40, startY + 22)
    pointer(moveBar, 'pointerup', startX + 40, startY + 22)

    const after = dialog.getBoundingClientRect()
    expect(after.left).toBeGreaterThan(before.left + 20)
    expect(after.top).toBeGreaterThan(before.top + 10)

    const toolbarRect = toolbar.getBoundingClientRect()
    const toolbarStartX = toolbarRect.left + toolbarRect.width / 2
    const toolbarStartY = toolbarRect.top + toolbarRect.height / 2

    pointer(toolbar, 'pointerdown', toolbarStartX, toolbarStartY, 2)
    pointer(toolbar, 'pointermove', toolbarStartX - 35, toolbarStartY + 16, 2)
    pointer(toolbar, 'pointerup', toolbarStartX - 35, toolbarStartY + 16, 2)

    const toolbarAfter = dialog.getBoundingClientRect()
    expect(toolbarAfter.left).toBeLessThan(after.left - 15)
    expect(toolbarAfter.top).toBeGreaterThan(after.top + 8)

    layoutBtn.click()
    await panel.updateComplete

    expect(panel.getAttribute('layout')).toBe('fixed')
  },
}

/**
 * Verifies Fixed mode height slider updates InputPanel internal style variable.
 */
export const FixedHeightSync: StoryObj = {
  render: () => html`
    <input-panel layout="fixed" active-tab="settings">
      <input-method-tab slot="input"></input-method-tab>
      <virtual-keyboard-tab slot="keys"></virtual-keyboard-tab>
      <shortcut-tab slot="shortcuts"></shortcut-tab>
      <virtual-trackpad-tab slot="trackpad"></virtual-trackpad-tab>
    </input-panel>
  `,
  play: async ({ canvasElement }) => {
    const panel = await getLitElement(canvasElement, 'input-panel')
    const settings = panel.shadowRoot?.querySelector('input-panel-settings') as LitElement
    await settings.updateComplete

    const slider = settings.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement
    slider.value = '320'
    slider.dispatchEvent(new Event('input', { bubbles: true }))

    await settings.updateComplete
    await panel.updateComplete

    expect(panel.style.getPropertyValue('--input-panel-fixed-height').trim()).toBe('320px')
  },
}
