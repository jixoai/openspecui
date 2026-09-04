/**
 * Orthogonal intents (updated 2026-09-04 Asia/Shanghai):
 * 1. Own the Change Evidence tab's container-responsive list-detail workspace topology.
 * 2. Preserve the decision-plane evidence layer order (summary/paths -> requirement diffs ->
 *    validation findings -> archived validation -> CLI/raw payload) in keyboard-reachable
 *    list rows.
 * 3. Derive row chips only from settled section facts; never fabricate counts or verdicts.
 * 4. Keep the crowded drill presentational: the detail replaces the list with a back
 *    affordance, and back restores the list without unmounting settled evidence; focus
 *    follows the drill (row -> back affordance -> originating row) so keyboard users never
 *    land on a hidden element.
 * 5. Keep sub-selection local runtime state — it never enters routes or browser storage.
 * 6. Separate the workspace planes visually: the list column is the muted rail and the
 *    detail column is the card surface; detail prose caps its measure, and only the
 *    selected row ever carries a row fill.
 *
 * Original request (2026-08-28): "使用移动端的 list-detail 思维……分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 * Owner walkthrough correction (2026-09-04): findings must attribute their owning change; the Evidence detail panel styling follows the vision review and every detail layer renders the shared EvidenceLayerHeader contract (title dominant over body, house-standard border padding) instead of a local weak header.
 */
import {
  ArchivedValidationEvidence,
  type ArchivedValidationEvidenceChip,
} from '@/components/archived-validation-evidence'
import { Badge } from '@/components/badge'
import type { ChangeReferenceEvidence } from '@/components/change-context-summary'
import { ChangeDiffEvidence, type ChangeDiffEvidenceChip } from '@/components/change-diff-evidence'
import {
  ChangeCliResultSection,
  ChangeSummaryPathsSection,
} from '@/components/change-evidence-panel'
import {
  ValidationFindingsEvidence,
  type ValidationFindingsEvidenceChip,
} from '@/components/validation-findings-evidence'
import { cn } from '@/lib/utils'
import type { ChangeStatus } from '@openspecui/core'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/**
 * Spacious threshold: below this inline size the workspace collapses to one column and the
 * list becomes the drill entry surface. 640px sustains the widest list rail (280px) plus a
 * ~360px detail reading column — the minimum at which the `@[32rem]` fact/provenance grids
 * inside every section still render as two columns without horizontal pressure.
 */
const EVIDENCE_SPACIOUS_MIN_WIDTH = 640

/** Row-chip fact union across sections; `tone` picks the semantic color, never a count. */
export interface EvidenceChipFact {
  label: string
  tone: 'neutral' | 'positive' | 'negative' | 'unavailable' | 'error'
}

interface EvidenceWorkspaceSection {
  id: string
  label: string
  /** Only settled facts may project a chip; `null`/absent renders no chip. */
  chip?: EvidenceChipFact | null
  content: ReactNode
}

const CHIP_TONE_CLASS: Record<EvidenceChipFact['tone'], string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  positive: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  negative: 'border border-destructive/40 bg-destructive/10 text-destructive',
  unavailable: 'border-border bg-muted/60 text-muted-foreground',
  error: 'border border-destructive/40 bg-destructive/10 text-destructive',
}

/**
 * Container-width topology state through the same ResizeObserver seam the Git list-detail
 * layout uses: the observed box is the workspace container itself, never the viewport, so
 * the drill semantics track the CSS `@container` grid breakpoint (640px) exactly.
 */
function useSpaciousEvidenceLayout() {
  const ref = useRef<HTMLElement | null>(null)
  const [spacious, setSpacious] = useState(false)

  useEffect(() => {
    // No-ResizeObserver environments stay on the crowded base on purpose: any engine old
    // enough to lack ResizeObserver also lacks `@container`, so the CSS grid stays on its
    // single-column base and the JS topology never disagrees with the rendered one.
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      setSpacious((entry?.contentRect.width ?? 0) >= EVIDENCE_SPACIOUS_MIN_WIDTH)
    })

    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  return { ref, spacious }
}

