import type { ExportSnapshot } from '@openspecui/core'
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
      specsCount: 2,
      changesCount: 2,
      archivesCount: 1,
    },
    specs: [
      {
        id: 'cli',
        name: 'CLI',
        content: '# CLI',
        overview: 'overview',
        requirements: [
          { id: 'req-1', text: 'a', scenarios: [{ rawText: 's1' }] },
          { id: 'req-2', text: 'b', scenarios: [{ rawText: 's2' }] },
          { id: 'req-3', text: 'c', scenarios: [{ rawText: 's3' }] },
        ],
        createdAt: 1,
        updatedAt: 20,
      },
      {
        id: 'ui',
        name: 'UI',
        content: '# UI',
        overview: 'overview',
        requirements: [{ id: 'req-1', text: 'a', scenarios: [{ rawText: 's1' }] }],
        createdAt: 1,
        updatedAt: 10,
      },
    ],
    changes: [
      {
        id: 'change-a',
        name: 'Change A',
        proposal: '# Proposal',
        tasks: '- [ ] task',
        why: 'why',
        whatChanges: 'what',
        parsedTasks: [],
        deltas: [],
        progress: { total: 4, completed: 1 },
        createdAt: 1,
        updatedAt: 30,
      },
      {
        id: 'change-b',
        name: 'Change B',
        proposal: '# Proposal',
        tasks: '- [x] task',
        why: 'why',
        whatChanges: 'what',
        parsedTasks: [],
        deltas: [],
        progress: { total: 2, completed: 2 },
        createdAt: 1,
        updatedAt: 15,
      },
    ],
    archives: [
      {
        id: 'archived-x',
        name: 'Archived X',
        proposal: '# Proposal',
        why: 'why',
        whatChanges: 'what',
        parsedTasks: [],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  }
}

describe('static-data-provider dashboard overview', () => {
  beforeEach(() => {
    vi.resetModules()
    staticState.snapshot = createSnapshot()
  })

  it('builds objective dashboard overview from snapshot', async () => {
    const provider = await import('./static-data-provider')
    const overview = await provider.getDashboardOverview()

    expect(overview.summary).toEqual({
      specifications: 2,
      requirements: 4,
      activeChanges: 2,
      inProgressChanges: 1,
      completedChanges: 1,
      tasksTotal: 6,
      tasksCompleted: 3,
    })

    expect(overview.specifications.map((spec) => spec.id)).toEqual(['cli', 'ui'])
    expect(overview.activeChanges.map((change) => change.id)).toEqual(['change-a', 'change-b'])
  })
})
