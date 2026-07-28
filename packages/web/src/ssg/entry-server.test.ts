/**
 * @vitest-environment node
 *
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove SSG enumerates and titles Owned Specs through compound identity.
 * 2. Prove the static server entry imports and renders without browser globals.
 * 3. Prove `/context` is generated with publication-safe snapshot provenance.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 * Derived requirement (2026-07-18): Static HTML pre-render must not evaluate browser-only toolkit modules.
 * Owner acceptance feedback (2026-07-28): "Static 导出后的 /context 页面没数据。"
 */
import type { ExportSnapshot } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { getRoutes, getTitle } from './route-manifest'

function snapshot(): ExportSnapshot {
  return {
    meta: {
      timestamp: '2026-07-16T00:00:00.000Z',
      observedAt: 1,
      version: '6.0.0',
      projectName: 'project',
      root: {
        planningRootPath: 'workspace/openspec',
        rootSource: 'nearest',
        storeId: null,
      },
      referencePolicy: { kind: 'none' },
    },
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
    expect(getRoutes(data)).toContain('/context')
    expect(getTitle('/context', data)).toBe('Context')
    expect(getTitle('/specs/owned/auth%2Fv2', data)).toBe('Auth V2')
    expect(getRoutes(data)).not.toContain('/specs/auth%2Fv2')
  })

  it('imports and renders the static server entry without browser globals', async () => {
    expect(globalThis).not.toHaveProperty('document')
    const { render } = await import('./entry-server')

    await expect(render('/dashboard', snapshot(), '/')).resolves.toContain('Dashboard')
  }, 20_000)

  it('renders published Context provenance into the static server output', async () => {
    const { render } = await import('./entry-server')

    const html = await render('/context', snapshot(), '/')

    expect(html).toContain('workspace/openspec')
    expect(html).toContain('No effective References were recorded')
    expect(html).toContain('Runtime CLI evidence, registry, and data scope are not published')
    expect(html).not.toContain('XDG_DATA_HOME')
  }, 20_000)
})
