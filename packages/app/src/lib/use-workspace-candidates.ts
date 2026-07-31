/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Reactive store over the credential-free Workspace candidate catalog (manual candidates persist).
 * 2. Cross-window convergence through the candidate-catalog storage key (3.9).
 * 3. Expose add/forget actions that never touch credentials or open-Workspace presentation.
 *
 * Original request (2026-07-30): "Workspaces融合了Connections。"
 * This mirrors the `use-connections.ts` store pattern but is scoped to the candidate catalog only.
 * Open-Workspace presentation (iframe/observation/mutation authority) remains on the existing owner so
 * iframe continuity (tab.id === sessionId) is preserved during the P3 migration.
 */
import { useSyncExternalStore } from 'react'
import {
  createEmptyWorkspaceCandidateCatalog,
  forgetManualCandidate,
  getWorkspaceCandidateCatalogStorageKey,
  loadWorkspaceCandidateCatalog,
  recordManualCandidate,
  saveWorkspaceCandidateCatalog,
  type WorkspaceCandidateCatalog,
} from './workspace-candidate-catalog'

const CANDIDATE_CATALOG_STORE_KEY = getWorkspaceCandidateCatalogStorageKey()

function createCandidateCatalogStore() {
  const listeners = new Set<() => void>()
  let cached: WorkspaceCandidateCatalog =
    typeof localStorage !== 'undefined'
      ? loadWorkspaceCandidateCatalog(localStorage)
      : createEmptyWorkspaceCandidateCatalog()

  function refresh(): void {
    const next =
      typeof localStorage !== 'undefined'
        ? loadWorkspaceCandidateCatalog(localStorage)
        : createEmptyWorkspaceCandidateCatalog()
    cached = next
    listeners.forEach((listener) => listener())
  }

  function publish(next: WorkspaceCandidateCatalog): void {
    cached = next
    listeners.forEach((listener) => listener())
  }

  // Cross-window convergence: a storage event from another same-origin window re-parses the catalog.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === CANDIDATE_CATALOG_STORE_KEY) refresh()
    })
  }

  return {
    getState: () => cached,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    addManualCandidate(apiBaseUrl: string, label?: string) {
      const next = recordManualCandidate(cached, apiBaseUrl, { now: Date.now(), label })
      if (typeof localStorage !== 'undefined') {
        saveWorkspaceCandidateCatalog(localStorage, next)
      }
      publish(next)
    },
    forgetManualCandidate(apiBaseUrl: string) {
      const next = forgetManualCandidate(cached, apiBaseUrl)
      if (typeof localStorage !== 'undefined') {
        saveWorkspaceCandidateCatalog(localStorage, next)
      }
      publish(next)
    },
    /** Publish a state already persisted by another owner (cross-window convergence). */
    publishPersistedCatalog(next: WorkspaceCandidateCatalog) {
      publish(next)
    },
  }
}

const candidateCatalogStore = createCandidateCatalogStore()

/** Subscribe to the persisted credential-free Workspace candidate list. */
export function useWorkspaceCandidates(): WorkspaceCandidateCatalog {
  return useSyncExternalStore(candidateCatalogStore.subscribe, candidateCatalogStore.getState)
}

/** Actions over the candidate catalog: add a manual candidate or forget one. Credentials never enter. */
export function useWorkspaceCandidateActions() {
  return candidateCatalogStore
}
