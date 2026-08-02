/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Define OpenSpec 1.7 Active Root official-field and diagnostic contracts.
 * 2. Define exact owner/file/revision mutation admission and typed recovery results.
 *
 * Original request (2026-08-01): structured fields align with official OpenSpec while raw YAML accepts team extensions.
 * Derived checkpoint (2026-08-02): stale Active Root saves return the latest physical source instead of overwriting it.
 */
import { z } from 'zod'
import type { CliRootSource } from './cli-contracts/index.js'
import type { PlanningConfigFile } from './planning-config.js'

/** OpenSpec 1.7 hard limit for project context encoded as UTF-8. */
export const MAX_ACTIVE_ROOT_CONTEXT_BYTES = 50 * 1024

const NonEmptyStringSchema = z.string().min(1)
const NonEmptyStringListSchema = z.array(NonEmptyStringSchema)
const ActiveRootRulesSchema = z.record(NonEmptyStringSchema, NonEmptyStringListSchema)
const ActiveRootOperationSchema = z.object({ guidance: NonEmptyStringListSchema }).strict()
const ActiveRootOperationsSchema = z
  .object({
    apply: ActiveRootOperationSchema.optional(),
    archive: ActiveRootOperationSchema.optional(),
  })
  .strict()

function withinContextByteLimit(value: string): boolean {
  return new TextEncoder().encode(value).byteLength <= MAX_ACTIVE_ROOT_CONTEXT_BYTES
}

const ActiveRootContextSchema = z
  .string()
  .refine(
    withinContextByteLimit,
    `Context must not exceed ${MAX_ACTIVE_ROOT_CONTEXT_BYTES} UTF-8 bytes.`
  )

/** Runtime schema for the resilient official-field projection. */
export const ActiveRootOfficialConfigSchema = z
  .object({
    schema: NonEmptyStringSchema.nullable(),
    context: ActiveRootContextSchema.nullable(),
    rules: ActiveRootRulesSchema.nullable(),
    operations: ActiveRootOperationsSchema.nullable(),
  })
  .strict()

/** Official OpenSpec 1.7 fields projected independently from custom YAML nodes. */
export type ActiveRootOfficialConfig = z.infer<typeof ActiveRootOfficialConfigSchema>

/** Runtime schema for one complete Structured-mode update. */
export const ActiveRootStructuredUpdateSchema = z
  .object({
    schema: NonEmptyStringSchema,
    context: ActiveRootContextSchema.nullable(),
    rules: ActiveRootRulesSchema.nullable(),
    operations: z
      .object({
        apply: ActiveRootOperationSchema.nullable(),
        archive: ActiveRootOperationSchema.nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict()

/** Validated official-field replacement authored by Structured mode. */
export type ActiveRootStructuredUpdate = z.infer<typeof ActiveRootStructuredUpdateSchema>

/** Opaque digest proving the exact Active Root owner, file, presence, and source bytes read by an editor. */
export const ActiveRootRevisionSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/)

/** Opaque loaded revision token. */
export type ActiveRootRevision = z.infer<typeof ActiveRootRevisionSchema>

const ActiveRootMutationLocatorShape = {
  ownerPath: z.string().min(1),
  filePath: z.string().min(1),
  revision: ActiveRootRevisionSchema,
}

/** Runtime schema for Structured or Raw mutation admission at one exact physical revision. */
export const ActiveRootMutationSchema = z.discriminatedUnion('mode', [
  z
    .object({
      ...ActiveRootMutationLocatorShape,
      mode: z.literal('structured'),
      update: ActiveRootStructuredUpdateSchema,
    })
    .strict(),
  z
    .object({
      ...ActiveRootMutationLocatorShape,
      mode: z.literal('raw'),
      content: z.string(),
    })
    .strict(),
])

/** Revision-aware Active Root mutation request. */
export type ActiveRootMutation = z.infer<typeof ActiveRootMutationSchema>

/** Objective syntax or official-field diagnostic without claiming ownership of unknown YAML keys. */
export interface ActiveRootConfigDiagnostic {
  code:
    | 'config-unparseable'
    | 'config-not-mapping'
    | 'schema-missing'
    | 'schema-invalid'
    | 'context-invalid'
    | 'context-too-large'
    | 'rules-invalid'
    | 'rules-entry-invalid'
    | 'rules-entry-empty'
    | 'operations-invalid'
    | 'operation-invalid'
    | 'operation-guidance-invalid'
    | 'operation-guidance-empty'
  severity: 'error' | 'warning'
  path: string
  message: string
}

/** Resilient official projection plus diagnostics for fields the official CLI may ignore. */
export interface ActiveRootConfigInspection {
  official: ActiveRootOfficialConfig
  diagnostics: ActiveRootConfigDiagnostic[]
}

/** Exact YAML file selected under the active writable Planning root. */
export interface ActiveRootConfigFile extends Omit<PlanningConfigFile, 'path' | 'format'> {
  path: string
  format: 'yaml' | 'yml'
}

/** Active Planning-root configuration, official projection, and CLI-owned root provenance. */
export interface ActiveRootConfig extends ActiveRootConfigInspection {
  kind: 'active-root'
  owner: {
    kind: 'planning-root'
    path: string
    source: CliRootSource
    storeId: string | null
    externalToLaunchProject: boolean
  }
  file: ActiveRootConfigFile
  revision: ActiveRootRevision
}

/** Structured or Raw mutation result with recoverable latest physical evidence. */
export type ActiveRootMutationResult =
  | { state: 'applied'; config: ActiveRootConfig }
  | {
      state: 'conflict'
      reason: 'owner-changed' | 'file-changed' | 'revision-changed'
      latest: ActiveRootConfig
    }
  | {
      state: 'invalid'
      reason: 'raw-syntax' | 'structured-source'
      diagnostics: ActiveRootConfigDiagnostic[]
      latest: ActiveRootConfig
    }

/** Raw YAML syntax validation performed before any physical mutation. */
export interface ActiveRootRawValidation {
  valid: boolean
  diagnostics: ActiveRootConfigDiagnostic[]
}
