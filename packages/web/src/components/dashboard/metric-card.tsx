import type {
  DashboardCardAvailability,
  DashboardTrendKind,
  DashboardTrendPoint,
  DashboardTriColorTrendPoint,
} from '@openspecui/core'
import type { ComponentType } from 'react'

const TREND_BAR_TARGET = 32
const BAR_HEIGHT_MIN = 0.08
const BAR_HEIGHT_MAX = 0.95

function compressTrend(values: number[], target: number): number[] {
  if (values.length <= target) return values

  const result: number[] = []
  const chunkSize = values.length / target
  for (let index = 0; index < target; index += 1) {
    const start = Math.floor(index * chunkSize)
    const end = Math.floor((index + 1) * chunkSize)
    const chunk = values.slice(start, Math.max(end, start + 1))
    const average = chunk.reduce((sum, value) => sum + value, 0) / chunk.length
    result.push(average)
  }
  return result
}

function normalizeTrend(values: number[], trendKind: DashboardTrendKind): number[] {
  if (values.length === 0) return []

  if (trendKind === 'monotonic') {
    const max = Math.max(...values)
    if (max <= 0) return values.map(() => BAR_HEIGHT_MIN)
    return values.map((value) => {
      const normalized = Math.max(0, value) / max
      return normalized * (BAR_HEIGHT_MAX - BAR_HEIGHT_MIN) + BAR_HEIGHT_MIN
    })
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return values.map(() => 0.55)
  return values.map((value) => ((value - min) / (max - min)) * 0.8 + 0.15)
}

type TrendDirection = 'up' | 'down' | 'flat'

function detectDirections(values: number[]): TrendDirection[] {
  if (values.length === 0) return []
  return values.map((value, index) => {
    if (index === 0) return 'flat'
    if (value > values[index - 1]) return 'up'
    if (value < values[index - 1]) return 'down'
    return 'flat'
  })
}

function MiniTrendBars({
  bars,
  directions,
  trendKind,
}: {
  bars: number[]
  directions: TrendDirection[]
  trendKind: DashboardTrendKind
}) {
  if (bars.length === 0) {
    return null
  }
  const renderBars = bars.length === 1 ? Array.from({ length: 12 }, () => bars[0]) : bars
  const renderDirections =
    directions.length === 1
      ? Array.from({ length: renderBars.length }, () => directions[0] ?? ('flat' as const))
      : directions

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-end gap-px px-2 py-2 opacity-50"
      data-testid="dashboard-mini-trend-bars"
    >
      {renderBars.map((height, index) => {
        const direction = renderDirections[index] ?? 'flat'
        const colorClass =
          trendKind === 'bidirectional'
            ? direction === 'up'
              ? 'bg-emerald-500/30'
              : direction === 'down'
                ? 'bg-rose-500/30'
                : 'bg-primary/25'
            : 'bg-primary/25'
        return (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className={`${colorClass} block flex-1 rounded-sm`}
            data-testid="dashboard-mini-trend-bar"
            data-direction={direction}
            style={{ height: `${Math.max(8, Math.round(height * 100))}%` }}
          />
        )
      })}
    </div>
  )
}

interface NormalizedTriColorBar {
  height: number
  addRatio: number
  modifyRatio: number
  deleteRatio: number
}

function compressTriColorTrend(
  points: DashboardTriColorTrendPoint[],
  target: number
): DashboardTriColorTrendPoint[] {
  if (points.length <= target) return points

  const result: DashboardTriColorTrendPoint[] = []
  const chunkSize = points.length / target
  for (let index = 0; index < target; index += 1) {
    const start = Math.floor(index * chunkSize)
    const end = Math.floor((index + 1) * chunkSize)
    const chunk = points.slice(start, Math.max(end, start + 1))
    const ts = chunk[chunk.length - 1]?.ts ?? points[points.length - 1]!.ts
    result.push({
      ts,
      add: chunk.reduce((sum, point) => sum + point.add, 0),
      modify: chunk.reduce((sum, point) => sum + point.modify, 0),
      delete: chunk.reduce((sum, point) => sum + point.delete, 0),
    })
  }
  return result
}

