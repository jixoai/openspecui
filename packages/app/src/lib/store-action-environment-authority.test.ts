/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Store dispatch authority resolution + revalidation gates the dispatch boundary (8.4/5.7/5.12).
 * 2. Prove Environment authority does not depend on the global active Workspace tab.
 * 3. Mutation resistance: a stale generation/identity/envUri authority is rejected, not combined.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * The dispatcher consumes `resolveStoreEnvironmentAuthority` + `revalidateEnvironmentAuthority` as its pure
 * provenance contract; this test proves those gates retire a stale authority at the named boundary.
 */
import { describe, expect, it } from 'vitest'
import {
  pinEnvironmentActionAuthority,
  revalidateEnvironmentAuthority,
  type EnvironmentSourceObservation,
} from './environment-authority'
import {
  hasExactEnvironmentAuthorityTab,
  resolveStoreEnvironmentAuthority,
} from './store-action-environment-authority'

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

describe('resolveStoreEnvironmentAuthority (8.4)', () => {
  it('returns authority when the selected Environment has a current compatible source', () => {
    const result = resolveStoreEnvironmentAuthority({
      selection: { selectedEnvUri: 'env://1' },
      observations: [obs({ envUri: 'env://1', tabId: 'a' })],
    })
    expect(result.kind).toBe('authority')
    if (result.kind === 'authority') {
      expect(result.authority.envUri).toBe('env://1')
      expect(result.source.tabId).toBe('a')
    }
  })

  it('returns no-authority when the selected Environment has no current observation', () => {
    const result = resolveStoreEnvironmentAuthority({
      selection: { selectedEnvUri: 'env://1' },
      observations: [obs({ envUri: 'env://2', tabId: 'b' })],
    })
    expect(result.kind).toBe('no-authority')
  })

  it('returns no-authority when no Environment is observed', () => {
    const result = resolveStoreEnvironmentAuthority({
      selection: { selectedEnvUri: null },
      observations: [],
    })
    expect(result.kind).toBe('no-authority')
  })
})

describe('Environment dispatch tab identity (5.10)', () => {
  it('accepts the exact Environment source even when another Workspace is globally active', () => {
    const authority = pinEnvironmentActionAuthority(
      obs({
        envUri: 'env://1',
        tabId: 'environment-source',
        sessionId: 'session-source',
        apiBaseUrl: 'http://environment-source',
        tabCreatedAt: 10,
      })
    )
    const tabs = [
      {
        id: 'active-other',
        sessionId: 'session-other',
        apiBaseUrl: 'http://active-other',
        createdAt: 1,
      },
      {
        id: 'environment-source',
        sessionId: 'session-source',
        apiBaseUrl: 'http://environment-source',
        createdAt: 10,
      },
    ]
    expect(hasExactEnvironmentAuthorityTab(authority, tabs)).toBe(true)
  })

  it('rejects a tab identity replacement even when the locator is unchanged', () => {
    const authority = pinEnvironmentActionAuthority(
      obs({
        envUri: 'env://1',
        tabId: 'source',
        sessionId: 'old-session',
        apiBaseUrl: 'http://source',
        tabCreatedAt: 10,
      })
    )
    expect(
      hasExactEnvironmentAuthorityTab(authority, [
        {
          id: 'source',
          sessionId: 'replacement-session',
          apiBaseUrl: 'http://source',
          createdAt: 11,
        },
      ])
    ).toBe(false)
  })
})

describe('Store dispatch authority revalidation mutation resistance (5.12/8.4)', () => {
  it('validates an unchanged pinned authority', () => {
    const source = obs({ envUri: 'env://1', tabId: 'a', generation: 7 })
    const authority = pinEnvironmentActionAuthority(source)
    expect(revalidateEnvironmentAuthority(authority, [source])).toEqual({ kind: 'valid', source })
  })

  it('retires on generation replacement, identity replacement, envUri change, offline, and incompatible', () => {
    const source = obs({
      envUri: 'env://1',
      tabId: 'a',
      sessionId: 's1',
      tabCreatedAt: 1,
      generation: 7,
    })
    const authority = pinEnvironmentActionAuthority(source)
    expect(revalidateEnvironmentAuthority(authority, [{ ...source, generation: 8 }])).toEqual({
      kind: 'retired',
      reason: 'generation-replaced',
    })
    expect(
      revalidateEnvironmentAuthority(authority, [{ ...source, sessionId: 's2', tabCreatedAt: 2 }])
    ).toEqual({ kind: 'retired', reason: 'identity-replaced' })
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
    expect(revalidateEnvironmentAuthority(authority, [{ ...source, compatible: false }])).toEqual({
      kind: 'retired',
      reason: 'incompatible',
    })
  })

  it('retires when the source disappears (no hybrid authority)', () => {
    const source = obs({ envUri: 'env://1', tabId: 'a' })
    const authority = pinEnvironmentActionAuthority(source)
    expect(revalidateEnvironmentAuthority(authority, [])).toEqual({
      kind: 'retired',
      reason: 'source-absent',
    })
  })
})
