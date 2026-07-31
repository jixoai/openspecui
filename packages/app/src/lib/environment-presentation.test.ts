/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove Environment labels lead with observed project identity instead of opaque envUri evidence.
 * 2. Prove multi-project Environments remain concise without erasing shared-registry scope.
 *
 * Owner-reported confusion (2026-07-31): "用户怎么理解这个env呢？"
 */
import { describe, expect, it } from 'vitest'
import type { EnvironmentEvidenceEntry } from '../components/stores-environment-evidence'
import { selectEnvironmentLabel } from './environment-presentation'

function environment(projectLabels: readonly (string | undefined)[]): EnvironmentEvidenceEntry {
  return {
    envUri: 'openspecui-env://1/opaque-internal-identity',
    observedAt: 1,
    projects: projectLabels.map((label, index) => ({
      sourceId: `workspace-${index}`,
      label,
    })),
  }
}

describe('selectEnvironmentLabel', () => {
  it('uses the single observed project label', () => {
    const label = selectEnvironmentLabel(environment(['openspecui']))
    expect(label).toBe('openspecui')
    expect(label).not.toContain('openspecui-env://')
  })

  it('summarizes a shared multi-project Environment', () => {
    const label = selectEnvironmentLabel(environment(['openspecui', 'accept-ref', 'docs']))
    expect(label).toBe('openspecui + 2 projects')
    expect(label).not.toContain('opaque-internal-identity')
  })
})
