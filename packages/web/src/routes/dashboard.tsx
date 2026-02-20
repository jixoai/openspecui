import { navController } from '@/lib/nav-controller'
import { useOpsxStatusListSubscription } from '@/lib/use-opsx'
import { Link } from '@tanstack/react-router'
import { AlertCircle, GitBranch, LayoutDashboard, Sparkles } from 'lucide-react'
import { useCallback, useMemo } from 'react'

export function Dashboard() {
  const { data: statuses, isLoading, error } = useOpsxStatusListSubscription()

  const summary = useMemo(() => {
    const totalChanges = statuses?.length ?? 0
    const totalArtifacts =
      statuses?.reduce((count, status) => count + status.artifacts.length, 0) ?? 0
    const doneArtifacts =
      statuses?.reduce(
        (count, status) => count + status.artifacts.filter((a) => a.status === 'done').length,
        0
      ) ?? 0
    return { totalChanges, totalArtifacts, doneArtifacts }
  }, [statuses])

  const runNewChange = useCallback(() => {
    navController.activatePop('/opsx-new')
  }, [])

  if (isLoading && !statuses) {
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

  const hasChanges = (statuses?.length ?? 0) > 0

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Active Changes" value={summary.totalChanges} />
        <StatCard
          label="Artifacts Complete"
          value={`${summary.doneArtifacts}/${summary.totalArtifacts}`}
        />
        <StatCard
          label="Completion"
          value={
            summary.totalArtifacts > 0
              ? `${Math.round((summary.doneArtifacts / summary.totalArtifacts) * 100)}%`
              : '0%'
          }
        />
      </div>

      {!hasChanges && (
        <div className="border-border text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          <div>No active changes yet.</div>
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

      {hasChanges && (
        <div className="border-border divide-border divide-y rounded-lg border">
          {statuses?.map((status) => {
            const done = status.artifacts.filter((a) => a.status === 'done').length
            const total = status.artifacts.length
            const percent = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <Link
                key={status.changeName}
                to="/changes/$changeId"
                params={{ changeId: status.changeName }}
                className="hover:bg-muted/50 block p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="text-muted-foreground h-4 w-4" />
                    <span className="font-medium">{status.changeName}</span>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {done}/{total} artifacts
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-muted h-2 flex-1 rounded-full">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-medium">{percent}%</span>
                </div>
                <div className="text-muted-foreground mt-2 text-xs">
                  Schema: {status.schemaName}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
