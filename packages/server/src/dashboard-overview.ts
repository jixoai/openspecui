/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Preserve the aggregate Dashboard compatibility projection for legacy and static callers.
 * 2. Delegate Summary, trends, and Git work to independently owned physical loaders.
 * 3. Re-export the established Dashboard Git refresh/task-status transport surface.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import type {
  ConfigManager,
  DashboardGitSnapshot,
  DashboardOverview,
  OpenSpecAdapter,
} from '@openspecui/core'
import { loadDashboardGitProjection } from './dashboard-git-projection.js'
import { loadDashboardSummary } from './dashboard-summary.js'
import { loadDashboardTrends } from './dashboard-trends.js'

/** Dependencies retained by the aggregate compatibility Dashboard loader. */
export interface DashboardOverviewLoaderContext {
  adapter: OpenSpecAdapter
  configManager: ConfigManager
  projectDir: string
  /** Stable Code binding token captured with each live Dashboard Git snapshot. */
  codeBindingToken: string
}

function createUnavailableGitSnapshot(codeBindingToken: string): DashboardGitSnapshot {
  return {
    bindingToken: codeBindingToken,
    defaultBranch: 'main',
    worktrees: [],
  }
}

/**
 * Build the historical aggregate response without reintroducing an aggregate live subscription boundary.
 * Live Dashboard routes consume the region loaders through DashboardProjectionService instead.
 */
export async function loadDashboardOverview(
  ctx: DashboardOverviewLoaderContext,
  reason = 'dashboard-refresh'
): Promise<DashboardOverview> {
  const [summary, trends, git] = await Promise.all([
    loadDashboardSummary({ adapter: ctx.adapter }),
    loadDashboardTrends({ adapter: ctx.adapter, configManager: ctx.configManager }),
    loadDashboardGitProjection(
      { projectDir: ctx.projectDir, codeBindingToken: ctx.codeBindingToken },
      reason
    ).catch(() => createUnavailableGitSnapshot(ctx.codeBindingToken)),
  ])

  return { ...summary, ...trends, git }
}

export {
  getDashboardGitTaskStatus,
  subscribeDashboardGitTaskStatus,
  touchDashboardGitRefreshStamp,
  type DashboardGitTaskStatus,
} from './dashboard-git-projection.js'
