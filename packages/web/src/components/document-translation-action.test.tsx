import type { BrowserTranslationSupportTableState } from '@/lib/browser-translation'
import { DOCUMENT_TRANSLATION_SESSION_STORAGE_KEY } from '@/lib/document-translation-session-state'
import {
  LocalModelAssetStateSchema,
  createTranslationEngineLifecycleStatus,
  type LocalModelAssetState,
} from '@openspecui/core/translator'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkdownViewer } from './markdown-viewer'

function createLocalAssetStateForTest(
  input: Omit<LocalModelAssetState, 'version' | 'profileLoad' | 'groupsState'> &
    Partial<Pick<LocalModelAssetState, 'version' | 'profileLoad' | 'groupsState'>>
): LocalModelAssetState {
  return LocalModelAssetStateSchema.parse(input)
}

const translateMarkdownDocumentProgressivelyMock = vi.hoisted(() => vi.fn())
const navigateMock = vi.hoisted(() => vi.fn())
const getBrowserSupportTableStateMock = vi.hoisted(() =>
  vi.fn<(targetLanguage: string) => BrowserTranslationSupportTableState | null>(
    (targetLanguage) => ({
      state: 'ready',
      message: 'Browser translation pairs: 1 ready.',
      table: {
        targetLanguage,
        checked: 1,
        total: 1,
        updatedAt: 1,
        rows: [
          {
            sourceLanguage: 'en',
            targetLanguage,
            availability: 'available',
          },
        ],
      },
    })
  )
)
const scanBrowserTranslationPairsMock = vi.hoisted(() =>
  vi.fn(
    async (targetLanguage: string): Promise<BrowserTranslationSupportTableState> => ({
      state: 'ready',
      message: 'Browser translation pairs: 1 ready.',
      table: {
        targetLanguage,
        checked: 1,
        total: 1,
        updatedAt: 1,
        rows: [
          {
            sourceLanguage: 'en',
            targetLanguage,
            availability: 'available',
          },
        ],
      },
    })
  )
)
const nmtModelStateMock = vi.hoisted(() => vi.fn())
const nmtModelPanelStateMock = vi.hoisted(() => vi.fn())
const translationCacheReadMock = vi.hoisted(() => vi.fn())
const translationCacheWriteMock = vi.hoisted(() => vi.fn())
const engineLifecycleQueryMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/browser-translation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/browser-translation')>()
  return {
    ...original,
    getBrowserSupportTableState: getBrowserSupportTableStateMock,
    scanBrowserTranslationPairs: scanBrowserTranslationPairsMock,
    translateMarkdownDocumentProgressively: translateMarkdownDocumentProgressivelyMock,
  }
})

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/lib/use-subscription', () => ({
  useGlobalSettingsSubscription: () => ({ data: undefined }),
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    localModels: {
      state: {
        query: nmtModelStateMock,
      },
      panelState: {
        query: nmtModelPanelStateMock,
      },
    },
    translationCache: {
      read: {
        query: translationCacheReadMock,
      },
      write: {
        mutate: translationCacheWriteMock,
      },
    },
    translationEngines: {
      getLifecycle: {
        query: engineLifecycleQueryMock,
      },
    },
  },
}))

