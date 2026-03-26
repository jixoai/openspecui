import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GitFileTree } from './git-file-tree'

const files = [
  {
    fileId: 'file-a',
    source: 'tracked' as const,
    path: 'src/components/git/git-file-tree.tsx',
    displayPath: 'src/components/git/git-file-tree.tsx',
    previousPath: null,
    changeType: 'modified' as const,
    diff: { state: 'ready' as const, files: 1, insertions: 3, deletions: 1 },
  },
  {
    fileId: 'file-b',
    source: 'tracked' as const,
    path: 'src/routes/git.tsx',
    displayPath: 'src/routes/git.tsx',
    previousPath: null,
    changeType: 'deleted' as const,
    diff: { state: 'ready' as const, files: 1, insertions: 0, deletions: 4 },
  },
  {
    fileId: 'file-c',
    source: 'tracked' as const,
    path: 'src/new-name.ts',
    displayPath: 'src/old-name.ts -> src/new-name.ts',
    previousPath: 'src/old-name.ts',
    changeType: 'renamed' as const,
    diff: { state: 'ready' as const, files: 1, insertions: 0, deletions: 0 },
  },
]

afterEach(() => {
  cleanup()
})

describe('GitFileTree', () => {
  it('renders files as a tree and forwards file selection', () => {
    const onSelectFile = vi.fn()

    render(
      <GitFileTree
        files={files}
        visibilityRatioByFileId={
          new Map([
            ['file-a', 0.8],
            ['file-b', 0.3],
          ])
        }
        onSelectFile={onSelectFile}
      />
    )

    expect(screen.getByRole('tree', { name: 'Changed files' })).toBeTruthy()
    expect(screen.getByRole('treeitem', { name: 'src' }).getAttribute('aria-expanded')).toBe('true')
    expect(
      screen.getByRole('treeitem', { name: 'src/components/git/git-file-tree.tsx' })
    ).toBeTruthy()
    expect(
      screen
        .getByRole('treeitem', { name: 'src/components/git/git-file-tree.tsx' })
        .getAttribute('aria-selected')
    ).toBeNull()
    expect(
      screen
        .getByRole('treeitem', { name: 'src/components/git/git-file-tree.tsx' })
        .getAttribute('data-visibility-ratio')
    ).toBe('0.800')
    expect(screen.getByText('components/git')).toBeTruthy()

    fireEvent.click(screen.getByRole('treeitem', { name: 'src/routes/git.tsx' }))
    expect(onSelectFile).toHaveBeenCalledWith('file-b')
  })

  it('renders renamed files on a single row without fallback subtitle text', () => {
    render(<GitFileTree files={[files[2]!]} onSelectFile={() => {}} />)

    expect(screen.getByText('old-name.ts -> new-name.ts')).toBeTruthy()
    expect(screen.queryByText(/^from /i)).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('shows loading text for unresolved file stats', () => {
    render(
      <GitFileTree
        files={[
          {
            fileId: 'file-loading',
            source: 'untracked',
            path: 'drafts/new-file.md',
            displayPath: 'drafts/new-file.md',
            previousPath: null,
            changeType: 'added',
            diff: { state: 'loading', files: 1 },
          },
        ]}
        onSelectFile={() => {}}
      />
    )

    expect(screen.getAllByText('loading').length).toBeGreaterThan(0)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('supports collapsing and expanding directories', () => {
    render(<GitFileTree files={files} onSelectFile={() => {}} />)

    const srcDirectory = screen.getByRole('treeitem', { name: 'src' })
    expect(screen.getByRole('treeitem', { name: 'src/routes/git.tsx' })).toBeTruthy()

    fireEvent.click(srcDirectory)

    expect(srcDirectory.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('treeitem', { name: 'src/routes/git.tsx' })).toBeNull()

    fireEvent.click(srcDirectory)

    expect(srcDirectory.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('treeitem', { name: 'src/routes/git.tsx' })).toBeTruthy()
  })

  it('supports file-manager keyboard navigation', () => {
    const onSelectFile = vi.fn()

    render(<GitFileTree files={files} onSelectFile={onSelectFile} />)

    const srcDirectory = screen.getByRole('treeitem', { name: 'src' })
    srcDirectory.focus()
    expect(document.activeElement).toBe(srcDirectory)

    fireEvent.keyDown(srcDirectory, { key: 'ArrowRight' })
    const componentsDirectory = screen.getByRole('treeitem', { name: 'components/git' })
    expect(document.activeElement).toBe(componentsDirectory)

    fireEvent.keyDown(componentsDirectory, { key: 'ArrowLeft' })
    expect(componentsDirectory.getAttribute('aria-expanded')).toBe('false')
    expect(
      screen.queryByRole('treeitem', { name: 'src/components/git/git-file-tree.tsx' })
    ).toBeNull()
    expect(document.activeElement).toBe(componentsDirectory)

    fireEvent.keyDown(componentsDirectory, { key: 'ArrowRight' })
    expect(componentsDirectory.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(componentsDirectory, { key: 'ArrowRight' })
    const componentFile = screen.getByRole('treeitem', {
      name: 'src/components/git/git-file-tree.tsx',
    })
    expect(document.activeElement).toBe(componentFile)

    fireEvent.keyDown(componentFile, { key: 'End' })
    const renamedFile = screen.getByRole('treeitem', {
      name: 'src/old-name.ts -> src/new-name.ts',
    })
    expect(document.activeElement).toBe(renamedFile)

    fireEvent.keyDown(renamedFile, { key: 'Enter' })
    expect(onSelectFile).toHaveBeenCalledWith('file-c')
  })

  it('shows the absolute project directory as the first tree level', () => {
    render(
      <GitFileTree
        files={[
          {
            fileId: 'file-a',
            source: 'tracked',
            path: 'openspec/changes/archive/change-a/specs/foo/spec.md',
            displayPath: 'openspec/changes/archive/change-a/specs/foo/spec.md',
            previousPath: null,
            changeType: 'modified',
            diff: { state: 'ready', files: 1, insertions: 3, deletions: 1 },
          },
          {
            fileId: 'file-b',
            source: 'tracked',
            path: 'openspec/changes/archive/change-a/tasks.md',
            displayPath: 'openspec/changes/archive/change-a/tasks.md',
            previousPath: null,
            changeType: 'modified',
            diff: { state: 'ready', files: 1, insertions: 1, deletions: 0 },
          },
        ]}
        projectDir="/Users/kzf/Dev/GitHub/jixoai-labs/agenter"
        onSelectFile={() => {}}
      />
    )

    expect(
      screen.getByRole('treeitem', { name: '/Users/kzf/Dev/GitHub/jixoai-labs/agenter' })
    ).toBeTruthy()
    expect(screen.getByRole('treeitem', { name: 'openspec/changes/archive/change-a' })).toBeTruthy()
  })

  it('reveals new highlighted rows inside the tree scroll container', () => {
    const scrollToMock = vi.fn()
    const originalScrollTo = HTMLElement.prototype.scrollTo
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollToMock,
    })

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.getAttribute('role') === 'tree') {
          return {
            x: 0,
            y: 0,
            width: 320,
            height: 60,
            top: 0,
            right: 320,
            bottom: 60,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.dataset.fileId === 'file-a') {
          return {
            x: 0,
            y: 18,
            width: 320,
            height: 18,
            top: 18,
            right: 320,
            bottom: 36,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.dataset.fileId === 'file-c') {
          return {
            x: 0,
            y: 120,
            width: 320,
            height: 18,
            top: 120,
            right: 320,
            bottom: 138,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        return originalGetBoundingClientRect.call(this)
      },
    })

    render(
      <GitFileTree
        files={files}
        visibilityRatioByFileId={
          new Map([
            ['file-a', 0.2],
            ['file-c', 0.8],
          ])
        }
        revealRequest={{ fileId: 'file-c', nonce: 1 }}
        onSelectFile={() => {}}
      />
    )

    expect(
      screen
        .getByRole('treeitem', { name: 'src/components/git/git-file-tree.tsx' })
        .getAttribute('data-visibility-ratio')
    ).toBe('0.200')
    expect(
      screen
        .getByRole('treeitem', { name: 'src/old-name.ts -> src/new-name.ts' })
        .getAttribute('data-visibility-ratio')
    ).toBe('0.800')
    expect(scrollToMock).toHaveBeenCalled()
    expect(scrollToMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        behavior: 'auto',
      })
    )

    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: originalScrollTo,
    })
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: originalGetBoundingClientRect,
    })
  })

  it('does not replay the same reveal request after unrelated rerenders', () => {
    const scrollToMock = vi.fn()
    const originalScrollTo = HTMLElement.prototype.scrollTo
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollToMock,
    })

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: function mockGetBoundingClientRect(this: HTMLElement) {
        if (this.getAttribute('role') === 'tree') {
          return {
            x: 0,
            y: 0,
            width: 320,
            height: 60,
            top: 0,
            right: 320,
            bottom: 60,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        if (this.dataset.fileId === 'file-c') {
          return {
            x: 0,
            y: 120,
            width: 320,
            height: 18,
            top: 120,
            right: 320,
            bottom: 138,
            left: 0,
            toJSON: () => ({}),
          } satisfies DOMRect
        }

        return originalGetBoundingClientRect.call(this)
      },
    })

    const revealRequest = { fileId: 'file-c', nonce: 7 }
    const { rerender } = render(
      <GitFileTree
        files={files}
        visibilityRatioByFileId={new Map([['file-c', 0.8]])}
        revealRequest={revealRequest}
        onSelectFile={() => {}}
      />
    )

    expect(scrollToMock).toHaveBeenCalledTimes(1)

    rerender(
      <GitFileTree
        files={files}
        visibilityRatioByFileId={new Map([['file-c', 1]])}
        revealRequest={revealRequest}
        onSelectFile={() => {}}
      />
    )

    expect(scrollToMock).toHaveBeenCalledTimes(1)

    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: originalScrollTo,
    })
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: originalGetBoundingClientRect,
    })
  })
})
