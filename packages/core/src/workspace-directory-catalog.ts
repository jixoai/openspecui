/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Define the browser-safe, credential-free Workspace directory catalog wire and persistence contract.
 * 2. Define typed daemon snapshot and favorite-control payloads for Push-invalidate -> Pull-replacement flow.
 * 3. Provide pure catalog mutations and Home projection shared by daemon persistence and App presentation.
 *
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。"
 * Owner correction (2026-07-31): "Favorites Recent 这些数据你是不是存储在前端？要存储在后端啊"
 */
import { z } from 'zod'

export const WORKSPACE_DIRECTORY_CATALOG_VERSION = 1 as const

/** Canonical credential-free identity and user history for one project directory. */
export const WorkspaceDirectoryEntrySchema = z.object({
  canonicalPath: z.string().min(1),
  favorite: z.boolean(),
  lastOpenedAt: z.number().int().nonnegative(),
})
export type WorkspaceDirectoryEntry = z.infer<typeof WorkspaceDirectoryEntrySchema>

/** Complete daemon-owned user-level directory catalog. */
export const WorkspaceDirectoryCatalogSchema = z.object({
  version: z.literal(WORKSPACE_DIRECTORY_CATALOG_VERSION),
  entries: z.array(WorkspaceDirectoryEntrySchema),
})
export type WorkspaceDirectoryCatalog = z.infer<typeof WorkspaceDirectoryCatalogSchema>

/** Revisioned replacement snapshot pulled after daemon invalidation. */
export const AppDaemonWorkspaceDirectorySnapshotSchema = z.object({
  revision: z.number().int().nonnegative(),
  catalog: WorkspaceDirectoryCatalogSchema,
})
export type AppDaemonWorkspaceDirectorySnapshot = z.infer<
  typeof AppDaemonWorkspaceDirectorySnapshotSchema
>

/** Same-origin command for changing favorite state on one canonical directory. */
export const AppDaemonSetWorkspaceDirectoryFavoriteRequestSchema = z.object({
  canonicalPath: z.string().min(1),
  favorite: z.boolean(),
})
export type AppDaemonSetWorkspaceDirectoryFavoriteRequest = z.infer<
  typeof AppDaemonSetWorkspaceDirectoryFavoriteRequestSchema
>

/** Settled acknowledgement after the daemon has persisted a favorite command. */
export const AppDaemonSetWorkspaceDirectoryFavoriteResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.enum(['INVALID_REQUEST', 'PERSISTENCE_FAILED']),
      message: z.string().min(1),
    }),
  }),
])
export type AppDaemonSetWorkspaceDirectoryFavoriteResponse = z.infer<
  typeof AppDaemonSetWorkspaceDirectoryFavoriteResponseSchema
>

/** Create the empty catalog used when no backend persistence exists yet. */
export function createEmptyWorkspaceDirectoryCatalog(): WorkspaceDirectoryCatalog {
  return { version: WORKSPACE_DIRECTORY_CATALOG_VERSION, entries: [] }
}

/** Parse persisted input; corruption rejects the complete file rather than guessing authority. */
export function parseWorkspaceDirectoryCatalog(raw: unknown): WorkspaceDirectoryCatalog {
  const parsed = WorkspaceDirectoryCatalogSchema.safeParse(raw)
  if (!parsed.success) return createEmptyWorkspaceDirectoryCatalog()
  const seen = new Set<string>()
  return {
    version: WORKSPACE_DIRECTORY_CATALOG_VERSION,
    entries: parsed.data.entries.filter((entry) => {
      if (seen.has(entry.canonicalPath)) return false
      seen.add(entry.canonicalPath)
      return true
    }),
  }
}

/** Record one daemon-confirmed successful directory admission. */
export function recordSuccessfulDirectoryOpen(
  catalog: WorkspaceDirectoryCatalog,
  canonicalPath: string,
  options?: { now?: number }
): WorkspaceDirectoryCatalog {
  const path = z.string().min(1).parse(canonicalPath)
  const now = options?.now ?? Date.now()
  const index = catalog.entries.findIndex((entry) => entry.canonicalPath === path)
  if (index < 0) {
    return {
      ...catalog,
      entries: [...catalog.entries, { canonicalPath: path, favorite: false, lastOpenedAt: now }],
    }
  }
  const entries = [...catalog.entries]
  entries[index] = { ...entries[index]!, lastOpenedAt: now }
  return { ...catalog, entries }
}

/** Persist favorite state independently from runtime state, admitting an objective backend path when absent. */
export function setDirectoryFavorite(
  catalog: WorkspaceDirectoryCatalog,
  canonicalPath: string,
  favorite: boolean,
  options?: { now?: number }
): WorkspaceDirectoryCatalog {
  const path = z.string().min(1).parse(canonicalPath)
  const admitted = catalog.entries.some((entry) => entry.canonicalPath === path)
    ? catalog
    : recordSuccessfulDirectoryOpen(catalog, path, options)
  const index = admitted.entries.findIndex((entry) => entry.canonicalPath === path)
  const entries = [...admitted.entries]
  entries[index] = { ...entries[index]!, favorite }
  return { ...admitted, entries }
}

export interface WorkspaceDirectoryCatalogView {
  readonly favorites: readonly WorkspaceDirectoryEntry[]
  readonly recent: readonly WorkspaceDirectoryEntry[]
}

/** Project favorites in stable stored order and non-favorites in descending recency. */
export function selectWorkspaceDirectoryCatalogView(
  catalog: WorkspaceDirectoryCatalog
): WorkspaceDirectoryCatalogView {
  return {
    favorites: catalog.entries.filter((entry) => entry.favorite),
    recent: catalog.entries
      .filter((entry) => !entry.favorite)
      .slice()
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
  }
}
