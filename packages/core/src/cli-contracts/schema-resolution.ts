/**
 * Orthogonal intents (created 2026-08-15 Asia/Shanghai):
 * 1. Decode `schemas --json` as a success-array or selected-Root failure sum type.
 * 2. Keep the 1.9 failure envelope's diagnostics and absent Root distinct from an empty catalog.
 * 3. Reuse the shared SchemaInfo entry shape across success and failure envelopes.
 * 4. Keep the sum type importable from browser-safe Core consumers without workflow contracts.
 *
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { z } from 'zod'
import { CliDiagnosticSchema } from './common.js'

/** One workflow schema discovered by the CLI-selected OpenSpec runtime. */
export const CliSchemaInfoSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    artifacts: z.array(z.string()),
    source: z.enum(['project', 'user', 'package']),
  })
  .passthrough()

/** Successful `openspec schemas --json` result: a bare SchemaInfo array. */
export const CliSchemasSuccessSchema = z.array(CliSchemaInfoSchema)

/**
 * Failed `openspec schemas --json` result for OpenSpec 1.9: the CLI emits
 * `{ schemas: [], root: null, status }` when Root selection fails. The empty
 * array is transport shape, not an empty successful catalog.
 */
export const CliSchemasFailureSchema = z
  .object({
    schemas: z.array(CliSchemaInfoSchema),
    root: z.null(),
    status: z.array(CliDiagnosticSchema).min(1),
  })
  .passthrough()

/** Typed sum result of `openspec schemas --json`. */
export const CliSchemasSchema = z.union([CliSchemasSuccessSchema, CliSchemasFailureSchema])

/** Distinguish the selected-Root failure envelope from a successful schema array. */
export function isCliSchemasFailure(schemas: CliSchemas): schemas is CliSchemasFailure {
  return !Array.isArray(schemas)
}

export type CliSchemasSuccess = z.infer<typeof CliSchemasSuccessSchema>
export type CliSchemasFailure = z.infer<typeof CliSchemasFailureSchema>
export type CliSchemas = z.infer<typeof CliSchemasSchema>
