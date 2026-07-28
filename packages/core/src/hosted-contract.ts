/**
 * Orthogonal intents (created 2026-07-25 Asia/Shanghai):
 * 1. Publish the browser-safe runtime schemas for hosted Health, Store, Root Context, and mutation facts.
 * 2. Decode one successful tRPC result envelope into typed data or retained contract-error evidence.
 * 3. Preserve upstream Store and OpenSpec diagnostic facts without inferring health or ownership.
 * 4. Keep this protocol entry free of Node runtime dependencies for hosted browser consumers.
 * 5. Publish Store CLI projection lifecycle Pull schemas and data-free Push notices.
 *
 * Original request (2026-07-24): "可以归档旧change了，然后我们继续新的change 的开发推进"
 * P4.1 contract boundary: malformed successful hosted payloads must not become asserted public facts.
 * Original request (2026-07-26): "这是一套通用的数据拉取推送技术。"
 */
import { z } from 'zod'
import {
  CliDiagnosticSchema,
  CliDoctorReferenceEntrySchema,
  CliRootSchema,
  CliRootSourceSchema,
} from './cli-contracts/common.js'
import { CliProjectionNoticeSchema, createCliProjectionStateSchema } from './cli-projection.js'
import { StoreMutationStartResponseSchema } from './store-mutation-protocol.js'
import { StoreDoctorStoreSchema, StoreListEntrySchema } from './store-types.js'

export {
  asEnvUri,
  hasCapability,
  isTerminalMutationStatus,
  type EnvUri,
  type StoreCapability,
  type StoreCapabilitySet,
  type StoreMutation,
  type StoreMutationKind,
  type StoreMutationResult,
  type StoreMutationStatus,
} from './hosted-protocol-browser.js'

export const HOSTED_SHELL_PROTOCOL_VERSION = 1

export const OPENSPECUI_RUNTIME_CAPABILITIES = [
  'notifications.subscribe',
  'config.notifications',
] as const

export const HOSTED_STORE_CAPABILITIES = [
  'stores.inspect',
  'stores.mutate',
  'contexts.inspect',
] as const

/** Display-safe summary emitted with a hosted backend health response. */
export const HostedBackendRootSummarySchema = z
  .object({
    planningRootPath: z.string().nullable(),
    rootSource: CliRootSourceSchema,
    storeId: z.string().nullable(),
    ready: z.boolean(),
  })
  .passthrough()

/** Browser-safe runtime contract for one hosted backend health response. */
export const HostedBackendHealthResponseSchema = z
  .object({
    status: z.literal('ok'),
    projectDir: z.string(),
    projectName: z.string(),
    watcherEnabled: z.boolean(),
    openspecuiVersion: z.string(),
    hostedShellProtocolVersion: z.literal(HOSTED_SHELL_PROTOCOL_VERSION),
    embeddedUiUrl: z.string(),
    runtimeCapabilities: z.array(z.enum(OPENSPECUI_RUNTIME_CAPABILITIES)),
    apiBaseUrl: z.string().optional(),
    cliVersion: z.string().nullable().optional(),
    envUri: z.string().optional(),
    rootSummary: HostedBackendRootSummarySchema.nullable().optional(),
    hostedCapabilities: z.array(z.enum(HOSTED_STORE_CAPABILITIES)).optional(),
    accessGateEnabled: z.boolean().optional(),
  })
  .passthrough()

const HostedStoreFeatureErrorSchema = z
  .object({
    kind: z.string(),
    message: z.string(),
    cliVersion: z.string().optional(),
  })
  .passthrough()

/** Browser-safe Store-list projection wrapper returned by the hosted router. */
export const HostedStoreListEnvelopeSchema = z
  .object({
    available: z.boolean(),
    stores: z.array(StoreListEntrySchema),
    evidence: z.unknown().nullable().optional(),
    error: HostedStoreFeatureErrorSchema.optional(),
    cliVersion: z.string().optional(),
  })
  .passthrough()

