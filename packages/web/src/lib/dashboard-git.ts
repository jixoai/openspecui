import type { DashboardGitEntry } from '@openspecui/core'

export type DashboardGitAutoRefreshPreset = '30s' | '5min' | '30min' | 'none'

export const DASHBOARD_GIT_AUTO_REFRESH_STORAGE_KEY = 'openspecui:dashboard:git-auto-refresh'

const DASHBOARD_GIT_AUTO_REFRESH_INTERVALS: Record<DashboardGitAutoRefreshPreset, number | null> = {
  '30s': 30_000,
  '5min': 5 * 60_000,
  '30min': 30 * 60_000,
  none: null,
}

export function isDashboardGitAutoRefreshPreset(
  value: string | null | undefined
): value is DashboardGitAutoRefreshPreset {
  return value === '30s' || value === '5min' || value === '30min' || value === 'none'
}

export function loadDashboardGitAutoRefreshPreset(): DashboardGitAutoRefreshPreset {
  if (typeof window === 'undefined') return 'none'

  try {
    const value = window.localStorage.getItem(DASHBOARD_GIT_AUTO_REFRESH_STORAGE_KEY)
    return isDashboardGitAutoRefreshPreset(value) ? value : 'none'
  } catch {
    return 'none'
  }
}

export function persistDashboardGitAutoRefreshPreset(preset: DashboardGitAutoRefreshPreset): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(DASHBOARD_GIT_AUTO_REFRESH_STORAGE_KEY, preset)
  } catch {
    // ignore
  }
}

export function getDashboardGitAutoRefreshIntervalMs(
  preset: DashboardGitAutoRefreshPreset
): number | null {
  return DASHBOARD_GIT_AUTO_REFRESH_INTERVALS[preset]
}

export function getDashboardGitAutoRefreshReason(
  preset: Exclude<DashboardGitAutoRefreshPreset, 'none'>
): string {
  return `auto-refresh:${preset}`
}

export function getDashboardGitEntryTimestamp(entry: DashboardGitEntry): number | null {
  if (entry.type === 'commit') {
    return Number.isFinite(entry.committedAt) && entry.committedAt > 0 ? entry.committedAt : null
  }

  return Number.isFinite(entry.updatedAt) && (entry.updatedAt ?? 0) > 0 ? entry.updatedAt : null
}

export function sortDashboardGitEntries(entries: DashboardGitEntry[]): DashboardGitEntry[] {
  return [...entries].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'uncommitted' ? -1 : 1
    }

    return (getDashboardGitEntryTimestamp(right) ?? 0) - (getDashboardGitEntryTimestamp(left) ?? 0)
  })
}

export function getDashboardGitAutoRefreshProgress(
  cycleStartedAt: number | null,
  intervalMs: number | null,
  now = Date.now()
): number {
  if (!cycleStartedAt || !intervalMs || intervalMs <= 0) return 0
  const elapsed = Math.max(0, now - cycleStartedAt)
  return Math.min(1, elapsed / intervalMs)
}