function normalizeTriColorTrend(points: DashboardTriColorTrendPoint[]): NormalizedTriColorBar[] {
  if (points.length === 0) return []

  const totals = points.map((point) => point.add + point.modify + point.delete)
  const maxTotal = Math.max(...totals)
  if (maxTotal <= 0) {
    return points.map(() => ({
      height: 0,
      addRatio: 0,
      modifyRatio: 0,
      deleteRatio: 0,
    }))
  }

  return points.map((point) => {
    const total = point.add + point.modify + point.delete
    if (total <= 0) {
      return {
        height: 0,
        addRatio: 0,
        modifyRatio: 0,
        deleteRatio: 0,
      }
    }
    return {
      height: (total / maxTotal) * (BAR_HEIGHT_MAX - BAR_HEIGHT_MIN) + BAR_HEIGHT_MIN,
      addRatio: point.add / total,
      modifyRatio: point.modify / total,
      deleteRatio: point.delete / total,
    }
  })
}

function MiniTriColorTrendBars({ bars }: { bars: NormalizedTriColorBar[] }) {
  if (bars.length === 0) return null

  const renderBars = bars.length === 1 ? Array.from({ length: 12 }, () => bars[0]!) : bars

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-end gap-px px-2 py-2 opacity-55"
      data-testid="dashboard-mini-tricolor-bars"
    >
      {renderBars.map((bar, index) => {
        const heightPercent = Math.max(0, Math.round(bar.height * 100))
        if (heightPercent <= 0) {
          return (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="bg-border/45 block min-h-px flex-1 rounded-sm"
              data-testid="dashboard-mini-tricolor-bar"
            />
          )
        }

        return (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="flex flex-1 flex-col-reverse overflow-hidden rounded-sm"
            data-testid="dashboard-mini-tricolor-bar"
            style={{ height: `${heightPercent}%`, minHeight: '1px' }}
          >
            {bar.addRatio > 0 && (
              <span className="bg-primary/40 block w-full" style={{ flexGrow: bar.addRatio }} />
            )}
            {bar.modifyRatio > 0 && (
              <span
                className="bg-secondary/55 block w-full"
                style={{ flexGrow: bar.modifyRatio }}
              />
            )}
            {bar.deleteRatio > 0 && (
              <span
                className="bg-foreground/35 block w-full"
                style={{ flexGrow: bar.deleteRatio }}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}

export function DashboardMetricCard({
  label,
  value,
  icon: Icon,
  availability,
  trendKind,
  points,
  triColorPoints = [],
  className,
}: {
  label: string
  value: string | number
  icon: ComponentType<{ className?: string }>
  availability: DashboardCardAvailability
  trendKind: DashboardTrendKind
  points: DashboardTrendPoint[]
  triColorPoints?: DashboardTriColorTrendPoint[]
  className?: string
}) {
  const compactTriColorPoints = compressTriColorTrend(triColorPoints, TREND_BAR_TARGET)
  const normalizedTriColorBars = normalizeTriColorTrend(compactTriColorPoints)
  const hasTriColorTrend = compactTriColorPoints.some(
    (point) => point.add + point.modify + point.delete > 0
  )

  const trendValues = points.map((point) => point.value)
  const compactValues = compressTrend(trendValues, TREND_BAR_TARGET)
  const normalizedBars = normalizeTrend(compactValues, trendKind)
  const directions = detectDirections(compactValues)
  const isInvalid = availability.state === 'invalid'
  const hasTrend = hasTriColorTrend || compactValues.length >= 2
  const invalidMessage =
    availability.state === 'invalid' && availability.reason === 'objective-history-unavailable'
      ? 'No objective historical source'
      : 'Insufficient computable data'

  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-4 ${
        isInvalid
          ? 'border-border from-muted/35 to-muted/5 border-dashed bg-gradient-to-br'
          : 'border-border bg-card'
      } ${className ?? ''}`}
      data-testid="dashboard-metric-card"
    >
      {!isInvalid &&
        (hasTriColorTrend ? (
          <MiniTriColorTrendBars bars={normalizedTriColorBars} />
        ) : (
          <MiniTrendBars bars={normalizedBars} directions={directions} trendKind={trendKind} />
        ))}

      <div className="relative z-10">
        <div className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {isInvalid && (
          <div
            className="text-muted-foreground mt-2 text-xs"
            data-testid="dashboard-card-invalid-note"
          >
            {invalidMessage}
          </div>
        )}
        {!isInvalid && !hasTrend && (
          <div
            className="text-muted-foreground mt-2 text-xs"
            data-testid="dashboard-card-trend-note"
          >
            No trend yet
          </div>
        )}
      </div>
    </div>
  )
}