/** Browser-safe Store-Doctor projection wrapper returned by the hosted router. */
export const HostedStoreDoctorEnvelopeSchema = z
  .object({
    available: z.boolean(),
    stores: z.array(StoreDoctorStoreSchema),
    evidence: z.unknown().nullable().optional(),
    error: HostedStoreFeatureErrorSchema.optional(),
    cliVersion: z.string().optional(),
  })
  .passthrough()

/** Browser-safe Pull state for Store Inventory CLI Projection Work. */
export const HostedStoreListProjectionStateSchema = createCliProjectionStateSchema(
  HostedStoreListEnvelopeSchema
)

/** Browser-safe Pull state for Store Doctor CLI Projection Work. */
export const HostedStoreDoctorProjectionStateSchema = createCliProjectionStateSchema(
  HostedStoreDoctorEnvelopeSchema
)

/** Browser-safe lifecycle-only Push shared by hosted CLI projections. */
export const HostedCliProjectionNoticeSchema = CliProjectionNoticeSchema

const HostedRootContextCliSchema = z
  .object({
    available: z.boolean(),
    version: z.string().optional(),
    error: z.string().optional(),
    effectiveCommand: z.string().optional(),
    tried: z.array(z.string()).optional(),
  })
  .passthrough()

const HostedRootContextCommandEvidenceSchema = z
  .object({
    success: z.boolean(),
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number().int().nullable(),
    diagnostics: z.array(CliDiagnosticSchema),
    contractError: z.string().optional(),
  })
  .passthrough()

const HostedPlanningRootSchema = CliRootSchema.extend({
  healthy: z.boolean(),
  status: z.array(CliDiagnosticSchema),
}).passthrough()

