/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Environment selection auto-selects one Environment but requires explicit choice for many (5.2/5.3).
 * 2. Prove stable source resolution stays within the selected envUri (5.4/5.5).
 * 3. Prove pinned authority revalidation retires on generation/identity/envUri/reachability change (5.6/5.7).
 * 4. Prove same-Environment conflict surfaces from settled source-labelled evidence (5.8) and distinct states (5.9).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Mutation resistance (5.12): bypassing exact-generation/identity retirement fails the named dispatch boundary.
 */
import { describe, expect, it } from 'vitest'
import {
  clearEnvironmentSelection,
  createEmptyEnvironmentSelection,
  pinEnvironmentActionAuthority,
  resolveEnvironmentAuthority,
  resolveEnvironmentSelection,
  revalidateEnvironmentAuthority,
  selectEnvironment,
  type EnvironmentSourceObservation,
} from './environment-authority'

function obs(
  overrides: Partial<EnvironmentSourceObservation> & { envUri: string; tabId: string }
): EnvironmentSourceObservation {
  return {
    sessionId: `sess-${overrides.tabId}`,
    apiBaseUrl: `http://${overrides.tabId}`,
    tabCreatedAt: 1,
    generation: 1,
    reachability: 'online',
    compatible: true,
    storeIdentity: null,
    ...overrides,
  }
}

describe('Environment selection (5.2/5.3)', () => {
  it('auto-selects the single observed Environment', () => {
    const resolution = resolveEnvironmentSelection(createEmptyEnvironmentSelection(), [
      obs({ envUri: 'env://1', tabId: 'a' }),
    ])
    expect(resolution).toEqual({ kind: 'selected', envUri: 'env://1', autoSelected: true })
  })

  it('requires an explicit choice when multiple Environments are observed and none valid is selected', () => {
    const resolution = resolveEnvironmentSelection(createEmptyEnvironmentSelection(), [
      obs({ envUri: 'env://1', tabId: 'a' }),
      obs({ envUri: 'env://2', tabId: 'b' }),
    ])
    expect(resolution.kind).toBe('requires-selection')
    if (resolution.kind === 'requires-selection') {
      expect(resolution.observedEnvUris.sort()).toEqual(['env://1', 'env://2'])
    }
  })

  it('keeps a valid explicit selection and never chooses the first observed Environment', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://2')
    const resolution = resolveEnvironmentSelection(selected, [
      obs({ envUri: 'env://1', tabId: 'a' }),
      obs({ envUri: 'env://2', tabId: 'b' }),
    ])
    expect(resolution).toEqual({ kind: 'selected', envUri: 'env://2', autoSelected: false })
  })

  it('reports no-environment when nothing is observed', () => {
    expect(resolveEnvironmentSelection(createEmptyEnvironmentSelection(), [])).toEqual({
      kind: 'no-environment',
    })
  })
})

