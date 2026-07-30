/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Persist a credential-free versioned Workspace directory catalog (canonical path + favorite + recency).
 * 2. Reject credentials, URLs, ports, process ids, and generation authority from persisted Home state.
 * 3. Keep favorite ordering independent from running/open/managed runtime state.
 *
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。"
 * Owner lifecycle decision (2026-07-30): favorites survive Stop; closing a tab preserves history.
 * Spec: hosted-app-distribution › "Path-First Workspace Home And Runtime Management" (persist scenario).
 *
 * This module owns presentation Home persistence only. Physical canonicalization and managed-service
 * ownership live on the daemon/CLI side; the catalog records the canonical path string the daemon
 * returned and never re-derives physical identity itself.
 */

const WORKSPACE_DIRECTORY_CATALOG_STORAGE_KEY = 'openspecui-app:workspace-directory-catalog'
const WORKSPACE_DIRECTORY_CATALOG_VERSION = 1 as const

/** Canonical credential-free identity for one project directory. */
export interface WorkspaceDirectoryEntry {
  /** Canonical physical directory path as returned by the daemon canonicalizer. */
  readonly canonicalPath: string
  /** Whether the directory is pinned to the Favorites section. Independent of runtime state. */
  favorite: boolean
  /** Monotonic recency timestamp of the last successful admission. */
  lastOpenedAt: number
  /**
   * Optional user-facing note for a favorite. Display-only metadata; never used as identity.
   * Stored only because favorites persist independently and may benefit from a short label.
   */
  note?: string
}

/** Versioned persisted catalog shape; parsed at load time and rejected when malformed. */
export interface WorkspaceDirectoryCatalog {
  readonly version: typeof WORKSPACE_DIRECTORY_CATALOG_VERSION
  readonly entries: WorkspaceDirectoryEntry[]
}

/** Create the empty credential-free catalog. */
export function createEmptyWorkspaceDirectoryCatalog(): WorkspaceDirectoryCatalog {
  return { version: WORKSPACE_DIRECTORY_CATALOG_VERSION, entries: [] }
}

/** Storage key used to persist the credential-free catalog. */
export function getWorkspaceDirectoryCatalogStorageKey(): string {
  return WORKSPACE_DIRECTORY_CATALOG_STORAGE_KEY
}

