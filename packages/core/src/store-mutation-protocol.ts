/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Runtime-decode the browser-visible Store mutation lifecycle records.
 * 2. Preserve correlated start/rejoin and lifecycle stream envelopes.
 * 3. Keep Store mutation transport separate from Store inventory and Root projections.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 *
 * This intentionally covers only the P3-A mutation protocol. Health, Store inventory, Doctor, and Root
 * Context envelopes remain separate P4 work.
 */
import { z } from 'zod'
import { CliDiagnosticSchema } from './cli-contracts/common.js'

/** Browser-safe runtime schema for terminal CLI evidence retained by a Store mutation. */
export const StoreMutationResultSchema = z.object({
  exitStatus: z.number().int().nullable(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  diagnostics: z.array(CliDiagnosticSchema).optional(),
  payload: z.unknown().optional(),
  contractError: z.string().optional(),
})

const StoreMutationRecordSchema = z.object({
  requestId: z.string().min(1),
  envUri: z.string().min(1),
  kind: z.enum(['setup', 'register', 'unregister', 'remove']),
  storeId: z.string().min(1).optional(),
  observedAt: z.number().int().nonnegative(),
})

/** Browser-safe correlated schema for one Server-owned Store mutation record. */
export const StoreMutationSchema = z.discriminatedUnion('status', [
  StoreMutationRecordSchema.extend({
    status: z.enum(['accepted', 'running']),
    result: z.undefined().optional(),
  }),
  StoreMutationRecordSchema.extend({
    status: z.enum(['succeeded', 'failed', 'indeterminate']),
    result: StoreMutationResultSchema,
  }),
])

/** Runtime-decoded response for a mutation admission or a request-id rejoin. */
export const StoreMutationStartResponseSchema = z.object({
  record: StoreMutationSchema,
  rejoined: z.boolean(),
})

/** Runtime-decoded Server lifecycle stream: a complete local-ledger snapshot or one changed record. */
export const StoreMutationLifecycleEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('snapshot'),
    cursor: z.number().int().nonnegative(),
    records: z.array(StoreMutationSchema),
  }),
  z.object({
    type: z.literal('changed'),
    cursor: z.number().int().nonnegative(),
    record: StoreMutationSchema,
  }),
])

/** Runtime-decoded terminal CLI evidence. */
export type StoreMutationResultEnvelope = z.infer<typeof StoreMutationResultSchema>
/** Runtime-decoded Server-owned Store mutation record. */
export type StoreMutationEnvelope = z.infer<typeof StoreMutationSchema>
/** Runtime-decoded mutation admission or rejoin response. */
export type StoreMutationStartResponse = z.infer<typeof StoreMutationStartResponseSchema>
/** Runtime-decoded lifecycle snapshot/change event. */
export type StoreMutationLifecycleEvent = z.infer<typeof StoreMutationLifecycleEventSchema>
