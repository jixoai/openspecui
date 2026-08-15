/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Attribute Apply instruction counts to the upstream Apply command.
 * 2. Preserve tracked artifact counts beside divergent Apply evidence.
 * 3. Keep divergence direct while compressing its two objective source counts.
 * 4. Render Apply progress whenever instructions exist, divergence secondary.
 *
 * Original request (2026-07-15): "与 tracked glob 进度分歧时各自归因展示。"
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { InformationBadge } from '@/components/information-disclosure'
import type { ApplyInstructionProgress } from '@openspecui/core'
import { AlertTriangle } from 'lucide-react'

/**
 * Render source-attributed Apply progress whenever Apply Instructions exist, with tracked
 * data only as a secondary comparison when it diverges. Agreement is not a reason to hide
 * the CLI's own count: the Apply instruction result is the only visible implementation
 * progress authority.
 */
export function ApplyProgressNotice({
  applyInstructionProgress,
}: {
  applyInstructionProgress: ApplyInstructionProgress
}) {
  const divergence = applyInstructionProgress.divergence

  return (
    <div
      role="status"
      aria-label={
        divergence ? 'Task progress source divergence' : 'Apply instruction task progress'
      }
      className={
        divergence
          ? 'flex min-w-0 items-start gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100'
          : 'border-border bg-muted/30 flex min-w-0 items-start gap-2 px-3 py-2 text-xs'
      }
    >
      {divergence ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      <div className="min-w-0 space-y-2">
        <div className="font-medium">
          {divergence ? 'Upstream task progress divergence' : 'Apply task progress'}
        </div>
        {divergence ? <p>{divergence.message}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          <InformationBadge
            ariaLabel={`Apply instructions progress ${applyInstructionProgress.complete} of ${applyInstructionProgress.total}`}
            tooltip="Progress reported by openspec instructions apply."
          >
            Apply {applyInstructionProgress.complete}/{applyInstructionProgress.total}
          </InformationBadge>
          {divergence ? (
            <InformationBadge
              ariaLabel={`Tracked artifact glob progress ${divergence.tracked.completed} of ${divergence.tracked.total}`}
              tooltip="Progress computed from the workflow's tracked task artifact glob."
            >
              Tracked {divergence.tracked.completed}/{divergence.tracked.total}
            </InformationBadge>
          ) : null}
        </div>
      </div>
    </div>
  )
}
