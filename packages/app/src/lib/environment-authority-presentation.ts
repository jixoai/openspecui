/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Preserve each Environment authority outcome as concise direct-plane product evidence.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 Environment Center。"
 * Review correction (2026-07-30): Store Detail must not collapse source conflict into generic authority loss.
 * Owner-reported confusion (2026-07-31): internal "Environment authority" language is not user-facing vocabulary.
 */
import type { EnvironmentAuthorityResolution } from './environment-authority'

/** Direct-plane issue shown when an Environment cannot currently authorize Store work. */
export interface EnvironmentAuthorityIssue {
  readonly severity: 'warning' | 'error'
  readonly message: string
}

/** Map exhaustive authority outcomes to user-facing evidence without rewriting conflict as generic absence. */
export function selectEnvironmentAuthorityIssue(
  kind: EnvironmentAuthorityResolution['kind']
): EnvironmentAuthorityIssue | null {
  switch (kind) {
    case 'no-environment':
      return {
        severity: 'warning',
        message: 'Open a compatible Workspace to observe its runtime Environment.',
      }
    case 'requires-selection':
      return {
        severity: 'warning',
        message: 'Choose an Environment to view and manage its Stores.',
      }
    case 'pending':
      return {
        severity: 'warning',
        message: 'Store data is updating for the selected Environment.',
      }
    case 'offline':
      return {
        severity: 'error',
        message: 'Every observed source for this Environment is offline.',
      }
    case 'authentication-required':
      return {
        severity: 'error',
        message: 'The selected Environment requires authentication.',
      }
    case 'incompatible':
      return { severity: 'error', message: 'No observed source supports the Store protocol.' }
    case 'conflict':
      return {
        severity: 'error',
        message: 'Current sources disagree on Store evidence for this Environment.',
      }
    case 'no-current-authority':
      return {
        severity: 'warning',
        message: 'No connected Workspace is currently ready to change Stores in this Environment.',
      }
    case 'authority':
      return null
  }
}
