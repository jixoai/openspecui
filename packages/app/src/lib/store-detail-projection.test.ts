/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Store Detail joins facts by composite identity and surfaces the direct plane (7.4/7.5/7.8).
 * 2. Prove observed-only Usage honesty and independent Specs/Changes regions (7.9/7.10).
 * 3. Prove destructive canRemove requires authority + no running mutation + no blocking diagnostics (7.12).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 */
import { describe, expect, it } from 'vitest'
import {
  selectStoreDetailProjection,
  usageCompletenessLabel,
  type StoreDetailProjectionInput,
} from './store-detail-projection'

function baseInput(
  overrides: Partial<StoreDetailProjectionInput> = {}
): StoreDetailProjectionInput {
  return {
    identity: { envUri: 'env://1', storeId: 'team' },
    health: 'healthy',
    usage: [],
    specs: { state: 'loading' },
    changes: { state: 'loading' },
    mutation: 'idle',
    repository: {},
    hasAuthority: true,
    ...overrides,
  }
}

describe('Store Detail projection (7.4/7.5/7.8)', () => {
  it('joins identity, health, usage, content, and mutation into the direct plane', () => {
    const projection = selectStoreDetailProjection(
      baseInput({
        specs: { state: 'ready', entries: [{ id: 'auth', requirementCount: 3 }] },
        changes: {
          state: 'ready',
          entries: [
            {
              name: 'reshape',
              completedTasks: 1,
              totalTasks: 4,
              lastModified: '2026-07-30',
              status: 'in-progress',
            },
          ],
        },
      })
    )
    expect(projection.identity.storeId).toBe('team')
    expect(projection.health).toBe('healthy')
    expect(projection.specs.state).toBe('ready')
    expect(projection.changes.state).toBe('ready')
  })

  it('keeps Specs and Changes regions independent (one error does not affect the other)', () => {
    const projection = selectStoreDetailProjection(
      baseInput({
        specs: { state: 'error', error: 'specs failed' },
        changes: { state: 'ready', entries: [] },
      })
    )
    expect(projection.specs.state).toBe('error')
    expect(projection.changes.state).toBe('ready')
  })

  it('promotes blocking diagnostics to the direct plane', () => {
    const projection = selectStoreDetailProjection(
      baseInput({ blockingDiagnostics: [{ severity: 'error', message: 'root unhealthy' }] })
    )
    expect(projection.hasBlockingDiagnostics).toBe(true)
    expect(projection.blockingDiagnostics[0]?.message).toBe('root unhealthy')
  })
})

describe('Store Detail observed-only Usage (7.9)', () => {
  it('counts Root-for and Referenced-by from observed usage', () => {
    const projection = selectStoreDetailProjection(
      baseInput({
        usage: [
          { kind: 'root-for', sourceId: 'ws-a' },
          { kind: 'referenced-by', sourceId: 'ws-b' },
          { kind: 'referenced-by', sourceId: 'ws-c' },
        ],
      })
    )
    expect(projection.rootForCount).toBe(1)
    expect(projection.referencedByCount).toBe(2)
  })

  it('labels observed-only completeness honestly (never "all" or "unreferenced")', () => {
    const empty = selectStoreDetailProjection(baseInput())
    expect(usageCompletenessLabel(empty)).toBe('No reference currently observed.')
    const withUsage = selectStoreDetailProjection(
      baseInput({ usage: [{ kind: 'root-for', sourceId: 'ws-a' }] })
    )
    expect(usageCompletenessLabel(withUsage)).toBe('1 observed relationship.')
    expect(usageCompletenessLabel(withUsage)).not.toMatch(/all|unreferenced/i)
  })
})

describe('Store Detail destructive canRemove (7.12)', () => {
  it('allows remove with authority, idle mutation, and no blocking diagnostics', () => {
    expect(selectStoreDetailProjection(baseInput()).canRemove).toBe(true)
  })

  it('blocks remove without authority', () => {
    expect(selectStoreDetailProjection(baseInput({ hasAuthority: false })).canRemove).toBe(false)
  })

  it('blocks remove while a mutation is running or indeterminate', () => {
    expect(selectStoreDetailProjection(baseInput({ mutation: 'running' })).canRemove).toBe(false)
    expect(selectStoreDetailProjection(baseInput({ mutation: 'indeterminate' })).canRemove).toBe(
      false
    )
  })

  it('blocks remove when blocking diagnostics are present', () => {
    expect(
      selectStoreDetailProjection(
        baseInput({ blockingDiagnostics: [{ severity: 'error', message: 'x' }] })
      ).canRemove
    ).toBe(false)
  })
})
