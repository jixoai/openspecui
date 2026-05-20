/**
 * Zod schemas and TypeScript types for OpenSpec documents.
 *
 * OpenSpec uses a structured format for specifications and change proposals:
 * - Spec: A specification document with requirements and scenarios
 * - Change: A change proposal with deltas and tasks
 * - Task: A trackable work item within a change
 *
 * @module schemas
 */

import { z } from 'zod'
import { FILE_PREVIEW_KINDS } from './file-preview.js'

// =====================
// Change File Schema
// =====================

/**
 * File metadata for a change directory entry.
 */
export const ChangeFileSchema = z.object({
  /** Path relative to the change root (e.g., "proposal.md" or "specs/auth/spec.md") */
  path: z.string(),
  /** Entry type */
  type: z.enum(['file', 'directory']),
  /** Optional file content for text files */
  content: z.string().optional(),
  /** Optional byte size for files */
  size: z.number().optional(),
  /** Optional mime inferred from file path */
  mime: z.string().optional(),
  /** Optional preview kind inferred from file path and mime */
  previewKind: z.enum(FILE_PREVIEW_KINDS).optional(),
})

export type ChangeFile = z.infer<typeof ChangeFileSchema>

// =====================
// Requirement Schema
// =====================

export const ScenarioStepKeywordSchema = z.enum(['GIVEN', 'WHEN', 'THEN', 'AND', 'BUT'])

export const ScenarioStepSchema = z.object({
  /** Scenario step keyword from the list item prefix */
  keyword: ScenarioStepKeywordSchema,
  /** Markdown content after the keyword */
  contentMarkdown: z.string(),
  /** Original markdown list item line */
  rawText: z.string(),
})

export type ScenarioStep = z.infer<typeof ScenarioStepSchema>

/**
 * A requirement within a specification.
 * Requirements should use RFC 2119 keywords (SHALL, MUST, etc.)
 */
export const RequirementSchema = z.object({
  /** Unique identifier within the spec (e.g., "req-1") */
  id: z.string(),
  /** Requirement heading text from `### Requirement:` */
  title: z.string(),
  /** Markdown body between the requirement heading and the first scenario/next requirement */
  bodyMarkdown: z.string(),
  /** Full requirement text used for validation and search facts */
  text: z.string(),
  /** Test scenarios for this requirement */
  scenarios: z.array(
    z.object({
      /** Scenario heading text from `#### Scenario:` */
      title: z.string(),
      /** Markdown body between this scenario heading and the next scenario/requirement */
      bodyMarkdown: z.string(),
      /** Full scenario Markdown facts, including the scenario title */
      rawText: z.string(),
      /** Parsed scenario step facts for reading enhancements */
      steps: z.array(ScenarioStepSchema).optional(),
    })
  ),
})

export type Requirement = z.infer<typeof RequirementSchema>

// =====================
// Spec Schema
// =====================

/**
 * A specification document.
 * Located at: openspec/specs/{id}/spec.md
 */
export const SpecSchema = z.object({
  /** Directory name (e.g., "user-auth") */
  id: z.string(),
  /** Human-readable name from # heading */
  name: z.string(),
  /** Purpose/overview section content */
  overview: z.string(),
  /** List of requirements */
  requirements: z.array(RequirementSchema),
  /** Optional metadata */
  metadata: z
    .object({
      version: z.string().default('1.0.0'),
      format: z.literal('openspec').default('openspec'),
      sourcePath: z.string().optional(),
    })
    .optional(),
})

export type Spec = z.infer<typeof SpecSchema>

// =====================
// Delta Schema
// =====================

/**
 * A delta describes changes to a spec within a change proposal.
 * Deltas track which specs are affected and how.
 */
export const DeltaOperationType = z.enum(['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'])

export const DeltaSchema = z.object({
  /** Target spec ID */
  spec: z.string(),
  /** Type of change */
  operation: DeltaOperationType,
  /** Human-readable description */
  description: z.string(),
  /** Single requirement change */
  requirement: RequirementSchema.optional(),
  /** Multiple requirement changes */
  requirements: z.array(RequirementSchema).optional(),
  /** Rename details (for RENAMED operation) */
  rename: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .optional(),
})

export type Delta = z.infer<typeof DeltaSchema>
export type DeltaOperation = z.infer<typeof DeltaOperationType>

// =====================
// Task Schema
// =====================

/**
 * A task within a change proposal.
 * Tasks are parsed from tasks.md using checkbox syntax: - [ ] or - [x]
 */
export const TaskSchema = z.object({
  /** Unique identifier (e.g., "task-1") */
  id: z.string(),
  /** Task description text */
  text: z.string(),
  /** Whether the task is completed */
  completed: z.boolean(),
  /** Optional section heading the task belongs to */
  section: z.string().optional(),
})

export type Task = z.infer<typeof TaskSchema>

// =====================
// Delta Spec Schema
// =====================

/**
 * A delta spec file from changes/{id}/specs/{specId}/spec.md
 * Contains the proposed changes to a spec
 */
export const DeltaSpecSchema = z.object({
  /** Spec ID (directory name under changes/{id}/specs/) */
  specId: z.string(),
  /** Raw markdown content of the delta spec */
  content: z.string(),
})

export type DeltaSpec = z.infer<typeof DeltaSpecSchema>

// =====================
// Change Schema
// =====================

/**
 * A change proposal document.
 * Located at: openspec/changes/{id}/proposal.md + tasks.md
 *
 * Change proposals describe why a change is needed, what will change,
 * which specs are affected (deltas), and trackable tasks.
 */
export const ChangeSchema = z.object({
  /** Directory name (e.g., "add-oauth") */
  id: z.string(),
  /** Human-readable name from # heading */
  name: z.string(),
  /** Why section - motivation for the change */
  why: z.string(),
  /** What Changes section - description of changes */
  whatChanges: z.string(),
  /** Affected specs and their changes */
  deltas: z.array(DeltaSchema),
  /** Trackable tasks from tasks.md */
  tasks: z.array(TaskSchema),
  /** Task completion progress */
  progress: z.object({
    total: z.number(),
    completed: z.number(),
  }),
  /** Optional design.md content */
  design: z.string().optional(),
  /** Delta specs from changes/{id}/specs/ directory */
  deltaSpecs: z.array(DeltaSpecSchema).optional(),
  /** Optional metadata */
  metadata: z
    .object({
      version: z.string().default('1.0.0'),
      format: z.literal('openspec-change').default('openspec-change'),
    })
    .optional(),
})

export type Change = z.infer<typeof ChangeSchema>
