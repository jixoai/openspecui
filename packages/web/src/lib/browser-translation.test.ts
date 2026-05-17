import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extractTranslatableSegments,
  prepareBrowserTranslation,
  translateMarkdownDocument,
  translateMarkdownDocumentProgressively,
} from './browser-translation'

interface MockTranslator {
  translate(input: string): Promise<string>
  destroy?: () => void
}

interface MockTranslatorFactory {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>
  create(options: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (monitor: EventTarget) => void
  }): Promise<MockTranslator>
}

interface MockLanguageDetector {
  detect(input: string): Promise<Array<{ detectedLanguage: string; confidence: number }>>
  destroy?: () => void
}

interface MockLanguageDetectorFactory {
  availability(): Promise<string>
  create(): Promise<MockLanguageDetector>
}

interface WindowTranslationMocks extends Window {
  Translator?: MockTranslatorFactory
  LanguageDetector?: MockLanguageDetectorFactory
}

function setTranslator(factory: MockTranslatorFactory): void {
  Object.defineProperty(window, 'Translator', {
    configurable: true,
    value: factory,
  })
}

function setLanguageDetector(factory: MockLanguageDetectorFactory | undefined): void {
  Object.defineProperty(window, 'LanguageDetector', {
    configurable: true,
    value: factory,
  })
}

function cleanupWindowMocks(): void {
  delete (window as WindowTranslationMocks).Translator
  delete (window as WindowTranslationMocks).LanguageDetector
}

