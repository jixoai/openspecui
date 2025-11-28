import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { useRealtimeUpdates } from '@/lib/use-realtime'
import { Link } from '@tanstack/react-router'
import { FileText, GitBranch, CheckCircle, AlertCircle, Archive } from 'lucide-react'

export function Dashboard() {
  useRealtimeUpdates()

  const { data, isLoading, error } = useQuery(trpc.dashboard.getData.queryOptions())
  const { data: initialized } = useQuery(trpc.dashboard.isInitialized.queryOptions())

  // Sort specs by requirement count (descending)
  const sortedSpecs = useMemo(() => {
    if (!data?.specs) return []
    return [...data.specs].sort((a, b) => b.requirements.length - a.requirements.length)
  }, [data?.specs])

  if (isLoading) {
    return <div className="animate-pulse">Loading dashboard...</div>
  }

  if (error) {
    return (
      <div className="text-destructive flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        Error loading dashboard: {error.message}
      </div>
    )
  }

  if (!initialized) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">OpenSpec Not Initialized</h2>
        <p className="text-muted-foreground mb-6">
          This project doesn't have an OpenSpec directory yet.
        </p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          Initialize OpenSpec
        </Link>
      </div>
    )
  }

  const { summary } = data!

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Specifications"
          value={summary.specCount}
          sublabel={`${summary.requirementCount} requirements`}
        />
        <StatCard
          icon={<GitBranch className="w-5 h-5" />}
          label="Active Changes"
          value={summary.activeChangeCount}
          sublabel="in progress"
        />
        <StatCard
          icon={<Archive className="w-5 h-5" />}
          label="Completed"
          value={summary.archivedChangeCount}
          sublabel="archived"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Task Progress"
          value={`${summary.completedTasks}/${summary.totalTasks}`}
          sublabel={`${summary.progressPercent}% complete`}
        />
      </div>

      {/* Active Changes with Progress Bars */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Active Changes</h2>
          {data!.changes.length > 0 && (
            <Link to="/changes" className="text-sm text-primary hover:underline">
              View all
            </Link>
          )}
        </div>
        <div className="border border-border rounded-lg divide-y divide-border">
          {data!.changes.map((change) => {
            const percent =
              change.progress.total > 0
                ? Math.round((change.progress.completed / change.progress.total) * 100)
                : 0
            return (
              <Link
                key={change.id}
                to="/changes/$changeId"
                params={{ changeId: change.id }}
                className="block p-4 hover:bg-muted/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{change.name}</div>
                  <span className="text-sm text-muted-foreground">
                    {change.progress.completed}/{change.progress.total} tasks
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{percent}%</span>
                </div>
              </Link>
            )
          })}
          {data!.changes.length === 0 && (
            <div className="p-4 text-muted-foreground text-center">
              No active changes. Create one in <code className="bg-muted px-1 rounded">openspec/changes/</code>
            </div>
          )}
        </div>
      </section>

      {/* Specifications sorted by requirement count */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Specifications</h2>
          {sortedSpecs.length > 0 && (
            <Link to="/specs" className="text-sm text-primary hover:underline">
              View all
            </Link>
          )}
        </div>
        <div className="border border-border rounded-lg divide-y divide-border">
          {sortedSpecs.map((spec) => (
            <Link
              key={spec.id}
              to="/specs/$specId"
              params={{ specId: spec.id }}
              className="flex items-center justify-between p-3 hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{spec.name}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {spec.requirements.length} requirement{spec.requirements.length !== 1 ? 's' : ''}
              </span>
            </Link>
          ))}
          {sortedSpecs.length === 0 && (
            <div className="p-4 text-muted-foreground text-center">
              No specs yet. Create one in <code className="bg-muted px-1 rounded">openspec/specs/</code>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  sublabel: string
}) {
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{sublabel}</div>
    </div>
  )
}
