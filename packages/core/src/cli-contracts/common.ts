/**
 * Orthogonal intents (created 2026-07-15 Asia/Shanghai):
 * 1. Model OpenSpec CLI diagnostics without reinterpreting their meaning.
 * 2. Preserve root selection provenance exactly as emitted by the CLI.
 * 3. Preserve direct Reference indexes and their upstream health evidence.
 *
 * Original request (2026-07-15): "CLI JSON、stderr、诊断、resolved paths、root provenance、exit status 必须完整保留。"
 */
import { z } from 'zod'

/** Upstream diagnostic emitted in a CLI JSON status array. */
export const CliDiagnosticSchema = z
  .object({
    severity: z.enum(['error', 'warning', 'info']),
    code: z.string(),
    message: z.string(),
    target: z.string().optional(),
    fix: z.string().optional(),
  })
  .passthrough()

/** Upstream provenance for the CLI-selected planning root. */
export const CliRootSourceSchema = z.enum(['store', 'declared', 'nearest', 'implicit'])

/** CLI-selected planning root with upstream selection provenance. */
export const CliRootSchema = z
  .object({
    path: z.string(),
    source: CliRootSourceSchema,
    store_id: z.string().optional(),
  })
  .passthrough()

/** Lightweight Spec fact exposed by a direct Reference index. */
export const CliReferenceSpecSchema = z
  .object({
    id: z.string(),
    summary: z.string(),
  })
  .passthrough()

/** Health-only direct Reference entry emitted by OpenSpec Doctor. */
export const CliDoctorReferenceEntrySchema = z
  .object({
    store_id: z.string(),
    root: z.string().optional(),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

/** Spec-bearing direct Reference index emitted by workflow Instructions. */
export const CliReferenceIndexEntrySchema = CliDoctorReferenceEntrySchema.extend({
  specs: z.array(CliReferenceSpecSchema).optional(),
  fetch: z.string().optional(),
}).passthrough()

/** JSON failure payload whose truth is carried entirely by upstream diagnostics. */
export const CliDiagnosticFailureSchema = z
  .object({
    status: z.array(CliDiagnosticSchema).min(1),
  })
  .passthrough()

export type CliDiagnostic = z.infer<typeof CliDiagnosticSchema>
export type CliRoot = z.infer<typeof CliRootSchema>
export type CliRootSource = z.infer<typeof CliRootSourceSchema>
/** Health-only direct Reference entry returned by OpenSpec Doctor. */
export type CliDoctorReferenceEntry = z.infer<typeof CliDoctorReferenceEntrySchema>
/** Spec-bearing direct Reference index returned by workflow Instructions. */
export type CliReferenceIndexEntry = z.infer<typeof CliReferenceIndexEntrySchema>
export type CliDiagnosticFailure = z.infer<typeof CliDiagnosticFailureSchema>
