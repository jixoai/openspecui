/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Render independent Dashboard Summary, objective Kanban, trends, and Code Git projections.
 * 2. Keep Dashboard-owned Code Git actions separate from Planning-root readiness.
 * 3. Carry the Code Git binding token through dashboard detail handoff navigation.
 * 4. Bind refresh and detached-worktree removal to the rendered Code snapshot generation.
 * 5. Retain stable regional snapshots beside their own loading, updating, and error evidence.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-19): Checkpoint 6.11 preserves Git handoff and action provenance.
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Original request (2026-07-28): replace Dashboard Workflow Progress with ReadonlyKanban.
 * Original request (2026-07-31): "dashboard.refreshGitSnapshot?batch=1 这个请求一直在阻塞其它任务，这个不是只读吗"
 */
import { Badge } from '@/components/badge'
import { DashboardContextSummary } from '@/components/dashboard/context-summary'
import { DashboardGitRefreshControl } from '@/components/dashboard/git-refresh-control'
import { DashboardMetricCard } from '@/components/dashboard/metric-card'
import {
  getGitEntrySharedDescriptor,
  getGitEntrySharedHandoff,
  GIT_WORKTREE_LINE_CLASS,
  GitEntryRow,
  isHttpUrl,
  WorktreeRow,
} from '@/components/git/git-shared'
import { ReadonlyKanban } from '@/components/kanban/readonly-kanban'
import {
  ChangeListSkeleton,
  DashboardSummarySkeleton,
  DashboardTrendsSkeleton,
  GitWorktreeSkeleton,
  RealtimeRevalidateCue,
} from '@/components/realtime'
import type { SelectOption } from '@/components/select'
import {
  classifyChangeWorkflowPhase,
  inferTrackedArtifactStatus,
} from '@/lib/change-workflow-phase'
import {
  getDashboardGitAutoRefreshIntervalMs,
  getDashboardGitAutoRefreshProgress,
  getDashboardGitAutoRefreshReason,
  loadDashboardGitAutoRefreshPreset,
  persistDashboardGitAutoRefreshPreset,
  sortDashboardGitEntries,
  type DashboardGitAutoRefreshPreset,
} from '@/lib/dashboard-git'
import { formatRelativeTime } from '@/lib/format-time'
import { buildGitEntryHrefFromEntry } from '@/lib/git-panel'
import { isStaticMode } from '@/lib/static-mode'
import {
  refreshDashboardGitSnapshot,
  removeDetachedDashboardWorktree,
  useDashboardGitTaskStatusSubscription,
  useDashboardOverviewSubscription,
} from '@/lib/use-dashboard'
import { useGitRepositoryScopes } from '@/lib/use-git-repository-scope'
import { useOpsxConfigBundleSubscription, useOpsxStatusListSubscription } from '@/lib/use-opsx'
import { VTLink, vtNavController } from '@/lib/view-transitions/navigation'
import {
  getSharedElementBinding,
  withSharedElementHandoffState,
} from '@/lib/view-transitions/shared-elements'
import type {
  DashboardCardAvailability,
  DashboardGitWorktree,
  DashboardMetricKey,
  DashboardTrendKind,
} from '@openspecui/core'
import { specIdentityKey } from '@openspecui/core/spec-catalog'
import {
  AlertCircle,
  Archive,
  FileText,
  GitBranch,
  LayoutDashboard,
  Sparkles,
  SquareKanban,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const GIT_AUTO_REFRESH_OPTIONS: SelectOption<DashboardGitAutoRefreshPreset>[] = [
  { value: '30s', label: '30s' },
  { value: '5min', label: '5min' },
  { value: '30min', label: '30min' },
  { value: 'none', label: 'none' },
]

export { WorktreeRow } from '@/components/git/git-shared'

function isAnimatedGitRefreshReason(reason: string | null): boolean {
  return reason === 'manual-button' || reason?.startsWith('auto-refresh:') === true
}

function formatGitActionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data
    if (typeof data === 'object' && data !== null && 'code' in data) {
      const code = data.code
      if (typeof code === 'string' && code.length > 0) return `${code}: ${message}`
    }
  }
  return message
}

