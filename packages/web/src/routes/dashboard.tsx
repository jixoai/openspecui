import { DashboardMetricCard } from '@/components/dashboard/metric-card'
import {
  getGitEntrySharedDescriptor,
  getGitEntrySharedHandoff,
  GIT_WORKTREE_LINE_CLASS,
  GitAutoRefreshPresetIcon,
  GitEntryRow,
  isHttpUrl,
  WorktreeRow,
} from '@/components/git/git-shared'
import { Select, type SelectOption } from '@/components/select'
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
import { useOpsxConfigBundleSubscription, useOpsxStatusListSubscription } from '@/lib/use-opsx'
import { VTLink, vtNavController } from '@/lib/view-transitions/navigation'
import {
  getSharedElementBinding,
  withSharedElementHandoffState,
} from '@/lib/view-transitions/shared-elements'
import type {
  ChangeStatus,
  DashboardCardAvailability,
  DashboardGitWorktree,
  DashboardMetricKey,
  DashboardTrendKind,
} from '@openspecui/core'
import {
  AlertCircle,
  Archive,
  ArrowRight,
  FileText,
  GitBranch,
  LayoutDashboard,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SPEC_DRIVEN_ORDER = ['proposal', 'design', 'specs', 'tasks'] as const
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

function formatArtifactLabel(id: string): string {
  if (!id) return 'Unknown'
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function sortArtifactIdsForSchema(schemaName: string, artifactIds: string[]): string[] {
  if (schemaName !== 'spec-driven') return artifactIds

  const rank = new Map<string, number>()
  for (const [index, id] of SPEC_DRIVEN_ORDER.entries()) {
    rank.set(id, index)
  }

  return [...artifactIds].sort((a, b) => {
    const rankA = rank.get(a)
    const rankB = rank.get(b)
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB
    if (rankA !== undefined) return -1
    if (rankB !== undefined) return 1
    return a.localeCompare(b)
  })
}

function buildWorkflowSchemaCards(
  statuses: ChangeStatus[],
  schemaCatalog: Array<{ schemaName: string; artifactIds: string[] }>,
  taskCompleteChangeIds: ReadonlySet<string>
): Array<{
  schemaName: string
  readyToArchive: number
  steps: Array<{
    id: string
    label: string
    draft: number
    ready: number
    blocked: number
  }>
}> {
  const groups = new Map<string, ChangeStatus[]>()
  for (const status of statuses) {
    const key = status.schemaName || 'unknown'
    const list = groups.get(key)
    if (list) {
      list.push(status)
    } else {
      groups.set(key, [status])
    }
  }

  const catalogMap = new Map<string, string[]>()
  for (const item of schemaCatalog) {
    catalogMap.set(item.schemaName, item.artifactIds)
  }

  const schemaNames = new Set<string>([
    ...schemaCatalog.map((item) => item.schemaName),
    ...groups.keys(),
  ])

  return [...schemaNames]
    .map((schemaName) => {
      const schemaStatuses = groups.get(schemaName) ?? []
      const orderedArtifactIds: string[] = [...(catalogMap.get(schemaName) ?? [])]
      const seen = new Set<string>()
      for (const artifactId of orderedArtifactIds) {
        seen.add(artifactId)
      }
      for (const status of schemaStatuses) {
        for (const artifact of status.artifacts) {
          if (seen.has(artifact.id)) continue
          seen.add(artifact.id)
          orderedArtifactIds.push(artifact.id)
        }
      }

      const sequence = sortArtifactIdsForSchema(schemaName, orderedArtifactIds)
      const steps = sequence.map((id) => {
        let draft = 0
        let ready = 0
        let blocked = 0

        for (const status of schemaStatuses) {
          const artifact = status.artifacts.find((item) => item.id === id)
          if (!artifact) continue
          if (artifact.status === 'done') draft += 1
          if (artifact.status === 'ready') ready += 1
          if (artifact.status === 'blocked') blocked += 1
        }

        return {
          id,
          label: formatArtifactLabel(id),
          draft,
          ready,
          blocked,
        }
      })

      return {
        schemaName,
        readyToArchive: schemaStatuses.filter(
          (status) => status.isComplete && taskCompleteChangeIds.has(status.changeName)
        ).length,
        steps,
      }
    })
    .sort((a, b) => {
      if (a.schemaName === 'spec-driven') return -1
      if (b.schemaName === 'spec-driven') return 1
      return a.schemaName.localeCompare(b.schemaName)
    })
}

function getStableHue(input: string): number {
  let hash = 0
  for (const ch of input) {
    hash = (hash * 31 + ch.charCodeAt(0)) | 0
  }
  return Math.abs(hash) % 360
}

function getStepPalette(stepName: string): {
  border: string
  background: string
  text: string
  arrow: string
} {
  const hue = getStableHue(stepName)
  const background = `oklch(0.97 0.016 ${hue})`
  const text = `oklch(0.44 0.1 ${hue})`
  return {
    border: `oklch(0.84 0.06 ${hue})`,
    background,
    text,
    arrow: `color-mix(in oklab, ${background} 90%, ${text})`,
  }
}

export function Dashboard() {
  const staticMode = isStaticMode()
  const { data: overview, isLoading, error } = useDashboardOverviewSubscription()
  const { data: gitTaskStatus } = useDashboardGitTaskStatusSubscription()
  const { data: statuses } = useOpsxStatusListSubscription()
  const { data: configBundle } = useOpsxConfigBundleSubscription()
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

  const runPropose = useCallback(() => {
    vtNavController.activatePop('/opsx-propose')
  }, [])

  const runNewChange = useCallback(() => {
    vtNavController.activatePop('/opsx-new')
  }, [])

  const triggerGitRefresh = useCallback(
    async (reason: string) => refreshDashboardGitSnapshot(reason),
    []
  )

  const focusRefreshAtRef = useRef(0)
  const [removingWorktreePath, setRemovingWorktreePath] = useState<string | null>(null)
  const gitAutoRefreshTimerRef = useRef<number | null>(null)
  const gitTaskStatusRef = useRef(gitTaskStatus)
  const gitRefreshRequestRef = useRef(gitRefreshRequest)
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
    gitAutoRefreshPreset,
    gitRefreshRequest,
    isDocumentVisible,
    runDashboardGitRefresh,
    staticMode,
  ])

  const handleManualGitRefresh = useCallback(() => {
    clearGitAutoRefreshTimer()
    setGitAutoRefreshCycleStartedAt(null)
    setGitAutoRefreshNow(Date.now())
    runDashboardGitRefresh('manual-button')
  }, [clearGitAutoRefreshTimer, runDashboardGitRefresh])

  const handleRemoveDetachedWorktree = useCallback(async (worktree: DashboardGitWorktree) => {
    if (isStaticMode() || worktree.isCurrent || !worktree.detached || isHttpUrl(worktree.path)) {
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
    try {
      await removeDetachedDashboardWorktree(worktree.path)
    } catch (error) {
      console.error('[Dashboard] Failed to remove detached worktree:', error)
      window.alert(error instanceof Error ? error.message : 'Failed to remove detached worktree.')
    } finally {
      setRemovingWorktreePath((current) => (current === worktree.path ? null : current))
    }
  }, [])

  useEffect(() => {
    gitRefreshRequestRef.current = gitRefreshRequest
  }, [gitRefreshRequest])

  useEffect(() => {
    if (staticMode) return

    const triggerOnce = (reason: string) => {
      if (gitRefreshRequestRef.current !== null) return
      const now = Date.now()
      if (now - focusRefreshAtRef.current < 700) return
      focusRefreshAtRef.current = now
      clearGitAutoRefreshTimer()
      setGitAutoRefreshCycleStartedAt(null)
      setGitAutoRefreshNow(Date.now())
      runDashboardGitRefresh(reason)
    }

    const onFocus = () => {
      triggerOnce('window-focus')
    }

    const onVisibilityChange = () => {
      const visible = document.visibilityState === 'visible'
      setIsDocumentVisible(visible)
      if (visible) {
        triggerOnce('document-visible')
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    triggerOnce('dashboard-mount')

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [clearGitAutoRefreshTimer, runDashboardGitRefresh, staticMode])

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

  const activeChanges = overview?.activeChanges ?? []
  const activeChangeIdSet = useMemo(
    () => new Set(activeChanges.map((change) => change.id)),
    [activeChanges]
  )
  const activeStatuses = useMemo(() => {
    return (statuses ?? []).filter((status) => activeChangeIdSet.has(status.changeName))
  }, [statuses, activeChangeIdSet])
  const workflowSchemaCatalog = useMemo(() => {
    const schemas = configBundle?.schemas ?? []
    const details = configBundle?.schemaDetails ?? {}
    return schemas.map((schema) => {
      const detailArtifacts = details[schema.name]?.artifacts.map((artifact) => artifact.id) ?? []
      const artifactIds = detailArtifacts.length > 0 ? detailArtifacts : schema.artifacts
      return {
        schemaName: schema.name,
        artifactIds,
      }
    })
  }, [configBundle])
  const taskCompleteChangeIds = useMemo(
    () =>
      new Set(
        activeChanges
          .filter(
            (change) =>
              change.progress.total === 0 || change.progress.completed >= change.progress.total
          )
          .map((change) => change.id)
      ),
    [activeChanges]
  )
  const workflowSchemaCards = useMemo(
    () => buildWorkflowSchemaCards(activeStatuses, workflowSchemaCatalog, taskCompleteChangeIds),
    [activeStatuses, taskCompleteChangeIds, workflowSchemaCatalog]
  )
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

  if (isLoading && !overview) {
    return <div className="route-loading animate-pulse">Loading dashboard...</div>
  }

  if (error) {
    return (
      <div className="text-destructive flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        Error loading dashboard: {error.message}
      </div>
    )
  }

  const summary = overview?.summary ?? {
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
    overview?.cardAvailability ?? createDefaultCardAvailability(summary.taskCompletionPercent)
  const trendKinds = overview?.trendKinds ?? createDefaultTrendKinds()

  const git = overview?.git ?? {
    defaultBranch: 'main',
    worktrees: [],
  }
  const showGitSnapshot =
    !staticMode || git.worktrees.some((worktree) => worktree.entries.length > 0)

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
  const disableRefreshButton = gitRefreshRequest !== null

  const renderHistoryCards = () => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <DashboardMetricCard
        label="Specifications / Requirements"
        value={`${summary.specifications} / ${summary.requirements}`}
        icon={FileText}
        availability={cardAvailability.specifications}
        trendKind={trendKinds.specifications}
        points={overview?.trends.specifications ?? []}
        triColorPoints={[]}
        className="min-h-44 sm:min-h-48 lg:min-h-52 xl:min-h-56"
      />
      <DashboardMetricCard
        label="Archived Changes / Completed Tasks"
        value={`${summary.completedChanges} / ${summary.archivedTasksCompleted}`}
        icon={Archive}
        availability={cardAvailability.completedChanges}
        trendKind={trendKinds.completedChanges}
        points={overview?.trends.completedChanges ?? []}
        triColorPoints={[]}
        className="min-h-44 sm:min-h-48 lg:min-h-52 xl:min-h-56"
      />
    </div>
  )

  const renderExecutionSnapshot = () => (
    <div className={`grid min-w-0 gap-3 ${showGitSnapshot ? 'xl:grid-cols-2' : 'xl:grid-cols-1'}`}>
      <section className="@container min-w-0 space-y-2">
        <div>
          <h2 className="font-medium">Workflow Progress</h2>
          <p className="text-muted-foreground text-xs">
            Status coverage: {activeStatuses.length}/{activeChanges.length} active changes have
            workflow status snapshots.
          </p>
        </div>

        {workflowSchemaCards.length === 0 ? (
          <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
            No workflow status available.
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-2">
            {workflowSchemaCards.map((schema) => (
              <section
                key={schema.schemaName}
                className="border-border/70 bg-card min-w-0 rounded-md border p-2"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold">{schema.schemaName}</h3>
                  </div>
                  {schema.readyToArchive > 0 ? (
                    <span className="text-muted-foreground rounded border px-1 py-0.5 text-[10px]">
                      archive-ready {schema.readyToArchive}
                    </span>
                  ) : null}
                </div>
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2">
                  {schema.steps.length === 0 ? (
                    <div className="text-muted-foreground border-border/70 rounded-md border border-dashed px-2 py-1.5 text-[11px]">
                      No artifacts in schema.
                    </div>
                  ) : (
                    schema.steps.map((step) => {
                      const palette = getStepPalette(step.id)
                      return (
                        <article
                          key={`${schema.schemaName}:${step.id}`}
                          className="relative min-w-0 overflow-hidden rounded-md border px-1.5 py-1"
                          style={{
                            borderColor: palette.border,
                            backgroundColor: palette.background,
                            color: palette.text,
                          }}
                        >
                          <ArrowRight
                            className="pointer-events-none absolute right-[10%] top-1/2 h-12 w-12 -translate-y-1/2"
                            style={{ color: palette.arrow }}
                          />
                          <div className="relative mb-0.5 pr-6 text-xs font-semibold">
                            {step.label}
                          </div>
                          <div className="relative space-y-0 text-[10px]">
                            <div className="flex items-center justify-between">
                              <span className="text-current/75">Draft</span>
                              <span className="font-mono">{step.draft}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-current/75">Ready</span>
                              <span className="font-mono">{step.ready}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-current/75">Blocked</span>
                              <span className="font-mono">{step.blocked}</span>
                            </div>
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {showGitSnapshot ? (
        <section className="min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-medium">Git Snapshot</h2>
              <p className="text-muted-foreground truncate text-xs">
                Default branch: {git.defaultBranch}
              </p>
            </div>
            {!staticMode ? (
              <div className="border-border bg-card inline-flex overflow-hidden rounded-md border">
                <Select
                  value={gitAutoRefreshPreset}
                  options={GIT_AUTO_REFRESH_OPTIONS}
                  onValueChange={setGitAutoRefreshPreset}
                  ariaLabel="Git auto refresh"
                  className="text-foreground/75 hover:text-foreground border-r-current/10 bg-muted/20 relative isolate h-7 w-9 shrink-0 justify-center rounded-none border-0 border-r px-0"
                  positionerClassName="z-50"
                  popupClassName="min-w-[7rem]"
                  renderTrigger={({ selectedOption }) => (
                    <span className="relative inline-flex h-full w-full items-center justify-center overflow-hidden">
                      <span className="bg-muted/20 pointer-events-none absolute inset-0" />
                      {showGitRefreshProgress ? (
                        <span
                          className="bg-primary/30 dark:bg-primary/35 pointer-events-none absolute inset-y-0 left-0 transition-[width]"
                          style={{ width: `${gitAutoRefreshProgress * 100}%` }}
                        />
                      ) : null}
                      <span className="relative z-10 inline-flex items-center justify-center">
                        <GitAutoRefreshPresetIcon
                          preset={selectedOption?.value ?? gitAutoRefreshPreset}
                        />
                      </span>
                    </span>
                  )}
                />
                <button
                  type="button"
                  onClick={handleManualGitRefresh}
                  disabled={disableRefreshButton}
                  className={`inline-flex h-7 items-center gap-1 px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                    animateRefreshButton
                      ? 'text-primary bg-primary/10'
                      : 'text-foreground/75 hover:text-foreground'
                  }`}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${animateRefreshButton ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </button>
              </div>
            ) : null}
          </div>
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
                <div className={`-mt-px space-y-1 border-l pl-3 pt-2 ${GIT_WORKTREE_LINE_CLASS}`}>
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
                              void vtNavController.push(
                                'bottom',
                                buildGitEntryHrefFromEntry(selectedEntry),
                                withSharedElementHandoffState(
                                  undefined,
                                  getGitEntrySharedHandoff(selectedEntry)
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
        {overview?.specifications.map((spec) => {
          const sharedDescriptor = { family: 'specs', entityId: spec.id } as const

          return (
            <VTLink
              key={spec.id}
              to="/specs/$specId"
              params={{ specId: spec.id }}
              state={(prev) => ({
                ...prev,
                __vtHandoff: {
                  family: 'specs',
                  entityId: spec.id,
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
                    {spec.id}
                    {spec.updatedAt > 0 && <> · {formatRelativeTime(spec.updatedAt)}</>}
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
        {overview?.specifications.length === 0 && (
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
          const progress = change.progress
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
            tasksComplete: progress.total === 0 || progress.completed >= progress.total,
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
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${phase.toneClass}`}
                  >
                    {phase.label}
                  </span>
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
            <div className="mt-1 text-xs">Recommended workflow start: /opsx:propose</div>
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
          title="Recommended workflow start is /opsx:propose."
        >
          <Sparkles className="h-4 w-4" />
          Start (/opsx:propose)
        </button>
      </div>

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
