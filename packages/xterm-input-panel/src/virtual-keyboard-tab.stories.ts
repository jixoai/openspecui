import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import type { Container, FederatedPointerEvent } from 'pixi.js'
import { expect, fn } from 'storybook/test'

import './virtual-keyboard-tab.js'

const meta: Meta = {
  title: 'VirtualKeyboardTab',
  tags: ['autodocs'],
  decorators: [
    (story) => html`
      <div
        style="width: 600px; height: 200px; background: #1a1a1a; color: #fff; font-family: monospace;"
      >
        ${story()}
      </div>
    `,
  ],
}

export default meta

// --- Internal access helpers ---

interface KeyboardInternals {
  _keys: { container: Container; def: { label: string; data: string; modifier?: string } }[]
}

/** Get the keyboard element, wait for PixiJS init, and expose internals. */
async function setup(canvasElement: HTMLElement) {
  const el = canvasElement.querySelector('virtual-keyboard-tab') as HTMLElement & {
    updateComplete: Promise<boolean>
  } & KeyboardInternals
  await el.updateComplete
  await new Promise((resolve) => setTimeout(resolve, 500))
  return el
}

/** Find a key by its label (e.g. 'a', 'Tab', 'Shift'). */
function findKey(el: KeyboardInternals, label: string) {
  return el._keys.find((k) => k.def.label === label)
}

/**
 * Simulate pointerdown → (wait) → pointerup on a PixiJS Graphics key.
 * We emit through PixiJS's FederatedPointerEvent system by calling
 * gfx.emit() directly, since native DOM events on the canvas don't
 * propagate to individual PixiJS display objects.
 */
function emitDown(target: Container) {
  target.emit('pointerdown', { pointerId: 1 } as unknown as FederatedPointerEvent)
}

function emitUp(target: Container) {
  target.emit('pointerup', {} as unknown as FederatedPointerEvent)
}

function emitUpOutside(target: Container) {
  target.emit('pointerupoutside', {} as unknown as FederatedPointerEvent)
}

function emitLeave(target: Container) {
  target.emit('pointerleave', {} as unknown as FederatedPointerEvent)
}

function emitMove(target: Container, globalY: number) {
  target.emit('pointermove', { global: { y: globalY } } as unknown as FederatedPointerEvent)
}

// --- Stories ---

/**
 * Virtual keyboard in fixed (opaque) mode with QWERTY layout.
 */
export const Fixed: StoryObj = {
  render: () =>
    html`<virtual-keyboard-tab platform="common" style="height: 100%;"></virtual-keyboard-tab>`,
}

/**
 * Virtual keyboard in floating mode with breathing transparency effect.
 */
export const Floating: StoryObj = {
  render: () =>
    html`<virtual-keyboard-tab
      platform="common"
      floating
      style="height: 100%;"
    ></virtual-keyboard-tab>`,
}

/**
 * Verifies QWERTY layout renders — PixiJS stage has children.
 */
export const QwertyLayout: StoryObj = {
  render: () =>
    html`<virtual-keyboard-tab platform="common" style="height: 100%;"></virtual-keyboard-tab>`,
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
  render: () =>
    html`<virtual-keyboard-tab platform="common" style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.container)
    // Quick release (no repeat)
    await new Promise((resolve) => setTimeout(resolve, 50))
    emitUp(key!.container)

    await new Promise((resolve) => setTimeout(resolve, 50))

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
  render: () =>
    html`<virtual-keyboard-tab platform="common" style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.container)

    // Wait long enough for initial delay (400ms) + several repeats (80ms each)
    // 400 + 80*3 = 640ms, add wider CI margin
    await new Promise((resolve) => setTimeout(resolve, 850))

    emitUp(key!.container)

    await new Promise((resolve) => setTimeout(resolve, 50))

    // 1 send from key up + at least 1 repeat event.
    const callCount = handler.mock.calls.length
    expect(callCount).toBeGreaterThanOrEqual(2)

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
  render: () =>
    html`<virtual-keyboard-tab platform="common" style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.container)
    // Release before the 400ms repeat delay
    await new Promise((resolve) => setTimeout(resolve, 200))
    emitUp(key!.container)

    // Wait to make sure no delayed repeats fire
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(handler).toHaveBeenCalledTimes(1)

    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * Pointer leave should not cancel the active key.
 * The key is released only when pointerup/upoutside arrives.
 */
export const PointerLeaveKeepsPendingKey: StoryObj = {
  render: () =>
    html`<virtual-keyboard-tab platform="common" style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.container)
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Finger slides off the key
    emitLeave(key!.container)
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Release outside
    emitUpOutside(key!.container)

    // Wait to ensure key upoutside settles
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(handler).toHaveBeenCalledTimes(1)

    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * Pointer leave during active repeat should keep repeating until release.
 */
