/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Define selector-exact Planning-root CLI Projection Work contracts.
 * 2. Define the runtime-environment Environment Global projection contract.
 * 3. Publish browser-safe lifecycle Pull schemas without importing Node-owned Core modules.
 * 4. Keep projection data discriminated across Status and Artifact/Apply/Archive Instructions.
 *
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 */
import { z } from 'zod'
import type { CliJsonValue } from './cli-contracts/command-result.js'
import { CliDiagnosticSchema } from './cli-contracts/common.js'
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
