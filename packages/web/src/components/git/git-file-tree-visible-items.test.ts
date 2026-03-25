import { describe, expect, it } from 'vitest'

import { buildGitFileTreeModel } from './git-file-tree-model'
import { buildGitFileTreeVisibleModel } from './git-file-tree-visible-items'

describe('buildGitFileTreeVisibleModel', () => {
  it('derives visible rows with tree metadata and connector guides', () => {
    const tree = buildGitFileTreeModel([
      {
        fileId: 'button-file',
        source: 'tracked',
        path: 'src/components/button.tsx',
        displayPath: 'src/components/button.tsx',
        previousPath: null,
        changeType: 'modified',
        diff: { state: 'ready', files: 1, insertions: 2, deletions: 1 },
      },
      {
        fileId: 'routes-file',
        source: 'tracked',
        path: 'src/routes/app.tsx',
        displayPath: 'src/routes/app.tsx',
        previousPath: null,
        changeType: 'modified',
        diff: { state: 'ready', files: 1, insertions: 4, deletions: 0 },
      },
      {
        fileId: 'test-file',
        source: 'tracked',
        path: 'test/unit/app.test.ts',
        displayPath: 'test/unit/app.test.ts',
        previousPath: null,
        changeType: 'added',
        diff: { state: 'ready', files: 1, insertions: 6, deletions: 0 },
      },
    ])

    const model = buildGitFileTreeVisibleModel(tree, new Set(), null)

    expect(model.items.map((item) => item.key)).toEqual([
      'src',
      'src/components',
      'button-file',
      'src/routes',
      'routes-file',
      'test/unit',
      'test-file',
    ])

    expect(model.itemsByKey.get('src')).toMatchObject({
      level: 1,
      posInSet: 1,
      setSize: 2,
      guideMask: [],
    })
    expect(model.itemsByKey.get('button-file')).toMatchObject({
      level: 3,
      parentKey: 'src/components',
      posInSet: 1,
      setSize: 1,
      guideMask: [true, true],
    })
    expect(model.parentByKey.get('test-file')).toBe('test/unit')
  })

  it('keeps full parent metadata while filtering hidden descendants', () => {
    const tree = buildGitFileTreeModel([
      {
        fileId: 'proposal-file',
        source: 'tracked',
        path: 'openspec/change/proposal.md',
        displayPath: 'openspec/change/proposal.md',
        previousPath: null,
        changeType: 'modified',
        diff: { state: 'ready', files: 1, insertions: 3, deletions: 1 },
      },
      {
        fileId: 'tasks-file',
        source: 'tracked',
        path: 'openspec/change/tasks.md',
        displayPath: 'openspec/change/tasks.md',
        previousPath: null,
        changeType: 'modified',
        diff: { state: 'ready', files: 1, insertions: 2, deletions: 0 },
      },
    ])

    const model = buildGitFileTreeVisibleModel(tree, new Set(['openspec/change']), null)

    expect(model.items.map((item) => item.key)).toEqual(['openspec/change'])
    expect(model.parentByKey.get('proposal-file')).toBe('openspec/change')
    expect(model.parentByKey.get('tasks-file')).toBe('openspec/change')
    expect(model.directoryKeys.has('openspec/change')).toBe(true)
  })
})
