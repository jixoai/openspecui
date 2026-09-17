/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Define selector-exact Planning-root CLI Projection Work contracts.
 * 2. Define the runtime-environment Environment Global projection contract.
 * 3. Publish browser-safe lifecycle Pull schemas without importing Node-owned Core modules.
 * 4. Keep projection data discriminated across Status and Artifact/Apply/Archive Instructions.
 * 5. Model the OpenSpec 1.13.1 change-list namespace facts beside the actionable set:
 *    `entries`/`value` stay actionable-only, `namespaces` is the single structural
 *    namespace-name set for row builders, and `warnings` is passthrough display evidence
 *    (absent when the CLI omitted it, never a synthesized empty array).
 *
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — change-list nested/warnings projection (update-openspec-cli-1131 Slice 2).
 */
import { z } from 'zod'
import type { CliJsonValue } from './cli-contracts/command-result.js'
import { CliDiagnosticSchema } from './cli-contracts/common.js'
import { CliChangeListWarningSchema, type CliChangeListEntry } from './cli-contracts/workflow.js'
import {
  CliProjectionCommandEvidenceSchema,
  createCliProjectionStateSchema,
} from './cli-projection.js'
import {
  ApplyInstructionsProjectionSchema,
  ArchiveInstructionsSchema,
  ArtifactInstructionsSchema,
  ChangeStatusSchema,
  OpsxConfigBundleSchema,
  TemplateContentMapSchema,
  TemplatesSchema,
} from './opsx-types.js'
import {
  SpecCatalogSchema,
  SpecDocumentProjectionSchema,
  SpecIdentitySchema,
} from './spec-catalog.js'
export { CliProjectionNoticeSchema } from './cli-projection.js'

/** Runtime selector for one Planning-root CLI-backed projection. */
export const PlanningCliProjectionSelectorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('opsx-status'),
    change: z.string().min(1),
    schema: z.string().optional(),
  }),
  z.object({ kind: z.literal('opsx-change-list') }),
  z.object({ kind: z.literal('opsx-status-list') }),
  z.object({
    kind: z.literal('opsx-instructions'),
    change: z.string().min(1),
    artifact: z.string().min(1),
    schema: z.string().optional(),
  }),
  z.object({
    kind: z.literal('opsx-apply-instructions'),
    change: z.string().min(1),
    schema: z.string().optional(),
  }),
  z.object({
    kind: z.literal('opsx-archive-instructions'),
    change: z.string().min(1),
    schema: z.string().optional(),
  }),
  z.object({ kind: z.literal('opsx-config-bundle') }),
  z.object({ kind: z.literal('opsx-templates'), schema: z.string().optional() }),
  z.object({ kind: z.literal('opsx-template-contents'), schema: z.string().optional() }),
  z.object({ kind: z.literal('spec-catalog') }),
  z.object({ kind: z.literal('spec-document'), identity: SpecIdentitySchema }),
])

export type PlanningCliProjectionSelector = z.infer<typeof PlanningCliProjectionSelectorSchema>

/** Data payload retained by one Planning-root Projection Work registry. */
export const PlanningCliProjectionDataSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('opsx-status'), value: ChangeStatusSchema }),
  z.object({
    kind: z.literal('opsx-change-list'),
    value: z.array(z.string()),
    entries: z.array(
      z.object({
        name: z.string(),
        completedTasks: z.number(),
        totalTasks: z.number(),
        lastModified: z.string(),
        status: z.enum(['no-tasks', 'complete', 'in-progress']),
      })
    ),
    /**
     * The structural namespace-name set (OpenSpec 1.13.1): the `name` of every CLI entry
     * that carried `nested`. This is the single derivation of which directories are
     * namespace folders; row builders subtract it and never re-derive directory identity
     * from warning message text.
     */
    namespaces: z.array(z.string()),
    /** CLI top-level change-list hygiene warnings; absent when the CLI omitted them. */
    warnings: z.array(CliChangeListWarningSchema).optional(),
    evidence: CliProjectionCommandEvidenceSchema,
  }),
  z.object({
    kind: z.literal('opsx-status-list'),
    value: z.array(ChangeStatusSchema),
    evidence: CliProjectionCommandEvidenceSchema,
  }),
  z.object({ kind: z.literal('opsx-instructions'), value: ArtifactInstructionsSchema }),
  z.object({
    kind: z.literal('opsx-apply-instructions'),
    value: ApplyInstructionsProjectionSchema,
  }),
  z.object({
    kind: z.literal('opsx-archive-instructions'),
    rootGeneration: z.string().min(1),
    value: ArchiveInstructionsSchema,
  }),
  z.object({
    kind: z.literal('opsx-config-bundle'),
    value: OpsxConfigBundleSchema,
    evidence: z.object({
      schemas: CliProjectionCommandEvidenceSchema,
      schemaResolutions: z.record(z.string(), CliProjectionCommandEvidenceSchema),
    }),
  }),
  z.object({
    kind: z.literal('opsx-templates'),
    value: TemplatesSchema,
    evidence: CliProjectionCommandEvidenceSchema,
  }),
  z.object({
    kind: z.literal('opsx-template-contents'),
    value: TemplateContentMapSchema,
    evidence: CliProjectionCommandEvidenceSchema,
  }),
  z.object({ kind: z.literal('spec-catalog'), value: SpecCatalogSchema }),
  z.object({ kind: z.literal('spec-document'), value: SpecDocumentProjectionSchema }),
])

