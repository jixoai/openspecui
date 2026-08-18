/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Combine CLI artifact status with the explicit planning-completion fact.
 * 2. Promote CLI-reported applied tasks to the Applying phase without reading local task checklists.
 * 3. Keep skipped dependency satisfaction distinct from completion and archive readiness.
 * 4. Keep local tracked task data out of implementation-progress authority.
 *
 * Original request (2026-08-15): Owner walkthrough: loop-schema Changes with every planning
 *   artifact done must not read as an implementation-complete state.
 */
export interface ChangeWorkflowPhaseInput {
  hasStatus: boolean
  isPlanningComplete: boolean
  trackedArtifactStatus: 'done' | 'skipped' | 'ready' | 'blocked' | null
  /** Completed task count reported by the CLI list/Apply projection; null means no CLI evidence. */
  cliCompletedTasks?: number | null
}

export interface ChangeWorkflowPhase {
  label: string
  toneClass: string
}

export function classifyChangeWorkflowPhase(params: ChangeWorkflowPhaseInput): ChangeWorkflowPhase {
  // A known blocked planning artifact remains the strongest available workflow gate. Without
  // Status, however, it is unknown rather than inferred from absence.
  if (params.hasStatus && params.trackedArtifactStatus === 'blocked') {
    return {
      label: 'Draft',
      toneClass: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
    }
  }

  // CLI task evidence is the implementation-progress authority. Planning completion only
  // describes the artifact gate; it must not hide work that the CLI reports as applied.
  if (typeof params.cliCompletedTasks === 'number' && params.cliCompletedTasks > 0) {
    return {
      label: 'Applying',
      toneClass: 'border-primary/40 text-primary',
    }
  }

  if (!params.hasStatus) {
    return {
      label: 'Unknown',
      toneClass: 'border-border text-muted-foreground',
    }
  }

  if (params.isPlanningComplete) {
    return {
      label: 'Planning Complete',
      toneClass: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
    }
  }

  return {
    label: 'Planning',
    toneClass: 'border-border text-muted-foreground',
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
