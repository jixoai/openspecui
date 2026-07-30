/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Confirm credential binding stays only in the locator-owned runtime memory owner across the candidate/open split (3.8).
 * 2. Prove no persisted Workspace state (candidate catalog, open-workspace state, shell state) carries credentials.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
 * Implementation law: credentials remain runtime-only in `launch-credential.ts`; persisted candidate/open
 *   Workspace state is credential-free. This test guards the candidate/open separation against credential leakage.
 */
import { describe, expect, it } from 'vitest'
import {
  bindLaunchCredential,
  clearLaunchCredential,
  readLaunchCredential,
} from './launch-credential'
import { openOrFocusWorkspace } from './open-workspace-state'
import {
  applyHostedLaunchRequest,
  createEmptyHostedShellState,
  saveHostedShellState,
} from './shell-state'
import { recordManualCandidate, saveWorkspaceCandidateCatalog } from './workspace-candidate-catalog'

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

describe('credential binding isolation across the candidate/open split (3.8)', () => {
  it('keeps the credential only in the locator-owned runtime memory, never in persisted state', () => {
    const apiBaseUrl = 'http://127.0.0.1:3100'
    clearLaunchCredential(apiBaseUrl)
    bindLaunchCredential(apiBaseUrl, 'private-secret')

    // The credential is readable from the runtime memory owner for the matching locator.
    expect(readLaunchCredential(apiBaseUrl)).toBe('private-secret')

    // Candidate catalog persistence carries no credential.
    const candidateStorage = memoryStorage()
    const candidateCatalog = recordManualCandidate({ version: 1, candidates: [] }, apiBaseUrl, {
      now: 1,
    })
    saveWorkspaceCandidateCatalog(candidateStorage, candidateCatalog)
    expect(candidateStorage.getItem('openspecui-app:workspace-candidates')).not.toContain(
      'private-secret'
    )

    // Open-workspace state persistence carries no credential.
    const openState = openOrFocusWorkspace({ activeTabId: null, tabs: [] }, apiBaseUrl, {
      sessionId: 's1',
      tabId: 't1',
    })
    expect(JSON.stringify(openState)).not.toContain('private-secret')

    // Legacy shell-state persistence carries no credential either.
    const shellStorage = memoryStorage()
    const shellState = applyHostedLaunchRequest(createEmptyHostedShellState(), { apiBaseUrl })
    saveHostedShellState(shellStorage, shellState)
    expect(shellStorage.getItem('openspecui-app:shell')).not.toContain('private-secret')

    clearLaunchCredential(apiBaseUrl)
  })
})
