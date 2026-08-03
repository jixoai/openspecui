/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Render schema/context and artifact-rule Structured fields as a naturally expanding container-responsive form.
 * 2. Render OpenSpec 1.7 apply/archive guidance separately from artifact rules.
 * 3. Preserve accessible read-only and editable states without acquiring mutation authority.
 *
 * Original request (2026-08-01): visually edit official Active Root fields while preserving custom YAML elsewhere.
 */
import { Button } from '@/components/button'
import { Plus, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import type { ActiveRootRuleDraft, ActiveRootStructuredDraft } from './active-root-structured-draft'

export interface ActiveRootStructuredEditorProps {
  draft: ActiveRootStructuredDraft
  readOnly: boolean
  onChange(draft: ActiveRootStructuredDraft): void
}

const inputClassName =
  'border-input bg-background text-foreground placeholder:text-muted-foreground w-full min-w-0 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-primary read-only:cursor-default read-only:bg-muted/30'

function replaceRule(
  rules: ActiveRootRuleDraft[],
  index: number,
  update: Partial<Pick<ActiveRootRuleDraft, 'artifactId' | 'guidance'>>
): ActiveRootRuleDraft[] {
  return rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...update } : rule))
}

/** Pure presentation owner for Structured Active Root fields. */
export function ActiveRootStructuredEditor({
  draft,
  readOnly,
  onChange,
}: ActiveRootStructuredEditorProps) {
  const nextRuleId = useRef(1)

  return (
    <div aria-label="Structured Active Root fields" className="@container min-w-0 space-y-5">
      <div className="@2xl:grid-cols-2 grid min-w-0 grid-cols-1 gap-4">
        <label className="min-w-0 space-y-1.5 text-sm">
          <span className="font-medium">Schema</span>
          <input
            aria-label="Schema"
            value={draft.schema}
            readOnly={readOnly}
            onChange={(event) => onChange({ ...draft, schema: event.target.value })}
            className={inputClassName}
          />
          <span className="text-muted-foreground block text-xs">
            Workflow schema selected by OpenSpec for new Changes.
          </span>
        </label>

        <label className="@2xl:row-span-2 min-w-0 space-y-1.5 text-sm">
          <span className="font-medium">Project context</span>
          <textarea
            aria-label="Project context"
            value={draft.context}
            readOnly={readOnly}
            rows={7}
            onChange={(event) => onChange({ ...draft, context: event.target.value })}
            className={`${inputClassName} resize-y`}
          />
          <span className="text-muted-foreground block text-xs">
            Injected into artifact and operation instructions; maximum 50 KiB UTF-8.
          </span>
        </label>
      </div>

      <section aria-labelledby="active-root-rules-title" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="active-root-rules-title" className="text-sm font-medium">
              Artifact rules
            </h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Additional rules keyed by artifact id; one rule per line.
            </p>
          </div>
          {!readOnly ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const id = `draft:${nextRuleId.current}`
                nextRuleId.current += 1
                onChange({
                  ...draft,
                  rules: [...draft.rules, { id, artifactId: '', guidance: '' }],
                })
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add artifact rules
            </Button>
          ) : null}
        </div>

        {draft.rules.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
            No artifact-specific rules.
          </p>
        ) : (
          <div className="@2xl:grid-cols-2 grid min-w-0 grid-cols-1 gap-3">
            {draft.rules.map((rule, index) => (
              <article
                key={rule.id}
                className="border-border min-w-0 space-y-2 rounded-md border p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <label className="min-w-0 flex-1 space-y-1 text-xs">
                    <span className="font-medium">Artifact id</span>
                    <input
                      aria-label={`Artifact id ${index + 1}`}
                      value={rule.artifactId}
                      readOnly={readOnly}
                      onChange={(event) =>
                        onChange({
                          ...draft,
                          rules: replaceRule(draft.rules, index, {
                            artifactId: event.target.value,
                          }),
                        })
                      }
                      className={inputClassName}
                    />
                  </label>
                  {!readOnly ? (
                    <Button
                      aria-label={`Remove artifact rules ${index + 1}`}
                      variant="ghost"
                      size="icon-sm"
                      className="mt-5"
                      onClick={() =>
                        onChange({
                          ...draft,
                          rules: draft.rules.filter((candidate) => candidate.id !== rule.id),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
                <label className="block min-w-0 space-y-1 text-xs">
                  <span className="font-medium">Rules</span>
                  <textarea
                    aria-label={`Rules for ${rule.artifactId || `group ${index + 1}`}`}
                    value={rule.guidance}
                    readOnly={readOnly}
                    rows={4}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        rules: replaceRule(draft.rules, index, { guidance: event.target.value }),
                      })
                    }
                    className={`${inputClassName} resize-y`}
                  />
                </label>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="active-root-operations-title" className="min-w-0 space-y-3">
        <div>
          <h3 id="active-root-operations-title" className="text-sm font-medium">
            Operation guidance
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Advisory guidance is separate from artifact rules; one instruction per line.
          </p>
        </div>
        <div className="@2xl:grid-cols-2 grid min-w-0 grid-cols-1 gap-3">
          <label className="min-w-0 space-y-1 text-xs">
            <span className="font-medium">Apply guidance</span>
            <textarea
              aria-label="Apply guidance"
              value={draft.applyGuidance}
              readOnly={readOnly}
              rows={5}
              onChange={(event) => onChange({ ...draft, applyGuidance: event.target.value })}
              className={`${inputClassName} resize-y`}
            />
          </label>
          <label className="min-w-0 space-y-1 text-xs">
            <span className="font-medium">Archive guidance</span>
            <textarea
              aria-label="Archive guidance"
              value={draft.archiveGuidance}
              readOnly={readOnly}
              rows={5}
              onChange={(event) => onChange({ ...draft, archiveGuidance: event.target.value })}
              className={`${inputClassName} resize-y`}
            />
          </label>
        </div>
      </section>
    </div>
  )
}