describe('Environment authority resolution (5.4/5.5/5.9)', () => {
  it('resolves the deterministic stable source inside the selected Environment', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://1')
    const resolution = resolveEnvironmentAuthority(selected, [
      obs({ envUri: 'env://1', tabId: 'b', tabCreatedAt: 5 }),
      obs({ envUri: 'env://1', tabId: 'a', tabCreatedAt: 1 }),
    ])
    expect(resolution.kind).toBe('authority')
    if (resolution.kind === 'authority') expect(resolution.source.tabId).toBe('a')
  })

  it('never crosses Environment identity to resolve a source', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://1')
    const resolution = resolveEnvironmentAuthority(selected, [
      obs({ envUri: 'env://2', tabId: 'other', tabCreatedAt: 0 }),
    ])
    // env://1 has no current observation => no-current-authority, not a cross-environment fallback.
    expect(resolution).toEqual({ kind: 'no-current-authority', envUri: 'env://1' })
  })

  it('surfaces pending while any source is checking', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://1')
    const resolution = resolveEnvironmentAuthority(selected, [
      obs({ envUri: 'env://1', tabId: 'a', reachability: 'checking' }),
    ])
    expect(resolution.kind).toBe('pending')
  })

  it('surfaces offline / authentication-required / incompatible distinctly', () => {
    const sel = (env: string) => selectEnvironment(createEmptyEnvironmentSelection(), env)
    expect(
      resolveEnvironmentAuthority(sel('env://off'), [
        obs({ envUri: 'env://off', tabId: 'a', reachability: 'offline', compatible: false }),
      ]).kind
    ).toBe('offline')
    expect(
      resolveEnvironmentAuthority(sel('env://auth'), [
        obs({
          envUri: 'env://auth',
          tabId: 'a',
          reachability: 'authentication-required',
          compatible: false,
        }),
      ]).kind
    ).toBe('authentication-required')
    expect(
      resolveEnvironmentAuthority(sel('env://inc'), [
        obs({ envUri: 'env://inc', tabId: 'a', reachability: 'unsupported', compatible: false }),
      ]).kind
    ).toBe('incompatible')
  })

  it('never treats an offline source as authority even when compatibility was previously observed', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://off')
    const resolution = resolveEnvironmentAuthority(selected, [
      obs({ envUri: 'env://off', tabId: 'a', reachability: 'offline', compatible: true }),
    ])
    expect(resolution.kind).toBe('offline')
  })

  it('keeps an online source authoritative while a redundant source is still checking', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://stable')
    const stable = obs({ envUri: 'env://stable', tabId: 'stable', tabCreatedAt: 20 })
    const resolution = resolveEnvironmentAuthority(selected, [
      stable,
      obs({
        envUri: 'env://stable',
        tabId: 'joining',
        tabCreatedAt: 10,
        reachability: 'checking',
      }),
    ])
    expect(resolution).toEqual({ kind: 'authority', source: stable })
  })

  it('retains the preferred exact source while it remains current', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://stable')
    const retained = obs({ envUri: 'env://stable', tabId: 'retained', tabCreatedAt: 20 })
    const earlier = obs({ envUri: 'env://stable', tabId: 'earlier', tabCreatedAt: 10 })
    expect(resolveEnvironmentAuthority(selected, [earlier, retained], retained)).toEqual({
      kind: 'authority',
      source: retained,
    })
  })
})

describe('same-Environment conflict (5.8)', () => {
  it('surfaces conflict when settled sources carry non-equivalent Store identity', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://1')
    const resolution = resolveEnvironmentAuthority(selected, [
      obs({
        envUri: 'env://1',
        tabId: 'a',
        tabCreatedAt: 1,
        storeIdentity: { storeId: 'team', root: '/x' },
      }),
      obs({
        envUri: 'env://1',
        tabId: 'b',
        tabCreatedAt: 2,
        storeIdentity: { storeId: 'design', root: '/y' },
      }),
    ])
    expect(resolution.kind).toBe('conflict')
  })

  it('does not surface conflict when settled sources agree', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://1')
    const resolution = resolveEnvironmentAuthority(selected, [
      obs({
        envUri: 'env://1',
        tabId: 'a',
        tabCreatedAt: 1,
        storeIdentity: { storeId: 'team', root: '/x' },
      }),
      obs({
        envUri: 'env://1',
        tabId: 'b',
        tabCreatedAt: 2,
        storeIdentity: { storeId: 'team', root: '/x' },
      }),
    ])
    expect(resolution.kind).toBe('authority')
  })

  it('surfaces conflict from non-equivalent settled Store registry/Doctor signatures', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://1')
    const resolution = resolveEnvironmentAuthority(selected, [
      obs({ envUri: 'env://1', tabId: 'a', storeEvidenceSignature: '{"stores":["a"]}' }),
      obs({ envUri: 'env://1', tabId: 'b', storeEvidenceSignature: '{"stores":["b"]}' }),
    ])
    expect(resolution.kind).toBe('conflict')
  })

  it('keeps the preferred source as display evidence when conflict revokes mutation authority', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://1')
    const earlier = obs({
      envUri: 'env://1',
      tabId: 'earlier',
      tabCreatedAt: 1,
      storeEvidenceSignature: '{"stores":["a"]}',
    })
    const retained = obs({
      envUri: 'env://1',
      tabId: 'retained',
      tabCreatedAt: 2,
      storeEvidenceSignature: '{"stores":["b"]}',
    })

    const resolution = resolveEnvironmentAuthority(selected, [earlier, retained], retained)

    expect(resolution.kind).toBe('conflict')
    if (resolution.kind === 'conflict') expect(resolution.source).toBe(retained)
  })
})

