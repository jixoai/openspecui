/**
 * Orthogonal intents (updated 2026-10-02 Asia/Shanghai):
 * 1. Render the OpenSpec 1.14 Status top-level `warnings` advisory array (unrecognized
 *    `.openspec.yaml` keys) as ONE always-visible summary row: count plus CLI attribution,
 *    discoverable without hover, so advisory evidence never hides behind a Tooltip.
 * 2. Keep the verbatim upstream warning strings one explicit expansion away on the same
 *    direct plane, under a heading that names the owning CLI command.
 * 3. Keep the warnings advisory: amber advisory tone and `role="status"` semantics, never
 *    the destructive blocker presentation, and never a gate on any action.
 * 4. Degrade to nothing when the member is absent or empty — absence is the upstream
 *    encoding for "none", so no empty state is ever synthesized.
 * 5. Mirror the v13 Apply guidance summary-row pattern (apply-progress-notice.tsx) as a
 *    parallel component: same DOM shape, roles, tone classes, and aria disclosure
 *    interaction, without refactoring the v13 notice's composite summary/detail surface.
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
 */
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

/** Upstream command that owns every fact rendered by this notice. */
const STATUS_COMMAND_ATTRIBUTION = 'openspec status'

const STATUS_WARNINGS_DETAIL_ID = 'change-status-warnings-detail'

/**
 * Render the OpenSpec 1.14 Status `warnings` as one collapsible summary row on the Change
 * Detail direct status plane: the row itself names the warning count and the owning CLI
 * command (discovery needs no hover), and expanding reveals the verbatim upstream strings
 * on the same plane. Returns null when the member is absent or empty — the upstream
 * encoding for "none" — so no empty state is ever synthesized. The warnings are advisory
 * evidence only and never gate any action.
 */
export function StatusWarningsNotice({
  warnings,
}: {
  /** OpenSpec 1.14 additive member: verbatim upstream warning strings, absent when none. */
  warnings?: readonly string[]
}) {
  const count = warnings?.length ?? 0
  const [expanded, setExpanded] = useState(false)
  if (count === 0) return null

  return (
    <>
      <div
        role="status"
        data-status-notice="summary"
        aria-label={`Change status warnings from ${STATUS_COMMAND_ATTRIBUTION}`}
        className="flex min-w-0 items-center gap-2 border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={STATUS_WARNINGS_DETAIL_ID}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <span className="truncate font-medium">
            {count} status warning{count > 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground shrink-0 font-normal">
            — {STATUS_COMMAND_ATTRIBUTION}
          </span>
        </button>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
      </div>
      {expanded ? (
        <div
          id={STATUS_WARNINGS_DETAIL_ID}
          data-status-notice="warnings"
          className="text-muted-foreground space-y-2 rounded-md border px-3 py-2 text-xs"
        >
          <div className="text-foreground font-medium">
            Status warnings — reported by {STATUS_COMMAND_ATTRIBUTION}
          </div>
          <ul className="space-y-1">
            {warnings?.map((warning) => (
              <li key={warning} className="break-words">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )
}
