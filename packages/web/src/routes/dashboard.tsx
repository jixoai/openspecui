import { formatRelativeTime } from '@/lib/format-time'
import { navController } from '@/lib/nav-controller'
import { useDashboardOverviewSubscription } from '@/lib/use-dashboard'
import { useOpsxStatusListSubscription } from '@/lib/use-opsx'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  Archive,
  CheckSquare,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import { useCallback, useMemo, type ComponentType } from 'react'

export function Dashboard() {
  const { data: overview, isLoading, error } = useDashboardOverviewSubscription()
  const { data: statuses } = useOpsxStatusListSubscription()

  const statusMap = useMemo(() => {
    return new Map((statuses ?? []).map((status) => [status.changeName, status]))
  }, [statuses])

  const runNewChange = useCallback(() => {
    navController.activatePop('/opsx-new')
  }, [])

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
    tasksTotal: 0,
    tasksCompleted: 0,
  }
  const taskCompletion =
    summary.tasksTotal > 0 ? Math.round((summary.tasksCompleted / summary.tasksTotal) * 100) : 0
  const hasChanges = summary.activeChanges > 0

  return (
    <div className="space-y-6 p-4">
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Specifications" value={summary.specifications} icon={FileText} />
        <StatCard label="Requirements" value={summary.requirements} icon={ListChecks} />
        <StatCard label="Active Changes" value={summary.activeChanges} icon={GitBranch} />
        <StatCard label="In Progress" value={summary.inProgressChanges} icon={CheckSquare} />
        <StatCard label="Completed Changes" value={summary.completedChanges} icon={Archive} />
        <StatCard label="Task Completion" value={`${taskCompletion}%`} icon={CheckSquare} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="border-border rounded-lg border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-medium">Specifications</h2>
            <span className="text-muted-foreground text-sm">
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
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{spec.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {spec.id}
                      {spec.updatedAt > 0 && <> · {formatRelativeTime(spec.updatedAt)}</>}
                    </div>
                  </div>
                  <div className="text-right text-sm">
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

        <section className="border-border rounded-lg border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-medium">Active Changes</h2>
            <span className="text-muted-foreground text-sm">{summary.activeChanges} active</span>
          </div>
          <div className="divide-border divide-y">
            {overview?.activeChanges.map((change) => {
              const progress = change.progress
              const taskPercent =
                progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
              const status = statusMap.get(change.id)
              const doneArtifacts =
                status?.artifacts.filter((artifact) => artifact.status === 'done').length ?? 0
              const totalArtifacts = status?.artifacts.length ?? 0
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
                      <div className="text-muted-foreground text-xs">
                        {change.id}
                        {change.updatedAt > 0 && <> · {formatRelativeTime(change.updatedAt)}</>}
                      </div>
                    </div>
                    <div className="text-right text-sm">
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
                  <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                    <span>{taskPercent}% task completion</span>
                    {status ? (
                      <span>
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
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="border-border rounded-lg border p-4">
      <div className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
