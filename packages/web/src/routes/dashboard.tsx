import { DashboardMetricCard } from '@/components/dashboard/metric-card'
import { formatRelativeTime } from '@/lib/format-time'
import { navController } from '@/lib/nav-controller'
import { isStaticMode } from '@/lib/static-mode'
import {
  refreshDashboardGitSnapshot,
  useDashboardGitTaskStatusSubscription,
  useDashboardOverviewSubscription,
} from '@/lib/use-dashboard'
import { useOpsxConfigBundleSubscription, useOpsxStatusListSubscription } from '@/lib/use-opsx'
import type {
  ChangeStatus,
  DashboardCardAvailability,
  DashboardGitEntry,
  DashboardGitWorktree,
  DashboardMetricKey,
  DashboardTrendKind,
} from '@openspecui/core'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  Archive,
  ArrowRight,
  FileText,
  GitBranch,
  GitCommitHorizontal,
  LayoutDashboard,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

const SPEC_DRIVEN_ORDER = ['proposal', 'design', 'specs', 'tasks'] as const
const GIT_WORKTREE_BORDER_CLASS = 'border-zinc-400/50'
const GIT_WORKTREE_BG_CLASS = 'bg-zinc-500/8'
const GIT_WORKTREE_LINE_CLASS = 'border-zinc-400/50'

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

