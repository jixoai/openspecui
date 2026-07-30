/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Confirm credential-free manual candidates and open-Workspace presentation converge across same-origin windows (3.9).
 * 2. Prove the converged state never carries credentials, fragments, or private launch data.
 *
 * Original request (2026-07-30): "Workspaces融合了Connections。"
 * Implementation law: same-window and cross-window convergence applies to credential-free candidate/open
 *   state only; credentials remain in the locator-owned runtime memory owner and never enter converged state.
 *
 * Convergence model: each catalog persists to its own localStorage key; a `storage` event in another
 * same-origin window re-parses that key into the local view. This mirrors the existing shell-state
 * convergence pattern and keeps the new models credential-free.
 */
import { describe, expect, it } from 'vitest'
import {
  areOpenWorkspaceStatesEqual,
  openOrFocusWorkspace,
  parseOpenWorkspaceState,
} from './open-workspace-state'
import {
  getWorkspaceCandidateCatalogStorageKey,
  loadWorkspaceCandidateCatalog,
  parseWorkspaceCandidateCatalog,
  recordManualCandidate,
  saveWorkspaceCandidateCatalog,
} from './workspace-candidate-catalog'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(initial))
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

describe('cross-window convergence of credential-free Workspace state (3.9)', () => {
  it('converges a manual candidate written in one window into another window via the storage key', () => {
    // Window A writes a credential-free candidate.
    const storageA = memoryStorage()
    const catalogA = recordManualCandidate(
      { version: 1, candidates: [] },
      'http://127.0.0.1:3100',
      { now: 7, label: 'proj' }
    )
    saveWorkspaceCandidateCatalog(storageA, catalogA)
    const serialized = storageA.getItem(getWorkspaceCandidateCatalogStorageKey())!

    // Window B observes the same serialized state (e.g. via a storage event) and re-parses it.
    const storageB = memoryStorage({ [getWorkspaceCandidateCatalogStorageKey()]: serialized })
    const catalogB = loadWorkspaceCandidateCatalog(storageB)
    expect(catalogB.candidates).toEqual(catalogA.candidates)
    // Converged state carries no credential.
    expect(serialized).not.toContain('credential')
  })

  it('converges open-Workspace presentation without credentials or fragments', () => {
    const stateA = openOrFocusWorkspace({ activeTabId: null, tabs: [] }, 'http://127.0.0.1:3100', {
      sessionId: 's1',
      tabId: 't1',
    })
    const serialized = JSON.stringify(stateA)
    // Window B re-parses the same open-Workspace presentation.
    const stateB = parseOpenWorkspaceState(JSON.parse(serialized))
    expect(areOpenWorkspaceStatesEqual(stateA, stateB)).toBe(true)
    expect(serialized).not.toContain('credential')
    expect(serialized).not.toContain('fragment')
  })

  it('rejects a credential-leaking candidate payload during cross-window convergence', () => {
    // A malformed/leaking payload from any source is rejected as empty; convergence never trusts it.
    const leaked = parseWorkspaceCandidateCatalog({
      version: 1,
      candidates: [
        { apiBaseUrl: 'http://x', source: 'manual', credential: 'secret', lastConnectedAt: 1 },
      ],
    })
    expect(leaked.candidates).toEqual([])
  })
})
