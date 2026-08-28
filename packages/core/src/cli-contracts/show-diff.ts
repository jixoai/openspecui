/**
 * Orthogonal intents (created 2026-08-28 Asia/Shanghai):
 * 1. Model the OpenSpec 1.11 `show <change> --json --diff` success payload as separately
 *    fetched CLI evidence; the diff is never recomputed or backfilled locally.
 * 2. Document `diff`/`warning` as MODIFIED-only upstream additions; ADDED, REMOVED, and
 *    RENAMED deltas are unchanged by `--diff`, and a delta outside MODIFIED that carries
 *    either field is rejected as contract drift instead of parsed as tolerated evidence.
 * 3. Keep the shared diagnostic failure union for root-selection and unknown-item failures.
 *
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */
import { z } from 'zod'
import { CliDiagnosticFailureSchema, CliRootSchema } from './common.js'
import { CliSpecRequirementSchema } from './workflow.js'

/** One JSON delta of a change, carrying the extra fields `--diff` adds to MODIFIED entries. */
export const CliShowChangeDeltaSchema = z
  .object({
    spec: z.string(),
    operation: z.enum(['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED']),
    description: z.string().optional(),
    requirement: CliSpecRequirementSchema.optional(),
    requirements: z.array(CliSpecRequirementSchema).optional(),
    rename: z.object({ from: z.string(), to: z.string() }).optional(),
    /**
     * MODIFIED-only upstream fact (schema-tolerant, semantics documented): the unified
     * diff body between the main-spec requirement block and the delta block, with `@@`
     * hunk headers and no synthetic file headers. A renamed-then-modified requirement
     * diffs against its old main-spec name; a new capability diffs against the empty
     * string, so every line reads as an addition.
     */
    diff: z.string().optional(),
    /**
     * MODIFIED-only upstream fact (schema-tolerant, semantics documented): exactly one of
     * three upstream texts — (1) the header differs from the main spec's requirement only
     * in case or spacing, so archive will not merge it although the shown diff is the one
     * the author meant; (2) no matching main requirement was found for the looked-up name
     * in the capability; (3) no main spec exists at openspec/specs/<capability>/spec.md,
     * so the MODIFIED requirement has nothing to diff against. A near-miss header can
     * carry both a warning and its diff.
     */
    warning: z.string().optional(),
  })
  .passthrough()
  .superRefine((delta, ctx) => {
    // Upstream emits `diff`/`warning` only on MODIFIED deltas. Any other operation
    // carrying either field is contract drift, not tolerated evidence: parse fails so
    // the caller preserves the raw payload instead of trusting a fabricated shape.
    if (delta.operation === 'MODIFIED') return
    for (const field of ['diff', 'warning'] as const) {
      if (delta[field] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `Only MODIFIED deltas carry ${field} evidence; ${delta.operation} deltas never do.`,
        })
      }
    }
  })

/**
 * Typed successful `show <change> --json [--diff]` payload.
 *
 * `root` is present because the root-aware top-level `show` command attaches the
 * selected-root output on every JSON run; without `--diff` the payload is unchanged
 * and simply omits the MODIFIED-only `diff`/`warning` fields.
 */
export const CliShowChangeDiffSuccessSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    deltaCount: z.number(),
    deltas: z.array(CliShowChangeDeltaSchema),
    root: CliRootSchema,
  })
  .passthrough()

/** Typed success or diagnostic failure result of the CLI show-change JSON command. */
export const CliShowChangeDiffSchema = z.union([
  CliShowChangeDiffSuccessSchema,
  CliDiagnosticFailureSchema,
])

export type CliShowChangeDelta = z.infer<typeof CliShowChangeDeltaSchema>
export type CliShowChangeDiffSuccess = z.infer<typeof CliShowChangeDiffSuccessSchema>
export type CliShowChangeDiff = z.infer<typeof CliShowChangeDiffSchema>