function formatRelatedChanges(relatedChanges: string[]): string {
  if (relatedChanges.length === 0) return 'No linked openspec change'
  return relatedChanges.join(', ')
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
  schemaCatalog: Array<{ schemaName: string; artifactIds: string[] }>
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
        readyToArchive: schemaStatuses.filter((status) => status.isComplete).length,
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

function classifyChangeStatus(params: {
  hasStatus: boolean
  isComplete: boolean
  tasksArtifactStatus: 'done' | 'ready' | 'blocked' | null
}): { label: string; toneClass: string } {
  if (!params.hasStatus) {
    return {
      label: 'Unknown',
      toneClass: 'border-border text-muted-foreground',
    }
  }

  if (params.isComplete) {
    return {
      label: 'Ready to Archive',
      toneClass: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
    }
  }

  if (params.tasksArtifactStatus === 'blocked') {
    return {
      label: 'Draft',
      toneClass: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
    }
  }

  return {
    label: 'In Execution',
    toneClass: 'border-primary/40 text-primary',
  }
}

export function Dashboard() {
  const { data: overview, isLoading, error } = useDashboardOverviewSubscription()
  const { data: statuses } = useOpsxStatusListSubscription()
  const { data: configBundle } = useOpsxConfigBundleSubscription()
  const { data: gitTaskStatus } = useDashboardGitTaskStatusSubscription()

  const runNewChange = useCallback(() => {
    navController.activatePop('/opsx-new')
  }, [])

  const triggerGitRefresh = useCallback(async (reason: string) => {
    try {
      await refreshDashboardGitSnapshot(reason)
    } catch (err) {
      console.error('[Dashboard] Failed to refresh git snapshot:', err)
    }
  }, [])

  const focusRefreshAtRef = useRef(0)

  useEffect(() => {
    if (isStaticMode()) return

    const triggerOnce = (reason: string) => {
      const now = Date.now()
      if (now - focusRefreshAtRef.current < 700) return
      focusRefreshAtRef.current = now
      void triggerGitRefresh(reason)
    }

    const onFocus = () => {
      triggerOnce('window-focus')
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
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
  }, [triggerGitRefresh])

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
  const workflowSchemaCards = useMemo(
    () => buildWorkflowSchemaCards(activeStatuses, workflowSchemaCatalog),
    [activeStatuses, workflowSchemaCatalog]
  )

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

  const hasChanges = activeChanges.length > 0
  const currentWorktree = git.worktrees.find((worktree) => worktree.isCurrent) ?? null
  const otherWorktrees = git.worktrees.filter((worktree) => !worktree.isCurrent)

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
    <div className="grid min-w-0 gap-3 xl:grid-cols-2">
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
          <div className="grid min-w-0 gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
            {workflowSchemaCards.map((schema) => (
              <section
                key={schema.schemaName}
                className="border-border/70 min-w-0 rounded-md border p-2"
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
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,6rem),1fr))] gap-2">
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
                          <div className="relative mb-0.5 truncate pr-6 text-xs font-semibold">
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

      <section className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-medium">Git Snapshot</h2>
            <p className="text-muted-foreground truncate text-xs">
              Default branch: {git.defaultBranch}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void triggerGitRefresh('manual-button')
            }}
            disabled={gitTaskStatus?.running === true}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${gitTaskStatus?.running ? 'text-primary animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
        <div className="border-border/80 min-w-0 rounded-lg border p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <GitBranch className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-muted-foreground truncate text-xs">
              Default branch: {git.defaultBranch}
            </span>
          </div>

          {currentWorktree ? (
            <div className="space-y-0">
              <WorktreeRow worktree={currentWorktree} emphasize />
              <div className={`-mt-px space-y-1 border-l pl-3 pt-2 ${GIT_WORKTREE_LINE_CLASS}`}>
                {currentWorktree.entries.map((entry) => (
                  <GitEntryRow
                    key={entry.type === 'commit' ? entry.hash : entry.type}
                    entry={entry}
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
                <WorktreeRow key={worktree.path} worktree={worktree} emphasize={false} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )

  const renderSpecificationsSection = () => (
    <section className="border-border min-w-0 rounded-lg border">
      <div className="border-border flex flex-wrap items-center justify-between gap-1.5 border-b px-4 py-3">
        <h2 className="shrink-0 font-medium">Specifications</h2>
        <span className="text-muted-foreground w-full text-xs sm:w-auto sm:text-sm">
          {summary.specifications} specs · {summary.requirements} requirements
        </span>
      </div>
      <div className="divide-border divide-y">
        {overview?.specifications.map((spec) => (
          <Link
            key={spec.id}
            to="/specs/$specId"
            params={{ specId: spec.id }}
            className="hover:bg-muted/50 block px-4 py-3"
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{spec.name}</div>
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
          </Link>
        ))}
        {overview?.specifications.length === 0 && (
          <div className="text-muted-foreground px-4 py-6 text-center text-sm">
            No specifications found.
          </div>
        )}
      </div>
    </section>
  )

  const renderActiveChangesSection = () => (
    <section className="border-border rounded-lg border">
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-medium">Active Changes</h2>
        <span className="text-muted-foreground text-sm">{summary.activeChanges} active</span>
      </div>
      <div className="divide-border divide-y">
        {activeChanges.map((change) => {
          const progress = change.progress
          const taskPercent =
            progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
          const status = activeStatuses.find((item) => item.changeName === change.id)
          const doneArtifacts =
            status?.artifacts.filter((artifact) => artifact.status === 'done').length ?? 0
          const totalArtifacts = status?.artifacts.length ?? 0
          const tasksArtifactStatus =
            status?.artifacts.find((artifact) => artifact.id === 'tasks')?.status ?? null
          const phase = classifyChangeStatus({
            hasStatus: Boolean(status),
            isComplete: status?.isComplete ?? false,
            tasksArtifactStatus,
          })

          return (
            <Link
              key={change.id}
              to="/changes/$changeId"
              params={{ changeId: change.id }}
              className="hover:bg-muted/50 block px-4 py-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{change.name}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    {change.id}
                    {change.updatedAt > 0 && <> · {formatRelativeTime(change.updatedAt)}</>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-right text-sm">
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
              <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>{taskPercent}% task completion</span>
                {status ? (
                  <span className="truncate">
                    {doneArtifacts}/{totalArtifacts} artifacts · {status.schemaName}
                  </span>
                ) : (
                  <span>Artifacts status unavailable</span>
                )}
              </div>
            </Link>
          )
        })}
        {!hasChanges && (
          <div className="text-muted-foreground px-4 py-6 text-center text-sm">
            <div>No active changes.</div>
            <button
              type="button"
              onClick={runNewChange}
              className="text-primary mt-2 inline-flex items-center gap-1 hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              /opsx:new
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
          onClick={runNewChange}
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          /opsx:new
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Historical Trends</h2>
        {renderHistoryCards()}
      </section>

      {renderExecutionSnapshot()}

      <div className="grid gap-3 xl:grid-cols-2">
        {renderSpecificationsSection()}
        {renderActiveChangesSection()}
      </div>
    </div>
  )
}

function WorktreeRow({
  worktree,
  emphasize,
}: {
  worktree: DashboardGitWorktree
  emphasize: boolean
}) {
  return (
    <div
      className={`min-w-0 rounded-md border px-2.5 py-2 ${
        emphasize
          ? `${GIT_WORKTREE_BORDER_CLASS} ${GIT_WORKTREE_BG_CLASS}`
          : 'border-border/70 bg-muted/15'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="truncate">{worktree.branchName}</span>
          </div>
          <div className="text-muted-foreground truncate text-xs">
            {worktree.relativePath} | {worktree.path}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1">
            <GitAheadBehindBadge ahead={worktree.ahead} behind={worktree.behind} />
            <GitFilesBadge files={worktree.diff.files} />
            <DiffStat diff={worktree.diff} className="justify-end" />
          </div>
        </div>
      </div>
    </div>
  )
}

function GitEntryRow({ entry }: { entry: DashboardGitEntry }) {
  const isCommit = entry.type === 'commit'
  return (
    <div
      className={`min-w-0 rounded-md border px-2 py-1.5 ${
        isCommit ? 'bg-sky-500/7 border-sky-500/30' : 'bg-amber-500/7 border-amber-500/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {isCommit ? (
              <GitCommitHorizontal className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300" />
            ) : (
              <LoaderCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
            )}
            <span className="truncate">{entry.title}</span>
          </div>
          <div className="text-muted-foreground truncate text-[11px]">
            {isCommit ? entry.hash.slice(0, 8) : 'working tree'} ·{' '}
            {formatRelatedChanges(entry.relatedChanges)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1">
            <GitFilesBadge files={entry.diff.files} />
            <DiffStat diff={entry.diff} className="justify-end" />
          </div>
        </div>
      </div>
    </div>
  )
}

function DiffStat({
  diff,
  className = '',
}: {
  diff: { insertions: number; deletions: number }
  className?: string
}) {
  return (
    <div className={`flex items-center gap-1 text-[10px] ${className}`}>
      <span className="bg-emerald-500/12 inline-flex items-center gap-0.5 rounded border border-emerald-500/40 px-[0.15rem] py-0 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
        <Plus className="h-2.5 w-2.5" />
        <span>{diff.insertions}</span>
      </span>
      <span className="bg-rose-500/12 inline-flex items-center gap-0.5 rounded border border-rose-500/40 px-[0.15rem] py-0 font-mono text-[10px] text-rose-700 dark:text-rose-300">
        <Minus className="h-2.5 w-2.5" />
        <span>{diff.deletions}</span>
      </span>
    </div>
  )
}

function GitFilesBadge({ files }: { files: number }) {
  return (
    <span className="text-muted-foreground inline-flex items-center rounded border border-zinc-500/35 bg-zinc-500/10 px-[0.15rem] py-0 font-mono text-[10px]">
      {files}f
    </span>
  )
}

function GitAheadBehindBadge({ ahead, behind }: { ahead: number; behind: number }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 rounded border border-zinc-500/35 bg-zinc-500/10 px-[0.15rem] py-0 font-mono text-[10px]">
      <span>↑{ahead}</span>
      <span>↓{behind}</span>
    </span>
  )
}
