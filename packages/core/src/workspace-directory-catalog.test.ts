/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove the shared catalog accepts only canonical path, favorite, and recency.
 * 2. Prove daemon-confirmed recency and favorite projection remain independent.
 * 3. Prove malformed persisted input degrades to an empty catalog.
 *
 * Owner correction (2026-07-31): "Favorites Recent 这些数据你是不是存储在前端？要存储在后端啊"
 */
import { describe, expect, it } from 'vitest'
import {
  createEmptyWorkspaceDirectoryCatalog,
  parseWorkspaceDirectoryCatalog,
  recordSuccessfulDirectoryOpen,
  selectWorkspaceDirectoryCatalogView,
  setDirectoryFavorite,
} from './workspace-directory-catalog'

describe('Workspace directory catalog contract', () => {
  it('records only canonical path, favorite, and recency', () => {
    const catalog = recordSuccessfulDirectoryOpen(
      createEmptyWorkspaceDirectoryCatalog(),
      '/projects/a',
      { now: 10 }
    )
    expect(catalog).toEqual({
      version: 1,
      entries: [{ canonicalPath: '/projects/a', favorite: false, lastOpenedAt: 10 }],
    })
    expect(JSON.stringify(catalog)).not.toMatch(/credential|backendUrl|port|pid|generation/)
  })

  it('keeps favorite order independent from recent order', () => {
    let catalog = createEmptyWorkspaceDirectoryCatalog()
    catalog = recordSuccessfulDirectoryOpen(catalog, '/old-favorite', { now: 1 })
    catalog = recordSuccessfulDirectoryOpen(catalog, '/recent', { now: 100 })
    catalog = setDirectoryFavorite(catalog, '/old-favorite', true)

    const view = selectWorkspaceDirectoryCatalogView(catalog)
    expect(view.favorites.map((entry) => entry.canonicalPath)).toEqual(['/old-favorite'])
    expect(view.recent.map((entry) => entry.canonicalPath)).toEqual(['/recent'])
  })

  it('admits an objective backend path when it is favorited before a managed start', () => {
    const catalog = setDirectoryFavorite(
      createEmptyWorkspaceDirectoryCatalog(),
      '/projects/external',
      true,
      { now: 7 }
    )
    expect(catalog.entries).toEqual([
      { canonicalPath: '/projects/external', favorite: true, lastOpenedAt: 7 },
    ])
  })

  it('rejects malformed or wrong-version persisted input as empty', () => {
    expect(parseWorkspaceDirectoryCatalog({ version: 1, entries: 'invalid' })).toEqual(
      createEmptyWorkspaceDirectoryCatalog()
    )
    expect(parseWorkspaceDirectoryCatalog({ version: 2, entries: [] })).toEqual(
      createEmptyWorkspaceDirectoryCatalog()
    )
  })
})