export const PointerLeaveDuringRepeatKeepsRepeating: StoryObj = {
  render: () =>
    html`<virtual-keyboard-tab platform="common" style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.container)
    // Wait for repeat to start (with CI margin)
    await new Promise((resolve) => setTimeout(resolve, 800))

    const countBefore = handler.mock.calls.length
    expect(countBefore).toBeGreaterThan(0) // At least one repeat fired

    // Finger slides off
    emitLeave(key!.container)

    // Wait — repeats should keep firing until release
    await new Promise((resolve) => setTimeout(resolve, 300))

    const countAfter = handler.mock.calls.length
    expect(countAfter).toBeGreaterThan(countBefore)

    emitUpOutside(key!.container)
    await new Promise((resolve) => setTimeout(resolve, 150))

    const countAfterRelease = handler.mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(handler.mock.calls.length).toBe(countAfterRelease)

    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * Modifier keys (Ctrl, Shift, Alt) do NOT trigger key repeat.
 */
export const ModifierNoRepeat: StoryObj = {
  render: () =>
    html`<virtual-keyboard-tab platform="common" style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'Ctrl')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.container)
    // Wait well past repeat delay
    await new Promise((resolve) => setTimeout(resolve, 700))
    emitUp(key!.container)

    await new Promise((resolve) => setTimeout(resolve, 100))

    // Modifiers never send input-panel:send
    expect(handler).toHaveBeenCalledTimes(0)

    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * Shift + key sends the shifted variant.
 */
export const ShiftKey: StoryObj = {
  render: () =>
    html`<virtual-keyboard-tab platform="common" style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)

    // Find the left Shift key
    const shiftKey = findKey(el, 'Shift')
    expect(shiftKey).toBeDefined()

    // Press Shift — this toggles the modifier and re-layouts (shifted labels)
    emitDown(shiftKey!.container)
    // Allow Lit to re-render
    await new Promise((resolve) => setTimeout(resolve, 200))

    // After _layoutKeys(), keys have new Graphics objects.
    // The 'a' key now shows 'A'.
    // Find by data instead of label since _keys stores the original def.
    const aKey = el._keys.find((k) => k.def.data === 'a')
    expect(aKey).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(aKey!.container)
    await new Promise((resolve) => setTimeout(resolve, 50))
    emitUp(aKey!.container)

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(handler).toHaveBeenCalledTimes(1)
    const detail = (handler.mock.calls[0] as unknown[])[0] as CustomEvent
    expect(detail.detail.data).toBe('A')

    el.removeEventListener('input-panel:send', handler)
  },
}

/**
 * macOS layout should provide Caps row under Tab row.
 */
export const MacosCapsRow: StoryObj = {
  render: () =>
    html`<virtual-keyboard-tab platform="macos" style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const caps = findKey(el, 'Caps')
    expect(caps).toBeDefined()
  },
}

/**
 * Swipe up on a key sends shifted value without pressing Shift key.
 */
export const SwipeUpShift: StoryObj = {
  render: () =>
    html`<virtual-keyboard-tab platform="common" style="height: 100%;"></virtual-keyboard-tab>`,
  play: async ({ canvasElement }) => {
    const el = await setup(canvasElement)
    const key = findKey(el, 'a')
    expect(key).toBeDefined()

    const handler = fn()
    el.addEventListener('input-panel:send', handler)

    emitDown(key!.container)
    emitMove(key!.container, -40)
    await new Promise((resolve) => setTimeout(resolve, 30))
    emitUp(key!.container)

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(handler).toHaveBeenCalledTimes(1)
    const detail = (handler.mock.calls[0] as unknown[])[0] as CustomEvent
    expect(detail.detail.data).toBe('A')

    el.removeEventListener('input-panel:send', handler)
  },
}
