/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Derive the shared Apply entry availability from CLI-owned Change Status.
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
  const doneIds = new Set(
    status.artifacts.filter((artifact) => artifact.status === 'done').map((artifact) => artifact.id)
  )
  const missingArtifactIds = status.applyRequires.filter((id) => !doneIds.has(id))
  return { available: missingArtifactIds.length === 0, missingArtifactIds }
}
