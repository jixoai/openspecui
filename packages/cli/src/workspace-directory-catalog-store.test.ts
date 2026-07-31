/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove Favorites and Recent survive reconstruction of the daemon persistence owner.
 * 2. Prove concurrent recency/favorite mutations serialize without losing either fact.
 * 3. Prove corrupt backend state degrades to an empty catalog and is replaceable.
 *
 * Owner correction (2026-07-31): "Favorites Recent 这些数据你是不是存储在前端？要存储在后端啊"
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createWorkspaceDirectoryCatalogStore } from './workspace-directory-catalog-store.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function fixturePath(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'openspecui-workspace-catalog-'))
  tempDirs.push(root)
  return join(root, 'workspace-directory-catalog.json')
}

describe('daemon Workspace directory catalog store', () => {
  it('retains Favorites and Recent after the owner is reconstructed', async () => {
    const filePath = await fixturePath()
    let now = 10
    const first = createWorkspaceDirectoryCatalogStore({ filePath, now: () => now })
    await first.recordSuccessfulOpen('/projects/a')
    await first.setFavorite('/projects/a', true)
    now = 20
    await first.recordSuccessfulOpen('/projects/b')

    const restarted = createWorkspaceDirectoryCatalogStore({ filePath })
    await expect(restarted.getSnapshot()).resolves.toEqual({
      version: 1,
      entries: [
        { canonicalPath: '/projects/a', favorite: true, lastOpenedAt: 10 },
        { canonicalPath: '/projects/b', favorite: false, lastOpenedAt: 20 },
      ],
    })
    expect(await readFile(filePath, 'utf8')).not.toMatch(
      /credential|backendUrl|port|pid|generation/
    )
  })

  it('serializes concurrent mutations without losing recency or favorite state', async () => {
    const filePath = await fixturePath()
    let now = 1
    const store = createWorkspaceDirectoryCatalogStore({ filePath, now: () => now++ })
    await Promise.all([
      store.recordSuccessfulOpen('/projects/a'),
      store.setFavorite('/projects/a', true),
      store.recordSuccessfulOpen('/projects/b'),
    ])

    await expect(store.getSnapshot()).resolves.toMatchObject({
      entries: [
        { canonicalPath: '/projects/a', favorite: true },
        { canonicalPath: '/projects/b', favorite: false },
      ],
    })
  })

  it('degrades corrupt persisted data to empty and replaces it on the next mutation', async () => {
    const filePath = await fixturePath()
    await writeFile(filePath, '{broken', 'utf8')
    const store = createWorkspaceDirectoryCatalogStore({ filePath, now: () => 5 })

    await expect(store.getSnapshot()).resolves.toEqual({ version: 1, entries: [] })
    await store.setFavorite('/projects/recovered', true)
    await expect(store.getSnapshot()).resolves.toMatchObject({
      entries: [{ canonicalPath: '/projects/recovered', favorite: true, lastOpenedAt: 5 }],
    })
  })
})
