/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Typecheck OpenSpec 1.7 `global_default` root provenance through public CLI and export contracts.
 * 2. Keep configured machine fallback inspection separate from effective Root selector authority.
 *
 * Original request (2026-08-01): adapt OpenSpec 1.7 machine `defaultStore` with checked evidence.
 */
import { describe, expect, it } from 'vitest'
import { CliDoctorSchema } from './cli-contracts/store.js'
import type { ExportRootProvenance } from './export-types.js'
import { inspectEnvironmentDefaultStore } from './planning-config.js'
import { getRootContextCliSelector, type RootContext } from './root-context.js'

describe('OpenSpec 1.7 default Store contracts', () => {
  it('accepts global_default as exact upstream Doctor provenance', () => {
    const parsed = CliDoctorSchema.parse({
      root: {
        path: '/stores/team-plans',
        source: 'global_default',
        store_id: 'team-plans',
        healthy: true,
        status: [],
      },
      store: null,
      references: [],
      status: [],
    })

    expect(parsed.root?.source).toBe('global_default')
    expect(parsed.root?.store_id).toBe('team-plans')
  })

  it('preserves global_default in static publication provenance', () => {
    const provenance: ExportRootProvenance = {
      planningRootPath: 'stores/team-plans',
      rootSource: 'global_default',
      storeId: 'team-plans',
    }

    expect(provenance.rootSource).toBe('global_default')
  })

  it('does not convert configured fallback into an explicit Store selector', () => {
    expect(inspectEnvironmentDefaultStore({ defaultStore: 'team-plans' })).toEqual({
      state: 'configured',
      id: 'team-plans',
    })
    const context: RootContext = {
      launchProject: { path: '/workspace/project' },
      planningRoot: {
        path: '/stores/team-plans',
        source: 'global_default',
        store_id: 'team-plans',
        healthy: true,
        status: [],
      },
      storeId: 'team-plans',
      cli: { available: true, version: '1.7.0' },
      references: [],
      contextMembers: [],
      dataScope: {
        path: '/data/openspec',
        source: 'user-home-default',
        environmentVariable: null,
      },
      diagnostics: { root: [], doctor: [], context: [] },
      evidence: { doctor: null, context: null },
      observedAt: 1,
    }

    expect(getRootContextCliSelector(context)).toEqual({})
  })
})
