/**
 * Orthogonal intents (updated 2026-08-05 Asia/Shanghai):
 * 1. Own the daemon user-level Workspace directory catalog across App windows and daemon restarts.
 * 2. Serialize catalog mutations and retry transient Windows replacement locks.
 * 3. Degrade missing or malformed persisted data to an empty credential-free catalog.
 *
 * Owner correction (2026-07-31): "Favorites Recent 这些数据你是不是存储在前端？要存储在后端啊"
 * Original request (2026-08-05): Continue the Windows adaptation and fix equivalent failures together.
 */
import { replaceFileAtomically } from '@openspecui/core'
import {
  createEmptyWorkspaceDirectoryCatalog,
  parseWorkspaceDirectoryCatalog,
  recordSuccessfulDirectoryOpen,
  setDirectoryFavorite,
  WorkspaceDirectoryCatalogSchema,
  type WorkspaceDirectoryCatalog,
} from '@openspecui/core/workspace-directory-catalog'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface WorkspaceDirectoryCatalogStore {
  getSnapshot(): Promise<WorkspaceDirectoryCatalog>
  recordSuccessfulOpen(canonicalPath: string): Promise<WorkspaceDirectoryCatalog>
  setFavorite(canonicalPath: string, favorite: boolean): Promise<WorkspaceDirectoryCatalog>
}

function cloneCatalog(catalog: WorkspaceDirectoryCatalog): WorkspaceDirectoryCatalog {
  return WorkspaceDirectoryCatalogSchema.parse(catalog)
}

/** Create one serialized atomic JSON owner for the daemon's directory catalog. */
export function createWorkspaceDirectoryCatalogStore(options: {
  filePath: string
  now?: () => number
}): WorkspaceDirectoryCatalogStore {
  let cached: WorkspaceDirectoryCatalog | null = null
  let mutationQueue: Promise<void> = Promise.resolve()

  const load = async (): Promise<WorkspaceDirectoryCatalog> => {
    if (cached) return cached
    try {
      const raw: unknown = JSON.parse(await readFile(options.filePath, 'utf8'))
      cached = parseWorkspaceDirectoryCatalog(raw)
    } catch {
      cached = createEmptyWorkspaceDirectoryCatalog()
    }
    return cached
  }

  const persist = async (catalog: WorkspaceDirectoryCatalog): Promise<void> => {
    await mkdir(dirname(options.filePath), { recursive: true })
    const temporaryPath = `${options.filePath}.${process.pid}.${randomUUID()}.tmp`
    try {
      await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      })
      await replaceFileAtomically(temporaryPath, options.filePath)
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
    }
  }

  const mutate = (
    update: (current: WorkspaceDirectoryCatalog) => WorkspaceDirectoryCatalog
  ): Promise<WorkspaceDirectoryCatalog> => {
    const result = mutationQueue.then(async () => {
      const next = update(await load())
      await persist(next)
      cached = next
      return cloneCatalog(next)
    })
    mutationQueue = result.then(
      () => {},
      () => {}
    )
    return result
  }

  return {
    async getSnapshot() {
      await mutationQueue
      return cloneCatalog(await load())
    },
    recordSuccessfulOpen(canonicalPath) {
      return mutate((catalog) =>
        recordSuccessfulDirectoryOpen(catalog, canonicalPath, { now: options.now?.() })
      )
    },
    setFavorite(canonicalPath, favorite) {
      return mutate((catalog) =>
        setDirectoryFavorite(catalog, canonicalPath, favorite, { now: options.now?.() })
      )
    },
  }
}
