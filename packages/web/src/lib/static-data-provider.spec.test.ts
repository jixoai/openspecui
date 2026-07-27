/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify static Spec details preserve processed Owned projection semantics.
 * 2. Verify current legal snapshots expose only Active-root Search documents.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import type { ExportSnapshot } from '@openspecui/core'
import {
  createDocumentChecklistSummary,
  createTrackedTaskProgress,
} from '@openspecui/core/task-progress'
import { buildSearchIndex, searchIndex } from '@openspecui/search'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const staticState = vi.hoisted(() => ({
  snapshot: null as ExportSnapshot | null,
}))

vi.mock('./static-mode', () => ({
  getBasePath: () => '/',
  getInitialData: () => staticState.snapshot,
}))

function createSnapshot(): ExportSnapshot {
  return {
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      projectDir: '/tmp/project',
    },
    dashboard: {
      specsCount: 1,
      changesCount: 0,
      archivesCount: 0,
    },
    specs: [
      {
        identity: { kind: 'owned', specId: 'cli' },
        source: 'owned',
        readOnly: false,
        id: 'cli',
        name: 'CLI',
        content: '# CLI\n\n## Purpose\nProcessed content',
        sourceContent: '# CLI\n\n## Purpose\nSource content',
        overview: 'Processed content',
        requirements: [],
        createdAt: 1,
        updatedAt: 2,
      },
    ],
    changes: [],
    archives: [],
  }
}

describe('static-data-provider specs', () => {
  beforeEach(() => {
    vi.resetModules()
    staticState.snapshot = createSnapshot()
  })

  it('serves processed spec markdown as the static detail render source', async () => {
    const provider = await import('./static-data-provider')

    await expect(provider.getSpecDocument({ kind: 'owned', specId: 'cli' })).resolves.toMatchObject(
      {
        identity: { kind: 'owned', specId: 'cli' },
        source: 'owned',
        readOnly: false,
        state: 'ready',
        rawMarkdown: '# CLI\n\n## Purpose\nProcessed content',
      }
    )
  })

  it('indexes only Active-root entities and keeps Referenced Search neutral-empty', async () => {
    staticState.snapshot = {
      ...createSnapshot(),
      changes: [
        {
          id: 'add-cli',
          name: 'Add CLI',
          proposal: '# CLI proposal',
          tasks: '- [ ] Ship CLI',
          why: 'CLI',
          whatChanges: 'CLI',
          trackedTaskProgress: createTrackedTaskProgress([]),
          documentChecklistSummary: createDocumentChecklistSummary([]),
          deltas: [],
          createdAt: 3,
          updatedAt: 4,
        },
      ],
      archives: [
        {
          id: 'old-cli',
          name: 'Old CLI',
          entity: {
            stage: 'archive',
            id: 'old-cli',
            exists: true,
            files: [{ path: 'summary.md', type: 'file', content: '# Archived CLI' }],
            artifacts: [],
            ungroupedFiles: [{ path: 'summary.md', type: 'file', content: '# Archived CLI' }],
            diagnostics: [],
          },
          trackedTaskProgress: createTrackedTaskProgress([]),
          documentChecklistSummary: createDocumentChecklistSummary([]),
          createdAt: 5,
          updatedAt: 6,
        },
      ],
    }
    const provider = await import('./static-data-provider')
    const docs = await provider.getSearchDocuments()

    expect(docs.map(({ id, scope }) => ({ id, scope }))).toEqual([
      { id: 'spec:owned:cli', scope: 'active-root' },
      { id: 'change:add-cli', scope: 'active-root' },
      { id: 'archive:old-cli', scope: 'active-root' },
    ])
    expect(
      searchIndex(buildSearchIndex(docs), {
        query: 'CLI',
        scope: 'referenced-specs',
      })
    ).toEqual([])
  })
})
