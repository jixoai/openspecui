/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Model camelCase workflow JSON independently from Store-family JSON.
 * 2. Preserve strict validate and archive outcomes, including failure payloads.
 * 3. Preserve multiline requirement bodies from `show --json`.
 * 4. Preserve complete OpenSpec 1.6 Status/Instructions action contracts as CLI facts.
 *
 * Original request (2026-07-15): "为不同命令建立强类型适配器，不实现平行解析规则。"
 */
import { z } from 'zod'
import {
  CliDiagnosticFailureSchema,
  CliDiagnosticSchema,
  CliReferenceIndexEntrySchema,
  CliRootSchema,
} from './common.js'

const CliChangeListEntrySchema = z
  .object({
    name: z.string(),
    completedTasks: z.number(),
    totalTasks: z.number(),
    lastModified: z.string(),
    status: z.enum(['no-tasks', 'complete', 'in-progress']),
  })
  .passthrough()

/** Typed result of the CLI change-list JSON command. */
export const CliChangeListSchema = z
  .object({
    changes: z.array(CliChangeListEntrySchema),
    root: CliRootSchema.nullable(),
    status: z.array(CliDiagnosticSchema).optional(),
  })
  .passthrough()

const CliSpecListEntrySchema = z
  .object({
    id: z.string(),
    requirementCount: z.number(),
  })
  .passthrough()

/** Typed result of the CLI Spec-list JSON command. */
export const CliSpecListSchema = z
  .object({
    specs: z.array(CliSpecListEntrySchema),
    root: CliRootSchema.nullable(),
    status: z.array(CliDiagnosticSchema).optional(),
  })
  .passthrough()

const CliSpecRequirementSchema = z
  .object({
    text: z.string(),
    scenarios: z.array(z.object({ rawText: z.string() }).passthrough()),
  })
  .passthrough()

/** Typed success or diagnostic failure result of the CLI show-Spec JSON command. */
export const CliShowSpecSchema = z.union([
  z
    .object({
      id: z.string(),
      title: z.string(),
      overview: z.string(),
      requirementCount: z.number(),
      requirements: z.array(CliSpecRequirementSchema),
      metadata: z
        .object({
          version: z.string(),
          format: z.string(),
          sourcePath: z.string().optional(),
        })
        .passthrough(),
      root: CliRootSchema,
    })
    .passthrough(),
  CliDiagnosticFailureSchema,
])

/** CLI-resolved output and existing paths for one workflow artifact. */
export const CliArtifactPathSchema = z
  .object({
    outputPath: z.string(),
    resolvedOutputPath: z.string(),
    existingOutputPaths: z.array(z.string()),
  })
  .passthrough()

/** Repository-local planning home selected by the CLI workflow engine. */
export const CliPlanningHomeSchema = z
  .object({
    kind: z.literal('repo'),
    root: z.string(),
    changesDir: z.string(),
    defaultSchema: z.string(),
  })
  .passthrough()

/** CLI-owned action boundaries and edit constraints for a workflow. */
export const CliActionContextSchema = z
  .object({
    mode: z.literal('repo-local'),
    sourceOfTruth: z.literal('repo'),
    planningArtifacts: z.array(z.string()),
    linkedContext: z.array(z.object({ name: z.string() }).passthrough()),
    allowedEditRoots: z.array(z.string()),
    requiresAffectedAreaSelection: z.boolean(),
    constraints: z.array(z.string()),
  })
  .passthrough()

const CliStatusArtifactSchema = z
  .object({
    id: z.string(),
    outputPath: z.string(),
    status: z.enum(['done', 'ready', 'blocked']),
    missingDeps: z.array(z.string()).optional(),
  })
  .passthrough()

/** Complete successful Status payload for one OpenSpec change. */
export const CliWorkflowStatusSuccessSchema = z
  .object({
    changeName: z.string(),
    schemaName: z.string(),
    planningHome: CliPlanningHomeSchema,
    changeRoot: z.string(),
    artifactPaths: z.record(CliArtifactPathSchema),
    isComplete: z.boolean(),
    applyRequires: z.array(z.string()),
    nextSteps: z.array(z.string()),
    actionContext: CliActionContextSchema,
    artifacts: z.array(CliStatusArtifactSchema),
    root: CliRootSchema,
  })
  .passthrough()

/** Typed success or diagnostic failure result of the CLI Status JSON command. */
export const CliWorkflowStatusSchema = z.union([
  CliWorkflowStatusSuccessSchema,
  CliDiagnosticFailureSchema,
])

const CliInstructionDependencySchema = z
  .object({
    id: z.string(),
    done: z.boolean(),
    path: z.string(),
    description: z.string(),
  })
  .passthrough()