describe('MarkdownViewer translation plugin', () => {
  beforeEach(() => {
    translationCacheReadMock.mockResolvedValue(null)
    translationCacheWriteMock.mockResolvedValue({ accepted: true })
    engineLifecycleQueryMock.mockReset()
    engineLifecycleQueryMock.mockResolvedValue(
      createTranslationEngineLifecycleStatus({
        dependency: {
          state: 'installed',
          message: 'Runtime dependencies are installed.',
        },
        runtime: {
          state: 'ready',
          message: 'Runtime is ready.',
        },
      })
    )
    nmtModelStateMock.mockResolvedValue(createDownloadedLocalAssetState())
    nmtModelPanelStateMock.mockImplementation(
      async ({ modelId, selectedGroupId }: { modelId: string; selectedGroupId?: string }) => ({
        modelId,
        selectedGroupId,
        asset: await nmtModelStateMock({
          modelId,
          selectedGroupId,
        }),
        downloadPlan: null,
      })
    )
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('jumps to translation settings when translation is disabled', () => {
    render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    const button = screen.getByRole('button', { name: 'Configure translation' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()

    fireEvent.click(button)

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/settings',
      hash: 'settings-translation',
    })
  })

  it('renders a disabled translation action when browser translation is unavailable', async () => {
    getBrowserSupportTableStateMock.mockReturnValueOnce(null)
    scanBrowserTranslationPairsMock.mockResolvedValueOnce({
      state: 'missing',
      message: 'Chrome Translator API is not exposed.',
      table: null,
    })

    render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    const button = await screen.findByRole('button', { name: 'Translation unavailable' })
    await waitFor(() => expect(button).toBeDisabled())

    expect(button).not.toHaveAttribute('title')
    fireEvent.mouseEnter(button.parentElement!)
    expect(await screen.findByText('Chrome Translator API is not exposed.')).toBeTruthy()
    expect(translateMarkdownDocumentProgressivelyMock).not.toHaveBeenCalled()

    fireEvent.click(button)

    expect(translateMarkdownDocumentProgressivelyMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('enables document translation from local NMT asset truth without probing browser capability', async () => {
    mockProgressiveResult('direct', [
      {
        id: 'md-2',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        sourceKind: 'heading',
        source: 'Hello',
        translatorInput: 'Hello',
        target: '你好',
        kind: 'heading',
      },
    ])

    render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'q8' },
            openai: {},
          },
        }}
      />
    )

    await waitFor(() =>
      expect(nmtModelPanelStateMock).toHaveBeenCalledWith({
        modelId: 'Xenova/opus-mt-en-zh',
        selectedGroupId: 'q8',
      })
    )
    expect(scanBrowserTranslationPairsMock).not.toHaveBeenCalled()
    const button = await screen.findByRole('button', { name: 'Translate' })
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('data-translation-action-state', 'ready')

    fireEvent.click(button)

    await waitFor(() => expect(screen.getByRole('heading', { name: '你好' })).toBeTruthy())
    expect(translateMarkdownDocumentProgressivelyMock).toHaveBeenCalled()
  })

  it('disables document translation when the selected NMT profile is not local', async () => {
    nmtModelStateMock.mockResolvedValueOnce({
      ...createDownloadedLocalAssetState(),
      status: 'not-downloaded',
      files: [],
    })

    render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'q8' },
            openai: {},
          },
        }}
      />
    )

    const button = await screen.findByRole('button', { name: 'Translation unavailable' })
    expect(button).toBeDisabled()
    expect(button).not.toHaveAttribute('title')
    fireEvent.mouseEnter(button.parentElement!)
    expect(
      await screen.findByText('Selected local model files are not installed locally.')
    ).toBeTruthy()
    expect(scanBrowserTranslationPairsMock).not.toHaveBeenCalled()
  })

  it('disables page translation when the selected local model direction conflicts with the target language', async () => {
    render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'q8' },
            openai: {},
          },
        }}
      />
    )

    const button = await screen.findByRole('button', { name: 'Translation unavailable' })
    expect(button).toBeDisabled()
    fireEvent.mouseEnter(button.parentElement!)
    expect(
      await screen.findByText(
        'Selected local model supports en -> zh, but document translation is configured for target de.'
      )
    ).toBeTruthy()

    fireEvent.click(button)

    expect(nmtModelPanelStateMock).not.toHaveBeenCalled()
    expect(translateMarkdownDocumentProgressivelyMock).not.toHaveBeenCalled()
    expect(scanBrowserTranslationPairsMock).not.toHaveBeenCalled()
  })

  it('recovers from an unavailable browser engine after switching to a ready local model', async () => {
    getBrowserSupportTableStateMock.mockReturnValueOnce(null)
    scanBrowserTranslationPairsMock.mockResolvedValueOnce({
      state: 'missing',
      message: 'Chrome Translator API is not exposed.',
      table: null,
    })

    const { rerender } = render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'browser',
          engines: {
            local: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'q8' },
            openai: {},
          },
        }}
      />
    )

    const unavailableButton = await screen.findByRole('button', { name: 'Translation unavailable' })
    expect(unavailableButton).toBeDisabled()

    fireEvent.click(unavailableButton)

    rerender(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'q8' },
            openai: {},
          },
        }}
      />
    )

    await waitFor(() =>
      expect(nmtModelPanelStateMock).toHaveBeenCalledWith({
        modelId: 'Xenova/opus-mt-en-zh',
        selectedGroupId: 'q8',
      })
    )
    const readyButton = await screen.findByRole('button', { name: 'Translate' })
    expect(readyButton).not.toBeDisabled()
    expect(readyButton).toHaveAttribute('data-translation-action-state', 'ready')
  })

  it('projects direct translation as the final render stage and uses translated ToC labels', async () => {
    mockProgressiveResult('direct', [
      {
        id: 'md-2',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        sourceKind: 'heading',
        source: 'Hello',
        translatorInput: 'Hello',
        target: '你好',
        kind: 'heading',
      },
      {
        id: 'md-3',
        sourceStartOffset: 9,
        sourceEndOffset: 20,
        sourceKind: 'paragraph',
        source: 'I love you.',
        translatorInput: 'I love you.',
        target: '我爱你。',
        kind: 'paragraph',
      },
    ])

    render(
      <MarkdownViewer
        markdown={'# Hello\n\nI love you.'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: '你好' })).toBeTruthy())
    const heading = screen.getByRole('heading', { name: '你好' })
    expect(heading.getAttribute('data-toc-label')).toBe('你好')
    expect(heading.getAttribute('data-translation-segment-id')).toBe('md-2')
    expect(screen.getByRole('link', { name: '你好', hidden: true })).toBeTruthy()
    expect(screen.queryByText('I love you.')).toBeNull()
    expect(screen.getByText('我爱你。')).toBeTruthy()
  })

  it('renders translated markdown as structured nodes instead of raw markdown text', async () => {
    mockProgressiveResult('direct', [
      {
        id: 'md-3',
        sourceStartOffset: 9,
        sourceEndOffset: 49,
        sourceKind: 'paragraph',
        source: '**Important:** keep `Config`.',
        translatorInput: '**Important:** keep `Config`.',
        target: '**重要：**保留 `Config`。',
        kind: 'paragraph',
      },
    ])

    render(
      <MarkdownViewer
        markdown={'# Notes\n\n**Important:** keep `Config`.'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => expect(screen.getByText('重要：')).toBeTruthy())
    expect(screen.queryByText('**重要：**保留 `Config`。')).toBeNull()
    expect(screen.getByText('重要：').tagName).toBe('STRONG')
    expect(screen.getByText('Config').tagName).toBe('CODE')
  })

  it('keeps code-like target nodes as source text with translated hover text', async () => {
    mockProgressiveResult('direct', [
      {
        id: 'md-code',
        sourceStartOffset: 9,
        sourceEndOffset: 31,
        sourceKind: 'paragraph',
        source: 'Keep Config enabled.',
        translatorInput: 'Keep <x1>Config</x1> enabled.',
        target: '保持 Config 启用。',
        targetNodes: [
          { type: 'text', value: '保持 ' },
          {
            type: 'element',
            tagName: 'code',
            properties: { title: '配置', 'aria-label': '配置' },
            children: [{ type: 'text', value: 'Config' }],
          },
          { type: 'text', value: ' 启用。' },
        ],
        kind: 'paragraph',
      },
    ])

    render(
      <MarkdownViewer
        markdown={'# Notes\n\nKeep `Config` enabled.'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => expect(screen.getByText('Config')).toBeTruthy())
    const code = screen.getByText('Config')
    expect(code.tagName).toBe('CODE')
    expect(code.getAttribute('title')).toBe('配置')
    expect(code.getAttribute('aria-label')).toBeNull()
    expect(document.body.textContent).not.toContain('配置启用')
  })

  it('keeps source ToC labels and inline heading/list translations in bilingual mode', async () => {
    mockProgressiveResult('bilingual', [
      {
        id: 'md-2',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        sourceKind: 'heading',
        source: 'Hello',
        translatorInput: 'Hello',
        target: '你好',
        kind: 'heading',
      },
      {
        id: 'md-3',
        sourceStartOffset: 9,
        sourceEndOffset: 15,
        sourceKind: 'listItem',
        source: 'item',
        translatorInput: 'item',
        target: '项目',
        kind: 'listItem',
      },
    ])

    render(
      <MarkdownViewer
        markdown={'# Hello\n\n- item'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'bilingual',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Show source' })).toBeTruthy())
    const heading = screen.getByRole('heading', { name: 'Hello 你好' })
    expect(heading.getAttribute('data-toc-label')).toBe('Hello')
    expect(screen.getByRole('link', { name: 'Hello', hidden: true })).toBeTruthy()

    const item = screen.getByRole('listitem')
    expect(within(item).getByText('item')).toBeTruthy()
    expect(within(item).getByText('项目')).toBeTruthy()
    expect(item.textContent).not.toContain('/')
  })

  it('keeps OpenSpec structure labels out of translated heading content', async () => {
    const markdown = `# Static Rendering

## Purpose
Static rendering mode detects hosted data.

## Requirements

### Requirement: Static Rendering Mode Detection
The system SHALL detect static rendering mode.
`

    mockProgressiveResult('bilingual', [
      {
        id: 'purpose-heading',
        sourceStartOffset: markdown.indexOf('## Purpose'),
        sourceEndOffset: markdown.indexOf('## Purpose') + '## Purpose'.length,
        sourceKind: 'heading',
        source: 'Purpose',
        translatorInput: 'Purpose',
        target: 'ZH:Purpose',
        targetNodes: [{ type: 'text', value: 'ZH:Purpose' }],
        kind: 'heading',
      },
      {
        id: 'requirements-heading',
        sourceStartOffset: markdown.indexOf('## Requirements'),
        sourceEndOffset: markdown.indexOf('## Requirements') + '## Requirements'.length,
        sourceKind: 'heading',
        source: 'Requirements',
        translatorInput: 'Requirements',
        target: 'ZH:Requirements',
        targetNodes: [{ type: 'text', value: 'ZH:Requirements' }],
        kind: 'heading',
      },
      {
        id: 'requirement-heading',
        sourceStartOffset: markdown.indexOf('### Requirement: Static Rendering Mode Detection'),
        sourceEndOffset:
          markdown.indexOf('### Requirement: Static Rendering Mode Detection') +
          '### Requirement: Static Rendering Mode Detection'.length,
        sourceKind: 'heading',
        source: 'Requirement: Static Rendering Mode Detection',
        translatorInput: 'Requirement: Static Rendering Mode Detection',
        target: '要求：静态渲染模式检测',
        targetNodes: [{ type: 'text', value: '要求：静态渲染模式检测' }],
        kind: 'heading',
      },
    ])

    render(
      <MarkdownViewer
        markdown={markdown}
        path="specs/static-rendering/spec.md"
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'bilingual',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => expect(screen.getByText('目的')).toBeTruthy())

    const purposeHeading = document.querySelector(
      '[data-openspec-section-kind="overview"][data-openspec-kind="section"]'
    )
    const requirementsHeading = document.querySelector(
      '[data-openspec-section-kind="requirements"][data-openspec-kind="section"]'
    )
    const requirementHeading = document.querySelector('[data-openspec-kind="requirement"]')
    expect(purposeHeading).toBeInstanceOf(HTMLElement)
    expect(requirementsHeading).toBeInstanceOf(HTMLElement)
    expect(requirementHeading).toBeInstanceOf(HTMLElement)
    if (
      !(purposeHeading instanceof HTMLElement) ||
      !(requirementsHeading instanceof HTMLElement) ||
      !(requirementHeading instanceof HTMLElement)
    ) {
      throw new Error('Expected OpenSpec headings to render.')
    }

    expect(purposeHeading.querySelector('.document-translation-target')?.textContent).toBe('目的')
    expect(requirementsHeading.querySelector('.document-translation-target')?.textContent).toBe(
      '需求'
    )
    const requirementTarget = requirementHeading.querySelector(
      '.openspec-heading-title .document-translation-target'
    )
    expect(requirementTarget?.textContent).toBe('静态渲染模式检测')
    expect(requirementTarget?.textContent).not.toContain('要求')
    expect(document.body.textContent).not.toContain('ZH:Purpose')
    expect(document.body.textContent).not.toContain('ZH:Requirements')

    const toc = document.querySelector('nav.toc-wide')
    expect(toc).toBeTruthy()
    const tocScope = within(toc as HTMLElement)
    expect(tocScope.getByRole('link', { name: 'Purpose', hidden: true })).toBeTruthy()
    expect(tocScope.getByRole('link', { name: 'Requirements', hidden: true })).toBeTruthy()
    expect(tocScope.queryByRole('link', { name: 'ZH:Purpose', hidden: true })).toBeNull()
    expect(tocScope.queryByRole('link', { name: 'ZH:Requirements', hidden: true })).toBeNull()
  })

  it('keeps nested list item translations attached to each list row', async () => {
    mockProgressiveResult('bilingual', [
      {
        id: 'md-4',
        sourceStartOffset: 10,
        sourceEndOffset: 30,
        sourceKind: 'listItem',
        source: 'Reported surfaces:',
        translatorInput: 'Reported surfaces:',
        target: '报告的表面：',
        kind: 'listItem',
      },
      {
        id: 'md-7',
        sourceStartOffset: 33,
        sourceEndOffset: 44,
        sourceKind: 'listItem',
        source: 'specs: ok',
        translatorInput: 'specs: ok',
        target: '规格：确定',
        kind: 'listItem',
      },
      {
        id: 'md-9',
        sourceStartOffset: 47,
        sourceEndOffset: 75,
        sourceKind: 'listItem',
        source: 'changes/spec: not rendered',
        translatorInput: 'changes/spec: not rendered',
        target: '更改/规格：未渲染',
        kind: 'listItem',
      },
    ])

    render(
      <MarkdownViewer
        markdown={'# Report\n\n- Reported surfaces:\n  - specs: ok\n  - changes/spec: not rendered'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'bilingual',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => expect(screen.getByText('报告的表面：')).toBeTruthy())
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]!).getByText('报告的表面：')).toBeTruthy()
    expect(within(items[1]!).getByText('规格：确定')).toBeTruthy()
    expect(within(items[2]!).getByText('更改/规格：未渲染')).toBeTruthy()
  })

  it('keeps a parent list translation before its nested list and renders translated code text', async () => {
    mockProgressiveResult('bilingual', [
      {
        id: 'md-parent',
        sourceStartOffset: 10,
        sourceEndOffset: 56,
        sourceKind: 'listItem',
        source: 'Upgraded direct Vite consumers to vite@8.0.0:',
        translatorInput: 'Upgraded direct Vite consumers to <x1>vite@8.0.0</x1>:',
        target: '将 Vite 消费者升级为 vite@8.0.0：',
        targetNodes: [
          { type: 'text', value: '将 Vite 消费者升级为 ' },
          {
            type: 'element',
            tagName: 'code',
            properties: {},
            children: [{ type: 'text', value: 'vite@8.0.0' }],
          },
          { type: 'text', value: '：' },
        ],
        kind: 'listItem',
      },
      {
        id: 'md-child',
        sourceStartOffset: 61,
        sourceEndOffset: 73,
        sourceKind: 'listItem',
        source: 'packages/app',
        translatorInput: 'packages/app',
        target: 'packages/app',
        kind: 'listItem',
      },
    ])

    render(
      <MarkdownViewer
        markdown={'# Report\n\n- Upgraded direct Vite consumers to `vite@8.0.0`:\n  - packages/app'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'bilingual',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => {
      const target = document.querySelector('[data-translation-segment-id="md-parent"]')
      expect(target?.textContent).toContain('将 Vite 消费者升级为')
    })

    const item = document.querySelector('[data-translation-segment-id="md-parent"]')
    expect(item).toBeInstanceOf(HTMLLIElement)
    if (!(item instanceof HTMLLIElement)) throw new Error('Expected translated parent list item.')

    const target = item.querySelector('.document-translation-target')
    const nestedList = item.querySelector('ul, ol')
    expect(target).toBeInstanceOf(HTMLElement)
    expect(nestedList).toBeInstanceOf(HTMLElement)
    if (!(target instanceof HTMLElement) || !(nestedList instanceof HTMLElement)) {
      throw new Error('Expected translated target and nested list to render.')
    }
    expect(target.compareDocumentPosition(nestedList) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    const source = item.querySelector('.document-translation-source')
    expect(source?.querySelector('ul, ol')).toBeNull()
    const parentText = item.textContent ?? ''
    const translatedCode = within(item)
      .getAllByText('vite@8.0.0')
      .find((node) => node.closest('.document-translation-target'))
    expect(translatedCode?.tagName).toBe('CODE')
    expect(parentText).not.toContain('[object Object]')
  })

  it('preserves nested list structure when the parent row uses translated HAST nodes', async () => {
    mockProgressiveResult('direct', [
      {
        id: 'md-parent',
        sourceStartOffset: 10,
        sourceEndOffset: 28,
        sourceKind: 'listItem',
        source: 'Reported surfaces:',
        translatorInput: 'Reported surfaces:',
        target: '报告的表面：',
        targetNodes: [{ type: 'text', value: '报告的表面：' }],
        kind: 'listItem',
      },
      {
        id: 'md-child',
        sourceStartOffset: 33,
        sourceEndOffset: 42,
        sourceKind: 'listItem',
        source: 'specs: ok',
        translatorInput: 'specs: ok',
        target: '规格：确定',
        targetNodes: [{ type: 'text', value: '规格：确定' }],
        kind: 'listItem',
      },
    ])

    render(
      <MarkdownViewer
        markdown={'# Report\n\n- Reported surfaces:\n  - specs: ok'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => expect(screen.getByText('报告的表面：')).toBeTruthy())
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]!).getByText('报告的表面：')).toBeTruthy()
    expect(within(items[1]!).getByText('规格：确定')).toBeTruthy()
  })

  it('filters unsafe restored link URLs before rendering translated HAST nodes', async () => {
    mockProgressiveResult('direct', [
      {
        id: 'md-link',
        sourceStartOffset: 9,
        sourceEndOffset: 47,
        sourceKind: 'paragraph',
        source: 'docs',
        translatorInput: '<x1>docs</x1>',
        target: '文档',
        targetNodes: [
          {
            type: 'element',
            tagName: 'a',
            properties: { href: 'javascript:alert(1)', title: 'Read more' },
            children: [{ type: 'text', value: '文档' }],
          },
        ],
        kind: 'paragraph',
      },
    ])

    render(
      <MarkdownViewer
        markdown={'# Links\n\n[docs](javascript:alert(1) "Read more")'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await screen.findByText('文档')
    const link = document.querySelector('a[title="Read more"]')
    expect(link).toBeTruthy()
    if (!link) throw new Error('Expected translated anchor to render.')
    expect(link.getAttribute('href')).toBeNull()
    expect(link.getAttribute('title')).toBe('Read more')
  })

  it('renders progressive segment patches before the full translation finishes', async () => {
    let releaseFinalResult: (() => void) | undefined
    translateMarkdownDocumentProgressivelyMock.mockImplementationOnce(async (args, onPatch) => {
      const firstSegment = {
        id: 'md-2',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        sourceKind: 'heading',
        source: 'Hello',
        translatorInput: 'Hello',
        target: '你好',
        kind: 'heading',
        sourceLanguage: 'en',
        targetLanguage: args.targetLanguage,
        status: 'translated',
      }
      onPatch({ segmentIndex: 0, segment: firstSegment })
      await new Promise<void>((resolve) => {
        releaseFinalResult = resolve
      })
      return {
        displayMode: args.displayMode,
        sourceLanguage: 'en',
        targetLanguage: args.targetLanguage,
        segments: [firstSegment],
      }
    })

    render(
      <MarkdownViewer
        markdown={'# Hello\n\nI love you.'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: '你好' })).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Cancel translation' })).toBeTruthy()
    expect(sessionStorage.getItem(DOCUMENT_TRANSLATION_SESSION_STORAGE_KEY)).toBe('translated')

    releaseFinalResult?.()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show source' })).toBeTruthy())
  })

  it('surfaces document translation failures when every translated segment fails', async () => {
    translateMarkdownDocumentProgressivelyMock.mockImplementationOnce(async (args, onPatch) => {
      const failedSegment = {
        id: 'md-2',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        sourceKind: 'heading',
        source: 'Hello',
        translatorInput: 'Hello',
        kind: 'heading',
        sourceLanguage: 'en',
        targetLanguage: args.targetLanguage,
        status: 'error',
        error: 'fetch failed',
      }
      onPatch({ segmentIndex: 0, segment: failedSegment })
      return {
        displayMode: args.displayMode,
        sourceLanguage: 'en',
        targetLanguage: args.targetLanguage,
        segments: [failedSegment],
      }
    })

    render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    const retryButton = await screen.findByRole('button', { name: 'Retry translation' })
    expect(retryButton).not.toBeDisabled()
    expect(retryButton).not.toHaveAttribute('title')
    fireEvent.focus(retryButton)
    expect(await screen.findByText('fetch failed Click to retry.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeTruthy()

    mockProgressiveResult('direct', [
      {
        id: 'md-2',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        sourceKind: 'heading',
        source: 'Hello',
        translatorInput: 'Hello',
        target: '你好',
        kind: 'heading',
      },
    ])

    fireEvent.click(retryButton)

    await waitFor(() => expect(screen.getByRole('heading', { name: '你好' })).toBeTruthy())
    expect(translateMarkdownDocumentProgressivelyMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the source document stable when a browser translation result has no segments', async () => {
    translateMarkdownDocumentProgressivelyMock.mockImplementationOnce(async (args) => ({
      displayMode: args.displayMode,
      sourceLanguage: 'en',
      targetLanguage: args.targetLanguage,
    }))

    render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Show source' })).toBeTruthy())
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeTruthy()
  })

  it('turns off session activation when cancelling an in-flight translation', async () => {
    translateMarkdownDocumentProgressivelyMock.mockImplementationOnce(async (args, onPatch) => {
      onPatch({
        segmentIndex: 0,
        segment: {
          id: 'md-2',
          sourceStartOffset: 0,
          sourceEndOffset: 7,
          sourceKind: 'heading',
          source: 'Hello',
          translatorInput: 'Hello',
          target: '你好',
          kind: 'heading',
          sourceLanguage: 'en',
          targetLanguage: args.targetLanguage,
          status: 'translated',
        },
      })
      await new Promise<void>(() => {})
      throw new Error('unreachable')
    })

    render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel translation' })).toBeTruthy()
    )
    expect(sessionStorage.getItem(DOCUMENT_TRANSLATION_SESSION_STORAGE_KEY)).toBe('translated')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel translation' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Translate' })).toBeTruthy())
    expect(sessionStorage.getItem(DOCUMENT_TRANSLATION_SESSION_STORAGE_KEY)).toBe('source')
    expect(translateMarkdownDocumentProgressivelyMock).toHaveBeenCalledTimes(1)
  })

  it('aborts the page-owned translation task when the viewer unmounts', async () => {
    let capturedSignal: AbortSignal | undefined
    translateMarkdownDocumentProgressivelyMock.mockImplementationOnce(async (args) => {
      capturedSignal = args.signal
      await new Promise<void>(() => {})
      throw new Error('unreachable')
    })

    const view = render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))
    await waitFor(() => expect(capturedSignal).toBeInstanceOf(AbortSignal))

    view.unmount()

    expect(capturedSignal?.aborted).toBe(true)
  })

  it('keeps rendering when translation patches arrive out of order', async () => {
    let emitSparsePatches: (() => void) | undefined
    let releaseFinalResult: (() => void) | undefined
    translateMarkdownDocumentProgressivelyMock.mockImplementationOnce(async (args, onPatch) => {
      emitSparsePatches = () => {
        onPatch({
          segmentIndex: 1,
          segment: {
            id: 'paragraph-world',
            sourceStartOffset: 9,
            sourceEndOffset: 14,
            sourceKind: 'paragraph',
            source: 'World',
            translatorInput: 'World',
            target: '世界',
            kind: 'paragraph',
            sourceLanguage: 'en',
            targetLanguage: args.targetLanguage,
            status: 'translated',
          },
        })
        onPatch({
          segmentIndex: 2,
          segment: {
            id: 'paragraph-again',
            sourceStartOffset: 16,
            sourceEndOffset: 25,
            sourceKind: 'paragraph',
            source: 'Again here',
            translatorInput: 'Again here',
            target: '再次出现',
            kind: 'paragraph',
            sourceLanguage: 'en',
            targetLanguage: args.targetLanguage,
            status: 'translated',
          },
        })
      }
      await new Promise<void>((resolve) => {
        releaseFinalResult = resolve
      })
      return {
        displayMode: args.displayMode,
        sourceLanguage: 'en',
        targetLanguage: args.targetLanguage,
        segments: [
          {
            id: 'heading-hello',
            sourceStartOffset: 0,
            sourceEndOffset: 7,
            sourceKind: 'heading',
            source: 'Hello',
            translatorInput: 'Hello',
            target: '你好',
            kind: 'heading',
            sourceLanguage: 'en',
            targetLanguage: args.targetLanguage,
            status: 'translated',
          },
          {
            id: 'paragraph-world',
            sourceStartOffset: 9,
            sourceEndOffset: 14,
            sourceKind: 'paragraph',
            source: 'World',
            translatorInput: 'World',
            target: '世界',
            kind: 'paragraph',
            sourceLanguage: 'en',
            targetLanguage: args.targetLanguage,
            status: 'translated',
          },
          {
            id: 'paragraph-again',
            sourceStartOffset: 16,
            sourceEndOffset: 25,
            sourceKind: 'paragraph',
            source: 'Again here',
            translatorInput: 'Again here',
            target: '再次出现',
            kind: 'paragraph',
            sourceLanguage: 'en',
            targetLanguage: args.targetLanguage,
            status: 'translated',
          },
        ],
      }
    })

    render(
      <MarkdownViewer
        markdown={'# Hello\n\nWorld\n\nAgain here'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))
    await waitFor(() => expect(emitSparsePatches).toBeTypeOf('function'))

    act(() => {
      emitSparsePatches?.()
    })

    expect(screen.getByRole('button', { name: 'Cancel translation' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeTruthy()

    await act(async () => {
      releaseFinalResult?.()
    })

    await waitFor(() => expect(screen.getByRole('heading', { name: '你好' })).toBeTruthy())
    expect(screen.getByText('世界')).toBeTruthy()
    expect(screen.getByText('再次出现')).toBeTruthy()
  })

  it('rejects stale late patches after the markdown generation changes', async () => {
    let emitStalePatch: (() => void) | undefined
    let releaseStaleResult: (() => void) | undefined
    translateMarkdownDocumentProgressivelyMock.mockImplementationOnce(async (args, onPatch) => {
      emitStalePatch = () =>
        onPatch({
          segmentIndex: 0,
          segment: {
            id: 'old-heading',
            sourceStartOffset: 0,
            sourceEndOffset: 7,
            sourceKind: 'heading',
            source: 'Hello',
            translatorInput: 'Hello',
            target: '旧翻译',
            kind: 'heading',
            sourceLanguage: 'en',
            targetLanguage: args.targetLanguage,
            status: 'translated',
          },
        })
      await new Promise<void>((resolve) => {
        releaseStaleResult = resolve
      })
      return {
        displayMode: args.displayMode,
        sourceLanguage: 'en',
        targetLanguage: args.targetLanguage,
        segments: [
          {
            id: 'old-heading',
            sourceStartOffset: 0,
            sourceEndOffset: 7,
            sourceKind: 'heading',
            source: 'Hello',
            translatorInput: 'Hello',
            target: '旧最终结果',
            kind: 'heading',
            sourceLanguage: 'en',
            targetLanguage: args.targetLanguage,
            status: 'translated',
          },
        ],
      }
    })

    const { rerender } = render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))
    await waitFor(() => expect(emitStalePatch).toBeTypeOf('function'))

    rerender(
      <MarkdownViewer
        markdown={'# Changed'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        }}
      />
    )

    act(() => {
      emitStalePatch?.()
      releaseStaleResult?.()
    })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Changed' })).toBeTruthy())
    expect(screen.queryByText('旧翻译')).toBeNull()
    expect(screen.queryByText('旧最终结果')).toBeNull()
  })

  it('keeps an in-flight batch translation bound to the settings snapshot used at start', async () => {
    let releaseTranslation: (() => void) | undefined
    translateMarkdownDocumentProgressivelyMock.mockImplementationOnce(async (args, onPatch) => {
      await new Promise<void>((resolve) => {
        releaseTranslation = resolve
      })
      onPatch({
        segmentIndex: 0,
        segment: {
          id: 'md-2',
          sourceStartOffset: 0,
          sourceEndOffset: 7,
          sourceKind: 'heading',
          source: 'Hello',
          translatorInput: 'Hello',
          target: '你好',
          kind: 'heading',
          sourceLanguage: 'en',
          targetLanguage: args.targetLanguage,
          status: 'translated',
        },
      })
      return {
        displayMode: args.displayMode,
        sourceLanguage: 'en',
        targetLanguage: args.targetLanguage,
        segments: [
          {
            id: 'md-2',
            sourceStartOffset: 0,
            sourceEndOffset: 7,
            sourceKind: 'heading',
            source: 'Hello',
            translatorInput: 'Hello',
            target: '你好',
            kind: 'heading',
            sourceLanguage: 'en',
            targetLanguage: args.targetLanguage,
            status: 'translated',
          },
        ],
      }
    })

    const baseProps = {
      markdown: '# Hello',
      translationConfig: {
        enabled: true,
        targetLanguage: 'zh',
        displayMode: 'direct' as const,
        cacheEnabled: false,
        engineId: 'local' as const,
        engines: {
          local: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'q4' },
          openai: {},
        },
      },
    }
    const { rerender } = render(<MarkdownViewer {...baseProps} />)

    await screen.findByRole('button', { name: 'Translate' })
    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))
    await waitFor(() => expect(translateMarkdownDocumentProgressivelyMock).toHaveBeenCalled())

    const firstCallArgs = translateMarkdownDocumentProgressivelyMock.mock.calls[0]?.[0]
    expect(firstCallArgs?.engine.cacheIdentity).toMatchObject({
      engineId: 'local',
      model: 'Xenova/opus-mt-en-zh',
      selectedGroupId: 'q4',
    })

    mockProgressiveResult('direct', [
      {
        id: 'md-2',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        sourceKind: 'heading',
        source: 'Hello',
        translatorInput: 'Hello',
        target: '你好-q8',
        kind: 'heading',
      },
    ])

    rerender(
      <MarkdownViewer
        {...baseProps}
        translationConfig={{
          ...baseProps.translationConfig,
          engines: {
            local: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'q8' },
            openai: {},
          },
        }}
      />
    )

    await waitFor(() => expect(screen.getByRole('heading', { name: '你好-q8' })).toBeTruthy())
    const secondCallArgs = translateMarkdownDocumentProgressivelyMock.mock.calls[1]?.[0]
    expect(secondCallArgs?.engine.cacheIdentity).toMatchObject({
      engineId: 'local',
      model: 'Xenova/opus-mt-en-zh',
      selectedGroupId: 'q8',
    })

    act(() => {
      releaseTranslation?.()
    })

    await waitFor(() => expect(screen.queryByText('你好')).toBeNull())
    expect(screen.getByRole('heading', { name: '你好-q8' })).toBeTruthy()
  })

  it('keeps translation cache plumbing available after leaving and re-entering a page', async () => {
    mockProgressiveResult('direct', [
      {
        id: 'md-2',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        sourceKind: 'heading',
        source: 'Hello',
        translatorInput: 'Hello',
        target: '你好',
        kind: 'heading',
      },
    ])

    const firstView = render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: true,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: '你好' })).toBeTruthy())
    expect(translateMarkdownDocumentProgressivelyMock.mock.calls[0]?.[0].cache).toBeTruthy()

    firstView.unmount()

    mockProgressiveResult('direct', [
      {
        id: 'md-2',
        sourceStartOffset: 0,
        sourceEndOffset: 7,
        sourceKind: 'heading',
        source: 'Hello',
        translatorInput: 'Hello',
        target: '你好',
        kind: 'heading',
      },
    ])

    render(
      <MarkdownViewer
        markdown={'# Hello'}
        translationConfig={{
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: true,
        }}
      />
    )

    await waitFor(() => expect(translateMarkdownDocumentProgressivelyMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('heading', { name: '你好' })).toBeTruthy())
    expect(translateMarkdownDocumentProgressivelyMock.mock.calls[1]?.[0].cache).toBeTruthy()
  })
})

