/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Select bounded Dashboard rows with deterministic ordering.
 * 2. Resolve archive dates identically across Server and browser/static consumers.
 * 3. Apply the objective bounded archive-range policy without owning UI state.
 *
 * Original request (2026-07-28): replace Dashboard Workflow Progress with ReadonlyKanban.
 */
export const DASHBOARD_RECENT_LIST_LIMIT = 10

export type DashboardArchiveRange = '7d' | '30d' | '90d' | 'all'

export interface DashboardArchiveTimeSource {
  id: string
  updatedAt: number
}

const ARCHIVE_RANGE_DAYS: Record<DashboardArchiveRange, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
}

const ARCHIVE_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:-|$)/

/** Parse a valid UTC calendar date from an archive id prefix. */
export function parseDatedArchiveIdTimestamp(id: string): number | null {
  const match = ARCHIVE_DATE_PREFIX.exec(id)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (
    !Number.isFinite(timestamp) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }
  return timestamp
}

/** Resolve the archive timestamp from its dated id, then its physical update time. */
export function resolveArchiveTimestamp(archive: DashboardArchiveTimeSource): number {
  return parseDatedArchiveIdTimestamp(archive.id) ?? archive.updatedAt
}

/** Test whether an archive belongs to a user-selected trailing range. */
export function isArchiveInRange(
  archive: DashboardArchiveTimeSource,
  range: DashboardArchiveRange,
  now = Date.now()
): boolean {
  const days = ARCHIVE_RANGE_DAYS[range]
  if (days === null) return true
  return resolveArchiveTimestamp(archive) >= now - days * 24 * 60 * 60 * 1000
}

export interface DashboardRecentListItem {
  id: string
  updatedAt: number
}

export function compareDashboardItemsByUpdatedAt<T extends DashboardRecentListItem>(
  left: T,
  right: T
): number {
  return right.updatedAt - left.updatedAt || left.id.localeCompare(right.id)
}

export function sortDashboardItemsByUpdatedAt<T extends DashboardRecentListItem>(
  items: readonly T[]
): T[] {
  return [...items].sort(compareDashboardItemsByUpdatedAt)
}

export function selectRecentDashboardItems<T extends DashboardRecentListItem>(
  items: readonly T[],
  limit = DASHBOARD_RECENT_LIST_LIMIT
): T[] {
  return sortDashboardItemsByUpdatedAt(items).slice(0, Math.max(0, Math.trunc(limit)))
}

/** Select recent archives by objective archive time rather than incidental directory mtime. */
export function selectRecentDashboardArchives<T extends DashboardArchiveTimeSource>(
  items: readonly T[],
  limit = DASHBOARD_RECENT_LIST_LIMIT
): T[] {
  return [...items]
    .sort(
      (left, right) =>
        resolveArchiveTimestamp(right) - resolveArchiveTimestamp(left) ||
        left.id.localeCompare(right.id)
    )
    .slice(0, Math.max(0, Math.trunc(limit)))
}
