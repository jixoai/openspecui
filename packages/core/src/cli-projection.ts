/**
 * Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
 * 1. Define the browser-safe lifecycle for one cached CLI-backed projection.
 * 2. Keep settled snapshot provenance separate from replacement Work lifecycle.
 * 3. Define lifecycle-only Push notices for typed client Pull.
 * 4. Preserve exact typed CLI failure evidence without fabricating it for infrastructure errors.
 *
 * Original request (2026-07-26): "即便现在有正在的任务，界面上仍然可以读到缓存，但它也能知道这个缓存现在正在被更新中。"
 */
import { z } from 'zod'
import type { CliCommandResult, CliJsonValue } from './cli-contracts/command-result.js'
import { CliDiagnosticSchema } from './cli-contracts/common.js'

export const CliJsonValueSchema: z.ZodType<CliJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(CliJsonValueSchema),
    z.record(z.string(), CliJsonValueSchema),
  ])
)

/** Complete CLI attempt evidence retained when a Projection Work command rejects. */
export const CliProjectionCommandEvidenceSchema = z.object({
  success: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int().nullable(),
  payload: CliJsonValueSchema.nullable(),
  diagnostics: z.array(CliDiagnosticSchema),
  contractError: z.string().optional(),
})

export type CliProjectionCommandEvidence = z.infer<typeof CliProjectionCommandEvidenceSchema>

/** Serializable infrastructure failure for one Projection Work attempt. */
export const CliProjectionFailureSchema = z.object({
  name: z.string(),
  message: z.string(),
  cliEvidence: CliProjectionCommandEvidenceSchema.nullable(),
})

export type CliProjectionFailure = z.infer<typeof CliProjectionFailureSchema>

export const cliProjectionStates = [
  'loading',
  'ready',
  'revalidating',
  'error',
  'refresh-error',
] as const

export const CliProjectionStateNameSchema = z.enum(cliProjectionStates)
export type CliProjectionStateName = z.infer<typeof CliProjectionStateNameSchema>

export const cliProjectionInvalidationCauses = [
  'initial',
  'dependency',
  'explicit-refresh',
  'subscriber-resume',
] as const

export const CliProjectionInvalidationCauseSchema = z.enum(cliProjectionInvalidationCauses)
export type CliProjectionInvalidationCause = z.infer<typeof CliProjectionInvalidationCauseSchema>

interface CliProjectionStateBase {
  /** Opaque, deterministic complete Work identity. */
  identity: string
  /** Current attempt generation, including an in-flight or failed replacement. */
  workGeneration: number
  /** Objective reason that started the current attempt generation. */
  invalidationCause: CliProjectionInvalidationCause
}

/** Public Pull result for a CLI-backed projection. */
export type CliProjectionState<T> =
  | (CliProjectionStateBase & {
      state: 'loading'
      data: null
      freshness: null
      snapshotGeneration: null
      error: null
    })
  | (CliProjectionStateBase & {
      state: 'ready'
      data: T
      freshness: 'current'
      snapshotGeneration: number
      error: null
    })
  | (CliProjectionStateBase & {
      state: 'revalidating'
      data: T
      freshness: 'stale-display-only'
      snapshotGeneration: number
      error: null
    })
  | (CliProjectionStateBase & {
      state: 'error'
      data: null
      freshness: null
      snapshotGeneration: null
      error: CliProjectionFailure
    })
  | (CliProjectionStateBase & {
      state: 'refresh-error'
      data: T
      freshness: 'stale-display-only'
      snapshotGeneration: number
      error: CliProjectionFailure
    })

/** Build a runtime decoder for one concrete CLI projection payload. */
export function createCliProjectionStateSchema<TOutput, TInput>(
  dataSchema: z.ZodType<TOutput, z.ZodTypeDef, TInput>
) {
  const base = {
    identity: z.string().min(1),
    workGeneration: z.number().int().nonnegative(),
    invalidationCause: CliProjectionInvalidationCauseSchema,
  }
  return z.discriminatedUnion('state', [
    z.object({
      ...base,
      state: z.literal('loading'),
      data: z.null(),
      freshness: z.null(),
      snapshotGeneration: z.null(),
      error: z.null(),
    }),
    z.object({
      ...base,
      state: z.literal('ready'),
      data: dataSchema,
      freshness: z.literal('current'),
      snapshotGeneration: z.number().int().nonnegative(),
      error: z.null(),
    }),
    z.object({
      ...base,
      state: z.literal('revalidating'),
      data: dataSchema,
      freshness: z.literal('stale-display-only'),
      snapshotGeneration: z.number().int().nonnegative(),
      error: z.null(),
    }),
    z.object({
      ...base,
      state: z.literal('error'),
      data: z.null(),
      freshness: z.null(),
      snapshotGeneration: z.null(),
      error: CliProjectionFailureSchema,
    }),
    z.object({
      ...base,
      state: z.literal('refresh-error'),
      data: dataSchema,
      freshness: z.literal('stale-display-only'),
      snapshotGeneration: z.number().int().nonnegative(),
      error: CliProjectionFailureSchema,
    }),
  ])
}

/** Lifecycle-only Server Push that wakes a client Pull without duplicating projection data. */
export const CliProjectionNoticeSchema = z.object({
  identity: z.string().min(1),
  workGeneration: z.number().int().nonnegative(),
  snapshotGeneration: z.number().int().nonnegative().nullable(),
  state: CliProjectionStateNameSchema,
  invalidationCause: CliProjectionInvalidationCauseSchema,
})

export type CliProjectionNotice = z.infer<typeof CliProjectionNoticeSchema>

/** Error raised by a typed CLI reader while retaining its complete command evidence. */
export class CliProjectionCommandError extends Error {
  readonly cliEvidence: CliProjectionCommandEvidence

  constructor(message: string, result: CliCommandResult<unknown>) {
    super(message)
    this.name = 'CliProjectionCommandError'
    this.cliEvidence = toCliProjectionCommandEvidence(result)
  }
}

/** Remove typed business data while retaining every process/parser fact for public projection evidence. */
export function toCliProjectionCommandEvidence(
  result: CliCommandResult<unknown>
): CliProjectionCommandEvidence {
  return CliProjectionCommandEvidenceSchema.parse({
    success: result.success,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    payload: result.payload,
    diagnostics: result.diagnostics,
    ...(result.contractError ? { contractError: result.contractError } : {}),
  })
}

/** Convert an unknown Work rejection into the stable public failure boundary. */
export function toCliProjectionFailure(error: unknown): CliProjectionFailure {
  if (error instanceof CliProjectionCommandError) {
    return {
      name: error.name,
      message: error.message,
      cliEvidence: error.cliEvidence,
    }
  }
  return error instanceof Error
    ? { name: error.name, message: error.message, cliEvidence: null }
    : { name: 'Error', message: String(error), cliEvidence: null }
}

/** Drop business data and exact errors from one Pull state before Server Push. */
export function toCliProjectionNotice<T>(state: CliProjectionState<T>): CliProjectionNotice {
  return {
    identity: state.identity,
    workGeneration: state.workGeneration,
    snapshotGeneration: state.snapshotGeneration,
    state: state.state,
    invalidationCause: state.invalidationCause,
  }
}
