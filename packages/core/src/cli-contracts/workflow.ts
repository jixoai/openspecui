/**
 * Orthogonal intents (updated 2026-10-02 Asia/Shanghai):
 * 1. Model camelCase workflow JSON independently from Store-family JSON.
 * 2. Preserve strict, archived, and bulk Validate plus Archive outcomes, including failure payloads.
 * 3. Preserve multiline requirement bodies from `show --json`.
 * 4. Preserve complete admitted-line (1.10/1.11) Status and operation-Instruction contracts as CLI facts.
 * 5. Export the successful Spec-document schema for browser-safe projection validation.
 * 6. Export the root-less Status payload fields and Requirement shape shared with the
 *    OpenSpec 1.11 batch Status and show --diff contracts.
 * 7. Model the OpenSpec 1.12 `validate --report findings` document beside (never inside) the
 *    full Validate report, sharing the bulk-item and summary shapes while keeping decoding
 *    independent of the process exit code and of full-report validation truth. Decode owns
 *    the upstream-guaranteed invariants (non-empty per-item issues, returnedItems bounded
 *    by totalItems), and the union guard validates the discriminator shape rather than
 *    mere `report`-key presence.
 * 8. Type the OpenSpec 1.13 Apply Instructions `missingPrerequisites` (build-order closure,
 *    present even when ready) and `warnings` (no-delta-specs advisory) as additive optional
 *    success members that never gain default empty arrays, never alter `state`/`progress`/
 *    `tasks`/`missingArtifacts` semantics, and stay verbatim CLI evidence.
 * 9. Type the OpenSpec 1.13.1 change-list `nested` entry member and top-level `warnings`
 *    array as additive optional facts (absent when empty, never null): an entry carrying
 *    `nested` is a namespace folder, not an actionable change; `code` stays an open string
 *    because an in-window patch may add codes beyond `nested_change_directory`.
 * 10. Type the OpenSpec 1.13.2 Apply tracking-evidence members (`taskTrackingConfigured`
 *    boolean, `unavailableTrackingFiles` `{path, reason}[]`) as additive optional success
 *    members: 1.13.2 always emits the boolean while 1.13.0/1.13.1 (still admitted) emit
 *    neither, so absence stays "unknown" and is never synthesized; the array is
 *    absent-when-everything-is-readable and both stay verbatim evidence.
 * 11. Type the OpenSpec 1.14 members (references/openspec-1.14.0-report.md, Verified CLI
 *    observations) as additive optional facts: apply task `sourcePath` (absolute) +
 *    `line` (1-based, upstream LocatedTask) — older in-flight payloads may lack them and
 *    OpenSpecUI never re-derives them; show-Spec requirement/scenario `name` members
 *    (upstream normalizeRequirementName/scenarioNameFromHeaderText) preserved by CLI
 *    value with old snapshots still decoding; Status top-level `warnings` advisory array
 *    on the single success payload and every batch healthy entry (same fields schema),
 *    verbatim CLI evidence that never gates anything; change-list per-entry `archived`
 *    boolean from `list --archived`/`--all` (default list never emits it); and the new
 *    `openspec version --json` envelope (`schemaVersion: 1` literal, `version`,
 *    `install`, check-gated passthrough `update`).
 *
 * Original request (2026-07-15): "为不同命令建立强类型适配器，不实现平行解析规则。"
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。"
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — change-list nested/warnings projection (update-openspec-cli-1131 Slice 2).
 * Original request (2026-09-26): "Openspec 1.13.2 释放了…" — Apply tracking-evidence decode contract (update-openspec-cli-1132 Slice 2).
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue" — typed contracts Slice 2 (target-openspec-cli-114-line).
 */
import { z } from 'zod'
import {
  CliDiagnosticFailureSchema,
  CliDiagnosticSchema,
  CliReferenceIndexEntrySchema,
  CliRootSchema,
} from './common.js'

/**
 * One top-level change-list hygiene warning (OpenSpec 1.13.1 `list --json`).
 *
 * `code` is an open string, not a literal: the upstream contract documents
 * `nested_change_directory` as the only current code while reserving room for more, so an
 * in-window patch adding a code must survive decode as evidence instead of failing the
 * whole document. The whole array is absent when empty (never `null`, never `[]`).
 */
export const CliChangeListWarningSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    nested: z.array(z.string()),
    message: z.string(),
  })
  .passthrough()

const CliChangeListEntrySchema = z
  .object({
    name: z.string(),
    completedTasks: z.number(),
    totalTasks: z.number(),
    lastModified: z.string(),
    status: z.enum(['no-tasks', 'complete', 'in-progress']),
    /**
     * OpenSpec 1.13.1: present exactly when the entry is a namespace folder wrapping the
     * named nested change directories. Status and task counts are meaningless for such an
     * entry ("do not treat such an entry as a change"); absent when the entry is a change.
     */
    nested: z.array(z.string()).optional(),
    /**
     * OpenSpec 1.14: present only on `list --archived` / `list --all` documents, marking
     * the entry as archive inventory (`true`, or `false` beside active entries under
     * `--all`). The default `list --json` never emits it, so absence carries no
     * information and is never synthesized.
     */
    archived: z.boolean().optional(),
  })
  .passthrough()

