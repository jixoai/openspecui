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

// =====================
// Requirement Schema
// =====================

/**
 * A requirement within a specification.
 * Requirements should use RFC 2119 keywords (SHALL, MUST, etc.)
 */
export const RequirementSchema = z.object({
  /** Unique identifier within the spec (e.g., "req-1") */
  id: z.string(),
  /** Requirement text, should contain SHALL/MUST keywords */
  text: z.string(),
  /** Test scenarios for this requirement */
  scenarios: z.array(
    z.object({
      rawText: z.string(),
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
export const DeltaSchema = z.object({
  /** Target spec ID */
  spec: z.string(),
  /** Type of change */
  operation: z.enum(['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED']),
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
  /** Optional metadata */
  metadata: z
    .object({
      version: z.string().default('1.0.0'),
      format: z.literal('openspec-change').default('openspec-change'),
    })
    .optional(),
})

export type Change = z.infer<typeof ChangeSchema>