describe('browser translation adapter', () => {
  afterEach(() => {
    cleanupWindowMocks()
  })

  it('extracts translation segments from markdown facts while skipping code blocks', () => {
    const segments = extractTranslatableSegments(`# Requirement: Terminal projection

Paragraph with \`code\` and src/app.ts.

\`\`\`ts
const value = 'keep source'
\`\`\`

- list item
`)

    expect(segments.map((segment) => [segment.kind, segment.source])).toEqual([
      ['heading', 'Requirement: Terminal projection'],
      ['paragraph', 'Paragraph with `code` and src/app.ts.'],
      ['listItem', 'list item'],
    ])
    expect(segments[0]).toMatchObject({
      sourceKind: 'heading',
      translatorInput: 'Requirement: Terminal projection',
    })
  })

  it('extracts nested list items as independent inline segments', () => {
    const segments = extractTranslatableSegments(`- Reported surfaces:
  - specs: ok
  - changes/spec: not rendered
`)

    expect(segments.map((segment) => [segment.kind, segment.source])).toEqual([
      ['listItem', 'Reported surfaces:'],
      ['listItem', 'specs: ok'],
      ['listItem', 'changes/spec: not rendered'],
    ])
  })

  it('uses document and segment-level language detection while protecting technical spans', async () => {
    const availability = vi.fn(async () => 'available')
    const translate = vi.fn(async (input: string) => `zh:${input}`)
    const destroy = vi.fn()
    const detect = vi.fn(async () => [{ detectedLanguage: 'en', confidence: 0.9 }])
    setTranslator({
      availability,
      async create() {
        return { translate, destroy }
      },
    })
    setLanguageDetector({
      async availability() {
        return 'available'
      },
      async create() {
        return { detect, destroy: vi.fn() }
      },
    })

    const result = await translateMarkdownDocument({
      markdown: `# Requirement: Keep src/app.ts

Open https://example.com/docs before editing \`Config\`.
`,
      targetLanguage: 'zh',
      displayMode: 'direct',
      signal: new AbortController().signal,
    })

    expect(detect).toHaveBeenCalledTimes(3)
    expect(availability).toHaveBeenCalledWith({ sourceLanguage: 'en', targetLanguage: 'zh' })
    expect(translate.mock.calls[0]?.[0]).toContain('OSUI0TOKEN')
    expect(translate.mock.calls[1]?.[0]).toContain('OSUI0TOKEN')
    expect(result.segments[0]?.target).toBe('zh:Requirement: Keep src/app.ts')
    expect(result.segments[0]?.sourceLanguage).toBe('en')
    expect(result.segments[0]?.targetLanguage).toBe('zh')
    expect(result.segments[0]?.status).toBe('translated')
    expect(result.segments[1]?.target).toContain('https://example.com/docs')
    expect(result.segments[1]?.target).toContain('`Config`')
    expect(destroy).toHaveBeenCalled()
  })

  it('uses segment-level language detection to skip already-target-language segments', async () => {
    const translate = vi.fn(async (input: string) => `zh:${input}`)
    const create = vi.fn(async () => ({ translate }))
    const detect = vi.fn(async (input: string) => {
      if (input.includes('中文')) {
        return [{ detectedLanguage: 'zh', confidence: 0.94 }]
      }
      return [{ detectedLanguage: 'en', confidence: 0.91 }]
    })
    setTranslator({
      async availability() {
        return 'available'
      },
      create,
    })
    setLanguageDetector({
      async availability() {
        return 'available'
      },
      async create() {
        return { detect, destroy: vi.fn() }
      },
    })

    const result = await translateMarkdownDocument({
      markdown: `Hello world.

这是中文段落。
`,
      targetLanguage: 'zh-CN',
      displayMode: 'direct',
      signal: new AbortController().signal,
    })

    expect(detect).toHaveBeenCalledTimes(3)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN',
      })
    )
    expect(translate).toHaveBeenCalledTimes(1)
    expect(translate).toHaveBeenCalledWith('Hello world.')
    expect(result.segments.map((segment) => segment.target)).toEqual([
      'zh:Hello world.',
      '这是中文段落。',
    ])
    expect(result.segments.map((segment) => segment.sourceLanguage)).toEqual(['en', 'zh'])
  })

  it('treats regional variants of the target language as already translated', async () => {
    const translate = vi.fn(async (input: string) => `zh:${input}`)
    setTranslator({
      async availability() {
        return 'available'
      },
      async create() {
        return { translate }
      },
    })
    setLanguageDetector({
      async availability() {
        return 'available'
      },
      async create() {
        return {
          async detect() {
            return [{ detectedLanguage: 'zh-Hans', confidence: 0.95 }]
          },
          destroy: vi.fn(),
        }
      },
    })

    const result = await translateMarkdownDocument({
      markdown: '这是中文段落。',
      targetLanguage: 'zh-CN',
      displayMode: 'direct',
      signal: new AbortController().signal,
    })

    expect(translate).not.toHaveBeenCalled()
    expect(result.segments[0]?.target).toBe('这是中文段落。')
    expect(result.segments[0]?.sourceLanguage).toBe('zh-Hans')
  })

  it('protects repeated technical spans and HTML tags with markdown-safe tokens', async () => {
    const translate = vi.fn(async (input: string) =>
      input
        .replace('Click ', '点击 ')
        .replace(' then repeat ', ' 然后重复 ')
        .replace(' in ', ' 在 ')
        .replaceAll('OSUI0TOKEN', 'osui0token')
    )
    setTranslator({
      async availability() {
        return 'available'
      },
      async create() {
        return { translate }
      },
    })
    setLanguageDetector(undefined)

    const result = await translateMarkdownDocument({
      markdown:
        'Click <b color="red">love</b> then repeat <b color="red">love</b> in `src/app.ts`.',
      targetLanguage: 'zh',
      displayMode: 'direct',
      signal: new AbortController().signal,
    })

    expect(translate).toHaveBeenCalledTimes(1)
    const translatorInput = translate.mock.calls[0]?.[0] ?? ''
    expect(translatorInput.match(/OSUI0TOKEN/g)).toHaveLength(2)
    expect(translatorInput).not.toContain('__')
    expect(translatorInput).not.toContain('<span')
    expect(translatorInput).not.toContain('translate="no"')
    expect(translatorInput).not.toContain('&lt;b')
    expect(result.segments[0]?.target).toContain('<b color="red">love</b>')
    expect(result.segments[0]?.target).toContain('`src/app.ts`')
  })

  it('emits progressive patches as each segment completes', async () => {
    const translate = vi.fn(async (input: string) => `zh:${input}`)
    setTranslator({
      async availability() {
        return 'available'
      },
      async create() {
        return { translate }
      },
    })
    setLanguageDetector(undefined)

    const patches: Array<{ segmentIndex: number; target: string | undefined }> = []
    const result = await translateMarkdownDocumentProgressively(
      {
        markdown: '# Hello\n\nWorld',
        targetLanguage: 'zh',
        displayMode: 'direct',
        signal: new AbortController().signal,
      },
      (patch) => patches.push({ segmentIndex: patch.segmentIndex, target: patch.segment.target })
    )

    expect(patches).toEqual([
      { segmentIndex: 0, target: 'zh:Hello' },
      { segmentIndex: 1, target: 'zh:World' },
    ])
    expect(result.segments.map((segment) => segment.target)).toEqual(['zh:Hello', 'zh:World'])
  })

  it('prepares downloadable language support through Translator.create', async () => {
    const create = vi.fn(async () => ({
      translate: async (input: string) => input,
      destroy: vi.fn(),
    }))
    setTranslator({
      async availability() {
        return 'downloadable'
      },
      create,
    })

    await expect(
      prepareBrowserTranslation('zh', new AbortController().signal)
    ).resolves.toMatchObject({ availability: 'available' })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      })
    )
  })

  it('does not throw from download progress listeners after initialization cancellation', async () => {
    const monitor = new EventTarget()
    let resolveCreate: ((translator: MockTranslator) => void) | undefined

    setTranslator({
      async availability() {
        return 'downloadable'
      },
      create({ monitor: attachMonitor }) {
        attachMonitor?.(monitor)
        return new Promise<MockTranslator>((resolve) => {
          resolveCreate = resolve
        })
      },
    })

    const controller = new AbortController()
    const pending = prepareBrowserTranslation('zh', controller.signal)
    controller.abort()

    expect(() => monitor.dispatchEvent(new Event('downloadprogress'))).not.toThrow()

    resolveCreate?.({ translate: async (input: string) => input, destroy: vi.fn() })
    await expect(pending).resolves.toMatchObject({
      availability: 'downloading',
      message: 'Translation initialization was cancelled.',
    })
  })
})
