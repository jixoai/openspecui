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
  relatedChanges: string[]
  diff: DashboardGitDiffStats
}

export interface DashboardGitUncommittedEntry {
  type: 'uncommitted'
  title: string
  relatedChanges: string[]
  diff: DashboardGitDiffStats
}

export type DashboardGitEntry = DashboardGitCommitEntry | DashboardGitUncommittedEntry

export interface DashboardGitWorktree {
  path: string
  relativePath: string
  branchName: string
  isCurrent: boolean
  ahead: number
  behind: number
  diff: DashboardGitDiffStats
  entries: DashboardGitEntry[]
}

export interface DashboardGitSnapshot {
  defaultBranch: string
  worktrees: DashboardGitWorktree[]
}

export interface DashboardOverview {
  summary: DashboardSummary
  trends: Record<DashboardMetricKey, DashboardTrendPoint[]>
  triColorTrends: Record<DashboardMetricKey, DashboardTriColorTrendPoint[]>
  trendKinds: Record<DashboardMetricKey, DashboardTrendKind>
  cardAvailability: Record<DashboardMetricKey, DashboardCardAvailability>
  trendMeta: DashboardTrendMeta
  specifications: Array<{
    id: string
    name: string
    requirements: number
    updatedAt: number
  }>
  activeChanges: Array<{
    id: string
    name: string
    progress: { total: number; completed: number }
    updatedAt: number
  }>
  git: DashboardGitSnapshot
}
