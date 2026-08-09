/**
 * Orthogonal intents (created 2026-08-06 Asia/Shanghai):
 * 1. Prove asynchronous Pixi initialization cannot outlive its Web Component connection.
 * 2. Cover keyboard, shortcut, and trackpad render owners through the real browser lifecycle.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows, then handle similar portability failures."
 */
import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { Application } from 'pixi.js'
import { expect } from 'storybook/test'

import './index.js'

type PixiTagName = 'shortcut-tab' | 'virtual-keyboard-tab' | 'virtual-trackpad-tab'

interface PixiOwnedElement extends HTMLElement {
  readonly updateComplete: Promise<unknown>
  readonly _app: Application | null
}

const meta: Meta = {
  title: 'PixiLifecycle',
  tags: ['autodocs'],
  render: () => html`<div data-pixi-host style="width: 600px; height: 300px;"></div>`,
}

export default meta

async function expectDisconnectedInitializationRetired(
  canvasElement: HTMLElement,
  tagName: PixiTagName
) {
  const originalInit = Application.prototype.init
  let markInitStarted: () => void = () => undefined
  let releaseInit: () => void = () => undefined
  let markInitFinished: () => void = () => undefined
  const initStarted = new Promise<void>((resolve) => {
    markInitStarted = resolve
  })
  const initRelease = new Promise<void>((resolve) => {
    releaseInit = resolve
  })
  const initFinished = new Promise<void>((resolve) => {
    markInitFinished = resolve
  })

  Application.prototype.init = async function (options) {
    markInitStarted()
    await initRelease
    try {
      await originalInit.call(this, options)
    } finally {
      markInitFinished()
    }
  }

  const host = canvasElement.querySelector('[data-pixi-host]') as HTMLElement
  const element = document.createElement(tagName) as PixiOwnedElement
  element.style.display = 'block'
  element.style.width = '100%'
  element.style.height = '100%'
  host.appendChild(element)

  try {
    await initStarted
    element.remove()
    releaseInit()
    await initFinished
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(element.isConnected).toBe(false)
    expect(element._app).toBeNull()
  } finally {
    releaseInit()
    element.remove()
    Application.prototype.init = originalInit
  }
}

export const KeyboardDisconnect: StoryObj = {
  play: async ({ canvasElement }) => {
    await expectDisconnectedInitializationRetired(canvasElement, 'virtual-keyboard-tab')
  },
}

export const ShortcutDisconnect: StoryObj = {
  play: async ({ canvasElement }) => {
    await expectDisconnectedInitializationRetired(canvasElement, 'shortcut-tab')
  },
}

export const TrackpadDisconnect: StoryObj = {
  play: async ({ canvasElement }) => {
    await expectDisconnectedInitializationRetired(canvasElement, 'virtual-trackpad-tab')
  },
}
