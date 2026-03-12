import type { ConfigManager, OpenSpecAdapter } from '@openspecui/core'
import {
  DASHBOARD_METRIC_KEYS,
  type DashboardOverview,
  type DashboardTriColorTrendPoint,
} from '@openspecui/core'
import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { buildDashboardGitSnapshot } from './dashboard-git-snapshot.js'
import { buildDashboardTimeTrends } from './dashboard-time-trends.js'

const execFileAsync = promisify(execFile)
const DASHBOARD_GIT_REFRESH_STAMP_NAME = 'openspecui-dashboard-git-refresh.stamp'

export interface DashboardOverviewLoaderContext {
  adapter: OpenSpecAdapter
  configManager: ConfigManager
  projectDir: string
}

export interface DashboardGitTaskStatus {
  running: boolean
  inFlight: number
  lastStartedAt: number | null
  lastFinishedAt: number | null
  lastReason: string | null
  lastError: string | null
}

const dashboardGitTaskStatusEmitter = new EventEmitter()
dashboardGitTaskStatusEmitter.setMaxListeners(200)

const dashboardGitTaskStatus: DashboardGitTaskStatus = {
  running: false,
  inFlight: 0,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastReason: null,
  lastError: null,
}

function createEmptyTriColorTrends(): Record<
  keyof DashboardOverview['triColorTrends'],
  DashboardTriColorTrendPoint[]
> {
  return Object.fromEntries(
    DASHBOARD_METRIC_KEYS.map((metric) => [metric, [] as DashboardTriColorTrendPoint[]])
  ) as Record<keyof DashboardOverview['triColorTrends'], DashboardTriColorTrendPoint[]>
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
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const ts = Date.UTC(year, month - 1, day)
  return Number.isFinite(ts) ? ts : null
}

async function readLatestCommitTimestamp(projectDir: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%ct'], {
      cwd: projectDir,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8',
    })
    const seconds = Number(stdout.trim())
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null
  } catch {
    return null
  }
}

function emitDashboardGitTaskStatus(): void {
  dashboardGitTaskStatusEmitter.emit('change', getDashboardGitTaskStatus())
}

function beginDashboardGitTask(reason: string): void {
  dashboardGitTaskStatus.inFlight += 1
  dashboardGitTaskStatus.running = true
  dashboardGitTaskStatus.lastStartedAt = Date.now()
  dashboardGitTaskStatus.lastReason = reason
  dashboardGitTaskStatus.lastError = null
  emitDashboardGitTaskStatus()
}

function endDashboardGitTask(error: unknown): void {
  dashboardGitTaskStatus.inFlight = Math.max(0, dashboardGitTaskStatus.inFlight - 1)
  dashboardGitTaskStatus.running = dashboardGitTaskStatus.inFlight > 0
  dashboardGitTaskStatus.lastFinishedAt = Date.now()
  if (error) {
    dashboardGitTaskStatus.lastError = error instanceof Error ? error.message : String(error)
  }
  emitDashboardGitTaskStatus()
}

export function getDashboardGitTaskStatus(): DashboardGitTaskStatus {
  return { ...dashboardGitTaskStatus }
}

export function subscribeDashboardGitTaskStatus(
  listener: (status: DashboardGitTaskStatus) => void
): () => void {
  dashboardGitTaskStatusEmitter.on('change', listener)
  return () => {
    dashboardGitTaskStatusEmitter.off('change', listener)
  }
}

async function resolveGitMetadataDir(projectDir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--git-dir'], {
      cwd: projectDir,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8',
    })
    const gitDirRaw = stdout.trim()
    if (!gitDirRaw) return null
    const gitDirPath = resolve(projectDir, gitDirRaw)
    const gitDirStat = await stat(gitDirPath)
    if (!gitDirStat.isDirectory()) return null
    return gitDirPath
  } catch {
    return null
  }
}

function getDashboardGitRefreshStampPath(gitMetadataDir: string): string {
  return join(gitMetadataDir, DASHBOARD_GIT_REFRESH_STAMP_NAME)
}

export async function touchDashboardGitRefreshStamp(
  projectDir: string,
  reason: string
): Promise<{ skipped: boolean }> {
  const gitMetadataDir = await resolveGitMetadataDir(projectDir)
  if (!gitMetadataDir) {
    return { skipped: true }
  }

  const stampPath = getDashboardGitRefreshStampPath(gitMetadataDir)
  await mkdir(dirname(stampPath), { recursive: true })
  await writeFile(stampPath, `${Date.now()} ${reason}\n`, 'utf8')
  return { skipped: false }
}

