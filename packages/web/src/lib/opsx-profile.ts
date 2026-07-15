/**
 * Orthogonal intents (created 2026-07-15 Asia/Shanghai):
 * 1. Mirror the official OpenSpec 1.6 workflow/profile vocabulary for Web controls.
 * 2. Classify an exact core-profile selection without inferring partial membership.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
export const OPSX_CORE_PROFILE_WORKFLOWS = [
  'propose',
  'explore',
  'apply',
  'update',
  'sync',
  'archive',
] as const

export const OPSX_ALL_WORKFLOWS = [
  'propose',
  'explore',
  'new',
  'continue',
  'apply',
  'update',
  'ff',
  'sync',
  'archive',
  'bulk-archive',
  'verify',
  'onboard',
] as const

export type OpsxWorkflowId = (typeof OPSX_ALL_WORKFLOWS)[number]

export const OPSX_WORKFLOW_LABELS: Record<OpsxWorkflowId, string> = {
  propose: 'Propose change',
  explore: 'Explore ideas',
  new: 'New change',
  continue: 'Continue change',
  apply: 'Apply tasks',
  update: 'Update change',
  ff: 'Fast-forward',
  sync: 'Sync specs',
  archive: 'Archive change',
  'bulk-archive': 'Bulk archive',
  verify: 'Verify change',
  onboard: 'Onboard',
}

export function isOpsxCoreWorkflowSelection(workflows: readonly string[]): boolean {
  return (
    workflows.length === OPSX_CORE_PROFILE_WORKFLOWS.length &&
    OPSX_CORE_PROFILE_WORKFLOWS.every((workflow) => workflows.includes(workflow))
  )
}