/** Container-responsive list-detail workspace that carries the whole Change Evidence tab. */
export function EvidenceWorkspace({
  changeId,
  status,
  referenceEvidence,
}: {
  changeId: string
  status: ChangeStatus
  referenceEvidence: ChangeReferenceEvidence
}) {
  const { ref, spacious } = useSpaciousEvidenceLayout()
  const [selectedId, setSelectedId] = useState('summary-paths')
  const [drilled, setDrilled] = useState(false)
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const backRef = useRef<HTMLButtonElement | null>(null)
  const drilledByRowId = useRef<string | null>(null)
  const pendingRestoreRowId = useRef<string | null>(null)
  // Captured while the back affordance still exists: once the spacious topology unmounts it,
  // its ref is already null and document.activeElement has fallen to body, so focus ownership
  // must be recorded by focus events rather than inspected after the fact.
  const backHadFocus = useRef(false)
  const [diffChip, setDiffChip] = useState<ChangeDiffEvidenceChip | null>(null)
  const [findingsChip, setFindingsChip] = useState<ValidationFindingsEvidenceChip | null>(null)
  const [validationChip, setValidationChip] = useState<ArchivedValidationEvidenceChip | null>(null)

  const handleDiffChip = useCallback((chip: ChangeDiffEvidenceChip | null) => {
    setDiffChip(chip)
  }, [])
  const handleFindingsChip = useCallback((chip: ValidationFindingsEvidenceChip | null) => {
    setFindingsChip(chip)
  }, [])
  const handleValidationChip = useCallback((chip: ArchivedValidationEvidenceChip | null) => {
    setValidationChip(chip)
  }, [])

  // Decision-plane layer order; static snapshots publish no CLI-result section (the same
  // fact the stacked panel expressed by omitting it).
  const sections = useMemo<readonly EvidenceWorkspaceSection[]>(() => {
    const liveSections: EvidenceWorkspaceSection[] =
      status.provenance.kind === 'static'
        ? []
        : [
            {
              id: 'cli-result',
              label: 'CLI result',
              content: <ChangeCliResultSection status={status} />,
            },
          ]
    return [
      {
        id: 'summary-paths',
        label: 'Summary & paths',
        content: (
          <ChangeSummaryPathsSection status={status} referenceEvidence={referenceEvidence} />
        ),
      },
      {
        id: 'requirement-diffs',
        label: 'Requirement diffs',
        chip: diffChip,
        content: <ChangeDiffEvidence changeId={changeId} onChip={handleDiffChip} />,
      },
      {
        id: 'validation-findings',
        label: 'Validation findings',
        chip: findingsChip,
        content: <ValidationFindingsEvidence changeId={changeId} onChip={handleFindingsChip} />,
      },
      {
        id: 'archived-validation',
        label: 'Archived validation',
        chip: validationChip,
        content: <ArchivedValidationEvidence onChip={handleValidationChip} />,
      },
      ...liveSections,
    ]
  }, [
    changeId,
    diffChip,
    findingsChip,
    handleDiffChip,
    handleFindingsChip,
    handleValidationChip,
    referenceEvidence,
    status,
    validationChip,
  ])

  const activeSection = sections.find((section) => section.id === selectedId) ?? sections[0]
  // Crowded drill topology: the list is the entry surface; an activated row reveals the
  // detail as the visible surface. Spacious shows both panes side by side at all times.
  const showList = spacious || !drilled
  const showDetail = spacious || drilled

  const selectSection = useCallback(
    (id: string) => {
      setSelectedId(id)
      if (!spacious) {
        drilledByRowId.current = id
        setDrilled(true)
      }
    },
    [spacious]
  )
  const backToList = useCallback(() => {
    pendingRestoreRowId.current = drilledByRowId.current
    drilledByRowId.current = null
    setDrilled(false)
  }, [])

  // Focus handoff for the crowded drill: opening the detail moves focus to the back
  // affordance (the first control of the newly revealed surface); returning moves it back
  // to the row that opened the drill. Without this, keyboard focus stays on a hidden row.
  useEffect(() => {
    if (drilled && !spacious) {
      backRef.current?.focus()
    } else if (!drilled) {
      const rowId = pendingRestoreRowId.current
      pendingRestoreRowId.current = null
      if (rowId) rowRefs.current.get(rowId)?.focus()
    } else if (drilled && spacious && backHadFocus.current) {
      // Growing into the spacious topology unmounts the back affordance; move its captured
      // focus to the selected row instead of letting it fall to body.
      backHadFocus.current = false
      rowRefs.current.get(selectedId)?.focus()
    }
  }, [drilled, spacious, selectedId])

  return (
    <section
      ref={ref}
      aria-label="Change Evidence"
      data-evidence-workspace=""
      data-evidence-topology={spacious ? 'spacious' : 'crowded'}
      className="@container/evidence-workspace flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div className="@[40rem]:grid-cols-[clamp(12.5rem,24cqw,17.5rem)_minmax(0,1fr)] grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden">
        <nav
          aria-label="Evidence sections"
          data-evidence-pane="list"
          hidden={!showList || undefined}
          className={cn(
            // List plane: muted rail; only the selected row ever carries a row fill, so a
            // gray row can never read as a selection state.
            'scrollbar-thin scrollbar-track-transparent bg-muted/40 border-border @[40rem]:border-r min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain',
            !showList && 'hidden'
          )}
        >
          <ul className="divide-border/20 m-0 list-none divide-y p-0">
            {sections.map((section) => {
              const selected = section.id === activeSection.id
              return (
                <li key={section.id}>
                  <button
                    ref={(node) => {
                      if (node) rowRefs.current.set(section.id, node)
                      else rowRefs.current.delete(section.id)
                    }}
                    type="button"
                    data-evidence-row={section.id}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => selectSection(section.id)}
                    className={cn(
                      'focus-visible:ring-primary hover:bg-muted flex min-h-10 w-full min-w-0 items-center justify-between gap-2 px-3 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset',
                      selected && 'bg-primary text-primary-foreground hover:bg-primary font-medium'
                    )}
                  >
                    <span className="min-w-0 truncate">{section.label}</span>
                    {section.chip ? (
                      <Badge tone="custom" size="xs" className={CHIP_TONE_CLASS[section.chip.tone]}>
                        {section.chip.label}
                      </Badge>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        <div
          data-evidence-pane="detail"
          data-change-evidence-scroll-owner=""
          hidden={!showDetail || undefined}
          className={cn(
            // Detail plane: the card surface beside the muted list rail. Prose paragraphs
            // cap their measure so long evidence lines stay readable at wide widths.
            'scrollbar-thin scrollbar-track-transparent bg-card min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain',
            showDetail ? 'flex flex-col' : 'hidden'
          )}
        >
          {!spacious && drilled ? (
            <button
              ref={backRef}
              type="button"
              data-evidence-back=""
              aria-label="Back to evidence list"
              onFocus={() => {
                backHadFocus.current = true
              }}
              onBlur={() => {
                backHadFocus.current = false
              }}
              onClick={backToList}
              className="bg-card/95 border-border/60 text-muted-foreground hover:text-foreground focus-visible:ring-primary sticky top-0 z-10 flex min-h-9 w-full min-w-0 items-center gap-1.5 border-b px-3 text-xs outline-none backdrop-blur focus-visible:ring-2 focus-visible:ring-inset"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Evidence list
            </button>
          ) : null}
          {sections.map((section) => (
            <div
              key={section.id}
              data-evidence-detail={section.id}
              // Every section stays mounted so re-selection never refetches settled evidence;
              // `hidden` keeps the inactive ones out of the accessibility tree. Paragraph
              // prose inside the detail caps its measure; monospace facts and code blocks
              // keep the full column.
              hidden={section.id !== activeSection.id}
              className="min-w-0 px-4 pb-6 pt-3 [&_p]:max-w-[88ch]"
            >
              {section.content}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
