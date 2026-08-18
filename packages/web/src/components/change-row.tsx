/**
 * Orthogonal intents (created 2026-08-15 Asia/Shanghai):
 * 1. Render one Change row with a grid: icon, title/subtitle, and a right rail.
 * 2. Keep the phase badge vertically centered while the time anchors the rail bottom.
 * 3. Share the exact row vocabulary between the Changes list and Dashboard.
 * 4. Preserve shared-element bindings for View Transition continuity.
 * 5. Render an optional CLI Apply ratio as an ambient fill without making local tracked data authoritative.
 *
 * Original request (2026-08-15): Owner walkthrough: grid layout, subtitle facts, badge
 *   centered with time at the bottom, one atomic row component across pages.
 */
import { Badge } from '@/components/badge'
import { getSharedElementBinding } from '@/lib/view-transitions/shared-elements'
import { ChevronRight, GitBranch } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface ChangeRowPhase {
  label: string
  toneClass: string
}

/** Ambient fill behind a phase badge; the caller must derive this ratio from CLI evidence. */
function PhaseBadgeProgressFill({ ratio }: { ratio: number }) {
  if (!Number.isFinite(ratio) || ratio <= 0) return null
  const clamped = Math.min(100, Math.max(0, ratio * 100))
  return (
    <span
      aria-hidden="true"
      className="bg-primary/50 pointer-events-none absolute inset-y-0 left-0"
      style={{ width: `${clamped}%` }}
    />
  )
}

/** Shared Change-row layout: icon | title+subtitle | badge(time) | chevron. */
export function ChangeRow({
  changeId,
  name,
  subtitle,
  phase,
  updatedAt,
  formatTime,
  sharedFamily = 'changes',
  className = '',
  progressRatio = null,
  containerProps,
  titleProps,
  iconProps,
}: {
  changeId: string
  name: string
  /** Objective planning facts line under the title (artifacts, schema, and CLI task facts). */
  subtitle: ReactNode
  phase: ChangeRowPhase
  /** Epoch ms; non-positive renders no time. */
  updatedAt: number
  formatTime: (ms: number) => string
  /** CLI-reported Apply ratio (0..1); null renders no implementation-progress fill. */
  progressRatio?: number | null
  sharedFamily?: string
  className?: string
  containerProps?: ComponentPropsWithoutRef<'div'>
  titleProps?: ComponentPropsWithoutRef<'div'>
  iconProps?: ComponentPropsWithoutRef<typeof GitBranch>
}) {
  const sharedDescriptor = { family: sharedFamily, entityId: changeId } as const
  return (
    <div
      {...containerProps}
      {...getSharedElementBinding(sharedDescriptor, 'container')}
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-x-3 ${className}`}
    >
      <div className="flex items-center">
        <GitBranch
          {...iconProps}
          {...getSharedElementBinding(sharedDescriptor, 'icon')}
          className="text-muted-foreground h-5 w-5 shrink-0"
        />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-0.5 py-0.5">
        <div
          {...titleProps}
          {...getSharedElementBinding(sharedDescriptor, 'title')}
          className="truncate font-medium"
        >
          {name}
        </div>
        <div className="text-muted-foreground truncate text-xs">{subtitle}</div>
      </div>
      <div className="flex flex-col items-end justify-between gap-1 text-right">
        <div className="flex flex-1 items-center">
          <Badge
            tone="custom"
            size="sm"
            shape="box"
            className={`relative overflow-hidden border ${phase.toneClass}`}
          >
            <PhaseBadgeProgressFill ratio={progressRatio ?? Number.NaN} />
            <span className="relative">{phase.label}</span>
          </Badge>
        </div>
        {updatedAt > 0 ? (
          <span className="text-muted-foreground shrink-0 text-xs">{formatTime(updatedAt)}</span>
        ) : null}
      </div>
    </div>
  )
}

/** Chevron affordance kept outside the grid so row layouts stay composable. */
export function ChangeRowChevron() {
  return <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
}
