import { formatRelativeTime } from '@/lib/format-time'
import { useArchivesSubscription } from '@/lib/use-subscription'
import { Link } from '@tanstack/react-router'
import { Archive, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ArchiveList() {
  const { data: archived, isLoading } = useArchivesSubscription()

  const [firstFrameLoading, setFirstFrameLoading] = useState(true)
  useEffect(() => {
    const id = requestAnimationFrame(() => setFirstFrameLoading(false))
    return () => cancelAnimationFrame(id)
  }, [])

  if (firstFrameLoading || (isLoading && !archived)) {
    return <div className="route-loading animate-pulse">Loading archived changes...</div>
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <Archive className="h-6 w-6 shrink-0" />
        Archive
      </h1>

      <p className="text-muted-foreground">
        Completed changes that have been archived after implementation.
      </p>

      <div className="border-border divide-border divide-y rounded-lg border">
        {archived?.map((change) => (
          <Link
            key={change.id}
            to="/archive/$changeId"
            params={{ changeId: change.id }}
            className="hover:bg-muted/50 flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <Archive className="text-muted-foreground h-5 w-5" />
              <div>
                <div className="font-medium">{change.name}</div>
                <div className="text-muted-foreground text-sm">
                  {change.id}
                  {change.updatedAt > 0 && <> · {formatRelativeTime(change.updatedAt)}</>}
                </div>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </Link>
        ))}
        {archived?.length === 0 && (
          <div className="text-muted-foreground p-8 text-center">
            <Archive className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No archived changes yet.</p>
            <p className="mt-2 text-sm">
              Changes are archived after implementation using{' '}
              <code className="bg-muted rounded px-1">openspec archive</code>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
