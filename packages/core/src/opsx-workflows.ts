/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Define the complete OPSX workflow vocabulary once for Core, Server, CLI, and Web.
 * 2. Define profile and input-shape groups without coupling them to one transport.
 * 3. Define shared labels, command capability, and official skill-directory mappings.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
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

export const OPSX_CORE_PROFILE_WORKFLOWS = [
  'propose',
  'explore',
  'apply',
  'update',
  'sync',
  'archive',
] as const satisfies readonly OpsxWorkflowId[]

export const OPSX_TEXT_INPUT_ACTIONS = ['explore', 'propose'] as const
export const OPSX_ARTIFACT_INPUT_ACTIONS = ['continue', 'ff'] as const
export const OPSX_CHANGE_INPUT_ACTIONS = ['apply', 'update', 'archive', 'verify', 'sync'] as const
export const OPSX_COMMAND_CAPABLE_WORKFLOWS = [
  'propose',
  'apply',
  'update',
  'sync',
  'archive',
] as const satisfies readonly OpsxWorkflowId[]

export type OpsxTextInputAction = (typeof OPSX_TEXT_INPUT_ACTIONS)[number]
export type OpsxArtifactInputAction = (typeof OPSX_ARTIFACT_INPUT_ACTIONS)[number]
export type OpsxChangeInputAction = (typeof OPSX_CHANGE_INPUT_ACTIONS)[number]

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

export const OPSX_WORKFLOW_TO_SKILL_DIR: Record<OpsxWorkflowId, string> = {
  propose: 'openspec-propose',
  explore: 'openspec-explore',
  new: 'openspec-new-change',
  continue: 'openspec-continue-change',
  apply: 'openspec-apply-change',
  update: 'openspec-update-change',
  ff: 'openspec-ff-change',
  sync: 'openspec-sync-specs',
  archive: 'openspec-archive-change',
  'bulk-archive': 'openspec-bulk-archive-change',
  verify: 'openspec-verify-change',
  onboard: 'openspec-onboard',
}

export function isOpsxCoreWorkflowSelection(workflows: readonly string[]): boolean {
  return (
    workflows.length === OPSX_CORE_PROFILE_WORKFLOWS.length &&
    OPSX_CORE_PROFILE_WORKFLOWS.every((workflow) => workflows.includes(workflow))
  )
}
