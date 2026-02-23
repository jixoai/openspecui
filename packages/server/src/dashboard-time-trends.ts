import type {
  DashboardCardAvailability,
  DashboardMetricKey,
  DashboardTrendMeta,
  DashboardTrendPoint,
} from '@openspecui/core'
import { DASHBOARD_METRIC_KEYS } from '@openspecui/core'

type DashboardTrendSeriesMap = Record<DashboardMetricKey, DashboardTrendPoint[]>
type DashboardAvailabilityMap = Record<DashboardMetricKey, DashboardCardAvailability>
type TrendReducer = 'sum' | 'sum-cumulative' | 'avg-carry'

export interface DashboardTrendEvent {
  ts: number
  value: number
}

const MIN_TREND_POINT_LIMIT = 20
const MAX_TREND_POINT_LIMIT = 500
const DEFAULT_TREND_POINT_LIMIT = 100
const TARGET_TREND_BARS = 20
const DAY_MS = 24 * 60 * 60 * 1000

function clampPointLimit(pointLimit: number): number {
  if (!Number.isFinite(pointLimit)) return DEFAULT_TREND_POINT_LIMIT
  return Math.max(MIN_TREND_POINT_LIMIT, Math.min(MAX_TREND_POINT_LIMIT, Math.trunc(pointLimit)))
}

function createEmptyTrendSeries(): DashboardTrendSeriesMap {
  return Object.fromEntries(
    DASHBOARD_METRIC_KEYS.map((metric) => [metric, [] as DashboardTrendPoint[]])
  ) as DashboardTrendSeriesMap
}

function normalizeEvents(events: DashboardTrendEvent[], pointLimit: number): DashboardTrendEvent[] {
  return events
    .filter((event) => Number.isFinite(event.ts) && event.ts > 0 && Number.isFinite(event.value))
    .sort((a, b) => a.ts - b.ts)
    .slice(-pointLimit)
}

function buildTimeWindow(options: {
  probeEvents: DashboardTrendEvent[]
  targetBars: number
  rightEdgeTs?: number | null
}): { windowStart: number; bucketMs: number; bucketEnds: number[] } | null {
  const { probeEvents, targetBars, rightEdgeTs } = options
  if (probeEvents.length === 0) return null

  const probeEnd = probeEvents[probeEvents.length - 1]!.ts
  const hasExplicitRightEdge =
    typeof rightEdgeTs === 'number' && Number.isFinite(rightEdgeTs) && rightEdgeTs > 0
  const end = hasExplicitRightEdge ? Math.max(probeEnd, rightEdgeTs) : probeEnd
  const probeStart = probeEvents[0]!.ts
  const rangeMs = Math.max(1, end - probeStart)

  // Prefer day-based buckets for real project timelines; fallback to raw ms for very dense ranges.
  const bucketMs =
    rangeMs >= DAY_MS
      ? Math.max(DAY_MS, Math.ceil(rangeMs / targetBars / DAY_MS) * DAY_MS)
      : Math.max(1, Math.ceil(rangeMs / targetBars))

  const windowStart = end - bucketMs * targetBars
  const bucketEnds = Array.from(
    { length: targetBars },
    (_, index) => windowStart + bucketMs * (index + 1)
  )
  return { windowStart, bucketMs, bucketEnds }
}

function bucketizeTrend(
  events: DashboardTrendEvent[],
  reducer: TrendReducer,
  rightEdgeTs?: number | null
): DashboardTrendPoint[] {
  if (events.length === 0) {
    return []
  }

  const timeWindow = buildTimeWindow({
    probeEvents: events,
    targetBars: TARGET_TREND_BARS,
    rightEdgeTs,
  })
  if (!timeWindow) return []

  const { windowStart, bucketMs, bucketEnds } = timeWindow
  const sums = Array.from({ length: bucketEnds.length }, () => 0)
  const counts = Array.from({ length: bucketEnds.length }, () => 0)
  let baseline = 0

  for (const event of events) {
    if (event.ts <= windowStart) {
      if (reducer === 'sum-cumulative') {
        baseline += event.value
      }
      continue
    }

    const offset = event.ts - windowStart
    const index = Math.max(0, Math.min(bucketEnds.length - 1, Math.ceil(offset / bucketMs) - 1))
    sums[index] += event.value
    counts[index] += 1
  }

  let cumulative = baseline
  let carry = baseline !== 0 ? baseline : events[0]!.value

  return bucketEnds.map((ts, index) => {
    if (reducer === 'sum') {
      return { ts, value: sums[index] }
    }

    if (reducer === 'sum-cumulative') {
      cumulative += sums[index]
      return { ts, value: cumulative }
    }

    if (counts[index] > 0) {
      carry = sums[index] / counts[index]
    }

    return { ts, value: carry }
  })
}

export function buildDashboardTimeTrends(options: {
  pointLimit: number
  timestamp: number
  rightEdgeTs?: number | null
  availability: DashboardAvailabilityMap
  events: Record<DashboardMetricKey, DashboardTrendEvent[]>
  reducers?: Partial<Record<DashboardMetricKey, TrendReducer>>
}): { trends: DashboardTrendSeriesMap; trendMeta: DashboardTrendMeta } {
  const pointLimit = clampPointLimit(options.pointLimit)
  const trends = createEmptyTrendSeries()

  for (const metric of DASHBOARD_METRIC_KEYS) {
    if (options.availability[metric].state !== 'ok') {
      continue
    }

    const normalizedEvents = normalizeEvents(options.events[metric], pointLimit)
    const reducer = options.reducers?.[metric] ?? 'sum'
    trends[metric] = bucketizeTrend(normalizedEvents, reducer, options.rightEdgeTs)
  }

  return {
    trends,
    trendMeta: {
      pointLimit,
      lastUpdatedAt: options.timestamp,
    },
  }
}
