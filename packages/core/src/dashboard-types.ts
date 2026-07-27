/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Define Dashboard metrics, trends, planning projections, and Git snapshot contracts.
 * 2. Preserve backend-issued Code binding provenance on live Git snapshots.
 * 3. Split independently refreshable Summary and Trends facts from the aggregate Dashboard compatibility view.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 binds Dashboard snapshots to their Code token.
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { z } from 'zod'
import { TrackedTaskProgressSchema } from './schemas.js'
import type { TrackedTaskProgress } from './task-progress.js'

export const DASHBOARD_METRIC_KEYS = [
  'specifications',
  'requirements',
  'activeChanges',
  'inProgressChanges',
  'completedChanges',
  'taskCompletionPercent',
] as const

export type DashboardMetricKey = (typeof DASHBOARD_METRIC_KEYS)[number]

export interface DashboardTrendPoint {
  ts: number
  value: number
}

export interface DashboardTriColorTrendPoint {
  ts: number
  add: number
  modify: number
  delete: number
}

export type DashboardTrendKind = 'monotonic' | 'bidirectional'

export interface DashboardTrendMeta {
  pointLimit: number
  lastUpdatedAt: number
}

export type DashboardCardAvailability =
  | { state: 'ok' }
  | {
      state: 'invalid'
      reason: 'semantic-uncomputable' | 'objective-history-unavailable'
    }

export interface DashboardSummary {
  specifications: number
  requirements: number
  activeChanges: number
  inProgressChanges: number
  completedChanges: number
  archivedTasksCompleted: number
  tasksTotal: number
  tasksCompleted: number
  taskCompletionPercent: number | null
}

export interface DashboardGitDiffStats {
  files: number
  insertions: number
  deletions: number
}

export interface DashboardGitCommitEntry {
  type: 'commit'
  hash: string
  title: string
  committedAt: number
  relatedChanges: string[]
  diff: DashboardGitDiffStats
}

export interface DashboardGitUncommittedEntry {
  type: 'uncommitted'
  title: string
  updatedAt: number | null
  relatedChanges: string[]
  diff: DashboardGitDiffStats
}

export type DashboardGitEntry = DashboardGitCommitEntry | DashboardGitUncommittedEntry

export interface DashboardGitWorktree {
  path: string
  relativePath: string
  pathAvailable: boolean
  branchName: string
  detached: boolean
  isCurrent: boolean
  ahead: number
  behind: number
  diff: DashboardGitDiffStats
  entries: DashboardGitEntry[]
}

export interface DashboardGitSnapshot {
  /** Code binding provenance; null means static data has no live backend binding. */
  bindingToken: string | null
  defaultBranch: string
  worktrees: DashboardGitWorktree[]
}

/** Stable first-screen planning facts, intentionally independent from Git and historical trend work. */
export interface DashboardSummaryProjection {
  summary: DashboardSummary
  specifications: Array<{
    id: string
    name: string
    requirements: number
    updatedAt: number
  }>
  activeChanges: Array<{
    id: string
    name: string
    trackedTaskProgress: TrackedTaskProgress
    updatedAt: number
  }>
}

/** Optional historical facts whose latency or failure must not hide a stable Dashboard Summary. */
export interface DashboardTrendsProjection {
  trends: Record<DashboardMetricKey, DashboardTrendPoint[]>
  triColorTrends: Record<DashboardMetricKey, DashboardTriColorTrendPoint[]>
  trendKinds: Record<DashboardMetricKey, DashboardTrendKind>
  cardAvailability: Record<DashboardMetricKey, DashboardCardAvailability>
  trendMeta: DashboardTrendMeta
}

/** Aggregate compatibility projection for static exports and legacy callers. */
export interface DashboardOverview extends DashboardSummaryProjection, DashboardTrendsProjection {
  git: DashboardGitSnapshot
}

const DashboardTrendPointSchema = z.object({
  ts: z.number(),
  value: z.number(),
})

const DashboardTriColorTrendPointSchema = z.object({
  ts: z.number(),
  add: z.number(),
  modify: z.number(),
  delete: z.number(),
})

const DashboardTrendRecordSchema = z.object({
  specifications: z.array(DashboardTrendPointSchema),
  requirements: z.array(DashboardTrendPointSchema),
  activeChanges: z.array(DashboardTrendPointSchema),
  inProgressChanges: z.array(DashboardTrendPointSchema),
  completedChanges: z.array(DashboardTrendPointSchema),
  taskCompletionPercent: z.array(DashboardTrendPointSchema),
})

