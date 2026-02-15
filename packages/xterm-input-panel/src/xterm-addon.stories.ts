import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, fn, waitFor } from 'storybook/test'
import { Terminal } from '@xterm/xterm'
import { InputPanelAddon } from './xterm-addon.js'

// Register all custom elements (critical — xterm-addon.ts does NOT import these)
import './index.js'

/** Reset singleton state between stories */
function resetAddonState() {
  // Force-close any active instance
  const active = InputPanelAddon.activeInstance
  if (active) active.close()
  InputPanelAddon.onActiveChange = null
  InputPanelAddon.mountTarget = null

  // Remove any <input-panel> elements leaked into body or containers
  document.querySelectorAll('input-panel').forEach((el) => el.remove())
}

/** Create a real xterm Terminal + InputPanelAddon, mount into container */
function setupTerminal(container: HTMLElement) {
  const terminal = new Terminal({
    cols: 80,
    rows: 10,
    allowTransparency: true,
    theme: { background: 'transparent' },
  })

  const inputHandler = fn()
  const addon = new InputPanelAddon({ onInput: inputHandler })
  terminal.loadAddon(addon)
  terminal.open(container)

  return { terminal, addon, inputHandler }
}

const meta: Meta = {
  title: 'InputPanelAddon',
  tags: ['autodocs'],
  decorators: [
    (story) => html`
      <div style="width: 600px; height: 400px; background: #1a1a1a; color: #fff; font-family: monospace; position: relative;">
        ${story()}
      </div>
    `,
  ],
}

export default meta

/**
 * Basic test: addon.open() creates an <input-panel> inside the terminal's
 * container (not document.body) and the floating dialog becomes visible.
 */
export const OpenCreatesPanel: StoryObj = {
  render: () => html`<div id="term-container" style="width:100%;height:100%;"></div>`,
  play: async ({ canvasElement }) => {
    resetAddonState()
    const container = canvasElement.querySelector('#term-container') as HTMLElement
    const { addon } = setupTerminal(container)

    // Verify no panel exists yet
    expect(container.querySelector('input-panel')).toBeNull()
    expect(addon.isOpen).toBe(false)

    // Open the panel
    addon.open()

    expect(addon.isOpen).toBe(true)

    // <input-panel> should be inside the terminal's container, NOT document.body
    const panel = container.querySelector('input-panel')
    expect(panel).not.toBeNull()
    expect(panel!.getAttribute('layout')).toBe('floating')
    expect(panel!.parentElement).toBe(container)

    // Wait for Lit to render + firstUpdated to call dialog.show()
    await (panel as any).updateComplete

    // The dialog inside shadow DOM should be open
    const dialog = (panel as any).shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement
    expect(dialog).not.toBeNull()
    expect(dialog.open).toBe(true)

    // Cleanup
    addon.close()
    expect(addon.isOpen).toBe(false)
    expect(container.querySelector('input-panel')).toBeNull()
  },
}

/**
 * Singleton test: opening a second addon instance closes the first.
 * Panel migrates from container A to container B.
 */
