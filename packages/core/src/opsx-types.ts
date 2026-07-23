/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Define reactive Change Status and Instructions projections.
 * 2. Preserve live CLI path/action provenance versus explicit static absence.
 * 3. Attribute Apply instruction progress without replacing tracked-task truth.
 * 4. Define schema, template, and dependency projections for OPSX surfaces.
 * 5. Preserve the complete CLI evidence envelope for demand-driven leaves.
 *
 * Original request (2026-07-15): "Preserve CLI-provided paths, action context, References, and diagnostics end to end."
 * Original request (2026-07-23): "OPSX Status 不应等待完整 Kernel warmup，且必须保留 CLI evidence。"
 */
import { z } from 'zod'
import type { CliJsonValue } from './cli-contracts/command-result.js'
import { CliDiagnosticSchema, CliRootSchema } from './cli-contracts/common.js'
import {
  CliActionContextSchema,
  CliArtifactPathSchema,
  CliPlanningHomeSchema,
} from './cli-contracts/workflow.js'
import { createApplyInstructionProgress } from './task-progress.js'

/** Check if an outputPath contains glob pattern characters */
export function isGlobPattern(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[')
}

/** Runtime schema for one JSON value retained from a CLI Status stdout document. */
const OpsxCliJsonValueSchema: z.ZodType<CliJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(OpsxCliJsonValueSchema),
    z.record(z.string(), OpsxCliJsonValueSchema),
  ])
)

/** Raw process and parser evidence retained beside one live CLI projection. */
export const OpsxCliEvidenceSchema = z
  .object({
    command: z.enum(['status', 'instructions', 'instructions apply']),
    success: z.boolean(),
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number().int().nullable(),
    payload: OpsxCliJsonValueSchema.nullable(),
    diagnostics: z.array(CliDiagnosticSchema),
    contractError: z.string().optional(),
    selector: z.object({ store: z.string().optional() }).strict(),
    root: CliRootSchema.optional(),
  })
  .passthrough()

export type OpsxCliEvidence = z.infer<typeof OpsxCliEvidenceSchema>

/** Status-specific evidence kept as a narrow public contract for consumers. */
export const OpsxStatusEvidenceSchema = OpsxCliEvidenceSchema.extend({
  command: z.literal('status'),
})

export type OpsxStatusEvidence = z.infer<typeof OpsxStatusEvidenceSchema>

const OpsxArtifactInstructionsEvidenceSchema = OpsxCliEvidenceSchema.extend({
  command: z.literal('instructions'),
})

const OpsxApplyInstructionsEvidenceSchema = OpsxCliEvidenceSchema.extend({
  command: z.literal('instructions apply'),
})

export const ArtifactStatusSchema = z.object({
  id: z.string(),
  outputPath: z.string(),
  status: z.enum(['done', 'ready', 'blocked']),
  missingDeps: z.array(z.string()).optional(),
  relativePath: z.string().optional(),
})

export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>

export const ChangeStatusSchema = z.object({
  changeName: z.string(),
  schemaName: z.string(),
  isComplete: z.boolean(),
  applyRequires: z.array(z.string()),
  artifacts: z.array(ArtifactStatusSchema),
  provenance: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('cli'),
      planningHome: CliPlanningHomeSchema,
      changeRoot: z.string(),
      artifactPaths: z.record(CliArtifactPathSchema),
      nextSteps: z.array(z.string()),
      actionContext: CliActionContextSchema,
      root: CliRootSchema,
      evidence: OpsxStatusEvidenceSchema,
    }),
    z.object({ kind: z.literal('static') }),
  ]),
})

export type ChangeStatus = z.infer<typeof ChangeStatusSchema>

export const DependencyInfoSchema = z.object({
  id: z.string(),
  done: z.boolean(),
  path: z.string(),
  description: z.string(),
})

export type DependencyInfo = z.infer<typeof DependencyInfoSchema>

export const ApplyTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  done: z.boolean(),
})

export type ApplyTask = z.infer<typeof ApplyTaskSchema>

const ApplyInstructionsContextFilePathsSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((paths) => (Array.isArray(paths) ? paths : [paths]))

export const ApplyInstructionsContextFilesSchema = z.record(ApplyInstructionsContextFilePathsSchema)

export const ApplyInstructionsSchema = z
  .object({
    changeName: z.string(),
    changeDir: z.string(),
    schemaName: z.string(),
    contextFiles: ApplyInstructionsContextFilesSchema,
    progress: z.object({
      total: z.number(),
      complete: z.number(),
      remaining: z.number(),
    }),
    tasks: z.array(ApplyTaskSchema),
    state: z.enum(['blocked', 'all_done', 'ready']),
    missingArtifacts: z.array(z.string()).optional(),
    instruction: z.string(),
    evidence: OpsxApplyInstructionsEvidenceSchema,
  })
  .transform(({ progress, ...instructions }) => ({
    ...instructions,
    applyInstructionProgress: createApplyInstructionProgress({
      ...progress,
      state: instructions.state,
    }),
  }))

export type ApplyInstructions = z.infer<typeof ApplyInstructionsSchema>

const NullableString = z.string().nullable().optional()

export const ArtifactInstructionsSchema = z.object({
  changeName: z.string(),
  artifactId: z.string(),
  schemaName: z.string(),
  changeDir: z.string(),
  outputPath: z.string(),
  description: z.string(),
  instruction: NullableString,
  context: NullableString,
  rules: z.array(z.string()).optional().nullable(),
  template: z.string(),
  dependencies: z.array(DependencyInfoSchema),
  unlocks: z.array(z.string()),
  evidence: OpsxArtifactInstructionsEvidenceSchema,
})

export type ArtifactInstructions = z.infer<typeof ArtifactInstructionsSchema>

export const SchemaInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  artifacts: z.array(z.string()),
  source: z.enum(['project', 'user', 'package']),
})

export type SchemaInfo = z.infer<typeof SchemaInfoSchema>

export const SchemaResolutionSchema = z.object({
  name: z.string(),
  source: z.enum(['project', 'user', 'package']),
  path: z.string(),
  displayPath: z.string().optional(),
  shadows: z.array(
    z.object({
      source: z.enum(['project', 'user', 'package']),
      path: z.string(),
      displayPath: z.string().optional(),
    })
  ),
})

export type SchemaResolution = z.infer<typeof SchemaResolutionSchema>

export const TemplatesSchema = z.record(
  z.object({
    path: z.string(),
    displayPath: z.string().optional(),
    source: z.enum(['project', 'user', 'package']),
  })
)

export type TemplatesMap = z.infer<typeof TemplatesSchema>

export const SchemaArtifactSchema = z.object({
  id: z.string(),
  outputPath: z.string(),
  description: z.string().optional(),
  template: z.string().optional(),
  instruction: z.string().optional(),
  requires: z.array(z.string()),
})

export type SchemaArtifact = z.infer<typeof SchemaArtifactSchema>

export const SchemaDetailSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.union([z.string(), z.number()]).optional(),
  artifacts: z.array(SchemaArtifactSchema),
  applyRequires: z.array(z.string()),
  applyTracks: z.string().optional(),
  applyInstruction: z.string().optional(),
})

export type SchemaDetail = z.infer<typeof SchemaDetailSchema>
