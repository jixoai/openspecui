/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Expose Resolved Context as a Config title action rather than a workspace tab.
 * 2. Give live and static Resolved Context one predictable return and page identity.
 * 3. Present objective Context authority without acquiring subscription ownership.
 *
 * Owner Context direction (2026-07-29): place Context in Config title actions and provide a direct return from `/config/context`.
 */
import { InformationBadge } from '@/components/information-disclosure'
import { VTLink } from '@/lib/view-transitions/navigation'
import { ArrowLeft, Waypoints } from 'lucide-react'
import type { ReactNode } from 'react'

export type ResolvedContextStatus = 'blocked' | 'ready' | 'refreshing' | 'resolving' | 'static'

const STATUS_CONTENT: Record<
  ResolvedContextStatus,
  { label: string; tooltip: string; className?: string }
> = {
  ready: {
    label: 'Ready',
    tooltip: 'The current Root Context can authorize root-dependent operations.',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  refreshing: {
    label: 'Refreshing',
    tooltip: 'Retained facts remain readable while root-dependent operations stay locked.',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  resolving: {
    label: 'Resolving',
    tooltip: 'OpenSpec is resolving the effective Root Context.',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  blocked: {
    label: 'Blocked',
    tooltip: 'The current observation cannot authorize root-dependent operations.',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  static: {
    label: 'Static snapshot',
    tooltip: 'Published facts are read-only and carry no live mutation authority.',
  },
}

/** Config title action for inspecting the declarations' effective CLI result. */
export function ResolvedContextAction() {
  return (
    <VTLink
      to="/config/context"
      aria-label="Open Resolved Context"
      className="border-border hover:bg-muted focus-visible:ring-primary inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-medium outline-none focus-visible:ring-2"
    >
      <Waypoints className="h-4 w-4" aria-hidden />
      Context
    </VTLink>
  )
}

/** Shared live/static page header for the Config-owned Resolved Context surface. */
export function ResolvedContextHeader({
  status,
  trailing,
}: {
  status: ResolvedContextStatus
  trailing?: ReactNode
}) {
  const content = STATUS_CONTENT[status]
  return (
    <header className="space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <VTLink
          to="/config"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-primary inline-flex min-h-8 items-center gap-1.5 rounded-md px-1 text-xs outline-none focus-visible:ring-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Config
        </VTLink>
        <div className="flex min-w-0 items-center gap-2">
          {trailing}
          <InformationBadge
            ariaLabel={`Resolved Context status ${content.label.toLowerCase()}`}
            tooltip={content.tooltip}
            tone={content.className ? 'custom' : 'muted'}
            className={content.className}
          >
            {content.label}
          </InformationBadge>
        </div>
      </div>
      <h1 className="font-nav flex min-w-0 items-center gap-2 text-2xl font-bold">
        <Waypoints className="h-6 w-6 shrink-0" aria-hidden />
        Resolved Context
      </h1>
    </header>
  )
}