export type PlanningCliProjectionData = z.infer<typeof PlanningCliProjectionDataSchema>

/** Browser-safe lifecycle Pull schema for every selector-exact Planning-root projection. */
export const PlanningCliProjectionStateSchema = createCliProjectionStateSchema(
  PlanningCliProjectionDataSchema
)

export type PlanningCliProjectionState = z.infer<typeof PlanningCliProjectionStateSchema>

/**
 * CLI-owned change-list row facts for inventory builders (OpenSpec 1.13.1).
 *
 * `entries` is the actionable set keyed by change name — structurally-nested entries are
 * already excluded at the kernel projection boundary, so a namespace entry can never
 * contribute a task summary through a name join. `namespaceNames` is that same structural
 * derivation (names of CLI entries carrying `nested`) for row subtraction; warning message
 * text is display evidence only and never contributes to either member.
 */
export interface CliChangeListFacts {
  readonly entries: ReadonlyMap<string, CliChangeListEntry>
  readonly namespaceNames: ReadonlySet<string>
}

/** Build the shared change-list row facts from one `opsx-change-list` projection payload. */
export function deriveCliChangeListFacts(payload: {
  entries: readonly CliChangeListEntry[]
  namespaces?: readonly string[]
}): CliChangeListFacts {
  return {
    entries: new Map(payload.entries.map((entry) => [entry.name, entry])),
    namespaceNames: new Set(payload.namespaces ?? []),
  }
}

const CliJsonValueSchema: z.ZodType<CliJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(CliJsonValueSchema),
    z.record(z.string(), CliJsonValueSchema),
  ])
)

const CliResultSchema = z.object({
  success: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int().nullable(),
})

const EnvironmentConfigCommandResultSchema = CliResultSchema.extend({
  data: z.record(z.string(), CliJsonValueSchema).nullable(),
  payload: CliJsonValueSchema.nullable(),
  diagnostics: z.array(CliDiagnosticSchema),
  contractError: z.string().optional(),
})

/** Browser-safe runtime schema for the CLI-owned Environment Global projection. */
export const EnvironmentGlobalProjectionDataSchema = z.object({
  kind: z.literal('environment-global'),
  owner: z.object({
    kind: z.literal('runtime-environment'),
    dataScope: z.object({
      path: z.string(),
      source: z.enum(['xdg-data-home', 'local-app-data', 'user-home-default']),
      environmentVariable: z.enum(['XDG_DATA_HOME', 'LOCALAPPDATA']).nullable(),
    }),
  }),
  configPath: z.string().nullable(),
  config: z.record(z.string(), CliJsonValueSchema).nullable(),
  defaultStore: z.discriminatedUnion('state', [
    z.object({ state: z.literal('absent'), id: z.null() }),
    z.object({ state: z.literal('configured'), id: z.string() }),
    z.object({ state: z.literal('invalid'), id: z.null(), value: CliJsonValueSchema }),
  ]),
  profileState: z.object({
    available: z.boolean(),
    profile: z.enum(['core', 'custom']).nullable(),
    delivery: z.enum(['both', 'skills', 'commands']).nullable(),
    workflows: z.array(z.string()),
    driftStatus: z.enum(['in-sync', 'drift', 'unknown']),
    warningText: z.string().nullable(),
    error: z.string().optional(),
  }),
  evidence: z.object({
    path: CliResultSchema,
    config: EnvironmentConfigCommandResultSchema,
    drift: CliResultSchema,
  }),
})

export type EnvironmentGlobalProjectionData = z.infer<typeof EnvironmentGlobalProjectionDataSchema>

/** Browser-safe file-native projection for the CLI-selected editable config document. */
export const EnvironmentGlobalFileProjectionDataSchema = z.object({
  kind: z.literal('environment-global-file'),
  owner: z.object({
    kind: z.literal('runtime-environment'),
    dataScope: z.object({
      path: z.string(),
      source: z.enum(['xdg-data-home', 'local-app-data', 'user-home-default']),
      environmentVariable: z.enum(['XDG_DATA_HOME', 'LOCALAPPDATA']).nullable(),
    }),
  }),
  file: z.object({
    path: z.string().nullable(),
    format: z.literal('json'),
    exists: z.boolean(),
    content: z.string().nullable(),
  }),
})

export type EnvironmentGlobalFileProjectionData = z.infer<
  typeof EnvironmentGlobalFileProjectionDataSchema
>

/** Browser-safe lifecycle Pull schema for the file-native config owner. */
export const EnvironmentGlobalFileProjectionStateSchema = createCliProjectionStateSchema(
  EnvironmentGlobalFileProjectionDataSchema
)

export type EnvironmentGlobalFileProjectionState = z.infer<
  typeof EnvironmentGlobalFileProjectionStateSchema
>

/** Browser-safe lifecycle Pull schema for the runtime-environment config/profile projection. */
export const EnvironmentGlobalProjectionStateSchema = createCliProjectionStateSchema(
  EnvironmentGlobalProjectionDataSchema
)

export type EnvironmentGlobalProjectionState = z.infer<
  typeof EnvironmentGlobalProjectionStateSchema
>
