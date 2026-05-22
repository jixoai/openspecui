import { describe, expect, it, vi } from 'vitest'
import { BrowserTranslatorFactory, probeBrowserTranslator } from './index.js'

class MockWindow extends EventTarget {
  Translator?: {
    availability: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>
    create: (options: {
      sourceLanguage: string
      targetLanguage: string
      monitor?: (monitor: EventTarget) => void
      signal?: AbortSignal
    }) => Promise<{ translate: (input: string) => Promise<string>; destroy?: () => void }>
  }
}

describe('browser translator package', () => {
  it('normalizes missing and unknown browser availability states', async () => {
    await expect(probeBrowserTranslator('zh', 'en', new MockWindow() as Window)).resolves.toEqual({
      availability: 'missing',
      message: 'Browser Translator API is not exposed.',
    })

    const win = new MockWindow()
    win.Translator = {
      availability: vi.fn(async () => 'future-state'),
      create: vi.fn(),
    }

    await expect(probeBrowserTranslator('zh', 'en', win as Window)).resolves.toEqual({
      availability: 'error',
    })
  })

  it('adapts rich input to the browser source text and reports download progress', async () => {
    const monitor = new EventTarget()
    const translate = vi.fn(async (input: string) => `zh:${input}`)
    const status = vi.fn()
    const win = new MockWindow()
    win.Translator = {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async (options) => {
        options.monitor?.(monitor)
        const event = new Event('downloadprogress')
        Object.defineProperties(event, {
          loaded: { value: 25 },
          total: { value: 100 },
        })
        monitor.dispatchEvent(event)
        return { translate }
      }),
    }

    const translator = await new BrowserTranslatorFactory(win as Window).create({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      monitor: { setStatus: status },
    })

    await expect(
      translator.translate({
        instructions: 'Keep tags.',
        context: '# Proposal',
        source: '<x1>Hello</x1>',
      })
    ).resolves.toBe('zh:<x1>Hello</x1>')
    expect(translate).toHaveBeenCalledWith('<x1>Hello</x1>', undefined)
    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Downloading browser translation support 25%.',
        progress: 0.25,
      })
    )
  })
})
