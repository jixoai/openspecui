/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove a Workspace candidate is credential-free and distinct from open Workspace tab identity (3.3).
 * 2. Prove daemon-live candidates never persist while manual candidates do.
 * 3. Prove malformed or credential-leaking persisted storage is rejected.
 *
 * Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，弹出的Dialog包含Connnections列表。"
 */
import { describe, expect, it } from 'vitest'
import {
  composeLauncherCandidates,
  createEmptyWorkspaceCandidateCatalog,
  forgetManualCandidate,
  getWorkspaceCandidateCatalogStorageKey,
  loadWorkspaceCandidateCatalog,
  parseWorkspaceCandidateCatalog,
  recordManualCandidate,
  saveWorkspaceCandidateCatalog,
  type WorkspaceCandidateEntry,
} from './workspace-candidate-catalog'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    key(index: number) {
      return [...map.keys()][index] ?? null
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
    removeItem(key: string) {
      map.delete(key)
    },
  }
}

describe('workspace candidate catalog (3.3)', () => {
  it('records a manual candidate as credential-free normalized locator + recency', () => {
    const catalog = recordManualCandidate(
      createEmptyWorkspaceCandidateCatalog(),
      'http://127.0.0.1:3100/',
      { now: 10 }
    )
    expect(catalog.candidates).toEqual([
      { apiBaseUrl: 'http://127.0.0.1:3100', source: 'manual', lastConnectedAt: 10 },
    ])
  })

  it('never persists daemon-live candidates; only manual candidates survive save/load', () => {
    const storage = memoryStorage()
    let catalog = recordManualCandidate(
      createEmptyWorkspaceCandidateCatalog(),
      'http://127.0.0.1:3100',
      { now: 1 }
    )
    // A daemon-live candidate is runtime-only and must not be persisted.
    const withDaemon: typeof catalog = {
      ...catalog,
      candidates: [
        ...catalog.candidates,
        { apiBaseUrl: 'http://127.0.0.1:3200', source: 'daemon-live' },
      ],
    }
    saveWorkspaceCandidateCatalog(storage, withDaemon)
    const reloaded = loadWorkspaceCandidateCatalog(storage)
    expect(reloaded.candidates.map((c) => c.source)).toEqual(['manual'])
    expect(
      reloaded.candidates.find((c) => c.apiBaseUrl === 'http://127.0.0.1:3200')
    ).toBeUndefined()
  })

  it('composes manual + daemon-live candidates into one launcher list without duplicate locators', () => {
    const manual = recordManualCandidate(
      createEmptyWorkspaceCandidateCatalog(),
      'http://127.0.0.1:3100',
      { now: 1 }
    )
    const daemonLive: readonly WorkspaceCandidateEntry[] = [
      { apiBaseUrl: 'http://127.0.0.1:3100', source: 'daemon-live', label: 'live' },
      { apiBaseUrl: 'http://127.0.0.1:3300', source: 'daemon-live' },
    ]
    const composed = composeLauncherCandidates(manual, daemonLive)
    // Same locator resolves to one row (daemon-live takes display precedence).
    expect(composed).toHaveLength(2)
    expect(composed.find((c) => c.apiBaseUrl === 'http://127.0.0.1:3100')?.source).toBe(
      'daemon-live'
    )
    expect(composed.find((c) => c.apiBaseUrl === 'http://127.0.0.1:3300')?.source).toBe(
      'daemon-live'
    )
  })

  it('forgets a manual candidate by locator without touching others', () => {
    let catalog = recordManualCandidate(createEmptyWorkspaceCandidateCatalog(), 'http://a', {
      now: 1,
    })
    catalog = recordManualCandidate(catalog, 'http://b', { now: 2 })
    catalog = forgetManualCandidate(catalog, 'http://a')
    expect(catalog.candidates.map((c) => c.apiBaseUrl)).toEqual(['http://b'])
  })

  it('rejects malformed or wrong-version persisted storage as the empty catalog', () => {
    expect(parseWorkspaceCandidateCatalog(null)).toEqual(createEmptyWorkspaceCandidateCatalog())
    expect(parseWorkspaceCandidateCatalog({ version: 2, candidates: [] })).toEqual(
      createEmptyWorkspaceCandidateCatalog()
    )
    expect(parseWorkspaceCandidateCatalog({ version: 1, candidates: 'nope' })).toEqual(
      createEmptyWorkspaceCandidateCatalog()
    )
  })

  it('drops candidates that leak credential-like fields and dedupes by locator', () => {
    const parsed = parseWorkspaceCandidateCatalog({
      version: 1,
      candidates: [
        { apiBaseUrl: 'http://a', source: 'manual', lastConnectedAt: 1 },
        { apiBaseUrl: 'http://a', source: 'manual', lastConnectedAt: 2 },
        { apiBaseUrl: 'http://leak', source: 'manual', credential: 'secret' },
        { apiBaseUrl: 'http://token', source: 'manual', token: 'x' },
        { apiBaseUrl: 'http://operator:secret@localhost:3100', source: 'manual' },
        { apiBaseUrl: '', source: 'manual' },
      ],
    })
    expect(parsed.candidates).toEqual([
      { apiBaseUrl: 'http://a', source: 'manual', lastConnectedAt: 1 },
    ])
  })

  it('persists and reloads through storage as the versioned credential-free shape', () => {
    const storage = memoryStorage()
    const catalog = recordManualCandidate(
      createEmptyWorkspaceCandidateCatalog(),
      'http://127.0.0.1:3100',
      { now: 5, label: 'proj' }
    )
    saveWorkspaceCandidateCatalog(storage, catalog)
    const reloaded = loadWorkspaceCandidateCatalog(storage)
    expect(reloaded.candidates).toEqual([
      { apiBaseUrl: 'http://127.0.0.1:3100', source: 'manual', label: 'proj', lastConnectedAt: 5 },
    ])
    expect(getWorkspaceCandidateCatalogStorageKey()).toBe('openspecui-app:workspace-candidates')
  })
})