function createDefaultCardAvailability(
  taskCompletionPercent: number | null
): Record<DashboardMetricKey, DashboardCardAvailability> {
  return {
    specifications: { state: 'ok' },
    requirements: { state: 'ok' },
    activeChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
    inProgressChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
    completedChanges: { state: 'ok' },
    taskCompletionPercent: {
      state: 'invalid',
      reason:
        taskCompletionPercent === null ? 'semantic-uncomputable' : 'objective-history-unavailable',
    },
  }
}

function createDefaultTrendKinds(): Record<DashboardMetricKey, DashboardTrendKind> {
  return {
    specifications: 'monotonic',
    requirements: 'monotonic',
    activeChanges: 'bidirectional',
    inProgressChanges: 'bidirectional',
    completedChanges: 'monotonic',
    taskCompletionPercent: 'bidirectional',
  }
}

export function Dashboard() {
  const staticMode = isStaticMode()
  const dashboardState = useDashboardOverviewSubscription()
  const { data: overview, isLoading, error } = dashboardState
  const summaryRegion = dashboardState.regions?.summary
  const trendsRegion = dashboardState.regions?.trends
  const gitRegion = dashboardState.regions?.git
  const summaryProjection =
    summaryRegion?.data ??
    (overview
      ? {
          summary: overview.summary,
          specifications: overview.specifications,
          activeChanges: overview.activeChanges,
          trackedTaskPhaseCounts: overview.trackedTaskPhaseCounts,
          recentArchives: overview.recentArchives,
        }
      : undefined)
  const trendsProjection =
    trendsRegion?.data ??
    (overview
      ? {
          trends: overview.trends,
          triColorTrends: overview.triColorTrends,
          trendKinds: overview.trendKinds,
          cardAvailability: overview.cardAvailability,
          trendMeta: overview.trendMeta,
        }
      : undefined)
  const dashboardGit = gitRegion?.data ?? overview?.git ?? null
  const summaryIsLoading = summaryRegion?.isLoading ?? isLoading
  const summaryIsUpdating = summaryRegion?.isUpdating ?? false
  const summaryError = summaryRegion?.error ?? error
  const trendsIsLoading = trendsRegion?.isLoading ?? (isLoading && !overview)
  const trendsIsUpdating = trendsRegion?.isUpdating ?? false
  const trendsError = trendsRegion?.error ?? (overview ? null : error)
  const gitIsLoading = gitRegion?.isLoading ?? (isLoading && !overview)
  const gitIsUpdating = gitRegion?.isUpdating ?? false
  const gitError = gitRegion?.error ?? (overview ? null : error)
  const admitSecondaryProjections = summaryProjection !== undefined
  const { data: gitScopes, authority: gitScopesAuthority } = useGitRepositoryScopes(
    !staticMode && admitSecondaryProjections
  )
  const { data: gitTaskStatus } = useDashboardGitTaskStatusSubscription()
  const { data: statuses } = useOpsxStatusListSubscription(admitSecondaryProjections)
  const { data: configBundle } = useOpsxConfigBundleSubscription(admitSecondaryProjections)
  const [gitAutoRefreshPreset, setGitAutoRefreshPreset] = useState<DashboardGitAutoRefreshPreset>(
    () => loadDashboardGitAutoRefreshPreset()
  )
  const [gitAutoRefreshCycleStartedAt, setGitAutoRefreshCycleStartedAt] = useState<number | null>(
    null
  )
  const [gitAutoRefreshNow, setGitAutoRefreshNow] = useState(() => Date.now())
  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  )
  const [gitRefreshRequest, setGitRefreshRequest] = useState<{
    reason: string
    requestedAt: number
  } | null>(null)
  const [gitActionError, setGitActionError] = useState<string | null>(null)
  const dashboardGitBindingToken =
    !staticMode &&
    gitScopesAuthority.state === 'current' &&
    dashboardGit?.bindingToken !== null &&
    dashboardGit?.bindingToken === gitScopes?.code.bindingToken
      ? (dashboardGit?.bindingToken ?? null)
      : null

  const runPropose = useCallback(() => {
    vtNavController.activatePop('/opsx-propose')
  }, [])

  const runNewChange = useCallback(() => {
    vtNavController.activatePop('/opsx-new')
  }, [])

  const triggerGitRefresh = useCallback(
    async (reason: string) => {
      if (!dashboardGitBindingToken) return
      setGitActionError(null)
      await refreshDashboardGitSnapshot(reason, dashboardGitBindingToken)
    },
    [dashboardGitBindingToken]
  )

  const [removingWorktreePath, setRemovingWorktreePath] = useState<string | null>(null)
  const gitAutoRefreshTimerRef = useRef<number | null>(null)
  const gitTaskStatusRef = useRef(gitTaskStatus)
  const gitRefreshReason = gitRefreshRequest?.reason ?? null

  const clearGitAutoRefreshTimer = useCallback(() => {
    if (gitAutoRefreshTimerRef.current === null) return
    window.clearTimeout(gitAutoRefreshTimerRef.current)
    gitAutoRefreshTimerRef.current = null
  }, [])

  const runDashboardGitRefresh = useCallback(
    (reason: string) => {
      const requestedAt = Date.now()
      setGitRefreshRequest({ reason, requestedAt })

      void triggerGitRefresh(reason)
        .then(() => {
          const latestTaskStatus = gitTaskStatusRef.current
          if (latestTaskStatus?.running) return
          setGitRefreshRequest((current) =>
            current?.reason === reason && current.requestedAt === requestedAt ? null : current
          )
        })
        .catch((err) => {
          console.error('[Dashboard] Failed to refresh git snapshot:', err)
          setGitActionError(formatGitActionError(err))
          setGitRefreshRequest((current) =>
            current?.reason === reason && current.requestedAt === requestedAt ? null : current
          )
        })
    },
    [triggerGitRefresh]
  )

  const scheduleGitAutoRefresh = useCallback(() => {
    clearGitAutoRefreshTimer()

    const intervalMs = getDashboardGitAutoRefreshIntervalMs(gitAutoRefreshPreset)
    const autoRefreshReason =
      gitAutoRefreshPreset === 'none'
        ? null
        : getDashboardGitAutoRefreshReason(gitAutoRefreshPreset)
    if (
      staticMode ||
      dashboardGitBindingToken === null ||
      intervalMs === null ||
      autoRefreshReason === null ||
      gitRefreshRequest !== null ||
      !isDocumentVisible
    ) {
      setGitAutoRefreshCycleStartedAt(null)
      return
    }

    const startedAt = Date.now()
    setGitAutoRefreshCycleStartedAt(startedAt)
    setGitAutoRefreshNow(startedAt)

    gitAutoRefreshTimerRef.current = window.setTimeout(() => {
      gitAutoRefreshTimerRef.current = null
      setGitAutoRefreshCycleStartedAt(null)
      setGitAutoRefreshNow(Date.now())
      runDashboardGitRefresh(autoRefreshReason)
    }, intervalMs)
  }, [
    clearGitAutoRefreshTimer,
    dashboardGitBindingToken,
    gitAutoRefreshPreset,
    gitRefreshRequest,
    isDocumentVisible,
    runDashboardGitRefresh,
    staticMode,
  ])

  const handleManualGitRefresh = useCallback(() => {
    if (dashboardGitBindingToken === null) return
    clearGitAutoRefreshTimer()
    setGitAutoRefreshCycleStartedAt(null)
    setGitAutoRefreshNow(Date.now())
    runDashboardGitRefresh('manual-button')
  }, [clearGitAutoRefreshTimer, dashboardGitBindingToken, runDashboardGitRefresh])

  const handleRemoveDetachedWorktree = useCallback(
    async (worktree: DashboardGitWorktree) => {
      if (
        dashboardGitBindingToken === null ||
        isStaticMode() ||
        worktree.isCurrent ||
        !worktree.detached ||
        isHttpUrl(worktree.path)
      ) {
        return
      }

      const confirmed = window.confirm(
        [
          'Remove detached worktree?',
          '',
          worktree.path,
          '',
          'This runs git worktree remove --force.',
        ].join('\n')
      )
      if (!confirmed) return

      setRemovingWorktreePath(worktree.path)
      setGitActionError(null)
      try {
        await removeDetachedDashboardWorktree(worktree.path, dashboardGitBindingToken)
      } catch (error) {
        console.error('[Dashboard] Failed to remove detached worktree:', error)
        setGitActionError(formatGitActionError(error))
        window.alert(error instanceof Error ? error.message : 'Failed to remove detached worktree.')
      } finally {
        setRemovingWorktreePath((current) => (current === worktree.path ? null : current))
      }
    },
    [dashboardGitBindingToken]
  )

  useEffect(() => {
    if (staticMode) return

    const onVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === 'visible')
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [staticMode])

  useEffect(() => {
    gitTaskStatusRef.current = gitTaskStatus
  }, [gitTaskStatus])

  useEffect(() => {
    if (!gitRefreshRequest || !gitTaskStatus) return

    const finishedAfterRequest =
      gitTaskStatus.running === false &&
      (gitTaskStatus.lastFinishedAt ?? 0) >= gitRefreshRequest.requestedAt

    if (!finishedAfterRequest) return

    setGitRefreshRequest((current) =>
      current?.reason === gitRefreshRequest.reason &&
      current.requestedAt === gitRefreshRequest.requestedAt
        ? null
        : current
    )
  }, [gitRefreshRequest, gitTaskStatus])

  useEffect(() => {
    if (staticMode) return
    persistDashboardGitAutoRefreshPreset(gitAutoRefreshPreset)
  }, [gitAutoRefreshPreset, staticMode])

  useEffect(() => {
    if (staticMode) return
    scheduleGitAutoRefresh()
    return () => {
      clearGitAutoRefreshTimer()
    }
  }, [clearGitAutoRefreshTimer, scheduleGitAutoRefresh, staticMode])

  useEffect(() => {
    const intervalMs = getDashboardGitAutoRefreshIntervalMs(gitAutoRefreshPreset)
    if (staticMode || intervalMs === null || gitAutoRefreshCycleStartedAt === null) return

    const updateNow = () => {
      setGitAutoRefreshNow(Date.now())
    }

    updateNow()
    const timer = window.setInterval(updateNow, 250)
    return () => {
      window.clearInterval(timer)
    }
  }, [gitAutoRefreshCycleStartedAt, gitAutoRefreshPreset, staticMode])

  const activeChanges = summaryProjection?.activeChanges ?? []
  const activeChangeIdSet = useMemo(
    () => new Set(activeChanges.map((change) => change.id)),
    [activeChanges]
  )
  const activeStatuses = useMemo(() => {
    return (statuses ?? []).filter((status) => activeChangeIdSet.has(status.changeName))
  }, [statuses, activeChangeIdSet])
  const applyTrackedArtifactBySchema = useMemo(() => {
    const details = configBundle?.schemaDetails ?? {}
    const tracked = new Map<string, string>()
    for (const [schemaName, detail] of Object.entries(details)) {
      if (!detail?.applyTracks) continue
      const artifact = detail.artifacts.find((item) => item.outputPath === detail.applyTracks)
      if (artifact?.id) {
        tracked.set(schemaName, artifact.id)
      }
    }
    return tracked
  }, [configBundle])

  if (summaryIsLoading && !summaryProjection) {
    // Preserve page chrome (header/nav) and render a stable skeleton body rather than a full-tree barrier,
    // so the surrounding layout and navigation do not flash on the first dashboard visit.
    return (
      <div className="min-w-0 space-y-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
            <LayoutDashboard className="h-6 w-6 shrink-0" />
            Dashboard
          </h1>
        </div>
        <DashboardSummarySkeleton count={6} />
        <ChangeListSkeleton count={3} />
      </div>
    )
  }

  if (summaryError && !summaryProjection) {
    return (
      <div role="alert" className="text-destructive flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        Error loading dashboard: {summaryError.message}
      </div>
    )
  }

  const summary = summaryProjection?.summary ?? {
    specifications: 0,
    requirements: 0,
    activeChanges: 0,
    inProgressChanges: 0,
    completedChanges: 0,
    archivedTasksCompleted: 0,
    tasksTotal: 0,
    tasksCompleted: 0,
    taskCompletionPercent: null,
  }

  const cardAvailability =
    trendsProjection?.cardAvailability ??
    createDefaultCardAvailability(summary.taskCompletionPercent)
  const trendKinds = trendsProjection?.trendKinds ?? createDefaultTrendKinds()
  const dashboardGitIsCurrent =
    staticMode ||
    (gitScopesAuthority.state === 'current' &&
      gitScopes !== undefined &&
      dashboardGit?.bindingToken !== null &&
      dashboardGit?.bindingToken === gitScopes?.code.bindingToken)
  const git =
    dashboardGitIsCurrent && dashboardGit
      ? dashboardGit
      : {
          bindingToken: null,
          defaultBranch: 'main',
          worktrees: [],
        }
  const showGitSnapshot = staticMode
    ? git.worktrees.some((worktree) => worktree.entries.length > 0)
    : dashboardGitIsCurrent
  const showGitRegion = staticMode ? showGitSnapshot : true

  const hasChanges = activeChanges.length > 0
  const currentWorktree = git.worktrees.find((worktree) => worktree.isCurrent) ?? null
  const otherWorktrees = git.worktrees.filter((worktree) => !worktree.isCurrent)
  const gitAutoRefreshIntervalMs = getDashboardGitAutoRefreshIntervalMs(gitAutoRefreshPreset)
  const gitAutoRefreshProgress =
    gitRefreshRequest !== null
      ? 0
      : getDashboardGitAutoRefreshProgress(
          gitAutoRefreshCycleStartedAt,
          gitAutoRefreshIntervalMs,
          gitAutoRefreshNow
        )
  const showGitRefreshProgress = gitAutoRefreshIntervalMs !== null && gitRefreshRequest === null
  const animateRefreshButton =
    gitRefreshRequest !== null && isAnimatedGitRefreshReason(gitRefreshReason)
  const disableRefreshButton = gitRefreshRequest !== null || dashboardGitBindingToken === null

  const renderHistoryCards = () => (
    <div className="space-y-2">
      {trendsIsLoading && !trendsProjection ? (
        <div aria-busy="true">
          <DashboardTrendsSkeleton count={2} />
        </div>
      ) : null}
      {trendsError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Dashboard trends failed: {trendsError.message}</span>
        </div>
      ) : null}
      <RealtimeRevalidateCue active={trendsIsUpdating && Boolean(trendsProjection)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DashboardMetricCard
            label="Specifications / Requirements"
            value={`${summary.specifications} / ${summary.requirements}`}
            icon={FileText}
            availability={cardAvailability.specifications}
            trendKind={trendKinds.specifications}
            points={trendsProjection?.trends.specifications ?? []}
            triColorPoints={[]}
            className="min-h-44 sm:min-h-48 lg:min-h-52 xl:min-h-56"
          />
          <DashboardMetricCard
            label="Archived Changes / Completed Tasks"
            value={`${summary.completedChanges} / ${summary.archivedTasksCompleted}`}
            icon={Archive}
            availability={cardAvailability.completedChanges}
            trendKind={trendKinds.completedChanges}
            points={trendsProjection?.trends.completedChanges ?? []}
            triColorPoints={[]}
            className="min-h-44 sm:min-h-48 lg:min-h-52 xl:min-h-56"
          />
        </div>
      </RealtimeRevalidateCue>
    </div>
  )

  const renderExecutionSnapshot = () => (
    <div className={`grid min-w-0 gap-3 ${showGitRegion ? 'xl:grid-cols-2' : 'xl:grid-cols-1'}`}>
      <section className="@container min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">Kanban</h2>
          <VTLink
            to="/board"
            aria-label="Open Kanban"
            title="Open Kanban"
            className="text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-md"
          >
            <SquareKanban className="h-4 w-4" />
          </VTLink>
        </div>
        <ReadonlyKanban
          variant="compact"
          activeItems={activeChanges}
          archivedItems={summaryProjection?.recentArchives ?? []}
          activeCounts={
            summaryProjection?.trackedTaskPhaseCounts ?? {
              'no-tasks': 0,
              'in-progress': 0,
              complete: 0,
            }
          }
          archivedCount={summary.completedChanges}
        />
      </section>

      {showGitRegion ? (
        <section className="min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-medium">Code Git Snapshot</h2>
              <p className="text-muted-foreground truncate text-xs">
                {showGitSnapshot
                  ? `Default branch: ${git.defaultBranch}`
                  : 'Waiting for the current Code Git projection.'}
              </p>
            </div>
            {!staticMode ? (
              <DashboardGitRefreshControl
                options={GIT_AUTO_REFRESH_OPTIONS}
                value={gitAutoRefreshPreset}
                onValueChange={setGitAutoRefreshPreset}
                progress={gitAutoRefreshProgress}
                showProgress={showGitRefreshProgress}
                disabled={disableRefreshButton}
                animated={animateRefreshButton}
                onRefresh={handleManualGitRefresh}
              />
            ) : null}
          </div>
          {gitIsLoading && !dashboardGit ? <GitWorktreeSkeleton count={3} /> : null}
          {gitError ? (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Code Git snapshot failed: {gitError.message}</span>
            </div>
          ) : null}
          {!showGitSnapshot && dashboardGit && !gitIsLoading && !gitError ? (
            <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
              Waiting for the current Code Git binding.
            </div>
          ) : null}
          {showGitSnapshot ? (
            <RealtimeRevalidateCue active={gitIsUpdating && Boolean(dashboardGit)}>
              <div className="border-border/80 bg-card min-w-0 rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <GitBranch className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground truncate text-xs">
                    Default branch: {git.defaultBranch}
                  </span>
                </div>

                {currentWorktree ? (
                  <div className="space-y-0">
                    <WorktreeRow
                      worktree={currentWorktree}
                      emphasize
                      removing={removingWorktreePath === currentWorktree.path}
                      onRemoveDetachedWorktree={handleRemoveDetachedWorktree}
                    />
                    <div
                      className={`-mt-px space-y-1 border-l pl-3 pt-2 ${GIT_WORKTREE_LINE_CLASS}`}
                    >
                      {sortDashboardGitEntries(currentWorktree.entries).map((entry) => (
                        <GitEntryRow
                          key={
                            entry.type === 'commit'
                              ? entry.hash
                              : `${entry.type}:${entry.updatedAt ?? 'none'}`
                          }
                          entry={entry}
                          onSelect={
                            staticMode
                              ? undefined
                              : (selectedEntry, sourceElement) => {
                                  if (git.bindingToken === null) return
                                  void vtNavController.push(
                                    'bottom',
                                    buildGitEntryHrefFromEntry(selectedEntry),
                                    withSharedElementHandoffState(
                                      undefined,
                                      getGitEntrySharedHandoff(selectedEntry, git.bindingToken)
                                    ),
                                    {
                                      source: sourceElement,
                                      sharedElements: getGitEntrySharedDescriptor(selectedEntry),
                                    }
                                  )
                                }
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground rounded-md border border-dashed px-2.5 py-2 text-xs">
                    No worktree snapshot available.
                  </div>
                )}

                {otherWorktrees.length > 0 && (
                  <div className="border-border/70 mt-3 space-y-1 border-t pt-2">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide">
                      Other Worktrees
                    </div>
                    {otherWorktrees.map((worktree) => (
                      <WorktreeRow
                        key={worktree.path}
                        worktree={worktree}
                        emphasize={false}
                        removing={removingWorktreePath === worktree.path}
                        onRemoveDetachedWorktree={handleRemoveDetachedWorktree}
                      />
                    ))}
                  </div>
                )}
              </div>
            </RealtimeRevalidateCue>
          ) : null}
        </section>
      ) : null}
    </div>
  )

  const renderSpecificationsSection = () => (
    <section className="border-border min-w-0 rounded-t-lg border">
      <div className="border-border flex min-w-0 flex-wrap items-center justify-between gap-1.5 border-b px-4 py-3">
        <h2 className="shrink-0 font-medium">Specifications</h2>
        <span className="text-muted-foreground text-xs sm:text-sm">
          {summary.specifications} specs · {summary.requirements} requirements
        </span>
      </div>
      <div className="bg-card divide-border min-w-0 divide-y">
        {summaryProjection?.specifications.map((spec) => {
          const identity = { kind: 'owned' as const, specId: spec.id }
          const sharedDescriptor = {
            family: 'specs',
            entityId: specIdentityKey(identity),
          } as const

          return (
            <VTLink
              key={spec.id}
              to="/specs/owned/$specId"
              params={{ specId: spec.id }}
              state={(prev) => ({
                ...prev,
                __vtHandoff: {
                  family: 'specs',
                  entityId: specIdentityKey(identity),
                  title: spec.name,
                  subtitle: spec.id,
                },
              })}
              vt={{ sharedElements: sharedDescriptor }}
              {...getSharedElementBinding(sharedDescriptor, 'container')}
              className="hover:bg-muted/50 block min-w-0 px-4 py-3"
            >
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <div
                    {...getSharedElementBinding(sharedDescriptor, 'title')}
                    className="truncate font-medium"
                  >
                    {spec.name}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {spec.updatedAt > 0 && <>{formatRelativeTime(spec.updatedAt)} · </>}
                    {spec.id}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <div className="font-medium">{spec.requirements}</div>
                  <div className="text-muted-foreground text-xs">requirements</div>
                </div>
              </div>
            </VTLink>
          )
        })}
        {summaryProjection?.specifications.length === 0 && (
          <div className="text-muted-foreground px-4 py-6 text-center text-sm">
            No specifications found.
          </div>
        )}
      </div>
    </section>
  )

  const renderActiveChangesSection = () => (
    <section className="border-border flex min-w-0 flex-col rounded-t-lg border">
      <div className="border-border flex min-w-0 flex-wrap items-center justify-between gap-1.5 border-b px-4 py-3">
        <h2 className="font-medium">Active Changes</h2>
        <span className="text-muted-foreground text-xs sm:text-sm">
          {summary.activeChanges} active
        </span>
      </div>
      <div className="bg-card divide-border flex min-w-0 flex-1 flex-col divide-y">
        {activeChanges.map((change) => {
          const progress = change.trackedTaskProgress
          const taskPercent =
            progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
          const status = activeStatuses.find((item) => item.changeName === change.id)
          const doneArtifacts =
            status?.artifacts.filter((artifact) => artifact.status === 'done').length ?? 0
          const totalArtifacts = status?.artifacts.length ?? 0
          const trackedArtifactId = status
            ? applyTrackedArtifactBySchema.get(status.schemaName)
            : undefined
          const trackedArtifactStatus =
            trackedArtifactId && status
              ? (status.artifacts.find((artifact) => artifact.id === trackedArtifactId)?.status ??
                inferTrackedArtifactStatus(status.artifacts.map((artifact) => artifact.status)))
              : inferTrackedArtifactStatus(
                  status?.artifacts.map((artifact) => artifact.status) ?? []
                )
          const phase = classifyChangeWorkflowPhase({
            hasStatus: Boolean(status),
            isComplete: status?.isComplete ?? false,
            trackedTaskPhase: progress.phase,
            trackedArtifactStatus,
          })

          return (
            <VTLink
              key={change.id}
              to="/changes/$changeId"
              params={{ changeId: change.id }}
              state={(prev) => ({
                ...prev,
                __vtHandoff: {
                  family: 'changes',
                  entityId: change.id,
                  title: change.name,
                  subtitle: change.id,
                },
              })}
              vt={{ sharedElements: { family: 'changes', entityId: change.id } }}
              {...getSharedElementBinding({ family: 'changes', entityId: change.id }, 'container')}
              className="hover:bg-muted/50 block min-w-0 px-4 py-3"
            >
              <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:items-center">
                <div className="min-w-0 flex-1">
                  <div
                    {...getSharedElementBinding(
                      { family: 'changes', entityId: change.id },
                      'title'
                    )}
                    className="truncate font-medium"
                  >
                    {change.name}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {change.updatedAt > 0 && <>{formatRelativeTime(change.updatedAt)} · </>}
                    {change.id}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <Badge
                    tone="custom"
                    size="sm"
                    shape="box"
                    className={`border ${phase.toneClass}`}
                  >
                    {phase.label}
                  </Badge>
                  <div className="font-medium">
                    {progress.completed}/{progress.total}
                  </div>
                  <div className="text-muted-foreground text-xs">tasks</div>
                </div>
              </div>
              <div className="bg-muted h-1.5 rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${taskPercent}%` }}
                />
              </div>
              <div className="text-muted-foreground mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs">
                <span className="shrink-0">{taskPercent}% task completion</span>
                {status ? (
                  <span className="min-w-0 truncate text-right">
                    {doneArtifacts}/{totalArtifacts} artifacts · {status.schemaName}
                  </span>
                ) : (
                  <span>Artifacts status unavailable</span>
                )}
              </div>
            </VTLink>
          )
        })}
        {!hasChanges && (
          <div className="text-muted-foreground px-4 py-6 text-center text-sm">
            <div>No active changes.</div>
            <div className="mt-1 text-xs">Recommended workflow start: Quick Propose</div>
            <button
              type="button"
              onClick={runNewChange}
              className="text-primary mt-2 inline-flex items-center gap-1 hover:underline"
              title="Open the advanced /opsx:new form"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Open /opsx:new form
            </button>
          </div>
        )}
      </div>
    </section>
  )

  return (
    <div className="min-w-0 space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <LayoutDashboard className="h-6 w-6 shrink-0" />
          Dashboard
        </h1>
        <button
          type="button"
          onClick={runPropose}
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm hover:opacity-90"
          title="Open Quick Propose."
        >
          <Sparkles className="h-4 w-4" />
          Start Propose
        </button>
      </div>

      <RealtimeRevalidateCue active={summaryIsUpdating && Boolean(summaryProjection)}>
        <DashboardContextSummary staticMode={staticMode} />
      </RealtimeRevalidateCue>

      {summaryError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Error loading dashboard: {summaryError.message}</span>
        </div>
      ) : null}

      {gitActionError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Git action failed: {gitActionError}</span>
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Historical Trends</h2>
        {renderHistoryCards()}
      </section>

      {renderExecutionSnapshot()}

      <div className="grid gap-3 xl:grid-cols-2">
        {renderActiveChangesSection()}
        {renderSpecificationsSection()}
      </div>
    </div>
  )
}
