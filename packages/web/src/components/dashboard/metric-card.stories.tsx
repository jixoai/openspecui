import { DashboardMetricCard } from '@/components/dashboard/metric-card'
import { renderReactStory } from '@/storybook/render-react-story'
import type {
  DashboardTrendKind,
  DashboardTrendPoint,
  DashboardTriColorTrendPoint,
} from '@openspecui/core'
import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { CheckSquare } from 'lucide-react'
import { expect, waitFor, within } from 'storybook/test'

function DashboardMetricCardStory({
  availability,
  label,
  points,
  triColorPoints,
  trendKind,
  value,
}: {
  availability: 'ok' | 'invalid'
  label: string
  points: DashboardTrendPoint[]
  triColorPoints?: DashboardTriColorTrendPoint[]
  trendKind: DashboardTrendKind
  value: number | string
}) {
  return (
    <div className="w-[360px]">
      <DashboardMetricCard
        label={label}
        value={value}
        icon={CheckSquare}
        availability={
          availability === 'ok'
            ? { state: 'ok' }
            : { state: 'invalid', reason: 'semantic-uncomputable' }
        }
        trendKind={trendKind}
        points={points}
        triColorPoints={triColorPoints}
      />
    </div>
  )
}

const meta = {
  title: 'Dashboard/MetricCard',
  render: () =>
    renderReactStory(
      <DashboardMetricCardStory
        availability="ok"
        label="Task Completion"
        trendKind="bidirectional"
        value="67%"
        points={[
          { ts: 1000, value: 20 },
          { ts: 2000, value: 45 },
          { ts: 3000, value: 67 },
        ]}
      />
    ),
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const WithTrend: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Task Completion')).toBeVisible()
    await expect(await canvas.findByText('67%')).toBeVisible()
    await expect(canvas.queryByText('No trend yet')).toBeNull()
    await waitFor(() => {
      const bars = canvasElement.querySelectorAll('[data-testid="dashboard-mini-trend-bar"]')
      expect(bars.length).toBeGreaterThan(1)
      const heights = Array.from(bars).map((bar) => (bar as HTMLElement).style.height)
      expect(new Set(heights).size).toBeGreaterThan(1)
    })
  },
}

export const MonotonicTrend: Story = {
  render: () =>
    renderReactStory(
      <DashboardMetricCardStory
        availability="ok"
        label="Requirements"
        trendKind="monotonic"
        value={12}
        points={[
          { ts: 1000, value: 3 },
          { ts: 2000, value: 7 },
          { ts: 3000, value: 9 },
          { ts: 4000, value: 12 },
        ]}
      />
    ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const bars = Array.from(
        canvasElement.querySelectorAll('[data-testid="dashboard-mini-trend-bar"]')
      ) as HTMLElement[]
      expect(bars.length).toBeGreaterThan(1)
      const classNames = bars.map((bar) => bar.className)
      expect(classNames.every((className) => className.includes('bg-primary/25'))).toBe(true)
    })
  },
}

export const BidirectionalTrend: Story = {
  render: () =>
    renderReactStory(
      <DashboardMetricCardStory
        availability="ok"
        label="Active Changes"
        trendKind="bidirectional"
        value={4}
        points={[
          { ts: 1000, value: 2 },
          { ts: 2000, value: 5 },
          { ts: 3000, value: 3 },
          { ts: 4000, value: 6 },
          { ts: 5000, value: 4 },
        ]}
      />
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Active Changes')).toBeVisible()
    await waitFor(() => {
      const bars = Array.from(
        canvasElement.querySelectorAll('[data-testid="dashboard-mini-trend-bar"]')
      ) as HTMLElement[]
      expect(bars.length).toBeGreaterThan(1)
      const directions = new Set(bars.map((bar) => bar.dataset.direction))
      expect(directions.has('up')).toBe(true)
      expect(directions.has('down')).toBe(true)
      const classNames = bars.map((bar) => bar.className)
      expect(classNames.some((className) => className.includes('bg-emerald-500/30'))).toBe(true)
      expect(classNames.some((className) => className.includes('bg-rose-500/30'))).toBe(true)
    })
  },
}

export const SinglePointFlatTrend: Story = {
  render: () =>
    renderReactStory(
      <DashboardMetricCardStory
        availability="ok"
        label="Task Completion"
        trendKind="bidirectional"
        value="67%"
        points={[{ ts: 1000, value: 67 }]}
      />
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Task Completion')).toBeVisible()
    await expect(await canvas.findByText('67%')).toBeVisible()
    await expect(await canvas.findByText('No trend yet')).toBeVisible()
    await waitFor(() => {
      const bars = canvasElement.querySelectorAll('[data-testid="dashboard-mini-trend-bar"]')
      expect(bars.length).toBeGreaterThan(1)
      const heights = Array.from(bars).map((bar) => (bar as HTMLElement).style.height)
      expect(new Set(heights).size).toBe(1)
    })
  },
}

export const InvalidCard: Story = {
  render: () =>
    renderReactStory(
      <DashboardMetricCardStory
        availability="invalid"
        label="Task Completion"
        trendKind="bidirectional"
        value="N/A"
        points={[
          { ts: 1000, value: 10 },
          { ts: 2000, value: 20 },
        ]}
      />
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Task Completion')).toBeVisible()
    await expect(await canvas.findByText('N/A')).toBeVisible()
    await expect(await canvas.findByText('Insufficient computable data')).toBeVisible()
    await expect(canvas.queryByText('No trend yet')).toBeNull()
    await waitFor(() => {
      const bars = canvasElement.querySelectorAll('[data-testid="dashboard-mini-trend-bar"]')
      expect(bars.length).toBe(0)
    })
  },
}

export const TriColorTrend: Story = {
  render: () =>
    renderReactStory(
      <DashboardMetricCardStory
        availability="ok"
        label="Completed Changes"
        trendKind="monotonic"
        value={2}
        points={[]}
        triColorPoints={[
          { ts: 1000, add: 1, modify: 0, delete: 0 },
          { ts: 2000, add: 0, modify: 1, delete: 0 },
          { ts: 3000, add: 0, modify: 0, delete: 1 },
        ]}
      />
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Completed Changes')).toBeVisible()
    await waitFor(() => {
      const bars = canvasElement.querySelectorAll('[data-testid="dashboard-mini-tricolor-bar"]')
      expect(bars.length).toBeGreaterThan(1)
    })
  },
}

export const ObjectiveHistoryUnavailable: Story = {
  render: () =>
    renderReactStory(
      <div className="w-[360px]">
        <DashboardMetricCard
          label="Active Changes"
          value={3}
          icon={CheckSquare}
          availability={{ state: 'invalid', reason: 'objective-history-unavailable' }}
          trendKind="bidirectional"
          points={[]}
        />
      </div>
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Active Changes')).toBeVisible()
    await expect(await canvas.findByText('No objective historical source')).toBeVisible()
    await waitFor(() => {
      const bars = canvasElement.querySelectorAll('[data-testid="dashboard-mini-trend-bar"]')
      expect(bars.length).toBe(0)
    })
  },
}
