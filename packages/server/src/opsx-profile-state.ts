/**
 * Orthogonal intents (created 2026-07-18 Asia/Shanghai):
 * 1. Parse the CLI-owned OPSX profile projection with effective Core defaults.
 * 2. Share one typed drift interpretation between public CLI and Config projections.
 *
 * Original request (2026-07-18): "Reuse the pinned Core workflow contract and remove parser duplication."
 */
import { OPSX_CORE_PROFILE_WORKFLOWS } from '@openspecui/core'

export type OpsxWorkflowProfile = 'core' | 'custom'
export type OpsxWorkflowDelivery = 'both' | 'skills' | 'commands'

export interface ParsedOpsxProfileState {
  profile: OpsxWorkflowProfile
  delivery: OpsxWorkflowDelivery
  workflows: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Resolve the effective workflow set without rewriting the raw CLI config payload. */
export function effectiveOpsxWorkflowList(config: Readonly<Record<string, unknown>>): string[] {
  if (Array.isArray(config.workflows)) {
    return config.workflows.filter(
      (workflow): workflow is string => typeof workflow === 'string' && workflow.length > 0
    )
  }
  return config.profile === 'core' ? [...OPSX_CORE_PROFILE_WORKFLOWS] : []
}

/** Parse `config list --json`, applying the pinned CLI's omitted-Core default. */
export function parseOpsxProfileListJson(stdout: string): ParsedOpsxProfileState | null {
  try {
    const value: unknown = JSON.parse(stdout)
    if (!isRecord(value)) return null
    const profile: OpsxWorkflowProfile = value.profile === 'custom' ? 'custom' : 'core'
    const delivery: OpsxWorkflowDelivery =
      value.delivery === 'skills' || value.delivery === 'commands' ? value.delivery : 'both'
    return { profile, delivery, workflows: effectiveOpsxWorkflowList(value) }
  } catch {
    return null
  }
}

/** Extract the first objective CLI warning that indicates profile drift. */
export function parseOpsxConfigDrift(output: string): {
  drift: boolean
  warningText: string | null
} {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const warningText =
    lines.find((line) => /global config.+not applied.+project/i.test(line)) ??
    lines.find((line) => /out of sync/i.test(line)) ??
    lines.find((line) => /run\s+`?openspec\s+update`?/i.test(line)) ??
    null
  return { drift: warningText !== null, warningText }
}