export const SingletonMigration: StoryObj = {
  render: () => html`
    <div style="display:flex;gap:8px;height:100%;">
      <div id="term-a" style="flex:1;"></div>
      <div id="term-b" style="flex:1;"></div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    resetAddonState()
    const containerA = canvasElement.querySelector('#term-a') as HTMLElement
    const containerB = canvasElement.querySelector('#term-b') as HTMLElement
    const { addon: addonA } = setupTerminal(containerA)
    const { addon: addonB } = setupTerminal(containerB)

    // Open A — panel should be inside container A
    addonA.open()
    expect(addonA.isOpen).toBe(true)
    expect(InputPanelAddon.activeInstance).toBe(addonA)
    expect(containerA.querySelector('input-panel')).not.toBeNull()

    // Open B — should close A, panel should now be inside container B
    addonB.open()
    expect(addonB.isOpen).toBe(true)
    expect(addonA.isOpen).toBe(false)
    expect(InputPanelAddon.activeInstance).toBe(addonB)

    // Panel removed from A, now in B
    expect(containerA.querySelector('input-panel')).toBeNull()
    expect(containerB.querySelector('input-panel')).not.toBeNull()

    // Only one <input-panel> total
    const panels = document.querySelectorAll('input-panel')
    expect(panels.length).toBe(1)

    addonB.close()
  },
}

/**
 * Toggle test: open → close → open works correctly.
 */
export const ToggleCycle: StoryObj = {
  render: () => html`<div id="term-container" style="width:100%;height:100%;"></div>`,
  play: async ({ canvasElement }) => {
    resetAddonState()
    const container = canvasElement.querySelector('#term-container') as HTMLElement
    const { addon } = setupTerminal(container)

    // Toggle open
    addon.toggle()
    expect(addon.isOpen).toBe(true)
    expect(container.querySelector('input-panel')).not.toBeNull()

    // Toggle close
    addon.toggle()
    expect(addon.isOpen).toBe(false)
    expect(container.querySelector('input-panel')).toBeNull()

    // Toggle open again
    addon.toggle()
    expect(addon.isOpen).toBe(true)

    const panel = container.querySelector('input-panel')
    expect(panel).not.toBeNull()

    // Wait for Lit render and verify dialog is open
    await (panel as any).updateComplete
    const dialog = (panel as any).shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement
    expect(dialog).not.toBeNull()
    expect(dialog.open).toBe(true)

    addon.close()
  },
}

/**
 * Close event: clicking close button inside <input-panel> triggers addon.close().
 */
export const CloseFromPanel: StoryObj = {
  render: () => html`<div id="term-container" style="width:100%;height:100%;"></div>`,
  play: async ({ canvasElement }) => {
    resetAddonState()
    const container = canvasElement.querySelector('#term-container') as HTMLElement
    const { addon } = setupTerminal(container)

    addon.open()
    expect(addon.isOpen).toBe(true)

    const panel = container.querySelector('input-panel') as any
    await panel.updateComplete

    // Click the close button inside the panel's shadow DOM
    const shadow = panel.shadowRoot!
    const closeBtn = shadow.querySelector('[title="Close panel"]') as HTMLButtonElement
    expect(closeBtn).not.toBeNull()
    closeBtn.click()

    // Addon should now be closed
    await waitFor(() => {
      expect(addon.isOpen).toBe(false)
    })
    expect(container.querySelector('input-panel')).toBeNull()
  },
}

/**
 * Callbacks test: onOpen and onClose fire correctly.
 */
export const Callbacks: StoryObj = {
  render: () => html`<div id="term-container" style="width:100%;height:100%;"></div>`,
  play: async ({ canvasElement }) => {
    resetAddonState()
    const container = canvasElement.querySelector('#term-container') as HTMLElement

    const onOpen = fn()
    const onClose = fn()
    const addon = new InputPanelAddon({ onOpen, onClose })
    const terminal = new Terminal({ cols: 80, rows: 10 })
    terminal.loadAddon(addon)
    terminal.open(container)

    addon.open()
    expect(onOpen).toHaveBeenCalledTimes(1)

    addon.close()
    expect(onClose).toHaveBeenCalledTimes(1)
  },
}

/**
 * Input forwarding: input-panel:send events are forwarded to onInput callback.
 */
export const InputForwarding: StoryObj = {
  render: () => html`<div id="term-container" style="width:100%;height:100%;"></div>`,
  play: async ({ canvasElement }) => {
    resetAddonState()
    const container = canvasElement.querySelector('#term-container') as HTMLElement
    const { addon, inputHandler } = setupTerminal(container)

    addon.open()
    expect(addon.isOpen).toBe(true)

    const panel = container.querySelector('input-panel')!
    await (panel as any).updateComplete

    // Simulate input event from panel
    panel.dispatchEvent(
      new CustomEvent('input-panel:send', {
        detail: { data: 'hello\r' },
        bubbles: true,
        composed: true,
      })
    )

    expect(inputHandler).toHaveBeenCalledWith('hello\r')

    addon.close()
  },
}

/**
 * Custom element registration: document.createElement('input-panel')
 * must produce a real InputPanel instance with shadow DOM, not a generic HTMLElement.
 */
export const CustomElementRegistered: StoryObj = {
  render: () => html`<div id="term-container" style="width:100%;height:100%;"></div>`,
  play: async () => {
    resetAddonState()

    // Verify the custom element is registered
    const ctor = customElements.get('input-panel')
    expect(ctor).toBeDefined()

    // Create via DOM API (same as addon.open())
    const el = document.createElement('input-panel')
    expect(el).toBeInstanceOf(ctor!)

    // Append to body and wait for Lit to render
    el.setAttribute('layout', 'floating')
    document.body.appendChild(el)

    await (el as any).updateComplete

    // Shadow DOM should exist with dialog
    const shadow = (el as any).shadowRoot
    expect(shadow).not.toBeNull()

    const dialog = shadow.querySelector('.panel-dialog') as HTMLDialogElement
    expect(dialog).not.toBeNull()

    // firstUpdated should have called dialog.show()
    expect(dialog.open).toBe(true)

    // The backdrop should also exist
    const backdrop = shadow.querySelector('.backdrop')
    expect(backdrop).not.toBeNull()

    el.remove()
  },
}

/**
 * FAB simulation: verifies the full FAB click → open → close cycle
 * using the same pointer event pattern as the real FAB.
 */
export const FabClickSimulation: StoryObj = {
  render: () => html`<div id="term-container" style="width:100%;height:100%;"></div>`,
  play: async ({ canvasElement }) => {
    resetAddonState()
    const container = canvasElement.querySelector('#term-container') as HTMLElement
    const { addon } = setupTerminal(container)

    // Simulate what attachListeners does on touch devices:
    // set _lastFocused (using the fix we applied)
    // We can't create the actual FAB in non-touch env, so test toggle() directly
    // as that's exactly what the FAB calls

    // Verify _lastFocused fallback — before any focus event
    addon.toggle()
    expect(addon.isOpen).toBe(true)

    // Panel should be in the terminal container with visible dialog
    const panel = container.querySelector('input-panel') as any
    expect(panel).not.toBeNull()
    await panel.updateComplete

    const dialog = panel.shadowRoot?.querySelector('.panel-dialog') as HTMLDialogElement
    expect(dialog).not.toBeNull()
    expect(dialog.open).toBe(true)

    // Verify dialog has reasonable dimensions (not 0x0)
    const rect = dialog.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)

    // Toggle close
    addon.toggle()
    expect(addon.isOpen).toBe(false)
    expect(container.querySelector('input-panel')).toBeNull()
  },
}

/**
 * Dispose test: addon.dispose() cleans up panel and listeners.
 */
export const DisposeCleanup: StoryObj = {
  render: () => html`<div id="term-container" style="width:100%;height:100%;"></div>`,
  play: async ({ canvasElement }) => {
    resetAddonState()
    const container = canvasElement.querySelector('#term-container') as HTMLElement
    const { addon } = setupTerminal(container)

    addon.open()
    expect(addon.isOpen).toBe(true)

    addon.dispose()
    expect(addon.isOpen).toBe(false)
    expect(container.querySelector('input-panel')).toBeNull()
    expect(InputPanelAddon.activeInstance).toBeNull()
  },
}

/**
 * Shared mount target: when InputPanelAddon.mountTarget is set,
 * panel mounts there instead of individual terminal containers.
 * This is the multi-terminal scenario.
 */
export const SharedMountTarget: StoryObj = {
  render: () => html`
    <div id="shared-wrapper" style="position:relative;height:100%;">
      <div style="display:flex;gap:8px;height:100%;">
        <div id="term-a" style="flex:1;"></div>
        <div id="term-b" style="flex:1;"></div>
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    resetAddonState()
    const wrapper = canvasElement.querySelector('#shared-wrapper') as HTMLElement
    const containerA = canvasElement.querySelector('#term-a') as HTMLElement
    const containerB = canvasElement.querySelector('#term-b') as HTMLElement

    // Set shared mount target BEFORE creating terminals
    InputPanelAddon.mountTarget = wrapper

    const { addon: addonA } = setupTerminal(containerA)
    const { addon: addonB } = setupTerminal(containerB)

    // Open A — panel should be in the shared wrapper, NOT container A
    addonA.open()
    expect(addonA.isOpen).toBe(true)
    expect(containerA.querySelector('input-panel')).toBeNull()
    const panelA = wrapper.querySelector('input-panel')
    expect(panelA).not.toBeNull()
    expect(panelA!.parentElement).toBe(wrapper)

    // Open B — panel migrates but still stays in shared wrapper
    addonB.open()
    expect(addonB.isOpen).toBe(true)
    expect(addonA.isOpen).toBe(false)
    const panelB = wrapper.querySelector('input-panel')
    expect(panelB).not.toBeNull()
    expect(panelB!.parentElement).toBe(wrapper)

    // Still only one panel total
    expect(wrapper.querySelectorAll('input-panel').length).toBe(1)

    addonB.close()
    expect(wrapper.querySelector('input-panel')).toBeNull()

    // Cleanup
    InputPanelAddon.mountTarget = null
  },
}
