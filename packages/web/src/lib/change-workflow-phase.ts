/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Combine CLI artifact status with formal tracked-task phase.
 * 2. Keep no-tasks distinct from execution and completion.
 * 3. Never infer archive readiness from workflow completion.
 *
 * Original request (2026-07-15): "0/0 means no-tasks, never complete."
 */
import type { TrackedTaskPhase } from '@openspecui/core'

export interface ChangeWorkflowPhaseInput {
  hasStatus: boolean
  isComplete: boolean
  trackedTaskPhase: TrackedTaskPhase
  trackedArtifactStatus: 'done' | 'ready' | 'blocked' | null
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

  if (params.isComplete && params.trackedTaskPhase === 'complete') {
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

  return {
    label: 'In Execution',
    toneClass: 'border-primary/40 text-primary',
  }
}

export function inferTrackedArtifactStatus(
  artifactStatuses: Array<'done' | 'ready' | 'blocked'>
): 'done' | 'ready' | 'blocked' | null {
  if (artifactStatuses.includes('blocked')) return 'blocked'
  if (artifactStatuses.includes('ready')) return 'ready'
  if (artifactStatuses.includes('done')) return 'done'
  return null
}
