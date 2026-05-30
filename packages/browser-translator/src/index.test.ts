import { describe, expect, it, vi } from 'vitest'
import {
  BrowserTranslatorFactory,
  prepareBrowserTranslator,
  probeBrowserTranslator,
  scanBrowserTranslationSupportTable,
} from './index.js'

class MockWindow extends EventTarget {
  Translator?: {
    availability: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>
    create: (options: {
      sourceLanguage: string
      targetLanguage: string
      monitor?: (monitor: EventTarget) => void
      signal?: AbortSignal
    }) => Promise<{
      translate: (input: string, options?: { signal?: AbortSignal }) => Promise<string>
      destroy?: () => void
    }>
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

  it('scans browser translation support pairs and keeps actionable rows', async () => {
    const onRow = vi.fn()
    const onProgress = vi.fn()
    const win = new MockWindow()
    win.Translator = {
      availability: vi.fn(
        async ({ sourceLanguage }: { sourceLanguage: string; targetLanguage: string }) => {
          switch (sourceLanguage) {
            case 'en':
              return 'available'
            case 'ja':
              return 'downloadable'
            case 'fr':
              return 'unavailable'
            default:
              throw new Error(`probe failed for ${sourceLanguage}`)
          }
        }
      ),
      create: vi.fn(),
    }

    const table = await scanBrowserTranslationSupportTable({
      sourceLanguages: ['en', 'zh', 'fr', 'ja', 'de'],
      targetLanguage: 'zh',
      signal: new AbortController().signal,
      win: win as Window,
      onRow,
      onProgress,
    })

    expect(table.targetLanguage).toBe('zh')
    expect(table.checked).toBe(5)
    expect(table.total).toBe(5)
    expect(table.rows).toEqual([
      {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        availability: 'available',
      },
      {
        sourceLanguage: 'ja',
        targetLanguage: 'zh',
        availability: 'downloadable',
      },
      {
        sourceLanguage: 'de',
        targetLanguage: 'zh',
        availability: 'error',
        message: 'probe failed for de',
      },
    ])
    expect(onRow).toHaveBeenCalledTimes(4)
    expect(onRow).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sourceLanguage: 'fr',
        targetLanguage: 'zh',
        availability: 'unavailable',
      })
    )
    expect(onProgress).toHaveBeenNthCalledWith(2, { checked: 2, total: 5 })
    expect(onProgress).toHaveBeenLastCalledWith({ checked: 5, total: 5 })
  })

  it('prepares a selected browser language pair and reports progress', async () => {
    const monitor = new EventTarget()
    const status = vi.fn()
    const destroy = vi.fn()
    const signal = new AbortController().signal
    const win = new MockWindow()
    win.Translator = {
      availability: vi.fn(async () => 'downloadable'),
      create: vi.fn(async (options) => {
        options.monitor?.(monitor)
        const event = new Event('downloadprogress')
        Object.defineProperties(event, {
          loaded: { value: 40 },
          total: { value: 100 },
        })
        monitor.dispatchEvent(event)
        return {
          translate: vi.fn(async (input: string) => input),
          destroy,
        }
      }),
    }

    const result = await prepareBrowserTranslator('zh', {
      sourceLanguage: 'ja',
      signal,
      onStatus: status,
      win: win as Window,
    })

    expect(win.Translator.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLanguage: 'ja',
        targetLanguage: 'zh',
        signal,
      })
    )
    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({
        availability: 'downloading',
        message: 'Downloading browser translation support.',
      })
    )
    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({
        availability: 'downloading',
        progress: 0.4,
        message: 'Downloading browser translation support 40%.',
      })
    )
    expect(status).toHaveBeenLastCalledWith({
      availability: 'available',
      message: 'Browser translator is ready.',
    })
    expect(destroy).toHaveBeenCalled()
    expect(result).toEqual({
      availability: 'available',
      message: 'Browser translator is ready.',
    })
  })

  it('returns ready availability without creating a translator when the pair is already available', async () => {
    const status = vi.fn()
    const win = new MockWindow()
    win.Translator = {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(),
    }

    await expect(
      prepareBrowserTranslator('zh', {
        sourceLanguage: 'en',
        signal: new AbortController().signal,
        onStatus: status,
        win: win as Window,
      })
    ).resolves.toEqual({
      availability: 'available',
    })

    expect(win.Translator.create).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith({ availability: 'available' })
  })

  it('returns a downloadable state when browser preparation is cancelled', async () => {
    const controller = new AbortController()
    const status = vi.fn()
    const win = new MockWindow()
    win.Translator = {
      availability: vi.fn(async () => 'downloadable'),
      create: vi.fn(
        () =>
          new Promise<{ translate: (input: string) => Promise<string> }>(() => {
            // Intentionally unresolved: raceAbort should settle from the signal.
          })
      ),
    }

    const preparing = prepareBrowserTranslator('zh', {
      sourceLanguage: 'en',
      signal: controller.signal,
      onStatus: status,
      win: win as Window,
    })
    controller.abort()

    await expect(preparing).resolves.toEqual({
      availability: 'downloadable',
      message: 'Browser translation download was cancelled.',
    })
    expect(status).toHaveBeenLastCalledWith({
      availability: 'downloadable',
      message: 'Browser translation download was cancelled.',
    })
  })

  it('adapts batched input to the browser source text and reports download progress', async () => {
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

    const outputs: Array<{
      index: number
      output?: string
      error?: { kind: string; message: string }
    }> = []
    for await (const item of translator.batchTranslate(['<x1>Hello</x1>'])) {
      outputs.push(item)
    }
    expect(outputs).toEqual([{ index: 0, output: 'zh:<x1>Hello</x1>' }])
    expect(translate).toHaveBeenCalledWith(
      '<x1>Hello</x1>',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Downloading browser translation support 25%.',
        progress: 0.25,
      })
    )
  })

  it('reports per-input timeout failures without aborting the whole browser batch contract', async () => {
    const translate = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('late'), 20)
        })
    )
    const win = new MockWindow()
    win.Translator = {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({ translate })),
    }

    const translator = await new BrowserTranslatorFactory(win as Window).create({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })

    const outputs: Array<{
      index: number
      output?: string
      error?: { kind: string; message: string }
    }> = []
    for await (const item of translator.batchTranslate(['Hello'], { timeoutMs: 1 })) {
      outputs.push(item)
    }

    expect(outputs).toEqual([
      {
        index: 0,
        error: {
          kind: 'timeout',
          message: 'Translation task timed out after 1ms.',
        },
      },
    ])
  })
})
