/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Own one reactive credential-free Workspace directory catalog for the complete App document.
 * 2. Converge Home, Task Manager, and same-origin windows through one persisted canonical-path snapshot.
 * 3. Expose successful-admission and favorite actions without acquiring daemon/runtime authority.
 *
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。"
 */
import { useSyncExternalStore } from 'react'
import {
  createEmptyWorkspaceDirectoryCatalog,
  getWorkspaceDirectoryCatalogStorageKey,
  loadWorkspaceDirectoryCatalog,
  recordSuccessfulDirectoryOpen,
  saveWorkspaceDirectoryCatalog,
  setDirectoryFavorite,
  type WorkspaceDirectoryCatalog,
} from './workspace-directory-catalog'

const DIRECTORY_CATALOG_STORE_KEY = getWorkspaceDirectoryCatalogStorageKey()

function createWorkspaceDirectoryCatalogStore() {
  const listeners = new Set<() => void>()
  let cached = createEmptyWorkspaceDirectoryCatalog()

  function readPersisted(): WorkspaceDirectoryCatalog {
    return typeof localStorage === 'undefined'
      ? createEmptyWorkspaceDirectoryCatalog()
      : loadWorkspaceDirectoryCatalog(localStorage)
  }

  function publish(next: WorkspaceDirectoryCatalog): void {
    cached = next
    listeners.forEach((listener) => listener())
  }

  function persistAndPublish(next: WorkspaceDirectoryCatalog): void {
    if (typeof localStorage !== 'undefined') {
      saveWorkspaceDirectoryCatalog(localStorage, next)
    }
    publish(next)
  }

  if (typeof window !== 'undefined') {
    cached = readPersisted()
    window.addEventListener('storage', (event) => {
      if (event.key === DIRECTORY_CATALOG_STORE_KEY) publish(readPersisted())
    })
  }

  return {
    getState() {
      const persisted = readPersisted()
      if (JSON.stringify(persisted) !== JSON.stringify(cached)) cached = persisted
      return cached
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    recordSuccessfulOpen(canonicalPath: string) {
      persistAndPublish(recordSuccessfulDirectoryOpen(readPersisted(), canonicalPath))
    },
    setFavorite(canonicalPath: string, favorite: boolean) {
      const current = readPersisted()
      const admitted = current.entries.some((entry) => entry.canonicalPath === canonicalPath)
        ? current
        : recordSuccessfulDirectoryOpen(current, canonicalPath)
      persistAndPublish(setDirectoryFavorite(admitted, canonicalPath, favorite))
    },
  }
}

const workspaceDirectoryCatalogStore = createWorkspaceDirectoryCatalogStore()

/** Subscribe to the App-wide credential-free Workspace directory catalog. */
export function useWorkspaceDirectoryCatalog(): WorkspaceDirectoryCatalog {
  return useSyncExternalStore(
    workspaceDirectoryCatalogStore.subscribe,
    workspaceDirectoryCatalogStore.getState
  )
}

/** Mutate the App-wide directory catalog after objective admission or an explicit favorite action. */
export function useWorkspaceDirectoryCatalogActions() {
  return workspaceDirectoryCatalogStore
}

/** Read directory-catalog commands outside React, including production-boundary tests. */
export function getWorkspaceDirectoryCatalogActions() {
  return workspaceDirectoryCatalogStore
}
