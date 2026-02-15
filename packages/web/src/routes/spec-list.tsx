import { formatRelativeTime } from '@/lib/format-time'
import { useSpecsSubscription } from '@/lib/use-subscription'
import { Link } from '@tanstack/react-router'
import { ChevronRight, FileText } from 'lucide-react'

export function SpecList() {
  const { data: specs, isLoading } = useSpecsSubscription()

  if (isLoading && !specs) {
    return <div className="route-loading animate-pulse">Loading specs...</div>
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <FileText className="h-6 w-6 shrink-0" />
        Specifications
      </h1>

      <div className="border-border divide-border divide-y rounded-lg border">
        {specs?.map((spec) => (
          <Link
            key={spec.id}
            to="/specs/$specId"
            params={{ specId: spec.id }}
            className="hover:bg-muted/50 flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <FileText className="text-muted-foreground h-5 w-5" />
              <div>
                <div className="font-medium">{spec.name}</div>
                <div className="text-muted-foreground text-sm">
                  {spec.id}
                  {spec.updatedAt > 0 && <> · {formatRelativeTime(spec.updatedAt)}</>}
                </div>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </Link>
        ))}
        {specs?.length === 0 && (
          <div className="text-muted-foreground p-4 text-center">
            No specs found. Create a spec in <code>openspec/specs/</code>
          </div>
        )}
      </div>
    </div>
  )
}
