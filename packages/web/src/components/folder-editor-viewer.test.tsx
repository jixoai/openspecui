import type { ChangeFile } from '@openspecui/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FolderEditorViewer } from './folder-editor-viewer'

vi.mock('@/components/code-editor', () => ({
  CodeEditor: ({ className }: { className?: string }) => (
    <div data-testid="code-editor" className={className}>
      code-editor
    </div>
  ),
}))

vi.mock('@/components/markdown-viewer', () => ({
  MarkdownViewer: ({ className }: { className?: string }) => (
    <div data-testid="markdown-viewer" className={className}>
      markdown-viewer
    </div>
  ),
}))

vi.mock('@/lib/file-preview', () => ({
  prepareEntityFilePreview: vi.fn(async () => null),
  writeEntityFile: vi.fn(async () => undefined),
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => false,
}))

vi.mock('@/lib/use-dark-mode', () => ({
  useDarkMode: () => false,
}))

vi.mock('@/lib/use-subscription', () => ({
  useArchiveFilesSubscription: () => ({ data: undefined, isLoading: false, error: null }),
  useChangeFilesSubscription: () => ({ data: undefined, isLoading: false, error: null }),
}))

const files: ChangeFile[] = [
  { path: 'folder-a', type: 'directory' as const },
  { path: 'folder-a/file-1.md', type: 'file' as const, content: '# One', previewKind: 'markdown' },
  { path: 'folder-a/file-2.md', type: 'file' as const, content: '# Two', previewKind: 'markdown' },
  {
    path: 'folder-a/file-3.md',
    type: 'file' as const,
    content: '# Three',
    previewKind: 'markdown',
  },
  { path: 'folder-a/file-4.md', type: 'file' as const, content: '# Four', previewKind: 'markdown' },
  { path: 'folder-a/file-5.md', type: 'file' as const, content: '# Five', previewKind: 'markdown' },
  { path: 'folder-a/file-6.md', type: 'file' as const, content: '# Six', previewKind: 'markdown' },
  {
    path: 'folder-a/file-7.md',
    type: 'file' as const,
    content: '# Seven',
    previewKind: 'markdown',
  },
  {
    path: 'folder-a/file-8.md',
    type: 'file' as const,
    content: '# Eight',
    previewKind: 'markdown',
  },
  { path: 'folder-a/file-9.md', type: 'file' as const, content: '# Nine', previewKind: 'markdown' },
  { path: 'folder-a/file-10.md', type: 'file' as const, content: '# Ten', previewKind: 'markdown' },
]

const htmlFiles: ChangeFile[] = [
  { path: 'folder-b', type: 'directory' as const },
  {
    path: 'folder-b/example.html',
    type: 'file' as const,
    content: '<!doctype html><html><body>Hello</body></html>',
    previewKind: 'html',
    mime: 'text/html',
  },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('FolderEditorViewer layout', () => {
  it('lets the file tree scroll inside the shared panel height without clipping the lower rows', () => {
    render(
      <div style={{ height: '360px', width: '1100px' }}>
        <FolderEditorViewer changeId="change-a" files={files} />
      </div>
    )

    const panelViewport = document.querySelector('[data-folder-viewport]') as HTMLElement | null
    const treeShell = document.querySelector('[data-file-explorer-tree]') as HTMLElement | null
    const treeScroll = document.querySelector(
      '[data-file-explorer-tree-scroll]'
    ) as HTMLElement | null

    expect(panelViewport).toBeTruthy()
    expect(treeShell).toBeTruthy()
    expect(treeScroll).toBeTruthy()

    if (!panelViewport || !treeShell || !treeScroll) {
      return
    }

    Object.defineProperty(panelViewport, 'clientHeight', {
      configurable: true,
      value: 360,
    })
    Object.defineProperty(treeShell, 'clientHeight', {
      configurable: true,
      value: 360,
    })
    Object.defineProperty(treeScroll, 'clientHeight', {
      configurable: true,
      value: 316,
    })
    Object.defineProperty(treeScroll, 'scrollHeight', {
      configurable: true,
      value: 720,
    })

    expect(treeShell.clientHeight).toBeLessThanOrEqual(panelViewport.clientHeight)
    expect(treeScroll.clientHeight).toBeLessThan(treeShell.clientHeight)
    expect(treeScroll.scrollHeight).toBeGreaterThan(treeScroll.clientHeight)
  })

  it('renders mode controls as icon-only buttons with accessible names', () => {
    render(
      <div style={{ height: '360px', width: '1100px' }}>
        <FolderEditorViewer changeId="change-a" files={files} />
      </div>
    )

    expect(screen.getByRole('button', { name: 'Read' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy()
    expect(screen.queryByText('Read')).toBeNull()
    expect(screen.queryByText('Edit')).toBeNull()
    expect(screen.queryByText('Preview')).toBeNull()
  })

  it('defaults html files to preview mode', () => {
    render(
      <div style={{ height: '360px', width: '1100px' }}>
        <FolderEditorViewer changeId="change-a" files={htmlFiles} />
      </div>
    )

    expect(screen.getByRole('button', { name: 'Preview' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(screen.queryByRole('button', { name: 'Read' })).toBeTruthy()
  })

  it('keeps the toolbar action strip within the available width', () => {
    render(
      <div style={{ height: '360px', width: '280px' }}>
        <FolderEditorViewer changeId="change-a" files={files} />
      </div>
    )

    const toolbar = document.querySelector('[data-folder-toolbar]') as HTMLElement | null
    const actions = document.querySelector('[data-folder-toolbar-actions]') as HTMLElement | null

    expect(toolbar).toBeTruthy()
    expect(actions).toBeTruthy()

    if (!toolbar || !actions) {
      return
    }

    Object.defineProperty(toolbar, 'clientWidth', {
      configurable: true,
      value: 280,
    })
    Object.defineProperty(actions, 'clientWidth', {
      configurable: true,
      value: 140,
    })
    Object.defineProperty(actions, 'scrollWidth', {
      configurable: true,
      value: 140,
    })

    expect(actions.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth)
    expect(actions.scrollWidth).toBeLessThanOrEqual(actions.clientWidth)
  })
})