const DashboardTriColorTrendRecordSchema = z.object({
  specifications: z.array(DashboardTriColorTrendPointSchema),
  requirements: z.array(DashboardTriColorTrendPointSchema),
  activeChanges: z.array(DashboardTriColorTrendPointSchema),
  inProgressChanges: z.array(DashboardTriColorTrendPointSchema),
  completedChanges: z.array(DashboardTriColorTrendPointSchema),
  taskCompletionPercent: z.array(DashboardTriColorTrendPointSchema),
})

const DashboardTrendKindsSchema = z.object({
  specifications: z.enum(['monotonic', 'bidirectional']),
  requirements: z.enum(['monotonic', 'bidirectional']),
  activeChanges: z.enum(['monotonic', 'bidirectional']),
  inProgressChanges: z.enum(['monotonic', 'bidirectional']),
  completedChanges: z.enum(['monotonic', 'bidirectional']),
  taskCompletionPercent: z.enum(['monotonic', 'bidirectional']),
})

const DashboardCardAvailabilitySchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('ok') }),
  z.object({
    state: z.literal('invalid'),
    reason: z.enum(['semantic-uncomputable', 'objective-history-unavailable']),
  }),
])

const DashboardCardAvailabilityRecordSchema = z.object({
  specifications: DashboardCardAvailabilitySchema,
  requirements: DashboardCardAvailabilitySchema,
  activeChanges: DashboardCardAvailabilitySchema,
  inProgressChanges: DashboardCardAvailabilitySchema,
  completedChanges: DashboardCardAvailabilitySchema,
  taskCompletionPercent: DashboardCardAvailabilitySchema,
})

const DashboardSummarySchema = z.object({
  specifications: z.number(),
  requirements: z.number(),
  activeChanges: z.number(),
  inProgressChanges: z.number(),
  completedChanges: z.number(),
  archivedTasksCompleted: z.number(),
  tasksTotal: z.number(),
  tasksCompleted: z.number(),
  taskCompletionPercent: z.number().nullable(),
})

const DashboardGitDiffStatsSchema = z.object({
  files: z.number(),
  insertions: z.number(),
  deletions: z.number(),
})

const DashboardGitEntrySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('commit'),
    hash: z.string(),
    title: z.string(),
    committedAt: z.number(),
    relatedChanges: z.array(z.string()),
    diff: DashboardGitDiffStatsSchema,
  }),
  z.object({
    type: z.literal('uncommitted'),
    title: z.string(),
    updatedAt: z.number().nullable(),
    relatedChanges: z.array(z.string()),
    diff: DashboardGitDiffStatsSchema,
  }),
])

const DashboardGitWorktreeSchema = z.object({
  path: z.string(),
  relativePath: z.string(),
  pathAvailable: z.boolean(),
  branchName: z.string(),
  detached: z.boolean(),
  isCurrent: z.boolean(),
  ahead: z.number(),
  behind: z.number(),
  diff: DashboardGitDiffStatsSchema,
  entries: z.array(DashboardGitEntrySchema),
})

export const DashboardGitSnapshotSchema = z.object({
  bindingToken: z.string().nullable(),
  defaultBranch: z.string(),
  worktrees: z.array(DashboardGitWorktreeSchema),
}) satisfies z.ZodType<DashboardGitSnapshot>

export const DashboardSummaryProjectionSchema = z.object({
  summary: DashboardSummarySchema,
  specifications: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      requirements: z.number(),
      updatedAt: z.number(),
    })
  ),
  activeChanges: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      trackedTaskProgress: TrackedTaskProgressSchema,
      updatedAt: z.number(),
    })
  ),
}) satisfies z.ZodType<DashboardSummaryProjection>

export const DashboardTrendsProjectionSchema = z.object({
  trends: DashboardTrendRecordSchema,
  triColorTrends: DashboardTriColorTrendRecordSchema,
  trendKinds: DashboardTrendKindsSchema,
  cardAvailability: DashboardCardAvailabilityRecordSchema,
  trendMeta: z.object({
    pointLimit: z.number(),
    lastUpdatedAt: z.number(),
  }),
}) satisfies z.ZodType<DashboardTrendsProjection>

export const DashboardOverviewSchema = DashboardSummaryProjectionSchema.merge(
  DashboardTrendsProjectionSchema
).extend({ git: DashboardGitSnapshotSchema }) satisfies z.ZodType<DashboardOverview>
