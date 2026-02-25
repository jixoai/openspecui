import { navController } from '@/lib/nav-controller'
import { useOpsxStatusListSubscription } from '@/lib/use-opsx'
import { Link } from '@tanstack/react-router'
import { ChevronRight, GitBranch, Sparkles } from 'lucide-react'

export function ChangeList() {
  const { data: statuses, isLoading } = useOpsxStatusListSubscription()

  if (isLoading && !statuses) {
    return <div className="route-loading animate-pulse">Loading changes...</div>
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <GitBranch className="h-6 w-6 shrink-0" />
        Changes
      </h1>

      <p className="text-muted-foreground">
        Active OPSX changes. Completed changes are moved to{' '}
        <Link to="/archive" className="text-primary hover:underline">
          Archive
        </Link>
        .
      </p>

      <div className="border-border divide-border divide-y rounded-lg border">
        {statuses?.map((status) => {
          const done = status.artifacts.filter((artifact) => artifact.status === 'done').length
          const total = status.artifacts.length
          return (
            <Link
              key={status.changeName}
              to="/changes/$changeId"
              params={{ changeId: status.changeName }}
              className="hover:bg-muted/50 flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <GitBranch className="text-muted-foreground h-5 w-5" />
                <div>
                  <div className="font-medium">{status.changeName}</div>
                  <div className="text-muted-foreground text-sm">
                    {done}/{total} artifacts · schema {status.schemaName}
                  </div>
                </div>
              </div>
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            </Link>
          )
        })}
        {statuses?.length === 0 && (
          <div className="text-muted-foreground p-4 text-center">
            <div>No active changes.</div>
            <div className="mt-1 text-xs">Recommended workflow start: /opsx:propose</div>
            <button
              type="button"
              onClick={() => navController.activatePop('/opsx-new')}
              className="text-primary mt-2 inline-flex items-center gap-1 hover:underline"
              title="Open the advanced /opsx:new form"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Open /opsx:new form
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
