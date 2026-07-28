/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove deterministic bounded Dashboard row selection.
 * 2. Prove valid archive date parsing and malformed-date fallback.
 * 3. Prove archive range boundaries and objective archive ordering.
 *
 * Original request (2026-07-28): replace Dashboard Workflow Progress with ReadonlyKanban.
 */
import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_RECENT_LIST_LIMIT,
  compareDashboardItemsByUpdatedAt,
  isArchiveInRange,
  parseDatedArchiveIdTimestamp,
  resolveArchiveTimestamp,
  selectRecentDashboardArchives,
  selectRecentDashboardItems,
  sortDashboardItemsByUpdatedAt,
} from './dashboard-display.js'

describe('dashboard display helpers', () => {
  it('sorts items by updatedAt descending and id ascending as tie-breaker', () => {
    const items = [
      { id: 'zeta', updatedAt: 10 },
      { id: 'alpha', updatedAt: 20 },
      { id: 'beta', updatedAt: 20 },
    ]

    expect(sortDashboardItemsByUpdatedAt(items).map((item) => item.id)).toEqual([
      'alpha',
      'beta',
      'zeta',
    ])
    expect(compareDashboardItemsByUpdatedAt(items[1]!, items[2]!)).toBeLessThan(0)
  })

  it('caps recent dashboard items to the default limit', () => {
    const items = Array.from({ length: DASHBOARD_RECENT_LIST_LIMIT + 2 }, (_, index) => ({
      id: `item-${index}`,
      updatedAt: index,
    }))

    const result = selectRecentDashboardItems(items)

    expect(result).toHaveLength(DASHBOARD_RECENT_LIST_LIMIT)
    expect(result[0]?.id).toBe(`item-${DASHBOARD_RECENT_LIST_LIMIT + 1}`)
    expect(result.at(-1)?.id).toBe('item-2')
  })

  it('accepts real calendar prefixes and falls back for normalized impossible dates', () => {
    const fallback = Date.UTC(2024, 0, 2)

    expect(parseDatedArchiveIdTimestamp('2026-02-28-release')).toBe(Date.UTC(2026, 1, 28))
    expect(parseDatedArchiveIdTimestamp('2026-02-31-release')).toBeNull()
    expect(resolveArchiveTimestamp({ id: '2026-02-31-release', updatedAt: fallback })).toBe(
      fallback
    )
  })

  it('applies bounded archive ranges against resolved archive time', () => {
    const now = Date.UTC(2026, 6, 28)

    expect(isArchiveInRange({ id: '2026-07-22-a', updatedAt: 0 }, '7d', now)).toBe(true)
    expect(isArchiveInRange({ id: '2026-07-20-b', updatedAt: 0 }, '7d', now)).toBe(false)
    expect(isArchiveInRange({ id: 'undated', updatedAt: 1 }, 'all', now)).toBe(true)
  })

  it('selects archives by archive date and uses id as a stable tie-breaker', () => {
    const archives = [
      { id: '2026-07-20-zeta', updatedAt: 100 },
      { id: '2026-07-22-beta', updatedAt: 1 },
      { id: '2026-07-22-alpha', updatedAt: 2 },
    ]

    expect(selectRecentDashboardArchives(archives, 2).map((item) => item.id)).toEqual([
      '2026-07-22-alpha',
      '2026-07-22-beta',
    ])
  })
})
