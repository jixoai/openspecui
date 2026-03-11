import { createReleaseStepDefinitions } from './plan'
import type { ReleasePlan, ReleaseStepDefinition, ReleaseStepId, ReleaseStepStatus } from './types'

export type ReleaseStepStatuses = ReadonlyMap<ReleaseStepId, ReleaseStepStatus>

export function formatReleaseStepStatus(status: ReleaseStepStatus): string {
  switch (status) {
    case 'failed':
      return 'FAILED'
    case 'running':
      return 'RUNNING'
    case 'skipped':
      return 'SKIPPED'
    case 'success':
      return 'DONE'
    default:
      return 'PENDING'
  }
}

function readStatus(statuses: ReleaseStepStatuses, step: ReleaseStepDefinition): ReleaseStepStatus {
  return statuses.get(step.id) ?? 'pending'
}

export function formatReleaseOverviewLines(
  plan: ReleasePlan,
  statuses: ReleaseStepStatuses,
  error: string | null
): string[] {
  const lines = [
    `Current openspecui version: ${plan.currentVersion}`,
    `Previous release version: ${plan.previousVersion ?? 'none'}`,
    `Baseline commit: ${plan.baselineCommit ?? 'none'}`,
    `Changed files since baseline: ${plan.changedFiles.length}`,
    '',
    'Deploy decisions',
    `- Website: ${plan.website.required ? 'deploy' : 'skip'} (${plan.website.reason})`,
    `- App: ${plan.app.required ? 'deploy' : 'skip'} (${plan.app.reason})`,
    `- npm wait: ${plan.waitForNpm.required ? 'required' : 'skip'} (${plan.waitForNpm.reason})`,
    '',
    'Steps',
  ]

  for (const step of createReleaseStepDefinitions(plan)) {
    const status = readStatus(statuses, step)
    lines.push(`- [${formatReleaseStepStatus(status)}] ${step.title}`)
    lines.push(`  ${step.skipReason ? `reason: ${step.skipReason}` : step.description}`)
  }

  if (error) {
    lines.push('')
    lines.push(`Error: ${error}`)
  }

  return lines
}
