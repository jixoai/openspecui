/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Combine CLI artifact status with the explicit planning-completion fact.
 * 2. Keep blocked and ready planning states distinct without reading local task checklists.
 * 3. Keep skipped dependency satisfaction distinct from completion and archive readiness.
 * 4. Keep Apply implementation progress owned by Change Detail's CLI Instructions projection.
 *
 * Original request (2026-08-15): Owner walkthrough: loop-schema Changes with every planning
 *   artifact done must not read as an implementation-complete state.
 */
export interface ChangeWorkflowPhaseInput {
  hasStatus: boolean
  isPlanningComplete: boolean
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

  if (params.trackedArtifactStatus === 'blocked') {
    return {
      label: 'Draft',
      toneClass: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
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
