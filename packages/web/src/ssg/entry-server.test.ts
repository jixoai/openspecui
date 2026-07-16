/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove SSG enumerates and titles Owned Specs through compound identity.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 */
import type { ExportSnapshot } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { getRoutes, getTitle } from './route-manifest'

function snapshot(): ExportSnapshot {
  return {
    meta: { timestamp: '2026-07-16T00:00:00.000Z', version: '6.0.0', projectDir: '/tmp/project' },
    dashboard: { specsCount: 1, changesCount: 0, archivesCount: 0 },
    specs: [
      {
        identity: { kind: 'owned', specId: 'auth/v2' },
        source: 'owned',
        readOnly: false,
        id: 'auth/v2',
        name: 'Auth V2',
        content: '# Auth V2',
        overview: '',
        requirements: [],
        createdAt: 1,
        updatedAt: 2,
      },
    ],
    changes: [],
    archives: [],
  }
}

describe('static Spec routes', () => {
  it('enumerates and titles the compound Owned route', () => {
    const data = snapshot()
    expect(getRoutes(data)).toContain('/specs/owned/auth%2Fv2')
    expect(getTitle('/specs/owned/auth%2Fv2', data)).toBe('Auth V2')
    expect(getRoutes(data)).not.toContain('/specs/auth%2Fv2')
  })
})
