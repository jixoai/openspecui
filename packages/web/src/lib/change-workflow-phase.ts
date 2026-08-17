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
  /**
   * CLI-reported completed task count (`openspec list` / Apply instructions). Zero means
   * nothing has been applied yet — the Change is still at the planning gate.
   */
  cliCompletedTasks?: number | null
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

  // Once any task has been applied the Change is executing — that is the dominant
  // signal, whether planning artifacts are still open (spec-driven) or long done
  // (loop-family schemas whose checkboxes are owner gates). "Planning Complete" is
  // reserved for the planning gate: nothing applied yet (0 tasks done).
  const applied = params.cliCompletedTasks ?? null
  if (applied !== null && applied > 0) {
    return {
      label: 'Applying',
      toneClass: 'border-primary/40 text-primary',
    }
  }

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