/** Typed result of the CLI change-list JSON command. */
export const CliChangeListSchema = z
  .object({
    changes: z.array(CliChangeListEntrySchema),
    /** Top-level hygiene warnings; absent when empty, never synthesized. */
    warnings: z.array(CliChangeListWarningSchema).optional(),
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

/**
 * One requirement body shared by Spec documents and Change deltas.
 *
 * OpenSpec 1.14 adds `name` on requirements and scenarios (upstream
 * `normalizeRequirementName` / `scenarioNameFromHeaderText`): the requirement name is
 * the identity archive matches on. Optional because old snapshots and in-window
 * payloads may lack it; preserved strictly by CLI value, never re-derived locally.
 */
export const CliSpecRequirementSchema = z
  .object({
    name: z.string().optional(),
    text: z.string(),
    scenarios: z.array(
      z.object({ name: z.string().optional(), rawText: z.string() }).passthrough()
    ),
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
    /**
     * OpenSpec 1.14 top-level advisory warnings (unrecognized `.openspec.yaml` keys,
     * upstream `formatUnknownChangeMetadataKeysMessage`). Verbatim CLI evidence, spread
     * only when non-empty upstream, so absence stays absence; advisory only — never a
     * gate on planning facts or actions. Shared by the single success payload and every
     * batch healthy entry (the same fields schema).
     */
    warnings: z.array(z.string()).optional(),
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
    /**
     * OpenSpec 1.14 LocatedTask source locations: the absolute `sourcePath` of the file
     * the checkbox lives in plus its 1-based `line`. Always present on 1.14 output, but
     * optional here because older in-flight payloads and retained snapshots may lack
     * them; verbatim CLI evidence ("which file the checkbox lives in") that OpenSpecUI
     * never re-derives or second-guesses.
     */
    sourcePath: z.string().optional(),
    line: z.number().optional(),
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
    // OpenSpec 1.13 additive members: conditionally spread upstream, so they are
    // optional here with no default; evidence only, never apply gating.
    missingPrerequisites: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    // OpenSpec 1.13.2 additive members: emitted from 1.13.2 only (the window still
    // admits 1.13.0/1.13.1 which never emit them); evidence only, never apply gating.
    // `taskTrackingConfigured` is always a boolean when emitted (true even when the
    // schema's `apply.tracks` matches zero files) and absence means "unknown CLI",
    // never a synthesized `false`; `unavailableTrackingFiles` is spread only when a
    // matched tracking file was unreadable, so it is never an empty array here.
    taskTrackingConfigured: z.boolean().optional(),
    unavailableTrackingFiles: z
      .array(z.object({ path: z.string(), reason: z.string() }))
      .optional(),
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

/** One bulk Validate item: verdict, full issue array, and runtime-dependent duration. */
export const CliValidateItemSchema = z
  .object({
    id: z.string(),
    type: z.enum(['change', 'spec']),
    valid: z.boolean(),
    issues: z.array(CliValidationIssueSchema),
    durationMs: z.number(),
  })
  .passthrough()

/** Shared Validate summary: full-run totals plus per-type totals, never the filtered view. */
export const CliValidateSummarySchema = z
  .object({
    totals: CliValidationTotalsSchema,
    byType: z.record(CliValidationTotalsSchema),
  })
  .passthrough()

/** Typed ordinary Validate report, also used by 1.9 `validate --archived --json`. */
export const CliValidateReportSchema = z
  .object({
    items: z.array(CliValidateItemSchema),
    summary: CliValidateSummarySchema,
    version: z.string(),
    root: CliRootSchema,
  })
  .passthrough()

/** Typed strict, non-strict, or archived Validate result, including failure diagnostics. */
export const CliValidateSchema = z.union([CliValidateReportSchema, CliDiagnosticFailureSchema])

/**
 * Typed OpenSpec 1.12 `validate --report findings` document.
 *
 * The findings report is a filtered evidence transport beside the full report, never the
 * validation truth: `itemFindings` carries only items with issues, while `summary` and
 * `root` stay the full-run values the CLI computed over every item in scope.
 * `report.returnedItems`/`report.totalItems` distinguish the filtered view from the run
 * size, and the process exit code keeps the full-run rule (`failed > 0 -> 1`), so decoding
 * never consults it. An empty scope is the success document
 * `{ returnedItems: 0, totalItems: 0, itemFindings: [] }`, not a failure sum type.
 *
 * Two upstream-guaranteed invariants are decode-level facts (pinned v1.12.0
 * `projectValidationFindings`): every `itemFindings` entry carries at least one issue
 * (upstream filters `item.issues.length > 0`), and `returnedItems` never exceeds
 * `totalItems` (the filtered view is a subset of the full run). Upstream also happens to
 * set `returnedItems === itemFindings.length` today; that equality stays unasserted so a
 * future patch-level count adjustment inside the admitted range cannot fabricate a
 * contract error out of otherwise well-formed CLI evidence.
 */
export const CliValidateFindingsSchema = z
  .object({
    report: z
      .object({
        kind: z.literal('validation-findings'),
        version: z.string(),
        scope: z.enum(['all', 'changes', 'specs', 'archived']),
        returnedItems: z.number(),
        totalItems: z.number(),
      })
      .passthrough(),
    itemFindings: z.array(CliValidateItemSchema),
    summary: CliValidateSummarySchema,
    root: CliRootSchema,
  })
  .passthrough()
  .superRefine((document, ctx) => {
    if (document.report.returnedItems > document.report.totalItems) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['report', 'returnedItems'],
        message: `returnedItems (${document.report.returnedItems}) must not exceed totalItems (${document.report.totalItems}).`,
      })
    }
    document.itemFindings.forEach((finding, index) => {
      if (finding.issues.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['itemFindings', index, 'issues'],
          message: 'Every findings item must carry at least one issue.',
        })
      }
    })
  })

