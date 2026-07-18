/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify static Spec details preserve processed and source-aware projection semantics.
 * 2. Verify static Search derives scope, path, route, and identity from compound Spec identity.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
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

  it('derives Search scope and paths from duplicate compound Spec identities', async () => {
    staticState.snapshot = {
      ...createSnapshot(),
      specs: [
        createSnapshot().specs[0],
        {
          identity: { kind: 'referenced', storeId: 'platform-a', specId: 'cli' },
          source: 'referenced',
          readOnly: true,
          id: 'cli',
          name: 'CLI',
          content: '# Referenced CLI A',
          overview: '',
          requirements: [],
          createdAt: 0,
          updatedAt: 0,
        },
        {
          identity: { kind: 'referenced', storeId: 'platform-b', specId: 'cli' },
          source: 'referenced',
          readOnly: true,
          id: 'cli',
          name: 'CLI',
          content: '# Referenced CLI B',
          overview: '',
          requirements: [],
          createdAt: 0,
          updatedAt: 0,
        },
      ] as never,
    }
    const provider = await import('./static-data-provider')

    await expect(provider.getSearchDocuments()).resolves.toEqual([
      expect.objectContaining({
        id: 'spec:owned:cli',
        scope: 'active-root',
        href: '/specs/owned/cli',
        path: 'owned:openspec/specs/cli/spec.md',
      }),
      expect.objectContaining({
        id: 'spec:referenced:platform-a:cli',
        scope: 'referenced-specs',
        href: '/specs/referenced/platform-a/cli',
        path: 'referenced:platform-a:specs/cli',
      }),
      expect.objectContaining({
        id: 'spec:referenced:platform-b:cli',
        scope: 'referenced-specs',
        href: '/specs/referenced/platform-b/cli',
        path: 'referenced:platform-b:specs/cli',
      }),
    ])
  })
})
