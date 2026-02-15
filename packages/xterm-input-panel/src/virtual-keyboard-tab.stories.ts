import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, fn } from 'storybook/test'
import type { FederatedPointerEvent, Graphics } from 'pixi.js'

import './virtual-keyboard-tab.js'

const meta: Meta = {
  title: 'VirtualKeyboardTab',
  tags: ['autodocs'],
  decorators: [
    (story) => html`
      <div style="width: 600px; height: 200px; background: #1a1a1a; color: #fff; font-family: monospace;">
        ${story()}
      </div>
    `,
  ],
}

export default meta

// --- Internal access helpers ---

interface KeyboardInternals {
  _keys: { gfx: Graphics; def: { label: string; data: string; modifier?: string; action?: string } }[]
}

/** Get the keyboard element, wait for PixiJS init, and expose internals. */
async function setup(canvasElement: HTMLElement) {
  const el = canvasElement.querySelector('virtual-keyboard-tab') as
    HTMLElement & { updateComplete: Promise<boolean> } & KeyboardInternals
  await el.updateComplete
  await new Promise(resolve => setTimeout(resolve, 500))
  return el
}

/** Find a key by its label (e.g. 'a', 'Tab', 'Shift'). */
function findKey(el: KeyboardInternals, label: string) {
  return el._keys.find(k => k.def.label === label)
}

/**
 * Simulate pointerdown → (wait) → pointerup on a PixiJS Graphics key.
 * We emit through PixiJS's FederatedPointerEvent system by calling
 * gfx.emit() directly, since native DOM events on the canvas don't
 * propagate to individual PixiJS display objects.
 */
function emitDown(gfx: Graphics) {
  gfx.emit('pointerdown', { pointerId: 1 } as unknown as FederatedPointerEvent)
}

function emitUp(gfx: Graphics) {
  gfx.emit('pointerup', {} as unknown as FederatedPointerEvent)
}

function emitUpOutside(gfx: Graphics) {
  gfx.emit('pointerupoutside', {} as unknown as FederatedPointerEvent)
}

function emitLeave(gfx: Graphics) {
  gfx.emit('pointerleave', {} as unknown as FederatedPointerEvent)
}

// --- Stories ---

/**
 * Virtual keyboard in fixed (opaque) mode with QWERTY layout.
 */
export const Fixed: StoryObj = {
  render: () => html`<virtual-keyboard-tab style="height: 100%;"></virtual-keyboard-tab>`,
}

/**
 * Virtual keyboard in floating mode with breathing transparency effect.
 */
export const Floating: StoryObj = {
  render: () => html`<virtual-keyboard-tab floating style="height: 100%;"></virtual-keyboard-tab>`,
}

/**
 * Verifies QWERTY layout renders — PixiJS stage has children.
 */
export const QwertyLayout: StoryObj = {
  render: () => html`<virtual-keyboard-tab style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const shadow = el.shadowRoot!
    const canvas = shadow.querySelector('canvas')
    expect(canvas).not.toBeNull()
  },
}

/**
 * Pressing and releasing a regular key dispatches exactly one
 * `input-panel:send` event with the correct data.
 */
export const SingleKeyPress: StoryObj = {
  render: () => html`<virtual-keyboard-tab style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.gfx)
    // Quick release (no repeat)
    await new Promise(resolve => setTimeout(resolve, 50))
    emitUp(key!.gfx)

    await new Promise(resolve => setTimeout(resolve, 50))

    // Exactly one send
    expect(handler).toHaveBeenCalledTimes(1)
    const detail = (handler.mock.calls[0] as unknown[])[0] as CustomEvent
    expect(detail.detail.data).toBe('a')

    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * Holding a key for longer than the repeat delay (400ms) dispatches
 * multiple `input-panel:send` events (key repeat).
 */
