import { TRANSLATION_CACHE_POLICY_VERSION } from '@openspecui/core/document-translation'
import { TRANSLATOR_CONTRACT_VERSION } from '@openspecui/core/translator'
import type { Element, RootContent } from 'hast'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extractTranslatableSegments,
  prepareBrowserTranslation,
  translateMarkdownDocument,
  translateMarkdownDocumentProgressively,
  type BrowserTranslationCache,
  type TranslationEngineExecution,
} from './browser-translation'
import {
  clearTranslationAdaptiveConcurrencyLogs,
  createTranslationAdaptiveConcurrencyScopeKey,
  readRecentTranslationAdaptiveConcurrencyLogs,
} from './translation-adaptive-concurrency-log'

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
    clearTranslationAdaptiveConcurrencyLogs()
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
      ['paragraph', 'Paragraph with code and src/app.ts.'],
      ['listItem', 'list item'],
    ])
    expect(segments[0]).toMatchObject({
      sourceKind: 'heading',
      translatorInput: 'Requirement: Terminal projection',
    })
  })

  it('extracts HAST placeholder input for inline structure and translatable attributes', () => {
    const segments = extractTranslatableSegments(
      '### **1. Research** and `Planning` [docs](https://example.com "Read more")\n\n![Diagram](diagram.png "System map")'
    )

    expect(segments[0]).toMatchObject({
      kind: 'heading',
      source: '1. Research and Planning Read more docs',
      translatorInput: '<x1>1. Research</x1> and <x2>Planning</x2> <x3 a1="Read more">docs</x3>',
      placeholderTopologyHash: expect.any(String),
      attributeTopologyHash: expect.any(String),
      displayPolicyVersion: TRANSLATION_CACHE_POLICY_VERSION,
    })
    const imageSegment = segments.find((segment) => segment.translatorInput.includes('Diagram'))
    expect(imageSegment?.translatorInput).toContain('<x1 a1="System map" a2="Diagram"></x1>')
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

  it('extracts markdown table cells as independent segments', () => {
    const segments = extractTranslatableSegments(`| Key | Value |
| --- | --- |
| Hello | World |`)

    expect(segments.map((segment) => [segment.sourceKind, segment.kind, segment.source])).toEqual([
      ['tableCell', 'paragraph', 'Key'],
      ['tableCell', 'paragraph', 'Value'],
      ['tableCell', 'paragraph', 'Hello'],
      ['tableCell', 'paragraph', 'World'],
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
    expect(translate.mock.calls[1]?.[0]).toContain('<x2>Config</x2>')
    expect(result.segments[0]?.target).toBe('zh:Requirement: Keep src/app.ts')
    expect(result.segments[0]?.sourceLanguage).toBe('en')
    expect(result.segments[0]?.targetLanguage).toBe('zh')
    expect(result.segments[0]?.status).toBe('translated')
    expect(result.segments[1]?.target).toContain('https://example.com/docs')
    expect(result.segments[1]?.target).toContain('Config')
    const codeNode = result.segments[1]?.targetNodes?.find(
      (node) => node.type === 'element' && node.tagName === 'code'
    )
    expect(codeNode).toMatchObject({
      type: 'element',
      tagName: 'code',
      children: [{ type: 'text', value: 'Config' }],
    })
    expect(destroy).toHaveBeenCalled()
  })

  it('restores translated HAST placeholders without reparsing markdown block syntax', async () => {
    const translate = vi.fn(async () => '1. 研究与规划')
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
      markdown: '### 1. Research and Planning',
      targetLanguage: 'zh',
      displayMode: 'direct',
      signal: new AbortController().signal,
    })

    expect(translate).toHaveBeenCalledWith(
      '1. Research and Planning',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(result.segments[0]?.target).toBe('1. 研究与规划')
    expect(result.segments[0]?.targetNodes).toEqual([{ type: 'text', value: '1. 研究与规划' }])
  })

  it('uses cache hits before translating segments', async () => {
    const availability = vi.fn(async () => 'available')
    const translate = vi.fn(async (input: string) => `zh:${input}`)
    const create = vi.fn(async () => ({ translate }))
    const segment = getExpectedSegment('### 1. Research and Planning')
    const cache: BrowserTranslationCache = {
      read: vi.fn(async (keyHash) => ({
        key: createExpectedCacheKey({
          markdown: '### 1. Research and Planning',
          sourceLanguage: 'en',
          targetLanguage: 'zh',
        }),
        keyHash,
        sourceText: '1. Research and Planning',
        translatedText: '1. 研究与规划',
        targetNodesJson: JSON.stringify([{ type: 'text', value: '1. 研究与规划' }]),
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        placeholderTopologyHash: segment.placeholderTopologyHash ?? '',
        attributeTopologyHash: segment.attributeTopologyHash ?? '',
        displayPolicyVersion: segment.displayPolicyVersion ?? TRANSLATION_CACHE_POLICY_VERSION,
        engineId: 'browser',
        translatorContractVersion: TRANSLATOR_CONTRACT_VERSION,
        createdAt: 1,
        lastAccessedAt: 1,
      })),
      write: vi.fn(),
    }
    setTranslator({
      availability,
      create,
    })
    setLanguageDetector(undefined)

    const result = await translateMarkdownDocument({
      markdown: '### 1. Research and Planning',
      targetLanguage: 'zh',
      displayMode: 'direct',
      signal: new AbortController().signal,
      cache,
    })

    expect(cache.read).toHaveBeenCalledTimes(1)
    expect(create).not.toHaveBeenCalled()
    expect(translate).not.toHaveBeenCalled()
    expect(cache.write).not.toHaveBeenCalled()
    expect(result.segments[0]?.target).toBe('1. 研究与规划')
    expect(result.segments[0]?.targetNodes).toEqual([{ type: 'text', value: '1. 研究与规划' }])
  })

  it('writes validated translated HAST projections to cache after misses', async () => {
    const translate = vi.fn(async () => '1. 研究与规划')
    const segment = getExpectedSegment('### 1. Research and Planning')
    const cache: BrowserTranslationCache = {
      read: vi.fn(async () => null),
      write: vi.fn(async () => ({ accepted: true })),
    }
    setTranslator({
      async availability() {
        return 'available'
      },
      async create() {
        return { translate }
      },
    })
    setLanguageDetector(undefined)

    await translateMarkdownDocument({
      markdown: '### 1. Research and Planning',
      targetLanguage: 'zh',
      displayMode: 'direct',
      signal: new AbortController().signal,
      cache,
    })

    expect(cache.write).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: '1. Research and Planning',
        translatedText: '1. 研究与规划',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        placeholderTopologyHash: segment.placeholderTopologyHash,
        attributeTopologyHash: segment.attributeTopologyHash,
        displayPolicyVersion: segment.displayPolicyVersion,
        targetNodesJson: JSON.stringify([{ type: 'text', value: '1. 研究与规划' }]),
      })
    )
  })

  it('restores link text and translated semantic attributes from the placeholder side table', async () => {
    const translate = vi.fn(async (input: string) =>
      input.replace('<x1 a1="Read more">docs</x1>', '<x1 a1="阅读更多">文档</x1>')
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
      markdown: '[docs](https://example.com "Read more")',
      targetLanguage: 'zh',
      displayMode: 'direct',
      signal: new AbortController().signal,
    })
    const linkNode = result.segments[0]?.targetNodes?.[0]

    expect(linkNode).toMatchObject({
      type: 'element',
      tagName: 'a',
      properties: {
        href: 'https://example.com',
        title: '阅读更多',
      },
      children: [{ type: 'text', value: '文档' }],
    })
  })

  it('keeps code-like placeholder text as source and stores translated text as hover metadata', async () => {
    const translate = vi.fn(async (input: string) =>
      input.replace('<x1>Config</x1>', '<x1>配置</x1>')
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
      markdown: 'Keep `Config` enabled.',
      targetLanguage: 'zh',
      displayMode: 'direct',
      signal: new AbortController().signal,
    })

    expect(findTargetElement(result.segments[0]?.targetNodes, 'code')).toMatchObject({
      properties: { title: '配置' },
      children: [{ type: 'text', value: 'Config' }],
    })
    expect(result.segments[0]?.target).toBe('Keep Config enabled.')
  })

  it('falls back to source-only HAST when translated placeholders are malformed', async () => {
    const translate = vi.fn(async () => '<x9>未知</x9>')
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
      markdown: '**Important:** keep `Config`.',
      targetLanguage: 'zh',
      displayMode: 'direct',
      signal: new AbortController().signal,
    })

    expect(result.segments[0]?.target).toBe('Important: keep Config.')
    expect(result.segments[0]?.targetNodes?.[0]).toMatchObject({
      type: 'element',
      tagName: 'strong',
      children: [{ type: 'text', value: 'Important:' }],
    })
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
    expect(translate).toHaveBeenCalledWith(
      'Hello world.',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
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
    expect(translatorInput.match(/<x1/g)).toHaveLength(1)
    expect(translatorInput).not.toContain('__')
    expect(translatorInput).not.toContain('<span')
    expect(translatorInput).not.toContain('translate="no"')
    expect(translatorInput).not.toContain('&lt;b')
    expect(result.segments[0]?.target).toContain('love')
    expect(result.segments[0]?.target).toContain('src/app.ts')
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

  it('batches pending translations per source language and restores out-of-order batch outputs', async () => {
    const batchTranslate = vi.fn(async function* (inputs: string[]) {
      yield { index: 1, output: `zh:${inputs[1] ?? ''}` }
      yield { index: 0, output: `zh:${inputs[0] ?? ''}` }
    })
    const create = vi.fn(async () => ({
      batchTranslate,
      destroy: vi.fn(),
    }))
    setTranslator({
      async availability() {
        return 'available'
      },
      async create() {
        return {
          translate: async (input: string) => input,
          destroy: vi.fn(),
        }
      },
    })
    setLanguageDetector(undefined)

    const engine: TranslationEngineExecution = {
      factory: {
        create,
      },
      cacheIdentity: {
        engineId: 'browser',
        translatorContractVersion: TRANSLATOR_CONTRACT_VERSION,
      },
    }

    const patches: Array<{ segmentIndex: number; target: string | undefined }> = []
    const result = await translateMarkdownDocumentProgressively(
      {
        markdown: '# Hello\n\nWorld',
        targetLanguage: 'zh',
        displayMode: 'direct',
        signal: new AbortController().signal,
        engine,
      },
      (patch) => patches.push({ segmentIndex: patch.segmentIndex, target: patch.segment.target })
    )

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      })
    )
    expect(batchTranslate).toHaveBeenCalledWith(['Hello', 'World'], expect.any(Object))
    expect(patches).toEqual([
      { segmentIndex: 0, target: 'zh:Hello' },
      { segmentIndex: 1, target: 'zh:World' },
    ])
    expect(result.segments.map((segment) => segment.target)).toEqual(['zh:Hello', 'zh:World'])
  })

  it('rejects unsupported local directional model groups before creating translators', async () => {
    const batchTranslate = vi.fn(async function* (inputs: string[]) {
      for (const [index, input] of inputs.entries()) {
        yield { index, output: `zh:${input}` }
      }
    })
    const create = vi.fn(async () => ({
      batchTranslate,
      destroy: vi.fn(),
    }))
    const detect = vi.fn(async (input: string) => {
      if (input.includes('Hallo') && !input.includes('Hello')) {
        return [{ detectedLanguage: 'de', confidence: 0.95 }]
      }
      return [{ detectedLanguage: 'en', confidence: 0.95 }]
    })
    setLanguageDetector({
      async availability() {
        return 'available'
      },
      async create() {
        return { detect, destroy: vi.fn() }
      },
    })

    const engine: TranslationEngineExecution = {
      factory: {
        create,
      },
      cacheIdentity: {
        engineId: 'local',
        model: 'onnx-community/opus-mt-en-zh',
        selectedGroupId: 'int8-4dc37a',
        translatorContractVersion: TRANSLATOR_CONTRACT_VERSION,
      },
    }

    const result = await translateMarkdownDocumentProgressively(
      {
        markdown: 'Hello world.\n\nHallo welt.',
        targetLanguage: 'zh',
        displayMode: 'direct',
        signal: new AbortController().signal,
        engine,
      },
      () => undefined
    )

    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      })
    )
    expect(result.segments.map((segment) => segment.status)).toEqual(['translated', 'error'])
    expect(result.segments[1]?.error).toBe(
      'Selected local model supports en -> zh, but document segment was detected as de -> zh.'
    )
  })

  it('records adaptive concurrency metrics in a global log store', async () => {
    const batchTranslate = vi.fn(async function* (inputs: string[]) {
      for (const [index, input] of inputs.entries()) {
        yield { index, output: `zh:${input}` }
      }
    })
    const create = vi.fn(async () => ({
      batchTranslate,
      destroy: vi.fn(),
    }))
    setTranslator({
      async availability() {
        return 'available'
      },
      async create() {
        return {
          translate: async (input: string) => input,
          destroy: vi.fn(),
        }
      },
    })
    setLanguageDetector(undefined)

    const engine: TranslationEngineExecution = {
      factory: {
        create,
      },
      cacheIdentity: {
        engineId: 'browser',
        engineVersion: 'local-test',
        model: 'browser-test-model',
        selectedGroupId: 'q8',
        translatorContractVersion: TRANSLATOR_CONTRACT_VERSION,
      },
    }

    const markdown = Array.from({ length: 24 }, (_, index) => `# Item ${index + 1}`).join('\n\n')
    await translateMarkdownDocumentProgressively(
      {
        markdown,
        targetLanguage: 'zh',
        displayMode: 'direct',
        signal: new AbortController().signal,
        engine,
      },
      () => undefined
    )

    const scopeKey = createTranslationAdaptiveConcurrencyScopeKey({
      engineId: 'browser',
      engineVersion: 'local-test',
      model: 'browser-test-model',
      selectedGroupId: 'q8',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      translatorContractVersion: TRANSLATOR_CONTRACT_VERSION,
    })
    const logs = readRecentTranslationAdaptiveConcurrencyLogs({ scopeKey, limit: 10 })

    expect(logs.length).toBeGreaterThan(0)
    expect(logs.every((entry) => entry.scopeKey === scopeKey)).toBe(true)
    expect(logs[0]).toMatchObject({
      engineId: 'browser',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })
    expect(logs[0]?.throughputTokensPerMs).toBeGreaterThan(0)
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
      prepareBrowserTranslation('zh', { signal: new AbortController().signal })
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
    const pending = prepareBrowserTranslation('zh', { signal: controller.signal })
    controller.abort()

    expect(() => monitor.dispatchEvent(new Event('downloadprogress'))).not.toThrow()

    resolveCreate?.({ translate: async (input: string) => input, destroy: vi.fn() })
    await expect(pending).resolves.toMatchObject({
      availability: 'downloadable',
      message: 'Browser translation download was cancelled.',
    })
  })
})

function createExpectedCacheKey(options: {
  markdown: string
  sourceLanguage: string
  targetLanguage: string
}): string {
  const segment = getExpectedSegment(options.markdown)
  return stableJsonStringify({
    sourceText: segment.source,
    translatorInput: segment.translatorInput,
    sourceLanguage: options.sourceLanguage,
    targetLanguage: options.targetLanguage,
    placeholderTopologyHash: segment.placeholderTopologyHash,
    attributeTopologyHash: segment.attributeTopologyHash,
    displayPolicyVersion: segment.displayPolicyVersion,
    engineId: 'browser',
    engineVersion: undefined,
    model: undefined,
    selectedGroupId: undefined,
    translatorContractVersion: TRANSLATOR_CONTRACT_VERSION,
  })
}

function getExpectedSegment(markdown: string) {
  const segment = extractTranslatableSegments(markdown)[0]
  if (!segment) throw new Error('Expected test markdown to produce a translation segment.')
  return segment
}

function findTargetElement(
  nodes: readonly RootContent[] | undefined,
  tagName: string
): Element | undefined {
  for (const node of nodes ?? []) {
    if (node.type === 'element' && node.tagName === tagName) return node
  }
  return undefined
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJsonStringify(entryValue)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
