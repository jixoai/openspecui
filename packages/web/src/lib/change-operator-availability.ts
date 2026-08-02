/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Derive Apply availability from dependency-satisfied CLI artifact states without fabricating files.
 *
 * Original request (2026-07-28): Board and Change Detail must expose the same Apply boundary.
 */
import type { ChangeStatus } from '@openspecui/core'

export interface ChangeApplyAvailability {
  available: boolean
  missingArtifactIds: string[]
}

/** Derive the existing artifact prerequisite gate without inferring task or archive readiness. */
export function getChangeApplyAvailability(
  status: ChangeStatus | undefined
): ChangeApplyAvailability {
  if (!status) return { available: false, missingArtifactIds: [] }
  const satisfiedIds = new Set(
    status.artifacts
      .filter((artifact) => artifact.status === 'done' || artifact.status === 'skipped')
      .map((artifact) => artifact.id)
  )
  const missingArtifactIds = status.applyRequires.filter((id) => !satisfiedIds.has(id))
  return { available: missingArtifactIds.length === 0, missingArtifactIds }
}
