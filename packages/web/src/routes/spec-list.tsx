import { useQuery } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { useRealtimeUpdates } from '@/lib/use-realtime'
import { Link } from '@tanstack/react-router'
import { FileText, ChevronRight } from 'lucide-react'

export function SpecList() {
  // Subscribe to realtime updates
  useRealtimeUpdates()

  const { data: specs, isLoading } = useQuery(trpc.spec.listWithMeta.queryOptions())

  if (isLoading) {
    return <div className="animate-pulse">Loading specs...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Specifications</h1>

      <div className="border border-border rounded-lg divide-y divide-border">
        {specs?.map((spec) => (
          <Link
            key={spec.id}
            to="/specs/$specId"
            params={{ specId: spec.id }}
            className="flex items-center justify-between p-4 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{spec.name}</div>
                <div className="text-sm text-muted-foreground">{spec.id}</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
        {specs?.length === 0 && (
          <div className="p-4 text-muted-foreground text-center">
            No specs found. Create a spec in <code>openspec/specs/</code>
          </div>
        )}
      </div>
    </div>
  )
}
