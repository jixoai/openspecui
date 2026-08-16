/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Combine CLI artifact status with formal tracked-task phase.
 * 2. Keep no-tasks distinct from execution and completion.
 * 3. Keep skipped dependency satisfaction distinct from completion and archive readiness.
 * 4. Separate planning-complete (ready to apply/review) from in-execution by the CLI's
 *    own planning fact, not by checkpoint arithmetic.
 *
 * Original request (2026-07-15): "0/0 means no-tasks, never complete."
 * Original request (2026-08-15): Owner walkthrough: loop-schema Changes with every planning
 *   artifact done must not read as "In Execution" — tracked checkboxes are owner gates.
 */
import type { TrackedTaskPhase } from '@openspecui/core'

export interface ChangeWorkflowPhaseInput {
  hasStatus: boolean
  isPlanningComplete: boolean
  trackedTaskPhase: TrackedTaskPhase
  trackedArtifactStatus: 'done' | 'skipped' | 'ready' | 'blocked' | null
}

export interface ChangeWorkflowPhase {
  label: string
  toneClass: string
}

export function classifyChangeWorkflowPhase(params: ChangeWorkflowPhaseInput): ChangeWorkflowPhase {
  if (!params.hasStatus) {
    return {
      label: 'Unknown',
      toneClass: 'border-border text-muted-foreground',
    }
  }

  if (params.isPlanningComplete && params.trackedTaskPhase === 'complete') {
    return {
      label: 'Workflow Complete',
      toneClass: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
    }
  }

  if (params.trackedArtifactStatus === 'blocked') {
    return {
      label: 'Draft',
      toneClass: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
    }
  }

  if (params.trackedTaskPhase === 'no-tasks') {
    return {
      label: 'No Tracked Tasks',
      toneClass: 'border-border text-muted-foreground',
    }
  }

  // Planning is finished but tracked checkboxes are not all checked. For spec-driven
  // schemas those checkboxes ARE the execution, so this was historically labeled
  // "In Execution". But loop-family schemas track owner gates (walkthrough, PR, archive)
  // in checkboxes that close only at archive time — labeling every planning-complete
  // loop Change as executing is false. The CLI's own planning fact is the authority:
  // planning done means the Change is ready to apply/review, and "In Execution" is
  // reserved for Changes whose planning is still open.
  if (params.isPlanningComplete) {
    return {
      label: 'Planning Complete',
      toneClass: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
    }
  }

  return {
    label: 'In Execution',
    toneClass: 'border-primary/40 text-primary',
  }
}

export function inferTrackedArtifactStatus(
  artifactStatuses: Array<'done' | 'skipped' | 'ready' | 'blocked'>
): 'done' | 'skipped' | 'ready' | 'blocked' | null {
  if (artifactStatuses.includes('blocked')) return 'blocked'
  if (artifactStatuses.includes('ready')) return 'ready'
  if (artifactStatuses.includes('done')) return 'done'
  if (artifactStatuses.includes('skipped')) return 'skipped'
  return null
}
