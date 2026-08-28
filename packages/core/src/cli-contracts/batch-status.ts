/**
 * Orthogonal intents (created 2026-08-28 Asia/Shanghai):
 * 1. Model the OpenSpec 1.11 `status --all --json` batch envelope as a per-entry sum type.
 * 2. Decode the envelope from stdout regardless of the process exit code: exit 1 with a
 *    complete valid JSON document is a partial failure, never a transport failure.
 * 3. Preserve the root-selection failure null shape together with its shared-contract
 *    diagnostics instead of rewriting it as an empty success.
 *
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */
import { z } from 'zod'
import { CliDiagnosticSchema, CliRootSchema } from './common.js'
import { CliWorkflowStatusFieldsSchema } from './workflow.js'

/** One healthy batch entry: the single-change Status fields; the envelope owns the root. */
export const CliBatchStatusHealthyEntrySchema = CliWorkflowStatusFieldsSchema

/** One failed batch entry: per-change load diagnostics carried in place by the CLI. */
export const CliBatchStatusFailureEntrySchema = z
  .object({
    changeName: z.string(),
    status: z.array(CliDiagnosticSchema).min(1),
  })
  .passthrough()

/** One batch entry: healthy Status evidence or an in-place per-change failure. */
export const CliBatchStatusEntrySchema = z.union([
  CliBatchStatusHealthyEntrySchema,
  CliBatchStatusFailureEntrySchema,
])

/**
 * Typed result of the OpenSpec 1.11 `status --all --json` batch command.
 *
 * Decoding must not consult the process exit code: a partial failure exits 1 while
 * stdout remains one complete valid JSON document, so only an unparseable stdout
 * document is a contract/transport error. `--all` and `--change` are mutually
 * exclusive upstream; a root-selection failure yields the null shape
 * `{ changes: [], root: null }` plus the shared failure contract's `status`
 * diagnostics, which this envelope preserves.
 */
export const CliBatchStatusSchema = z
  .object({
    changes: z.array(CliBatchStatusEntrySchema),
    root: CliRootSchema.nullable(),
    /** Present only on the empty active set (exit 0). */
    message: z.literal('No active changes.').optional(),
    /** Shared JSON failure-contract diagnostics preserved on the root-selection null shape. */
    status: z.array(CliDiagnosticSchema).optional(),
  })
  .passthrough()

/**
 * Whether one batch entry carries per-change failure diagnostics.
 *
 * Mirrors the upstream discriminator: a failed entry has no `artifacts` because
 * the CLI could not load the change at all. An empty change directory still
 * loads as a healthy entry with blocked/ready artifacts and is not a failure.
 */
export function isCliBatchStatusEntryFailure(
  entry: CliBatchStatusEntry
): entry is CliBatchStatusFailureEntry {
  return !('artifacts' in entry)
}

/**
 * Whether the envelope is the root-selection failure null shape
 * (`changes: []`, `root: null`) with preserved diagnostics, rather than an
 * empty success or the empty-set message envelope.
 */
export function isCliBatchStatusRootSelectionFailure(batch: CliBatchStatus): boolean {
  return batch.changes.length === 0 && batch.root === null && (batch.status?.length ?? 0) > 0
}

export type CliBatchStatusHealthyEntry = z.infer<typeof CliBatchStatusHealthyEntrySchema>
export type CliBatchStatusFailureEntry = z.infer<typeof CliBatchStatusFailureEntrySchema>
export type CliBatchStatusEntry = z.infer<typeof CliBatchStatusEntrySchema>
export type CliBatchStatus = z.infer<typeof CliBatchStatusSchema>
