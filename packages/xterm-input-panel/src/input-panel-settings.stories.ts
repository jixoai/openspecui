import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, fn } from 'storybook/test'

import './input-panel-settings.js'

const meta: Meta = {
  title: 'InputPanelSettings',
  tags: ['autodocs'],
  decorators: [
    (story) => html`
      <div
        style="width: 300px; height: 250px; background: #1a1a1a; color: #fff; font-family: monospace; position: relative;"
      >
        ${story()}
      </div>
    `,
  ],
}

export default meta

/**
 * Settings panel with height sliders and vibration intensity.
 */
export const Default: StoryObj = {
  render: () => html`
    <input-panel-settings
      visible
      fixed-height="250"
      floating-height="200"
      vibration-intensity="50"
    ></input-panel-settings>
  `,
}

/**
 * Verifies that changing a slider dispatches `input-panel:settings-change`.
 */
export const SliderChange: StoryObj = {
  render: () => html`
    <input-panel-settings
      visible
      fixed-height="250"
      floating-height="200"
      vibration-intensity="50"
    ></input-panel-settings>
  `,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('input-panel-settings') as HTMLElement & {
      updateComplete: Promise<boolean>
    }
    await el.updateComplete

    const settingsHandler = fn()
    el.addEventListener('input-panel:settings-change', settingsHandler)

    const shadow = el.shadowRoot!
    const ranges = shadow.querySelectorAll('input[type="range"]')
    expect(ranges.length).toBe(5)

    // Change the first slider (fixed height)
    const fixedSlider = ranges[0] as HTMLInputElement
    fixedSlider.value = '300'
    fixedSlider.dispatchEvent(new Event('input', { bubbles: true }))

    expect(settingsHandler).toHaveBeenCalledTimes(1)
    const detail = (settingsHandler.mock.calls[0] as unknown[])[0] as CustomEvent
    expect(detail.detail.fixedHeight).toBe(300)

    el.removeEventListener('input-panel:settings-change', settingsHandler)
  },
}