function mockProgressiveResult(
  displayMode: 'direct' | 'bilingual',
  segments: Array<Record<string, unknown>>
) {
  translateMarkdownDocumentProgressivelyMock.mockImplementationOnce(async (args, onPatch) => {
    const translatedSegments = segments.map((segment) => ({
      ...segment,
      sourceLanguage: 'en',
      targetLanguage: args.targetLanguage,
      status: 'translated',
    }))
    translatedSegments.forEach((segment, segmentIndex) => {
      onPatch({ segmentIndex, segment })
    })
    return {
      displayMode,
      sourceLanguage: 'en',
      targetLanguage: args.targetLanguage,
      segments: translatedSegments,
    }
  })
}

function createDownloadedLocalAssetState(): LocalModelAssetState {
  return createLocalAssetStateForTest({
    modelId: 'Xenova/opus-mt-en-zh',
    status: 'downloaded',
    selected: true,
    progress: 1,
    bytesDownloaded: 246415360,
    totalBytes: 246415360,
    resumable: false,
    plan: {
      modelId: 'Xenova/opus-mt-en-zh',
      estimatedTotalBytes: 246415360,
      selectedGroupId: 'q8',
      files: [
        { path: 'config.json', sizeBytes: 1503, required: true },
        { path: 'onnx/encoder_model_quantized.onnx', sizeBytes: 52848230, required: true },
      ],
      groups: [
        {
          id: 'q8',
          label: 'q8 (8-bit)',
          profile: 'q8',
          dtype: 'q8',
          estimatedTotalBytes: 246415360,
          selectable: true,
          selected: true,
          files: [
            { path: 'config.json', sizeBytes: 1503, required: true },
            { path: 'onnx/encoder_model_quantized.onnx', sizeBytes: 52848230, required: true },
          ],
        },
      ],
    },
    files: [
      { path: 'config.json', sizeBytes: 1503, downloadedBytes: 1503 },
      {
        path: 'onnx/encoder_model_quantized.onnx',
        sizeBytes: 52848230,
        downloadedBytes: 52848230,
      },
    ],
    updatedAt: 100,
  })
}