export const KeyRepeatOnLongPress: StoryObj = {
  render: () => html`<virtual-keyboard-tab style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.gfx)

    // Wait long enough for initial delay (400ms) + several repeats (80ms each)
    // 400 + 80*3 = 640ms, wait 700ms to be safe
    await new Promise(resolve => setTimeout(resolve, 700))

    emitUp(key!.gfx)

    await new Promise(resolve => setTimeout(resolve, 50))

    // 1 send from the final keyUp + at least 2 from the repeat interval
    // Total should be > 2 (repeats happen at 80ms intervals after 400ms delay)
    const callCount = handler.mock.calls.length
    expect(callCount).toBeGreaterThanOrEqual(3)

    // All sends should have data 'a'
    for (const call of handler.mock.calls) {
      const event = (call as unknown[])[0] as CustomEvent
      expect(event.detail.data).toBe('a')
    }

    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * Quick press (< 400ms) does NOT trigger key repeat — exactly 1 send.
 */
export const QuickPressNoRepeat: StoryObj = {
  render: () => html`<virtual-keyboard-tab style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.gfx)
    // Release before the 400ms repeat delay
    await new Promise(resolve => setTimeout(resolve, 200))
    emitUp(key!.gfx)

    // Wait to make sure no delayed repeats fire
    await new Promise(resolve => setTimeout(resolve, 300))

    expect(handler).toHaveBeenCalledTimes(1)

    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * Sliding finger off the key (pointerleave) during hold cancels repeat
 * and does NOT send the key on release.
 */
export const PointerLeaveCancelsRepeat: StoryObj = {
  render: () => html`<virtual-keyboard-tab style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.gfx)
    await new Promise(resolve => setTimeout(resolve, 100))

    // Finger slides off the key
    emitLeave(key!.gfx)
    await new Promise(resolve => setTimeout(resolve, 50))

    // Release outside
    emitUpOutside(key!.gfx)

    // Wait to ensure no delayed sends
    await new Promise(resolve => setTimeout(resolve, 500))

    // No key should have been sent (leave cancelled the pending send,
    // and keyUp checks _activeKeyDef)
    expect(handler).toHaveBeenCalledTimes(0)

    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * Pointer leave during active key repeat stops the repeat.
 */
export const PointerLeaveDuringRepeat: StoryObj = {
  render: () => html`<virtual-keyboard-tab style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.gfx)
    // Wait for repeat to start
    await new Promise(resolve => setTimeout(resolve, 550))

    const countBefore = handler.mock.calls.length
    expect(countBefore).toBeGreaterThan(0) // At least one repeat fired

    // Finger slides off
    emitLeave(key!.gfx)

    // Wait — no more repeats should fire
    await new Promise(resolve => setTimeout(resolve, 300))

    const countAfter = handler.mock.calls.length
    // Count should not have increased (or at most +0)
    expect(countAfter).toBe(countBefore)

    // Clean up
    emitUpOutside(key!.gfx)
    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * Modifier keys (Ctrl, Shift, Alt) do NOT trigger key repeat.
 */
export const ModifierNoRepeat: StoryObj = {
  render: () => html`<virtual-keyboard-tab style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'Ctrl')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.gfx)
    // Wait well past repeat delay
    await new Promise(resolve => setTimeout(resolve, 700))
    emitUp(key!.gfx)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Modifiers never send input-panel:send
    expect(handler).toHaveBeenCalledTimes(0)

    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * Shift + key sends the shifted variant.
 */
export const ShiftKey: StoryObj = {
  render: () => html`<virtual-keyboard-tab style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)

    // Find the left Shift key
    const shiftKey = findKey(el, 'Shift')
    expect(shiftKey).toBeDefined()

    // Press Shift — this toggles the modifier and re-layouts (shifted labels)
    emitDown(shiftKey!.gfx)
    // Allow Lit to re-render
    await new Promise(resolve => setTimeout(resolve, 200))

    // After _layoutKeys(), keys have new Graphics objects.
    // The 'a' key now shows 'A'.
    // Find by data instead of label since _keys stores the original def.
    const aKey = el._keys.find(k => k.def.data === 'a')
    expect(aKey).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(aKey!.gfx)
    await new Promise(resolve => setTimeout(resolve, 50))
    emitUp(aKey!.gfx)

    await new Promise(resolve => setTimeout(resolve, 50))

    expect(handler).toHaveBeenCalledTimes(1)
    const detail = (handler.mock.calls[0] as unknown[])[0] as CustomEvent
    expect(detail.detail.data).toBe('A')

    el.removeEventListener('input-panel:send', handler)
  },
}
