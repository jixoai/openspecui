export const DASHBOARD_RECENT_LIST_LIMIT = 10

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