interface PersistedCatalog {
  version?: unknown
  entries?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isWorkspaceDirectoryEntry(value: unknown): value is WorkspaceDirectoryEntry {
  if (!isRecord(value)) return false
  return (
    typeof value.canonicalPath === 'string' &&
    value.canonicalPath.length > 0 &&
    typeof value.favorite === 'boolean' &&
    typeof value.lastOpenedAt === 'number' &&
    Number.isFinite(value.lastOpenedAt) &&
    (value.note === undefined || typeof value.note === 'string')
  )
}

/**
 * Parse untrusted persisted storage into a typed catalog.
 *
 * Malformed or wrong-version storage is rejected as the empty catalog rather than repaired, because
 * this is a credential-free convenience cache: there is no authority worth guessing at. Unknown
 * additive fields on individual entries are tolerated only when every required field is present.
 */
export function parseWorkspaceDirectoryCatalog(raw: unknown): WorkspaceDirectoryCatalog {
  if (!isRecord(raw)) return createEmptyWorkspaceDirectoryCatalog()
  const persisted = raw as PersistedCatalog
  if (persisted.version !== WORKSPACE_DIRECTORY_CATALOG_VERSION) {
    return createEmptyWorkspaceDirectoryCatalog()
  }
  if (!Array.isArray(persisted.entries)) return createEmptyWorkspaceDirectoryCatalog()

  const seen = new Set<string>()
  const entries: WorkspaceDirectoryEntry[] = []
  for (const candidate of persisted.entries) {
    if (!isWorkspaceDirectoryEntry(candidate)) continue
    if (seen.has(candidate.canonicalPath)) continue
    seen.add(candidate.canonicalPath)
    entries.push({ ...candidate })
  }
  return { version: WORKSPACE_DIRECTORY_CATALOG_VERSION, entries }
}

/** Load the credential-free catalog from storage, returning the empty catalog on any failure. */
export function loadWorkspaceDirectoryCatalog(
  storage: Pick<Storage, 'getItem'>
): WorkspaceDirectoryCatalog {
  try {
    const raw = storage.getItem(WORKSPACE_DIRECTORY_CATALOG_STORAGE_KEY)
    if (!raw) return createEmptyWorkspaceDirectoryCatalog()
    return parseWorkspaceDirectoryCatalog(JSON.parse(raw))
  } catch {
    return createEmptyWorkspaceDirectoryCatalog()
  }
}

/** Persist the credential-free catalog. Persistence failures are ignored (convenience cache). */
export function saveWorkspaceDirectoryCatalog(
  storage: Pick<Storage, 'setItem'>,
  catalog: WorkspaceDirectoryCatalog
): void {
  try {
    storage.setItem(WORKSPACE_DIRECTORY_CATALOG_STORAGE_KEY, JSON.stringify(catalog))
  } catch {
    // ignore persistence failures in the convenience catalog
  }
}

function indexOfEntry(catalog: WorkspaceDirectoryCatalog, canonicalPath: string): number {
  return catalog.entries.findIndex((entry) => entry.canonicalPath === canonicalPath)
}

/**
 * Record a successful directory admission: upsert the canonical path and bump recency.
 *
 * Only the canonical credential-free path and a monotonic timestamp enter the catalog. Failed
 * submissions never reach this function, so failed starts do not pollute history.
 */
export function recordSuccessfulDirectoryOpen(
  catalog: WorkspaceDirectoryCatalog,
  canonicalPath: string,
  options?: { now?: number }
): WorkspaceDirectoryCatalog {
  const now = options?.now ?? Date.now()
  const index = indexOfEntry(catalog, canonicalPath)
  if (index >= 0) {
    const next = [...catalog.entries]
    next[index] = { ...next[index]!, lastOpenedAt: now }
    return { ...catalog, entries: next }
  }
  return {
    ...catalog,
    entries: [...catalog.entries, { canonicalPath, favorite: false, lastOpenedAt: now }],
  }
}

/** Toggle favorite state for a canonical directory, preserving every other field including recency. */
export function setDirectoryFavorite(
  catalog: WorkspaceDirectoryCatalog,
  canonicalPath: string,
  favorite: boolean
): WorkspaceDirectoryCatalog {
  const index = indexOfEntry(catalog, canonicalPath)
  if (index < 0) return catalog
  const next = [...catalog.entries]
  next[index] = { ...next[index]!, favorite }
  return { ...catalog, entries: next }
}

/** Remove a directory from the catalog (used by an explicit forget/remove action). */
export function removeDirectoryEntry(
  catalog: WorkspaceDirectoryCatalog,
  canonicalPath: string
): WorkspaceDirectoryCatalog {
  const index = indexOfEntry(catalog, canonicalPath)
  if (index < 0) return catalog
  return { ...catalog, entries: catalog.entries.filter((_, i) => i !== index) }
}

export interface WorkspaceDirectoryCatalogView {
  /** Favorites first, preserving their relative order, then non-favorites. */
  readonly favorites: readonly WorkspaceDirectoryEntry[]
  /** Non-favorite entries ordered by most-recent first. */
  readonly recent: readonly WorkspaceDirectoryEntry[]
}

/**
 * Project the catalog into the Home view: Favorites (in stored order) above, Recent (recency-desc)
 * below. Favorite ordering is independent of recency and runtime state.
 */
export function selectWorkspaceDirectoryCatalogView(
  catalog: WorkspaceDirectoryCatalog
): WorkspaceDirectoryCatalogView {
  const favorites = catalog.entries.filter((entry) => entry.favorite)
  const recent = catalog.entries
    .filter((entry) => !entry.favorite)
    .slice()
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  return { favorites, recent }
}
