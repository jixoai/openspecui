/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Attribute Apply instruction counts to the upstream Apply command.
 * 2. Preserve tracked artifact counts beside divergent Apply evidence.
 *
 * Original request (2026-07-15): "与 tracked glob 进度分歧时各自归因展示。"
 */
import type { ApplyInstructionProgress } from '@openspecui/core'
import { AlertTriangle } from 'lucide-react'

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
      <div className="min-w-0 space-y-1">
        <div className="font-medium">Upstream task progress divergence</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Apply instructions: {divergence.apply.complete}/{divergence.apply.total}
          </span>
          <span>
            Tracked artifact glob: {divergence.tracked.completed}/{divergence.tracked.total}
          </span>
        </div>
      </div>
    </div>
  )
}
