import { describe, expect, it } from 'vitest'

import { buildGitFileTreeModel } from './git-file-tree-model'

describe('buildGitFileTreeModel', () => {
  it('compresses directory chains and aggregates ready stats onto directories', () => {
    const tree = buildGitFileTreeModel([
      {
        fileId: 'a',
        source: 'tracked',
        path: 'src/components/git/a.ts',
        displayPath: 'src/components/git/a.ts',
        previousPath: null,
        changeType: 'modified',
        diff: { state: 'ready', files: 1, insertions: 3, deletions: 1 },
      },
      {
        fileId: 'b',
        source: 'tracked',
        path: 'src/components/git/b.ts',
        displayPath: 'src/components/git/b.ts',
        previousPath: null,
        changeType: 'modified',
        diff: { state: 'ready', files: 1, insertions: 2, deletions: 0 },
      },
    ])

    expect(tree[0]).toMatchObject({
      kind: 'directory',
      name: 'src/components/git',
      diff: { state: 'ready', files: 2, insertions: 5, deletions: 1 },
    })
  })

  it('uses the absolute project directory as the first tree level when available', () => {
    const tree = buildGitFileTreeModel(
      [
        {
          fileId: 'a',
          source: 'tracked',
          path: 'openspec/changes/archive/change-a/specs/foo/spec.md',
          displayPath: 'openspec/changes/archive/change-a/specs/foo/spec.md',
          previousPath: null,
          changeType: 'modified',
          diff: { state: 'ready', files: 1, insertions: 3, deletions: 1 },
        },
        {
          fileId: 'b',
          source: 'tracked',
          path: 'openspec/changes/archive/change-a/tasks.md',
          displayPath: 'openspec/changes/archive/change-a/tasks.md',
          previousPath: null,
          changeType: 'modified',
          diff: { state: 'ready', files: 1, insertions: 1, deletions: 0 },
        },
      ],
      { projectDir: '/Users/kzf/Dev/GitHub/jixoai-labs/agenter' }
    )

    expect(tree[0]).toMatchObject({
      kind: 'directory',
      name: '/Users/kzf/Dev/GitHub/jixoai-labs/agenter',
    })
    expect(tree[0]?.kind === 'directory' ? tree[0].children[0] : null).toMatchObject({
      kind: 'directory',
      name: 'openspec/changes/archive/change-a',
    })
  })

  it('keeps directories in loading state while any descendant summary is unresolved', () => {
    const tree = buildGitFileTreeModel([
      {
        fileId: 'a',
        source: 'tracked',
        path: 'openspec/change/proposal.md',
        displayPath: 'openspec/change/proposal.md',
        previousPath: null,
        changeType: 'modified',
        diff: { state: 'ready', files: 1, insertions: 3, deletions: 1 },
      },
      {
        fileId: 'b',
        source: 'untracked',
        path: 'openspec/change/tasks.md',
        displayPath: 'openspec/change/tasks.md',
        previousPath: null,
        changeType: 'added',
        diff: { state: 'loading', files: 1 },
      },
    ])

    expect(tree[0]).toMatchObject({
      kind: 'directory',
      name: 'openspec/change',
      diff: { state: 'loading', files: 2 },
    })
  })
})
