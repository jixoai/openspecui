/**
 * Orthogonal intents (created 2026-07-20 Asia/Shanghai):
 * 1. Render the Server-owned planning-root target shared by OPSX workflow surfaces.
 * 2. Keep Store identity and root source visible without reconstructing client paths.
 *
 * Original request (2026-07-20): "New/Propose/Compose/Verify must show the returned target before dispatch."
 */
import type { WorkflowInvocationTargetV2 } from '@openspecui/core'

/** Render one prepared workflow target; null is intentionally unavailable in static mode. */
export function WorkflowTargetNotice({
  target,
  stale = false,
}: {
  target: WorkflowInvocationTargetV2 | null
  stale?: boolean
}) {
  if (!target) return null
  return (
    <div className="border-border bg-muted/30 grid min-w-0 gap-1 rounded-md border p-2 text-xs sm:grid-cols-[auto_1fr] sm:gap-x-3">
      <span className="text-muted-foreground">
        Planning root{stale ? ' (stale, dispatch locked)' : ''}
      </span>
      <span className="min-w-0 break-all font-mono">{target.planningRoot.path}</span>
      <span className="text-muted-foreground">Root source</span>
      <span>
        {target.planningRoot.source}
        {target.storeId ? ` · Store ${target.storeId}` : ''}
      </span>
    </div>
  )
}
