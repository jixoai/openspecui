/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Attribute Apply instruction counts to the upstream Apply command.
 * 2. Compress agreement to one subtitle badge; keep divergence a direct blocker.
 * 3. Keep divergence's two objective source counts side by side with their causes.
 * 4. Keep tooltips as the keyboard-reachable explanation for every compact count.
 *
 * Original request (2026-07-15): "与 tracked glob 进度分歧时各自归因展示。"
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.
 * Original request (2026-08-15): Owner walkthrough: agreement is one badge in the subtitle row,
 *   not a two-line block; only divergence owns a notice.
 */
import { InformationBadge } from '@/components/information-disclosure'
import type { ApplyInstructionProgress } from '@openspecui/core'
import { AlertTriangle } from 'lucide-react'

/**
 * One compact, source-attributed Apply progress badge for the Change subtitle row.
 * The Apply instruction result is the only visible implementation progress authority, so
 * this stays rendered whenever instructions exist — agreement is not a reason to hide the
 * CLI's own count, but it needs no separate block.
 */
export function ApplyProgressBadge({
  applyInstructionProgress,
}: {
  applyInstructionProgress: ApplyInstructionProgress
}) {
  const { complete, total, remaining } = applyInstructionProgress
  return (
    <InformationBadge
      ariaLabel={`Apply instructions progress ${complete} of ${total}`}
      tooltip={`Progress reported by openspec instructions apply — ${complete} of ${total} tasks applied, ${remaining} remaining.`}
    >
      Apply {complete}/{total}
    </InformationBadge>
  )
}

/**
 * Render the Apply/tracked divergence as one direct, source-attributed blocker. Returns
 * null when the sources agree — the agreement case lives in the subtitle badge row via
 * {@link ApplyProgressBadge}.
 */
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
            ariaLabel={`Apply instructions progress ${applyInstructionProgress.complete} of ${applyInstructionProgress.total}`}
            tooltip="Progress reported by openspec instructions apply."
          >
            Apply {applyInstructionProgress.complete}/{applyInstructionProgress.total}
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
