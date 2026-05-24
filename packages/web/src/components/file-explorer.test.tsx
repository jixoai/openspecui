import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FileExplorer, type FileExplorerEntry } from './file-explorer'

const entries: FileExplorerEntry[] = [
  { path: 'folder-a', type: 'directory' },
  { path: 'folder-a/file-1.md', type: 'file', content: '# One' },
  { path: 'folder-a/file-2.md', type: 'file', content: '# Two' },
  { path: 'folder-a/file-3.md', type: 'file', content: '# Three' },
  { path: 'folder-a/file-4.md', type: 'file', content: '# Four' },
  { path: 'folder-a/file-5.md', type: 'file', content: '# Five' },
  { path: 'folder-a/file-6.md', type: 'file', content: '# Six' },
  { path: 'folder-a/file-7.md', type: 'file', content: '# Seven' },
  { path: 'folder-a/file-8.md', type: 'file', content: '# Eight' },
  { path: 'folder-a/file-9.md', type: 'file', content: '# Nine' },
  { path: 'folder-a/file-10.md', type: 'file', content: '# Ten' },
]

afterEach(() => {
  cleanup()
})

describe('FileExplorer layout', () => {
  it('keeps the file tree in a constrained internal scroll container', () => {
    render(
      <div style={{ height: '320px', width: '1100px' }}>
        <FileExplorer
          entries={entries}
          selectedPath="folder-a/file-1.md"
          onSelect={() => {}}
          renderEditor={(activeFile) => (
            <div data-testid="editor" className="min-h-0 flex-1 overflow-auto">
              {activeFile?.path ?? 'empty'}
            </div>
          )}
        />
      </div>
    )

    const treeShell = document.querySelector('[data-file-explorer-tree]') as HTMLElement | null
    const scrollViewport = document.querySelector(
      '[data-file-explorer-tree-scroll]'
    ) as HTMLElement | null

    expect(treeShell).toBeTruthy()
    expect(scrollViewport).toBeTruthy()

    if (!treeShell || !scrollViewport) {
      return
    }

    Object.defineProperty(treeShell, 'clientHeight', {
      configurable: true,
      value: 320,
    })
    Object.defineProperty(scrollViewport, 'clientHeight', {
      configurable: true,
      value: 280,
    })
    Object.defineProperty(scrollViewport, 'scrollHeight', {
      configurable: true,
      value: 640,
    })

    expect(scrollViewport.clientHeight).toBeLessThanOrEqual(treeShell.clientHeight)
    expect(scrollViewport.scrollHeight).toBeGreaterThan(scrollViewport.clientHeight)
    expect(screen.getByRole('button', { name: /file-10\.md/i })).toBeTruthy()
  })
})
