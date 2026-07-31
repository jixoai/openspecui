/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Translate opaque Environment identity into project-shaped product labels.
 * 2. Keep envUri available only as low-frequency evidence, never as direct-plane copy.
 *
 * Owner-reported confusion (2026-07-31): "用户怎么理解这个env呢？"
 */
import type { EnvironmentEvidenceEntry } from '../components/stores-environment-evidence'

/** Select a concise human label for one observed Store Environment. */
export function selectEnvironmentLabel(environment: EnvironmentEvidenceEntry): string {
  const labels = environment.projects
    .map((project) => project.label?.trim())
    .filter((label): label is string => Boolean(label))
  const uniqueLabels = [...new Set(labels)]
  if (uniqueLabels.length === 1) return uniqueLabels[0]!
  if (uniqueLabels.length > 1) {
    return `${uniqueLabels[0]} + ${uniqueLabels.length - 1} project${uniqueLabels.length > 2 ? 's' : ''}`
  }
  return environment.projects.length > 0
    ? `${environment.projects.length} connected projects`
    : 'Observed Environment'
}
