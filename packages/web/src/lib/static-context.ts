/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Select publication-safe Context facts from one static ExportSnapshot.
 * 2. Preserve root and Reference-policy provenance without fabricating runtime evidence.
 * 3. Keep absent legacy metadata explicit instead of treating it as an empty live observation.
 *
 * Owner acceptance feedback (2026-07-28): "Static 导出后的 /context 页面没数据。"
 */
import type { ExportSnapshot } from '@openspecui/core'

export type StaticContextReferencePolicy =
  | { kind: 'none' }
  | { kind: 'omit'; sourceCount: number }
  | {
      kind: 'include'
      sources: Array<{ storeId: string; state: 'ready' | 'error'; specCount: number }>
    }
  | { kind: 'unrecorded' }

/** Publication-safe Context projection. Runtime CLI and environment evidence are deliberately absent. */
export interface StaticContextSnapshot {
  observedAt: number | null
  projectName: string
  referencePolicy: StaticContextReferencePolicy
  root: ExportSnapshot['meta']['root'] | null
  version: string
}

function selectObservedAt(meta: ExportSnapshot['meta']): number | null {
  if (Number.isFinite(meta.observedAt) && meta.observedAt > 0) return meta.observedAt
  const timestamp = Date.parse(meta.timestamp)
  return Number.isFinite(timestamp) ? timestamp : null
}

/** Select only facts that have crossed the static publication/redaction boundary. */
export function selectStaticContextSnapshot(
  snapshot: ExportSnapshot | null
): StaticContextSnapshot | null {
  if (!snapshot) return null

  const policy = snapshot.meta.referencePolicy
  const referencePolicy: StaticContextReferencePolicy = !policy
    ? { kind: 'unrecorded' }
    : policy.kind === 'include'
      ? { kind: 'include', sources: policy.referenceSources }
      : policy.kind === 'omit'
        ? { kind: 'omit', sourceCount: policy.referenceSourceCount }
        : { kind: 'none' }

  return {
    observedAt: selectObservedAt(snapshot.meta),
    projectName: snapshot.meta.projectName,
    referencePolicy,
    root: snapshot.meta.root ?? null,
    version: snapshot.meta.version,
  }
}