describe('pinned authority revalidation at dispatch (5.6/5.7/5.12)', () => {
  it('validates an unchanged pinned authority', () => {
    const source = obs({ envUri: 'env://1', tabId: 'a', generation: 7 })
    const authority = pinEnvironmentActionAuthority(source)
    const result = revalidateEnvironmentAuthority(authority, [source])
    expect(result.kind).toBe('valid')
  })

  it('retires on generation replacement', () => {
    const source = obs({ envUri: 'env://1', tabId: 'a', generation: 7 })
    const authority = pinEnvironmentActionAuthority(source)
    const replaced = revalidateEnvironmentAuthority(authority, [{ ...source, generation: 8 }])
    expect(replaced).toEqual({ kind: 'retired', reason: 'generation-replaced' })
  })

  it('retires on identity replacement (same tab id, different session/creation)', () => {
    const source = obs({ envUri: 'env://1', tabId: 'a', sessionId: 's1', tabCreatedAt: 1 })
    const authority = pinEnvironmentActionAuthority(source)
    const replaced = revalidateEnvironmentAuthority(authority, [
      { ...source, sessionId: 's2', tabCreatedAt: 2 },
    ])
    expect(replaced).toEqual({ kind: 'retired', reason: 'identity-replaced' })
  })

  it('retires on envUri change, offline, authentication-required, and incompatible', () => {
    const source = obs({ envUri: 'env://1', tabId: 'a' })
    const authority = pinEnvironmentActionAuthority(source)
    expect(revalidateEnvironmentAuthority(authority, [{ ...source, envUri: 'env://2' }])).toEqual({
      kind: 'retired',
      reason: 'envuri-changed',
    })
    expect(
      revalidateEnvironmentAuthority(authority, [{ ...source, reachability: 'offline' }])
    ).toEqual({
      kind: 'retired',
      reason: 'offline',
    })
    expect(
      revalidateEnvironmentAuthority(authority, [
        { ...source, reachability: 'authentication-required' },
      ])
    ).toEqual({ kind: 'retired', reason: 'authentication-required' })
    expect(revalidateEnvironmentAuthority(authority, [{ ...source, compatible: false }])).toEqual({
      kind: 'retired',
      reason: 'incompatible',
    })
    expect(
      revalidateEnvironmentAuthority(authority, [{ ...source, reachability: 'unsupported' }])
    ).toEqual({ kind: 'retired', reason: 'incompatible' })
  })

  it('retires when the source disappears entirely', () => {
    const source = obs({ envUri: 'env://1', tabId: 'a' })
    const authority = pinEnvironmentActionAuthority(source)
    expect(revalidateEnvironmentAuthority(authority, [])).toEqual({
      kind: 'retired',
      reason: 'source-absent',
    })
  })

  it('mutation resistance: a same-id tab replacement cannot combine A generation with replacement identity', () => {
    // A hybrid authority (A's generation + replacement tab identity) is rejected, not combined.
    const source = obs({
      envUri: 'env://1',
      tabId: 'a',
      sessionId: 's1',
      tabCreatedAt: 1,
      generation: 7,
    })
    const authority = pinEnvironmentActionAuthority(source)
    const hybrid = revalidateEnvironmentAuthority(authority, [
      { ...source, sessionId: 's2', tabCreatedAt: 2, generation: 7 },
    ])
    expect(hybrid.kind).toBe('retired')
    if (hybrid.kind === 'retired') expect(hybrid.reason).toBe('identity-replaced')
  })
})

describe('selection clearing', () => {
  it('clears a selection and is a no-op when already empty', () => {
    const selected = selectEnvironment(createEmptyEnvironmentSelection(), 'env://1')
    expect(clearEnvironmentSelection(selected)).toEqual({ selectedEnvUri: null })
    expect(clearEnvironmentSelection(createEmptyEnvironmentSelection())).toStrictEqual(
      createEmptyEnvironmentSelection()
    )
  })
})