/** Complete successful artifact Instructions payload. */
export const CliArtifactInstructionsSuccessSchema = z
  .object({
    changeName: z.string(),
    artifactId: z.string(),
    schemaName: z.string(),
    changeDir: z.string(),
    planningHome: CliPlanningHomeSchema,
    outputPath: z.string(),
    resolvedOutputPath: z.string(),
    existingOutputPaths: z.array(z.string()),
    description: z.string(),
    instruction: z.string().optional(),
    context: z.string().optional(),
    rules: z.array(z.string()).optional(),
    template: z.string(),
    dependencies: z.array(CliInstructionDependencySchema),
    unlocks: z.array(z.string()),
    references: z.array(CliReferenceIndexEntrySchema).optional(),
    root: CliRootSchema,
  })
  .passthrough()

/** Typed success or diagnostic failure result for artifact Instructions. */
export const CliArtifactInstructionsSchema = z.union([
  CliArtifactInstructionsSuccessSchema,
  CliDiagnosticFailureSchema,
])

const CliApplyTaskSchema = z
  .object({
    id: z.string(),
    description: z.string(),
    done: z.boolean(),
  })
  .passthrough()

/** Complete successful Apply Instructions payload, including raw Apply progress. */
export const CliApplyInstructionsSuccessSchema = z
  .object({
    changeName: z.string(),
    changeDir: z.string(),
    schemaName: z.string(),
    contextFiles: z.record(z.array(z.string())),
    progress: z.object({ total: z.number(), complete: z.number(), remaining: z.number() }),
    tasks: z.array(CliApplyTaskSchema),
    state: z.enum(['blocked', 'all_done', 'ready']),
    missingArtifacts: z.array(z.string()).optional(),
    instruction: z.string(),
    references: z.array(CliReferenceIndexEntrySchema).optional(),
    root: CliRootSchema,
  })
  .passthrough()

/** Typed success or diagnostic failure result of the CLI Apply Instructions command. */
export const CliApplyInstructionsSchema = z.union([
  CliApplyInstructionsSuccessSchema,
  CliDiagnosticFailureSchema,
])

const CliValidationIssueSchema = z
  .object({
    level: z.enum(['ERROR', 'WARNING', 'INFO']),
    path: z.string(),
    message: z.string(),
    line: z.number().optional(),
    column: z.number().optional(),
  })
  .passthrough()

const CliValidationTotalsSchema = z
  .object({
    items: z.number(),
    passed: z.number(),
    failed: z.number(),
  })
  .passthrough()

/** Typed strict or non-strict Validate result, including upstream failure diagnostics. */
export const CliValidateSchema = z.union([
  z
    .object({
      items: z.array(
        z
          .object({
            id: z.string(),
            type: z.enum(['change', 'spec']),
            valid: z.boolean(),
            issues: z.array(CliValidationIssueSchema),
            durationMs: z.number(),
          })
          .passthrough()
      ),
      summary: z
        .object({
          totals: CliValidationTotalsSchema,
          byType: z.record(CliValidationTotalsSchema),
        })
        .passthrough(),
      version: z.string(),
      root: CliRootSchema,
    })
    .passthrough(),
  CliDiagnosticFailureSchema,
])

const CliArchiveTotalsSchema = z
  .object({
    added: z.number(),
    modified: z.number(),
    removed: z.number(),
    renamed: z.number(),
  })
  .passthrough()

/** Typed Archive result without inferred retry or readiness semantics. */
export const CliArchiveSchema = z
  .object({
    archive: z
      .object({
        change: z.string(),
        archivedAs: z.string(),
        path: z.string(),
        specsUpdated: z.boolean(),
        totals: CliArchiveTotalsSchema.optional(),
      })
      .passthrough()
      .nullable(),
    root: CliRootSchema.optional(),
    status: z.array(CliDiagnosticSchema).optional(),
  })
  .passthrough()

export type CliChangeList = z.infer<typeof CliChangeListSchema>
export type CliSpecList = z.infer<typeof CliSpecListSchema>
export type CliShowSpec = z.infer<typeof CliShowSpecSchema>
export type CliWorkflowStatus = z.infer<typeof CliWorkflowStatusSchema>
export type CliWorkflowStatusSuccess = z.infer<typeof CliWorkflowStatusSuccessSchema>
export type CliArtifactInstructions = z.infer<typeof CliArtifactInstructionsSchema>
export type CliArtifactInstructionsSuccess = z.infer<typeof CliArtifactInstructionsSuccessSchema>
export type CliApplyInstructions = z.infer<typeof CliApplyInstructionsSchema>
export type CliApplyInstructionsSuccess = z.infer<typeof CliApplyInstructionsSuccessSchema>
export type CliValidate = z.infer<typeof CliValidateSchema>
export type CliArchive = z.infer<typeof CliArchiveSchema>
