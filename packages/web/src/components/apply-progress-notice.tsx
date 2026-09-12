/**
 * Orthogonal intents (updated 2026-09-12 Asia/Shanghai):
 * 1. Attribute Apply instruction counts to the upstream Apply command.
 * 2. Compress agreement to one subtitle badge; keep divergence a direct blocker.
 * 3. Keep divergence's two objective source counts side by side with their causes.
 * 4. Keep tooltips as the keyboard-reachable explanation for every compact count.
 * 5. Render OpenSpec 1.13 Apply `warnings`/`missingPrerequisites` as ONE always-visible summary
 *    row (count + build-order chain, CLI attribution) whose verbatim evidence is one explicit
 *    expansion away on the same direct plane — advisory guidance must stay discoverable without
 *    consuming the page; a Tooltip-only surface remains forbidden.
 * 6. Keep `missingPrerequisites` visually and semantically distinct from blockers (status
 *    semantics), including when the Apply state is already `ready`.
 * 7. Degrade to the previous presentation when either 1.13 field is absent — absent keys
 *    are the upstream encoding for "none", so no empty state is ever synthesized.
 *
 * Original request (2026-07-15): "与 tracked glob 进度分歧时各自归因展示。"
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.
 * Original request (2026-08-15): Owner walkthrough: agreement is one badge in the subtitle row,
 *   not a two-line block; only divergence owns a notice.
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-09-12): Owner walkthrough: the always-expanded warning/build-order blocks
 *   consumed the page; collapse them behind one summary row while keeping direct-plane discovery.
 */
import { InformationBadge } from '@/components/information-disclosure'
import type { ApplyInstructionProgress } from '@openspecui/core'
import { AlertTriangle, ChevronDown, ChevronRight, ListOrdered } from 'lucide-react'
import { Fragment, useState } from 'react'

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

/** Upstream command that owns every fact rendered by these notices. */
const APPLY_COMMAND_ATTRIBUTION = 'openspec instructions apply'

const GUIDANCE_DETAIL_ID = 'apply-readiness-guidance-detail'

/**
 * Render the Apply/tracked divergence as one direct, source-attributed blocker, plus the
 * OpenSpec 1.13 `warnings` and `missingPrerequisites` evidence as one collapsible summary row:
 * the row itself names the warning count and the build-order chain (discovery needs no hover),
 * and expanding reveals the verbatim upstream evidence on the same direct plane.
 * Returns null when none apply — the agreement case lives in the subtitle badge row via
 * {@link ApplyProgressBadge}, and absent 1.13 keys render nothing.
 */
export function ApplyProgressNotice({
  applyInstructionProgress,
  warnings,
  missingPrerequisites,
}: {
  applyInstructionProgress: ApplyInstructionProgress
  /** OpenSpec 1.13 additive member: verbatim upstream warning strings, absent when none. */
  warnings?: readonly string[]
  /** OpenSpec 1.13 additive member: build-order ids still to create, absent when none. */
  missingPrerequisites?: readonly string[]
}) {
  const divergence = applyInstructionProgress.divergence
  const hasWarnings = (warnings?.length ?? 0) > 0
  const hasPrerequisites = (missingPrerequisites?.length ?? 0) > 0
  const [expanded, setExpanded] = useState(false)
  if (!divergence && !hasWarnings && !hasPrerequisites) return null

  const guidanceSummaryParts: string[] = []
  if (hasWarnings) {
    const count = warnings!.length
    guidanceSummaryParts.push(`${count} apply warning${count > 1 ? 's' : ''}`)
  }
  if (hasPrerequisites) {
    guidanceSummaryParts.push(`next in build order: ${missingPrerequisites!.join(' → ')}`)
  }

  return (
    <>
      {hasWarnings || hasPrerequisites ? (
        <div
          role="status"
          data-apply-notice="summary"
          aria-label={`Apply readiness guidance from ${APPLY_COMMAND_ATTRIBUTION}`}
          className={
            hasWarnings
              ? 'flex min-w-0 items-center gap-2 border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100'
              : 'text-muted-foreground flex min-w-0 items-center gap-2 rounded-md border px-3 py-1.5 text-xs'
          }
        >
          {hasWarnings ? (
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ListOrdered className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={GUIDANCE_DETAIL_ID}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          >
            <span className="truncate font-medium">{guidanceSummaryParts.join(' · ')}</span>
            <span className="text-muted-foreground shrink-0 font-normal">
              — {APPLY_COMMAND_ATTRIBUTION}
            </span>
          </button>
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
        </div>
      ) : null}
      {expanded && (hasWarnings || hasPrerequisites) ? (
        <div
          id={GUIDANCE_DETAIL_ID}
          className="text-muted-foreground space-y-2 rounded-md border px-3 py-2 text-xs"
        >
          {hasWarnings ? (
            <div data-apply-notice="warnings" className="min-w-0 space-y-1">
              <div className="text-foreground font-medium">
                Apply warnings — reported by {APPLY_COMMAND_ATTRIBUTION}
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
          {hasPrerequisites ? (
            <div data-apply-notice="build-order" className="min-w-0 space-y-1">
              <div className="text-foreground font-medium">
                Next in build order — reported by {APPLY_COMMAND_ATTRIBUTION}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {missingPrerequisites?.map((artifactId, index) => (
                  <Fragment key={artifactId}>
                    {index > 0 ? (
                      <span className="text-muted-foreground/70" aria-hidden="true">
                        →
                      </span>
                    ) : null}
                    <span className="bg-muted break-words rounded border px-1 py-0.5 font-mono [overflow-wrap:anywhere]">
                      {artifactId}
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {divergence ? (
        <div
          role="status"
          data-apply-notice="divergence"
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
      ) : null}
    </>
  )
}
