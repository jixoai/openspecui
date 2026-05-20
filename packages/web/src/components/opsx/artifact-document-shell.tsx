import type { ArtifactStatus } from '@openspecui/core'
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import type { ReactNode } from 'react'

const statusConfig: Record<
  ArtifactStatus['status'],
  { label: string; className: string; icon: typeof Circle }
> = {
  done: { label: 'Done', className: 'text-emerald-500', icon: CheckCircle2 },
  ready: { label: 'Ready', className: 'text-sky-500', icon: Circle },
  blocked: { label: 'Blocked', className: 'text-amber-500', icon: AlertTriangle },
}

export function OpsxArtifactStatusBadge({ status }: { status: ArtifactStatus['status'] }) {
  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${config.className}`}
    >
      <StatusIcon className="h-4 w-4" />
      {config.label}
    </span>
  )
}

export function OpsxArtifactTabStatusIcon({ status }: { status: ArtifactStatus['status'] }) {
  const StatusIcon = statusConfig[status].icon
  return <StatusIcon className={`h-3.5 w-3.5 ${statusConfig[status].className}`} />
}

export function OpsxArtifactDocumentShell({
  id,
  path,
  status,
  missingDeps,
  meta,
  children,
}: {
  id: string
  path?: string
  status?: ArtifactStatus['status']
  missingDeps?: readonly string[]
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <section className="border-border bg-muted/25 mb-5 rounded-md border px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="font-medium">{id}</div>
            {path ? <div className="text-muted-foreground break-all text-xs">{path}</div> : null}
          </div>
          {status ? <OpsxArtifactStatusBadge status={status} /> : meta}
        </div>
        {status === 'blocked' && missingDeps?.length ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Blocked by missing dependencies</div>
              <div className="mt-1">{missingDeps.join(', ')}</div>
            </div>
          </div>
        ) : null}
      </section>
      {children}
    </>
  )
}
