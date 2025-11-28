import { useQuery } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { useRealtimeUpdates } from '@/lib/use-realtime'
import { formatRelativeTime } from '@/lib/format-time'
import { Link } from '@tanstack/react-router'
import { Archive, ChevronRight } from 'lucide-react'

export function ArchiveList() {
  useRealtimeUpdates()

  const { data: archived, isLoading } = useQuery(trpc.archive.listWithMeta.queryOptions())

  if (isLoading) {
    return <div className="animate-pulse">Loading archived changes...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Archive className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Archive</h1>
      </div>

      <p className="text-muted-foreground">
        Completed changes that have been archived after implementation.
      </p>

      <div className="border border-border rounded-lg divide-y divide-border">
        {archived?.map((change) => (
          <Link
            key={change.id}
            to="/archive/$changeId"
            params={{ changeId: change.id }}
            className="flex items-center justify-between p-4 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <Archive className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{change.name}</div>
                <div className="text-sm text-muted-foreground">
                  {change.id}
                  {change.updatedAt > 0 && <> · {formatRelativeTime(change.updatedAt)}</>}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
        {archived?.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No archived changes yet.</p>
            <p className="text-sm mt-2">
              Changes are archived after implementation using{' '}
              <code className="bg-muted px-1 rounded">openspec archive</code>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
