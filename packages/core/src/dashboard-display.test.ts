import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_RECENT_LIST_LIMIT,
  compareDashboardItemsByUpdatedAt,
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
})