/**
 * Typed findings or request-failure result of `validate --report findings --json`.
 *
 * Invalid requests (no bulk scope, an item name, archived+active mixing, or an unknown
 * report value) produce the shared status-array failure envelope with code
 * `invalid_validation_report_request`, decoded here through the shared diagnostic
 * failure schema including its optional `fix` string.
 */
export const CliValidateFindingsResultSchema = z.union([
  CliValidateFindingsSchema,
  CliDiagnosticFailureSchema,
])

/**
 * Whether a findings result is the findings document rather than the request-failure
 * envelope. Passthrough tolerance means a failure envelope may legally carry unknown
 * keys, so mere `report`-key presence cannot discriminate the union: the guard validates
 * the upstream discriminator shape — `report` is an object whose `kind` is the
 * `validation-findings` literal and whose count fields are numbers.
 *
 * The input is deliberately `unknown`: route and evidence consumers receive the union
 * of every validate transport (`CliValidate | CliValidateFindingsResult | null`), so the
 * guard must accept the consumed boundary, not only the already-narrowed findings union.
 * It stays a cheap shape check, never a second decode: schema-level invariants
 * (issue presence, count bounds) belong to `CliValidateFindingsSchema` alone.
 */
export function isCliValidateFindings(result: unknown): result is CliValidateFindings {
  if (typeof result !== 'object' || result === null) return false
  const report = (result as { report?: unknown }).report
  if (typeof report !== 'object' || report === null) return false
  const { kind, returnedItems, totalItems } = report as {
    kind?: unknown
    returnedItems?: unknown
    totalItems?: unknown
  }
  return (
    kind === 'validation-findings' &&
    typeof returnedItems === 'number' &&
    typeof totalItems === 'number'
  )
}

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

/**
 * Typed result of the OpenSpec 1.14 `openspec version --json` command.
 *
 * Upstream (pinned v1.14.0, src/cli/index.ts + src/core/version-check.ts) always emits
 * `schemaVersion: 1`, the running `version`, and the resolved `install` facts (every
 * install member nullable — an unresolvable install reports all-null, never a guess).
 * `update` is conditionally spread only under `--check` (a registry probe honoring
 * CI/no-network and DO_NOT_TRACK opt-outs), so it is optional with no default and its
 * facts stay passthrough evidence; the probe is opt-in and OpenSpecUI composes no
 * capability gate for this admitted-window command.
 */
export const CliVersionSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: z.string(),
    install: z
      .object({
        location: z.string().nullable(),
        packageManager: z.enum(['npm', 'pnpm', 'bun', 'yarn', 'volta']).nullable(),
        scope: z.enum(['global', 'project', 'temporary', 'source']).nullable(),
      })
      .passthrough(),
    update: z
      .object({
        status: z.enum(['disabled', 'offline', 'available', 'current']),
        latest: z.string().nullable(),
        command: z.string().nullable(),
        canSelfUpgrade: z.boolean(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

/** One CLI-reported Change row: task counts and phase straight from `openspec list`. */
export type CliChangeListEntry = z.infer<typeof CliChangeListEntrySchema>

/** One top-level change-list hygiene warning from `openspec list` (OpenSpec 1.13.1). */
export type CliChangeListWarning = z.infer<typeof CliChangeListWarningSchema>

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
export type CliValidateItem = z.infer<typeof CliValidateItemSchema>
export type CliValidateSummary = z.infer<typeof CliValidateSummarySchema>
export type CliValidateFindings = z.infer<typeof CliValidateFindingsSchema>
export type CliValidateFindingsResult = z.infer<typeof CliValidateFindingsResultSchema>
export type CliArchive = z.infer<typeof CliArchiveSchema>
export type CliVersion = z.infer<typeof CliVersionSchema>
