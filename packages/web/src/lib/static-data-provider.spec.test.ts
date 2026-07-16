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
})
