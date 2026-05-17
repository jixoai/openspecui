import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownViewer } from './markdown-viewer'

const translateMarkdownDocumentProgressivelyMock = vi.hoisted(() => vi.fn())
const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/browser-translation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/browser-translation')>()
  return {
    ...original,
    probeBrowserTranslation: vi.fn(async () => ({ availability: 'available' })),
    translateMarkdownDocumentProgressively: translateMarkdownDocumentProgressivelyMock,
  }
})

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

describe('MarkdownViewer translation plugin', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
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

    fireEvent.click(screen.getByRole('button', { name: 'Configure translation' }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/settings',
      hash: 'settings-translation',
    })
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

    releaseFinalResult?.()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show source' })).toBeTruthy())
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
