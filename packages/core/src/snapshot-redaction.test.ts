/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove publication redaction strips absolute paths from every snapshot facet.
 * 2. Prove the Git remote URL is gated behind the explicit include Reference policy.
 * 3. Prove display-safe relative paths and labels survive redaction.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Section 7.8 redaction boundary.
 */
import { describe, expect, it } from 'vitest'
import type { ExportSnapshot } from './export-types.js'
import { redactSnapshotForPublication, snapshotHasAbsolutePath } from './snapshot-redaction.js'

function baselineSnapshot(overrides: Partial<ExportSnapshot> = {}): ExportSnapshot {
  return {
    meta: {
      timestamp: '2026-07-23T00:00:00.000Z',
      observedAt: 1,
      version: '6.0.0',
      projectName: 'project',
      root: {
        planningRootPath: '/private/tmp/openspecui/project',
        rootSource: 'nearest',
        storeId: null,
      },
      referencePolicy: { kind: 'none' },
    },
    dashboard: { specsCount: 0, changesCount: 0, archivesCount: 0 },
    specs: [],
    changes: [],
    archives: [],
    ...overrides,
  }
}

describe('redactSnapshotForPublication', () => {
  it('strips the absolute planning-root path from meta provenance', () => {
    const snapshot = baselineSnapshot()
    expect(snapshot.meta.root?.planningRootPath).toBe('/private/tmp/openspecui/project')
    const redacted = redactSnapshotForPublication(snapshot)
    expect(redacted.meta.root?.planningRootPath).toBe('openspecui/project')
    expect(redacted.meta.root?.planningRootPath).not.toContain('/private/tmp')
  })

  it('clears the Git remote URL unless the Reference policy is explicitly include', () => {
    const snapshot = baselineSnapshot({
      git: {
        defaultBranch: 'main',
        repositoryUrl: 'https://github.com/owner/repo',
        latestCommitTs: null,
        recentCommits: [],
      },
    })
    expect(redactSnapshotForPublication(snapshot).git?.repositoryUrl).toBeNull()

    const included = redactSnapshotForPublication({
      ...snapshot,
      meta: { ...snapshot.meta, referencePolicy: { kind: 'include', referenceSources: [] } },
    })
    expect(included.git?.repositoryUrl).toBe('https://github.com/owner/repo')
  })

  it('redacts absolute OPSX schema/template paths while preserving displayPath', () => {
    const snapshot = baselineSnapshot({
      opsx: {
        schemas: [],
        schemaDetails: {},
        schemaResolutions: {
          default: {
            name: 'default',
            source: 'project',
            path: '/private/tmp/openspecui/project/openspec/schemas/default',
            displayPath: 'openspec/schemas/default',
            shadows: [
              {
                source: 'user',
                path: '/Users/owner/.local/share/openspec/schemas/default',
                displayPath: 'user schemas/default',
              },
            ],
          },
        },
        templates: {
          default: {
            spec: {
              path: '/private/tmp/openspecui/project/openspec/templates/spec.md',
              displayPath: 'openspec/templates/spec.md',
              source: 'project',
            },
          },
        },
        changeMetadata: {},
      },
    })
    const redacted = redactSnapshotForPublication(snapshot)
    const resolution = redacted.opsx!.schemaResolutions.default!
    // Absolute paths are reduced to a display-safe relative tail; displayPath is preserved verbatim.
    expect(resolution.path).not.toContain('/private/')
    expect(resolution.path).not.toMatch(/^\/|^[A-Za-z]:\//)
    expect(resolution.displayPath).toBe('openspec/schemas/default')
    expect(resolution.shadows[0]!.path).not.toContain('/Users/')
    expect(resolution.shadows[0]!.path).not.toMatch(/^\/|^[A-Za-z]:\//)
    expect(redacted.opsx!.templates.default!.spec.path).not.toContain('/private/')
    expect(redacted.opsx!.templates.default!.spec.displayPath).toBe('openspec/templates/spec.md')
  })

  it('leaves no absolute filesystem path anywhere in the published snapshot', () => {
    const snapshot = baselineSnapshot({
      git: {
        defaultBranch: 'main',
        repositoryUrl: 'https://github.com/owner/repo',
        latestCommitTs: null,
        recentCommits: [],
      },
      opsx: {
        schemas: [],
        schemaDetails: {},
        schemaResolutions: {
          default: {
            name: 'default',
            source: 'project',
            path: '/private/tmp/openspecui/project/openspec/schemas/default',
            shadows: [],
          },
        },
        templates: {},
        changeMetadata: { foo: 'root: /private/tmp/x' },
      },
    })
    const redacted = redactSnapshotForPublication(snapshot)
    expect(snapshotHasAbsolutePath(redacted)).toBe(false)
  })

  it('does not mutate the input snapshot', () => {
    const snapshot = baselineSnapshot({
      git: {
        defaultBranch: 'main',
        repositoryUrl: 'https://github.com/owner/repo',
        latestCommitTs: null,
        recentCommits: [],
      },
    })
    redactSnapshotForPublication(snapshot)
    expect(snapshot.git?.repositoryUrl).toBe('https://github.com/owner/repo')
    expect(snapshot.meta.root?.planningRootPath).toBe('/private/tmp/openspecui/project')
  })
})

describe('publication parity (Section 7.8/7.10)', () => {
  it('serialized published data.json contains no forbidden absolute paths, envUri, or remote host', () => {
    const snapshot = baselineSnapshot({
      git: {
        defaultBranch: 'main',
        repositoryUrl: 'https://github.com/owner/repo',
        latestCommitTs: null,
        recentCommits: [],
      },
      opsx: {
        schemas: [],
        schemaDetails: {},
        schemaResolutions: {
          default: {
            name: 'default',
            source: 'project',
            path: '/private/tmp/openspecui/project/openspec/schemas/default',
            shadows: [],
          },
        },
        templates: {},
        changeMetadata: {},
      },
    })
    const published = JSON.stringify(redactSnapshotForPublication(snapshot))
    // No absolute filesystem path, no host identity, no envUri, no registry/data-home path.
    expect(published).not.toMatch(/\/private\/tmp/)
    expect(published).not.toMatch(/\/Users\//)
    expect(published).not.toMatch(/[A-Za-z]:\\/)
    expect(published).not.toContain('envUri')
    // Git remote is cleared because policy is not include.
    expect(published).not.toContain('github.com/owner/repo')
  })
})
