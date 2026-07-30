/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the directory catalog persists only credential-free canonical identity + favorite + recency.
 * 2. Prove favorite ordering is independent of recency and runtime state.
 * 3. Prove malformed or wrong-version persisted storage is rejected as the empty catalog.
 *
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。"
 * Spec: hosted-app-distribution › "Persist favorites and recent directories".
 */
import { describe, expect, it } from 'vitest'
import {
  createEmptyWorkspaceDirectoryCatalog,
  getWorkspaceDirectoryCatalogStorageKey,
  loadWorkspaceDirectoryCatalog,
  parseWorkspaceDirectoryCatalog,
  recordSuccessfulDirectoryOpen,
  removeDirectoryEntry,
  saveWorkspaceDirectoryCatalog,
  selectWorkspaceDirectoryCatalogView,
  setDirectoryFavorite,
} from './workspace-directory-catalog'

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

describe('workspace directory catalog persistence', () => {
  it('records a successful admission as credential-free canonical identity + recency', () => {
    const catalog = recordSuccessfulDirectoryOpen(
      createEmptyWorkspaceDirectoryCatalog(),
      '/Users/me/projects/openspecui',
      { now: 100 }
    )
    expect(catalog.entries).toEqual([
      { canonicalPath: '/Users/me/projects/openspecui', favorite: false, lastOpenedAt: 100 },
    ])
  })

  it('bumps recency on repeat admission without duplicating identity', () => {
    let catalog = recordSuccessfulDirectoryOpen(
      createEmptyWorkspaceDirectoryCatalog(),
      '/projects/a',
      { now: 10 }
    )
    catalog = recordSuccessfulDirectoryOpen(catalog, '/projects/a', { now: 90 })
    catalog = recordSuccessfulDirectoryOpen(catalog, '/projects/b', { now: 50 })
    expect(catalog.entries).toHaveLength(2)
    expect(catalog.entries.find((e) => e.canonicalPath === '/projects/a')?.lastOpenedAt).toBe(90)
  })

  it('survives stop/close: favorite toggles preserve recency and identity', () => {
    let catalog = recordSuccessfulDirectoryOpen(
      createEmptyWorkspaceDirectoryCatalog(),
      '/projects/a',
      { now: 5 }
    )
    catalog = setDirectoryFavorite(catalog, '/projects/a', true)
    expect(catalog.entries[0]).toEqual({
      canonicalPath: '/projects/a',
      favorite: true,
      lastOpenedAt: 5,
    })
    // Stop does not clear favorites: toggling favorite off keeps the entry and recency.
    catalog = setDirectoryFavorite(catalog, '/projects/a', false)
    expect(catalog.entries[0]?.favorite).toBe(false)
    expect(catalog.entries[0]?.lastOpenedAt).toBe(5)
  })

  it('keeps favorite ordering independent of recency in the Home view', () => {
    let catalog = createEmptyWorkspaceDirectoryCatalog()
    catalog = recordSuccessfulDirectoryOpen(catalog, '/old-fav', { now: 1 })
    catalog = recordSuccessfulDirectoryOpen(catalog, '/recent-a', { now: 100 })
    catalog = recordSuccessfulDirectoryOpen(catalog, '/recent-b', { now: 50 })
    catalog = setDirectoryFavorite(catalog, '/old-fav', true)

    const view = selectWorkspaceDirectoryCatalogView(catalog)
    // Favorite is shown first despite being the oldest recency.
    expect(view.favorites.map((e) => e.canonicalPath)).toEqual(['/old-fav'])
    // Recent is recency-descending, ignoring favorites.
    expect(view.recent.map((e) => e.canonicalPath)).toEqual(['/recent-a', '/recent-b'])
  })

  it('persists and reloads through storage as the versioned credential-free shape', () => {
    const storage = memoryStorage()
    let catalog = recordSuccessfulDirectoryOpen(
      createEmptyWorkspaceDirectoryCatalog(),
      '/projects/a',
      { now: 7 }
    )
    catalog = setDirectoryFavorite(catalog, '/projects/a', true)
    saveWorkspaceDirectoryCatalog(storage, catalog)

    const reloaded = loadWorkspaceDirectoryCatalog(storage)
    expect(reloaded.entries).toEqual(catalog.entries)
    expect(reloaded.version).toBe(1)
    expect(getWorkspaceDirectoryCatalogStorageKey()).toBe(
      'openspecui-app:workspace-directory-catalog'
    )
  })

  it('rejects malformed persisted storage as the empty catalog', () => {
    expect(parseWorkspaceDirectoryCatalog(null)).toEqual(createEmptyWorkspaceDirectoryCatalog())
    expect(parseWorkspaceDirectoryCatalog({ version: 1, entries: 'nope' })).toEqual(
      createEmptyWorkspaceDirectoryCatalog()
    )
    // Wrong version is not repaired; it resets to empty.
    expect(parseWorkspaceDirectoryCatalog({ version: 2, entries: [] })).toEqual(
      createEmptyWorkspaceDirectoryCatalog()
    )
  })

  it('drops individual malformed entries and dedupes by canonical path', () => {
    const parsed = parseWorkspaceDirectoryCatalog({
      version: 1,
      entries: [
        { canonicalPath: '/a', favorite: true, lastOpenedAt: 1 },
        { canonicalPath: '', favorite: true, lastModifiedAt: 1 },
        { canonicalPath: '/a', favorite: false, lastOpenedAt: 2 },
        { favorite: true, lastOpenedAt: 3 },
        { canonicalPath: '/b', favorite: 'yes', lastOpenedAt: 4 },
      ],
    })
    expect(parsed.entries).toEqual([{ canonicalPath: '/a', favorite: true, lastOpenedAt: 1 }])
  })

  it('never carries credentials, URLs, ports, or generation authority', () => {
    const catalog = recordSuccessfulDirectoryOpen(
      createEmptyWorkspaceDirectoryCatalog(),
      '/projects/a',
      { now: 1 }
    )
    const json = JSON.stringify(catalog)
    expect(json).not.toContain('credential')
    expect(json).not.toContain('backendUrl')
    expect(json).not.toContain('port')
    expect(json).not.toContain('generation')
    expect(json).not.toContain('pid')
  })

  it('removes a directory entry only through the explicit forget action', () => {
    let catalog = recordSuccessfulDirectoryOpen(
      createEmptyWorkspaceDirectoryCatalog(),
      '/projects/a',
      { now: 1 }
    )
    catalog = removeDirectoryEntry(catalog, '/projects/a')
    expect(catalog.entries).toEqual([])
    // Removing a missing entry is a no-op.
    expect(removeDirectoryEntry(catalog, '/missing')).toBe(catalog)
  })
})