const HostedContextMemberSchema = z
  .object({
    role: z.literal('referenced_store'),
    id: z.string(),
    path: z.string().optional(),
    remote: z.string().optional(),
    fetch: z.string().optional(),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

/** Browser-safe complete Root Context fact retained by the hosted App projection. */
export const HostedRootContextSchema = z
  .object({
    launchProject: z.object({ path: z.string() }).passthrough(),
    planningRoot: HostedPlanningRootSchema.nullable(),
    storeId: z.string().nullable(),
    generation: z.string().optional(),
    cli: HostedRootContextCliSchema,
    references: z.array(CliDoctorReferenceEntrySchema),
    contextMembers: z.array(HostedContextMemberSchema),
    dataScope: z
      .object({
        path: z.string(),
        source: z.enum(['xdg-data-home', 'local-app-data', 'user-home-default']),
        environmentVariable: z.enum(['XDG_DATA_HOME', 'LOCALAPPDATA']).nullable(),
      })
      .passthrough(),
    diagnostics: z
      .object({
        root: z.array(CliDiagnosticSchema),
        doctor: z.array(CliDiagnosticSchema),
        context: z.array(CliDiagnosticSchema),
      })
      .passthrough(),
    evidence: z
      .object({
        doctor: HostedRootContextCommandEvidenceSchema.nullable(),
        context: HostedRootContextCommandEvidenceSchema.nullable(),
      })
      .passthrough(),
    observedAt: z.number(),
  })
  .passthrough()

export const HostedRootContextErrorCodeSchema = z.enum([
  'cli-unavailable',
  'doctor-command-failed',
  'doctor-contract-drift',
  'root-unresolved',
  'root-unhealthy',
  'context-command-failed',
  'context-contract-drift',
  'context-root-mismatch',
  'references-unresolved',
  'resolver-failed',
])

const HostedRootContextLoadingStateSchema = z.object({
  state: z.literal('loading'),
  data: z.null(),
  attempt: z.null(),
  error: z.null(),
  observedAt: z.number(),
})

const HostedRootContextReadyStateSchema = z.object({
  state: z.literal('ready'),
  data: HostedRootContextSchema,
  attempt: z.null(),
  error: z.null(),
  observedAt: z.number(),
})

const HostedRootContextRefreshingStateSchema = z.object({
  state: z.literal('refreshing'),
  data: HostedRootContextSchema,
  attempt: z.null(),
  error: z.null(),
  observedAt: z.number(),
})

const HostedRootContextErrorStateSchema = z.object({
  state: z.literal('error'),
  data: HostedRootContextSchema.nullable(),
  attempt: HostedRootContextSchema,
  error: z.object({ code: HostedRootContextErrorCodeSchema, message: z.string() }),
  observedAt: z.number(),
})

/** Browser-safe settled CLI result cached by Root Context Projection Work. */
export const HostedRootContextResolvedStateSchema = z.discriminatedUnion('state', [
  HostedRootContextReadyStateSchema,
  HostedRootContextErrorStateSchema,
])

/** Browser-safe Pull lifecycle for cached Root Context CLI Projection Work. */
export const HostedRootContextProjectionStateSchema = createCliProjectionStateSchema(
  HostedRootContextResolvedStateSchema
)

/** Browser-safe legacy Root Context lifecycle retained for project-workspace adapters. */
export const HostedRootContextStateSchema = z.discriminatedUnion('state', [
  HostedRootContextLoadingStateSchema,
  HostedRootContextReadyStateSchema,
  HostedRootContextRefreshingStateSchema,
  HostedRootContextErrorStateSchema,
])

/** Hosted mutation admission shares the Server-owned P3 lifecycle schema. */
export const HostedStoreMutationStartResponseSchema = StoreMutationStartResponseSchema

/** One explicit browser-visible contract error, retaining the decoder's parse cause. */
export class HostedBackendContractError extends Error {
  readonly kind = 'contract'

  constructor(message: string, options: ErrorOptions) {
    super(message, options)
    this.name = 'HostedBackendContractError'
  }
}

/** Structural tRPC envelope used by every successful hosted router ingress. */
export const HostedTrpcResultEnvelopeSchema = z
  .object({ result: z.object({ data: z.unknown() }).passthrough() })
  .passthrough()

export type HostedTrpcDecodeResult<T> =
  | { kind: 'success'; data: T }
  | { kind: 'contract-error'; error: HostedBackendContractError }

/** Decode one successful hosted tRPC `{ result: { data } }` envelope into typed data. */
export function decodeHostedTrpcData<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  payload: unknown
): HostedTrpcDecodeResult<z.output<TSchema>> {
  const envelope = HostedTrpcResultEnvelopeSchema.safeParse(payload)
  if (!envelope.success) {
    return {
      kind: 'contract-error',
      error: new HostedBackendContractError('Malformed hosted tRPC result envelope.', {
        cause: envelope.error,
      }),
    }
  }

  const decoded = schema.safeParse(envelope.data.result.data)
  if (!decoded.success) {
    return {
      kind: 'contract-error',
      error: new HostedBackendContractError('Malformed hosted tRPC result data.', {
        cause: decoded.error,
      }),
    }
  }

  return { kind: 'success', data: decoded.data }
}

export type HostedBackendRootSummary = z.infer<typeof HostedBackendRootSummarySchema>
export type HostedBackendHealthResponse = z.infer<typeof HostedBackendHealthResponseSchema>
export type HostedStoreListEnvelope = z.infer<typeof HostedStoreListEnvelopeSchema>
export type HostedStoreDoctorEnvelope = z.infer<typeof HostedStoreDoctorEnvelopeSchema>
export type HostedStoreListProjectionState = z.infer<typeof HostedStoreListProjectionStateSchema>
export type HostedStoreDoctorProjectionState = z.infer<
  typeof HostedStoreDoctorProjectionStateSchema
>
export type HostedCliProjectionNotice = z.infer<typeof HostedCliProjectionNoticeSchema>
export type HostedRootContext = z.infer<typeof HostedRootContextSchema>
export type HostedRootContextResolvedState = z.infer<typeof HostedRootContextResolvedStateSchema>
export type HostedRootContextProjectionState = z.infer<
  typeof HostedRootContextProjectionStateSchema
>
export type HostedRootContextState = z.infer<typeof HostedRootContextStateSchema>
export type HostedRootContextErrorCode = z.infer<typeof HostedRootContextErrorCodeSchema>
export type HostedStoreMutationStartResponse = z.infer<
  typeof HostedStoreMutationStartResponseSchema
>
export type HostedCliDiagnostic = z.infer<typeof CliDiagnosticSchema>
export type HostedRootSource = z.infer<typeof CliRootSourceSchema>
