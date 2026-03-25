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

    render(<GitFileTree files={files} activeFileId="file-a" onSelectFile={onSelectFile} />)

    expect(screen.getByRole('tree', { name: 'Changed files' })).toBeTruthy()
    expect(screen.getByRole('treeitem', { name: 'src' })).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('treeitem', { name: 'src/components/git/git-file-tree.tsx' })
    ).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('components/git')).toBeTruthy()

    fireEvent.click(screen.getByRole('treeitem', { name: 'src/routes/git.tsx' }))
    expect(onSelectFile).toHaveBeenCalledWith('file-b')
  })

  it('renders renamed files on a single row without fallback subtitle text', () => {
    render(<GitFileTree files={[files[2]!]} activeFileId={null} onSelectFile={() => {}} />)

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
        activeFileId={null}
        onSelectFile={() => {}}
      />
    )

    expect(screen.getAllByText('loading').length).toBeGreaterThan(0)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('supports collapsing and expanding directories', () => {
    render(<GitFileTree files={files} activeFileId={null} onSelectFile={() => {}} />)

    const srcDirectory = screen.getByRole('treeitem', { name: 'src' })
    expect(screen.getByRole('treeitem', { name: 'src/routes/git.tsx' })).toBeTruthy()

    fireEvent.click(srcDirectory)

    expect(srcDirectory).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('treeitem', { name: 'src/routes/git.tsx' })).toBeNull()

    fireEvent.click(srcDirectory)

    expect(srcDirectory).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('treeitem', { name: 'src/routes/git.tsx' })).toBeTruthy()
  })

  it('supports file-manager keyboard navigation', () => {
    const onSelectFile = vi.fn()

    render(<GitFileTree files={files} activeFileId={null} onSelectFile={onSelectFile} />)

    const srcDirectory = screen.getByRole('treeitem', { name: 'src' })
    srcDirectory.focus()
    expect(document.activeElement).toBe(srcDirectory)

    fireEvent.keyDown(srcDirectory, { key: 'ArrowRight' })
    const componentsDirectory = screen.getByRole('treeitem', { name: 'components/git' })
    expect(document.activeElement).toBe(componentsDirectory)

    fireEvent.keyDown(componentsDirectory, { key: 'ArrowLeft' })
    expect(componentsDirectory).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('treeitem', { name: 'src/components/git/git-file-tree.tsx' })
    ).toBeNull()
    expect(document.activeElement).toBe(componentsDirectory)

    fireEvent.keyDown(componentsDirectory, { key: 'ArrowRight' })
    expect(componentsDirectory).toHaveAttribute('aria-expanded', 'true')

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
        activeFileId={null}
        onSelectFile={() => {}}
      />
    )

    expect(
      screen.getByRole('treeitem', { name: '/Users/kzf/Dev/GitHub/jixoai-labs/agenter' })
    ).toBeTruthy()
    expect(screen.getByRole('treeitem', { name: 'openspec/changes/archive/change-a' })).toBeTruthy()
  })
})
