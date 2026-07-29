/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Attribute Apply instruction counts to the upstream Apply command.
 * 2. Preserve tracked artifact counts beside divergent Apply evidence.
 * 3. Keep divergence direct while compressing its two objective source counts.
 *
 * Original request (2026-07-15): "与 tracked glob 进度分歧时各自归因展示。"
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.
 */
import { InformationBadge } from '@/components/information-disclosure'
import type { ApplyInstructionProgress } from '@openspecui/core'
import { AlertTriangle } from 'lucide-react'

/** Render source-attributed Apply progress and any tracked-progress divergence. */
export function ApplyProgressNotice({
  applyInstructionProgress,
}: {
  applyInstructionProgress: ApplyInstructionProgress
}) {
  const divergence = applyInstructionProgress.divergence
  if (!divergence) return null

  return (
    <div
      role="status"
      aria-label="Task progress source divergence"
      className="flex min-w-0 items-start gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-2">
        <div className="font-medium">Upstream task progress divergence</div>
        <p>{divergence.message}</p>
        <div className="flex flex-wrap gap-1.5">
          <InformationBadge
            ariaLabel={`Apply instructions progress ${divergence.apply.complete} of ${divergence.apply.total}`}
            tooltip="Progress reported by openspec instructions apply."
          >
            Apply {divergence.apply.complete}/{divergence.apply.total}
          </InformationBadge>
          <InformationBadge
            ariaLabel={`Tracked artifact glob progress ${divergence.tracked.completed} of ${divergence.tracked.total}`}
            tooltip="Progress computed from the workflow's tracked task artifact glob."
          >
            Tracked {divergence.tracked.completed}/{divergence.tracked.total}
          </InformationBadge>
        </div>
      </div>
    </div>
  )
}
