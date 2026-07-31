/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove Dashboard metric cards preserve settled geometry while Pending.
 * 2. Prove Pending content is replaced in place without changing the card owner.
 *
 * Original request (2026-07-31): "Historical Trends 这里的卡片高度是稳定的"
 */
import { render, screen } from '@testing-library/react'
import { Activity } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { DashboardMetricCard } from './metric-card'

describe('DashboardMetricCard', () => {
  it('renders Pending skeletons inside the stable card geometry', () => {
    const view = render(
      <DashboardMetricCard
        label="Specifications / Requirements"
        value="12 / 24"
        icon={Activity}
        availability={{ state: 'ok' }}
        trendKind="monotonic"
        points={[]}
        pending
        className="h-44"
      />
    )

    const card = screen.getByTestId('dashboard-metric-card')
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(card.className).toContain('h-44')
    expect(card.querySelectorAll('.rt-skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByText('12 / 24')).toBeNull()

    view.rerender(
      <DashboardMetricCard
        label="Specifications / Requirements"
        value="12 / 24"
        icon={Activity}
        availability={{ state: 'ok' }}
        trendKind="monotonic"
        points={[]}
        pending={false}
        className="h-44"
      />
    )

    expect(screen.getByText('12 / 24')).toBeTruthy()
    expect(card).toHaveAttribute('aria-busy', 'false')
  })
})
