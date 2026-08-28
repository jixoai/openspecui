/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Model camelCase workflow JSON independently from Store-family JSON.
 * 2. Preserve strict, archived, and bulk Validate plus Archive outcomes, including failure payloads.
 * 3. Preserve multiline requirement bodies from `show --json`.
 * 4. Preserve complete admitted-line (1.10/1.11) Status and operation-Instruction contracts as CLI facts.
 * 5. Export the successful Spec-document schema for browser-safe projection validation.
 * 6. Export the root-less Status payload fields and Requirement shape shared with the
 *    OpenSpec 1.11 batch Status and show --diff contracts.
 *
 * Original request (2026-07-15): "为不同命令建立强类型适配器，不实现平行解析规则。"
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
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

/** CLI resolution for one schema, including lower-priority shadows. */
export const CliSchemaShadowSchema = z
  .object({
    source: z.enum(['project', 'user', 'package']),
    path: z.string(),
  })
  .passthrough()

export const CliSchemaResolutionSchema = z
  .object({
    name: z.string(),
    source: z.enum(['project', 'user', 'package']),
    path: z.string(),
    shadows: z.array(CliSchemaShadowSchema),
  })
  .passthrough()

/** Typed result of `openspec schema which <name> --json`. */
export const CliSchemaWhichSchema = CliSchemaResolutionSchema

/** Typed result of `openspec templates --json [--schema <name>]`. */
export const CliTemplateEntrySchema = z
  .object({
    path: z.string(),
    source: z.enum(['project', 'user', 'package']),
  })
  .passthrough()

export const CliTemplatesSchema = z.record(CliTemplateEntrySchema)

/** One requirement body shared by Spec documents and Change deltas. */
export const CliSpecRequirementSchema = z
  .object({
    text: z.string(),
    scenarios: z.array(z.object({ rawText: z.string() }).passthrough()),
  })
  .passthrough()

/** Typed successful document returned by the CLI show-Spec JSON command. */
export const CliShowSpecDocumentSchema = z
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
  .passthrough()

/** Typed success or diagnostic failure result of the CLI show-Spec JSON command. */
export const CliShowSpecSchema = z.union([CliShowSpecDocumentSchema, CliDiagnosticFailureSchema])

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
    status: z.enum(['done', 'skipped', 'ready', 'blocked']),
    requires: z.array(z.string()),
    missingDeps: z.array(z.string()).optional(),
  })
  .passthrough()

/**
 * Root-less Status payload fields for one OpenSpec change.
 *
 * The single-change command attaches `root` itself; the OpenSpec 1.11 batch
 * envelope (`status --all --json`) reuses exactly these fields per entry while
 * the envelope owns the single root.
 */
export const CliWorkflowStatusFieldsSchema = z
  .object({
    changeName: z.string(),
    schemaName: z.string(),
    planningHome: CliPlanningHomeSchema,
    changeRoot: z.string(),
    artifactPaths: z.record(CliArtifactPathSchema),
    /** Required planning-artifact completion fact since OpenSpec 1.8. */
    isPlanningComplete: z.boolean(),
    /** Retained upstream compatibility alias, kept only as raw CLI evidence. */
    isComplete: z.boolean().optional(),
    applyRequires: z.array(z.string()),
    nextSteps: z.array(z.string()),
    actionContext: CliActionContextSchema,
    artifacts: z.array(CliStatusArtifactSchema),
  })
  .passthrough()

/** Complete successful Status payload for one OpenSpec change. */
export const CliWorkflowStatusSuccessSchema = CliWorkflowStatusFieldsSchema.extend({
  root: CliRootSchema,
}).passthrough()

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
    skipped: z.boolean().optional(),
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
    context: z.string().optional(),
    operationGuidance: z.array(z.string()).optional(),
    root: CliRootSchema,
  })
  .passthrough()

/** Typed success or diagnostic failure result of the CLI Apply Instructions command. */
export const CliApplyInstructionsSchema = z.union([
  CliApplyInstructionsSuccessSchema,
  CliDiagnosticFailureSchema,
])

/** Complete successful Archive Instructions payload for the selected Root. */
export const CliArchiveInstructionsSuccessSchema = z
  .object({
    changeName: z.string(),
    context: z.string().optional(),
    operationGuidance: z.array(z.string()).optional(),
    root: CliRootSchema,
  })
  .passthrough()

/** Typed success or diagnostic failure result of the CLI Archive Instructions command. */
export const CliArchiveInstructionsSchema = z.union([
  CliArchiveInstructionsSuccessSchema,
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

/** Typed ordinary Validate report, also used by 1.9 `validate --archived --json`. */
export const CliValidateReportSchema = z
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
  .passthrough()

/** Typed strict, non-strict, or archived Validate result, including failure diagnostics. */
export const CliValidateSchema = z.union([CliValidateReportSchema, CliDiagnosticFailureSchema])

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
        /** Upstream spec-rebuild warnings, including retirement and scenario-loss notices. */
        warnings: z.array(z.string()).optional(),
      })
      .passthrough()
      .nullable(),
    root: CliRootSchema.optional(),
    status: z.array(CliDiagnosticSchema).optional(),
  })
  .passthrough()

/** One CLI-reported Change row: task counts and phase straight from `openspec list`. */
export type CliChangeListEntry = z.infer<typeof CliChangeListEntrySchema>

export type CliChangeList = z.infer<typeof CliChangeListSchema>
export type CliSpecList = z.infer<typeof CliSpecListSchema>
export type CliSchemaResolution = z.infer<typeof CliSchemaResolutionSchema>
export type CliSchemaWhich = z.infer<typeof CliSchemaWhichSchema>
export type CliTemplates = z.infer<typeof CliTemplatesSchema>
export type CliShowSpec = z.infer<typeof CliShowSpecSchema>
export type CliWorkflowStatus = z.infer<typeof CliWorkflowStatusSchema>
export type CliWorkflowStatusSuccess = z.infer<typeof CliWorkflowStatusSuccessSchema>
export type CliWorkflowStatusFields = z.infer<typeof CliWorkflowStatusFieldsSchema>
export type CliArtifactInstructions = z.infer<typeof CliArtifactInstructionsSchema>
export type CliArtifactInstructionsSuccess = z.infer<typeof CliArtifactInstructionsSuccessSchema>
export type CliApplyInstructions = z.infer<typeof CliApplyInstructionsSchema>
export type CliApplyInstructionsSuccess = z.infer<typeof CliApplyInstructionsSuccessSchema>
export type CliArchiveInstructions = z.infer<typeof CliArchiveInstructionsSchema>
export type CliArchiveInstructionsSuccess = z.infer<typeof CliArchiveInstructionsSuccessSchema>
export type CliValidate = z.infer<typeof CliValidateSchema>
export type CliValidateReport = z.infer<typeof CliValidateReportSchema>
export type CliArchive = z.infer<typeof CliArchiveSchema>
