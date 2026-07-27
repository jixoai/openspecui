/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Load optional Dashboard historical trend facts independently from first-screen Summary.
 * 2. Preserve objective availability and tracked-artifact semantics for each metric.
 * 3. Keep trend configuration and timeline calculation outside Git snapshot delivery.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import {
  DASHBOARD_METRIC_KEYS,
  type ConfigManager,
  type DashboardTrendsProjection,
  type DashboardTriColorTrendPoint,
  type OpenSpecAdapter,
} from '@openspecui/core'
import { loadDashboardPlanningFacts } from './dashboard-summary.js'
import { buildDashboardTimeTrends } from './dashboard-time-trends.js'

/** Dependencies for optional Dashboard trend computation. */
export interface DashboardTrendsLoaderContext {
  adapter: OpenSpecAdapter
  configManager: ConfigManager
  now?: () => number
}

function createEmptyTriColorTrends(): DashboardTrendsProjection['triColorTrends'] {
  return Object.fromEntries(
    DASHBOARD_METRIC_KEYS.map((metric) => [metric, [] as DashboardTriColorTrendPoint[]])
  ) as DashboardTrendsProjection['triColorTrends']
}

function resolveTrendTimestamp(
  primary: number | undefined,
  secondary: number | undefined
): number | null {
  if (typeof primary === 'number' && Number.isFinite(primary) && primary > 0) return primary
  if (typeof secondary === 'number' && Number.isFinite(secondary) && secondary > 0) return secondary
  return null
}

function parseDatedIdTimestamp(id: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:-|$)/.exec(id)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const timestamp = Date.UTC(year, month - 1, day)
  return Number.isFinite(timestamp) ? timestamp : null
}

/** Load optional historical Dashboard facts without waiting for a Git snapshot. */
export async function loadDashboardTrends(
  ctx: DashboardTrendsLoaderContext
): Promise<DashboardTrendsProjection> {
  const [facts, config] = await Promise.all([
    loadDashboardPlanningFacts({ adapter: ctx.adapter }),
    ctx.configManager.readConfig(),
  ])
  const specificationTrendEvents = facts.specMetas.flatMap((spec) => {
    const timestamp = resolveTrendTimestamp(spec.createdAt, spec.updatedAt)
    return timestamp === null ? [] : [{ ts: timestamp, value: 1 }]
  })
  const completedTrendEvents = facts.archiveMetas.flatMap((archive) => {
    const timestamp =
      parseDatedIdTimestamp(archive.id) ??
      resolveTrendTimestamp(archive.updatedAt, archive.createdAt)
    return timestamp === null ? [] : [{ ts: timestamp, value: 1 }]
  })
  const specMetaById = new Map(facts.specMetas.map((meta) => [meta.id, meta] as const))
  const requirementTrendEvents = facts.allSpecifications.flatMap((spec) => {
    const meta = specMetaById.get(spec.id)
    const timestamp = resolveTrendTimestamp(meta?.updatedAt, meta?.createdAt)
    return timestamp === null ? [] : [{ ts: timestamp, value: spec.requirements }]
  })
  const requirements = facts.allSpecifications.reduce((sum, spec) => sum + spec.requirements, 0)
  const tasksTotal = facts.allActiveChanges.reduce(
    (sum, change) => sum + change.trackedTaskProgress.total,
    0
  )
  const tasksCompleted = facts.allActiveChanges.reduce(
    (sum, change) => sum + change.trackedTaskProgress.completed,
    0
  )
  const taskCompletionPercent =
    tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : null
  const hasObjectiveSpecificationTrend =
    specificationTrendEvents.length > 0 || facts.allSpecifications.length === 0
  const hasObjectiveRequirementTrend = requirementTrendEvents.length > 0 || requirements === 0
  const hasObjectiveCompletedTrend =
    completedTrendEvents.length > 0 || facts.archiveMetas.length === 0
  const cardAvailability: DashboardTrendsProjection['cardAvailability'] = {
    specifications: hasObjectiveSpecificationTrend
      ? { state: 'ok' }
      : { state: 'invalid', reason: 'objective-history-unavailable' },
    requirements: hasObjectiveRequirementTrend
      ? { state: 'ok' }
      : { state: 'invalid', reason: 'objective-history-unavailable' },
    activeChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
    inProgressChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
    completedChanges: hasObjectiveCompletedTrend
      ? { state: 'ok' }
      : { state: 'invalid', reason: 'objective-history-unavailable' },
    taskCompletionPercent: {
      state: 'invalid',
      reason:
        taskCompletionPercent === null ? 'semantic-uncomputable' : 'objective-history-unavailable',
    },
  }
  const trendKinds: DashboardTrendsProjection['trendKinds'] = {
    specifications: 'monotonic',
    requirements: 'monotonic',
    activeChanges: 'bidirectional',
    inProgressChanges: 'bidirectional',
    completedChanges: 'monotonic',
    taskCompletionPercent: 'bidirectional',
  }
  const { trends, trendMeta } = buildDashboardTimeTrends({
    pointLimit: config.dashboard.trendPointLimit,
    timestamp: ctx.now?.() ?? Date.now(),
    availability: cardAvailability,
    events: {
      specifications: specificationTrendEvents,
      requirements: requirementTrendEvents,
      activeChanges: [],
      inProgressChanges: [],
      completedChanges: completedTrendEvents,
      taskCompletionPercent: [],
    },
    reducers: {
      specifications: 'sum',
      requirements: 'sum',
      completedChanges: 'sum',
    },
  })

  return {
    trends,
    triColorTrends: createEmptyTriColorTrends(),
    trendKinds,
    cardAvailability,
    trendMeta,
  }
}