export async function loadDashboardOverview(
  ctx: DashboardOverviewLoaderContext,
  reason = 'dashboard-refresh'
): Promise<DashboardOverview> {
  const now = Date.now()
  const [specMetas, changeMetas, archiveMetas] = await Promise.all([
    ctx.adapter.listSpecsWithMeta(),
    ctx.adapter.listChangesWithMeta(),
    ctx.adapter.listArchivedChangesWithMeta(),
  ])

  const activeChanges = changeMetas
    .map((changeMeta) => ({
      id: changeMeta.id,
      name: changeMeta.name ?? changeMeta.id,
      progress: changeMeta.progress,
      updatedAt: changeMeta.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const archivedChanges = (
    await Promise.all(
      archiveMetas.map(async (meta) => {
        const change = await ctx.adapter.readArchivedChange(meta.id)
        if (!change) return null
        return {
          id: meta.id,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          tasksCompleted: change.tasks.filter((task) => task.completed).length,
        }
      })
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null)

  const specifications = (
    await Promise.all(
      specMetas.map(async (meta) => {
        const spec = await ctx.adapter.readSpec(meta.id)
        if (!spec) return null
        return {
          id: meta.id,
          name: meta.name,
          requirements: spec.requirements.length,
          updatedAt: meta.updatedAt,
        }
      })
    )
  )
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.requirements - a.requirements || b.updatedAt - a.updatedAt)

  const requirements = specifications.reduce((sum, spec) => sum + spec.requirements, 0)
  const tasksTotal = activeChanges.reduce((sum, change) => sum + change.progress.total, 0)
  const tasksCompleted = activeChanges.reduce((sum, change) => sum + change.progress.completed, 0)
  const archivedTasksCompleted = archivedChanges.reduce(
    (sum, change) => sum + change.tasksCompleted,
    0
  )
  const taskCompletionPercent =
    tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : null
  const inProgressChanges = activeChanges.filter(
    (change) => change.progress.total > 0 && change.progress.completed < change.progress.total
  ).length

  const specificationTrendEvents = specMetas.flatMap((spec) => {
    const ts = resolveTrendTimestamp(spec.createdAt, spec.updatedAt)
    return ts === null ? [] : [{ ts, value: 1 }]
  })
  const completedTrendEvents = archivedChanges.flatMap((archive) => {
    const ts =
      parseDatedIdTimestamp(archive.id) ??
      resolveTrendTimestamp(archive.updatedAt, archive.createdAt)
    return ts === null ? [] : [{ ts, value: archive.tasksCompleted }]
  })
  const specMetaById = new Map(specMetas.map((meta) => [meta.id, meta] as const))
  const requirementTrendEvents = specifications.flatMap((spec) => {
    const meta = specMetaById.get(spec.id)
    const ts = resolveTrendTimestamp(meta?.updatedAt, meta?.createdAt)
    return ts === null ? [] : [{ ts, value: spec.requirements }]
  })
  const hasObjectiveSpecificationTrend =
    specificationTrendEvents.length > 0 || specifications.length === 0
  const hasObjectiveRequirementTrend = requirementTrendEvents.length > 0 || requirements === 0
  const hasObjectiveCompletedTrend = completedTrendEvents.length > 0 || archiveMetas.length === 0
  const config = await ctx.configManager.readConfig()

  beginDashboardGitTask(reason)
  let latestCommitTs: number | null = null
  let git: DashboardOverview['git']

  try {
    const gitSnapshotPromise = buildDashboardGitSnapshot({
      projectDir: ctx.projectDir,
    }).catch(() => ({
      defaultBranch: 'main',
      worktrees: [],
    }))
    latestCommitTs = await readLatestCommitTimestamp(ctx.projectDir)
    git = await gitSnapshotPromise
  } catch (error) {
    endDashboardGitTask(error)
    throw error
  }
  endDashboardGitTask(null)

  const cardAvailability: DashboardOverview['cardAvailability'] = {
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
  const trendKinds: DashboardOverview['trendKinds'] = {
    specifications: 'monotonic',
    requirements: 'monotonic',
    activeChanges: 'bidirectional',
    inProgressChanges: 'bidirectional',
    completedChanges: 'monotonic',
    taskCompletionPercent: 'bidirectional',
  }

  const { trends: baselineTrends, trendMeta } = buildDashboardTimeTrends({
    pointLimit: config.dashboard.trendPointLimit,
    timestamp: now,
    rightEdgeTs: latestCommitTs,
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
    summary: {
      specifications: specifications.length,
      requirements,
      activeChanges: activeChanges.length,
      inProgressChanges,
      completedChanges: archiveMetas.length,
      archivedTasksCompleted,
      tasksTotal,
      tasksCompleted,
      taskCompletionPercent,
    },
    trends: baselineTrends,
    triColorTrends: createEmptyTriColorTrends(),
    trendKinds,
    cardAvailability,
    trendMeta,
    specifications,
    activeChanges,
    git,
  }
}
