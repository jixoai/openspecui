import { useQuery } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { useRealtimeUpdates } from '@/lib/use-realtime'
import { Link } from '@tanstack/react-router'
import { GitBranch, ChevronRight } from 'lucide-react'

export function ChangeList() {
  useRealtimeUpdates()

  const { data: changes, isLoading } = useQuery(trpc.change.listWithMeta.queryOptions())

  if (isLoading) {
    return <div className="animate-pulse">Loading changes...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Changes</h1>

      <p className="text-muted-foreground">
        Active change proposals. Completed changes are moved to{' '}
        <Link to="/archive" className="text-primary hover:underline">
          Archive
        </Link>
        .
      </p>

      <div className="border border-border rounded-lg divide-y divide-border">
        {changes?.map((change) => (
          <Link
            key={change.id}
            to="/changes/$changeId"
            params={{ changeId: change.id }}
            className="flex items-center justify-between p-4 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <GitBranch className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{change.name}</div>
                <div className="text-sm text-muted-foreground">
                  {change.id} · {change.progress.completed}/{change.progress.total} tasks
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
        {changes?.length === 0 && (
          <div className="p-4 text-muted-foreground text-center">
            No active changes. Create one in <code>openspec/changes/</code>
          </div>
        )}
      </div>
    </div>
  )
}
