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

/** Complete supported OPSX workflow identifier union. */
export type OpsxWorkflowId = (typeof OPSX_ALL_WORKFLOWS)[number]

/** Workflows delivered by the OpenSpec core profile. */
export const OPSX_CORE_PROFILE_WORKFLOWS = [
  'propose',
  'explore',
  'apply',
  'update',
  'sync',
  'archive',
] as const satisfies readonly OpsxWorkflowId[]

/** OPSX actions whose primary input is free text. */
export const OPSX_TEXT_INPUT_ACTIONS = ['explore', 'propose'] as const
/** OPSX actions whose primary input is an artifact identity. */
export const OPSX_ARTIFACT_INPUT_ACTIONS = ['continue', 'ff'] as const
/** OPSX actions whose primary input is an existing Change identity. */
export const OPSX_CHANGE_INPUT_ACTIONS = ['apply', 'update', 'archive', 'verify', 'sync'] as const
/** Workflows that can be delivered as explicit agent commands. */
export const OPSX_COMMAND_CAPABLE_WORKFLOWS = [
  'propose',
  'apply',
  'update',
  'sync',
  'archive',
] as const satisfies readonly OpsxWorkflowId[]

/** Text-input OPSX action union. */
export type OpsxTextInputAction = (typeof OPSX_TEXT_INPUT_ACTIONS)[number]
/** Artifact-input OPSX action union. */
export type OpsxArtifactInputAction = (typeof OPSX_ARTIFACT_INPUT_ACTIONS)[number]
/** Change-input OPSX action union. */
export type OpsxChangeInputAction = (typeof OPSX_CHANGE_INPUT_ACTIONS)[number]

/** User-facing labels for every supported OPSX workflow. */
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

/** First-party skill directory selected for each OPSX workflow. */
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

/** Return whether a workflow selection exactly represents the core profile. */
export function isOpsxCoreWorkflowSelection(workflows: readonly string[]): boolean {
  return (
    workflows.length === OPSX_CORE_PROFILE_WORKFLOWS.length &&
    OPSX_CORE_PROFILE_WORKFLOWS.every((workflow) => workflows.includes(workflow))
  )
}
