/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Load stable Dashboard Summary facts required for the first useful Dashboard render.
 * 2. Keep Summary independent from Git, trend configuration, and OPSX workflow work.
 * 3. Preserve exact tracked-task facts while selecting bounded recent lists.
 * 4. Derive objective Kanban phase counts and recent archives from the same Adapter read.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-28): replace Dashboard Workflow Progress with ReadonlyKanban.
 */
import type {
  ArchiveMeta,
  CliChangeListEntry,
  DashboardSummaryProjection,
  OpenSpecAdapter,
  SpecMeta,
} from '@openspecui/core'
import {
  resolveArchiveTimestamp,
  selectRecentDashboardArchives,
  selectRecentDashboardItems,
} from '../../core/src/dashboard-display.js'

/** Raw planning facts shared by Summary and optional trend calculations inside one loader invocation. */
export interface DashboardPlanningFacts {
  specMetas: SpecMeta[]
  archiveMetas: ArchiveMeta[]
  allSpecifications: DashboardSummaryProjection['specifications']
  allActiveChanges: DashboardSummaryProjection['activeChanges']
}

/** Dependencies for reading stable Dashboard planning facts. */
export interface DashboardSummaryLoaderContext {
  adapter: OpenSpecAdapter
  /**
   * CLI-reported Change-list task facts when the planning CLI projection is observable.
   * Optional: without it rows carry a null cliTaskSummary, never a UI-side recomputation.
   */
  readCliChangeListEntries?: () => Promise<Map<string, CliChangeListEntry>>
}

/** Read the objective files behind Dashboard Summary without invoking Git or workflow commands. */
export async function loadDashboardPlanningFacts(
  ctx: DashboardSummaryLoaderContext
): Promise<DashboardPlanningFacts> {
  const [specMetas, changeMetas, archiveMetas, cliEntries] = await Promise.all([
    ctx.adapter.listSpecsWithMeta(),
    ctx.adapter.listChangesWithMeta(),
    ctx.adapter.listArchivedChangesWithMeta(),
    ctx.readCliChangeListEntries?.().catch(() => new Map<string, CliChangeListEntry>()) ??
      Promise.resolve(new Map<string, CliChangeListEntry>()),
  ])
  const allActiveChanges = changeMetas.map((changeMeta) => {
    const entry = cliEntries.get(changeMeta.id)
    return {
      id: changeMeta.id,
      name: changeMeta.name ?? changeMeta.id,
      trackedTaskProgress: changeMeta.trackedTaskProgress,
      cliTaskSummary: entry
        ? {
            completedTasks: entry.completedTasks,
            totalTasks: entry.totalTasks,
            status: entry.status,
          }
        : changeMeta.cliTaskSummary,
      updatedAt: changeMeta.updatedAt,
    }
  })
  const allSpecifications = (
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
  ).filter((item): item is NonNullable<typeof item> => item !== null)

  return { specMetas, archiveMetas, allSpecifications, allActiveChanges }
}

/** Derive the first-screen projection from already-read planning facts. */
export function buildDashboardSummaryProjection(
  facts: DashboardPlanningFacts
): DashboardSummaryProjection {
  const requirements = facts.allSpecifications.reduce((sum, spec) => sum + spec.requirements, 0)
  const tasksTotal = facts.allActiveChanges.reduce(
    (sum, change) => sum + change.trackedTaskProgress.total,
    0
  )
  const tasksCompleted = facts.allActiveChanges.reduce(
    (sum, change) => sum + change.trackedTaskProgress.completed,
    0
  )
  const archivedTasksCompleted = facts.archiveMetas.reduce(
    (sum, archive) => sum + archive.trackedTaskProgress.completed,
    0
  )
  const taskCompletionPercent =
    tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : null
  const inProgressChanges = facts.allActiveChanges.filter(
    (change) => change.trackedTaskProgress.phase === 'in-progress'
  ).length
  const trackedTaskPhaseCounts: DashboardSummaryProjection['trackedTaskPhaseCounts'] = {
    'no-tasks': 0,
    'in-progress': 0,
    complete: 0,
  }
  for (const change of facts.allActiveChanges) {
    trackedTaskPhaseCounts[change.trackedTaskProgress.phase] += 1
  }
  const recentArchives = selectRecentDashboardArchives(facts.archiveMetas).map((archive) => ({
    id: archive.id,
    name: archive.name,
    trackedTaskProgress: archive.trackedTaskProgress,
    archivedAt: resolveArchiveTimestamp(archive),
    updatedAt: archive.updatedAt,
  }))

  return {
    summary: {
      specifications: facts.allSpecifications.length,
      requirements,
      activeChanges: facts.allActiveChanges.length,
      inProgressChanges,
      completedChanges: facts.archiveMetas.length,
      archivedTasksCompleted,
      tasksTotal,
      tasksCompleted,
      taskCompletionPercent,
    },
    specifications: selectRecentDashboardItems(facts.allSpecifications),
    activeChanges: selectRecentDashboardItems(facts.allActiveChanges),
    trackedTaskPhaseCounts,
    recentArchives,
  }
}

/** Load the first stable Dashboard projection. */
export async function loadDashboardSummary(
  ctx: DashboardSummaryLoaderContext
): Promise<DashboardSummaryProjection> {
  return buildDashboardSummaryProjection(await loadDashboardPlanningFacts(ctx))
}
