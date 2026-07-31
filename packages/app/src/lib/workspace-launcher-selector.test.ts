/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove launcher rows derive one deterministic Focus/Open/unavailable command per candidate (4.2/4.3).
 * 2. Prove Focus targets an existing open Workspace and Open creates exactly one (4.4/4.5).
 * 3. Prove distinct unavailable reasons surface directly, not as generic offline (4.6).
 *
 * Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，弹出的Dialog包含Connnections列表。"
 */
import { describe, expect, it } from 'vitest'
import {
  isLauncherRowLocked,
  selectLauncherRows,
  type LauncherCandidate,
} from './workspace-launcher-selector'

function candidate(
  overrides: Partial<LauncherCandidate> & { apiBaseUrl: string }
): LauncherCandidate {
  return {
    reachability: 'online',
    source: 'manual',
    label: null,
    envUri: null,
    ...overrides,
  }
}

describe('workspace launcher selector (4.2/4.3)', () => {
  it('commands Focus when an open Workspace already exists for the candidate', () => {
    const rows = selectLauncherRows({
      candidates: [candidate({ apiBaseUrl: 'http://a', reachability: 'online' })],
      openWorkspaces: [{ apiBaseUrl: 'http://a' }],
      pending: [],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.command).toEqual({ kind: 'focus', apiBaseUrl: 'http://a' })
  })

  it('commands Open when a reachable candidate is not open', () => {
    const rows = selectLauncherRows({
      candidates: [candidate({ apiBaseUrl: 'http://a', reachability: 'online' })],
      openWorkspaces: [],
      pending: [],
    })
    expect(rows[0]?.command).toEqual({ kind: 'open', apiBaseUrl: 'http://a' })
  })

  it('deduplicates candidates by locator while preserving order', () => {
    const rows = selectLauncherRows({
      candidates: [
        candidate({ apiBaseUrl: 'http://a', source: 'manual' }),
        candidate({ apiBaseUrl: 'http://b', source: 'daemon-live' }),
        candidate({ apiBaseUrl: 'http://a', source: 'daemon-live' }),
      ],
      openWorkspaces: [],
      pending: [],
    })
    expect(rows.map((r) => r.candidate.apiBaseUrl)).toEqual(['http://a', 'http://b'])
  })
})

describe('launcher unavailable states surface distinctly (4.6)', () => {
  it('surfaces checking, offline, authentication-required, unsupported, and failed as unavailable', () => {
    const reasons: LauncherCandidate['reachability'][] = [
      'checking',
      'offline',
      'authentication-required',
      'unsupported',
      'failed',
    ]
    for (const reason of reasons) {
      const rows = selectLauncherRows({
        candidates: [candidate({ apiBaseUrl: 'http://x', reachability: reason })],
        openWorkspaces: [],
        pending: [],
      })
      expect(rows[0]?.command.kind).toBe('unavailable')
      if (rows[0]?.command.kind === 'unavailable') {
        expect(rows[0].command.reason).toBe(reason)
      }
    }
  })

  it('does not offer Open for an unavailable candidate even when not open', () => {
    const rows = selectLauncherRows({
      candidates: [candidate({ apiBaseUrl: 'http://x', reachability: 'offline' })],
      openWorkspaces: [],
      pending: [],
    })
    expect(rows[0]?.command.kind).toBe('unavailable')
    expect(isLauncherRowLocked(rows[0]!)).toBe(true)
  })
})

describe('launcher pending/loading lock (4.5/4.9)', () => {
  it('locks a row while its open/connect command is pending', () => {
    const rows = selectLauncherRows({
      candidates: [candidate({ apiBaseUrl: 'http://a', reachability: 'online' })],
      openWorkspaces: [],
      pending: [{ apiBaseUrl: 'http://a', kind: 'open' }],
    })
    expect(rows[0]?.pending).toBe(true)
    expect(isLauncherRowLocked(rows[0]!)).toBe(true)
  })

  it('does not lock an unrelated row', () => {
    const rows = selectLauncherRows({
      candidates: [
        candidate({ apiBaseUrl: 'http://a', reachability: 'online' }),
        candidate({ apiBaseUrl: 'http://b', reachability: 'online' }),
      ],
      openWorkspaces: [],
      pending: [{ apiBaseUrl: 'http://a', kind: 'open' }],
    })
    expect(rows[0]?.pending).toBe(true)
    expect(rows[1]?.pending).toBe(false)
    expect(isLauncherRowLocked(rows[1]!)).toBe(false)
  })
})
