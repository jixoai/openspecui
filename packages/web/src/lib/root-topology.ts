/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Classify Launch and Planning physical identity as collapsed, distinct, or unresolved.
 * 2. Keep the presentation selector pure and independent from diagnostics, Store, Git, and subscriptions.
 *
 * Owner same-root direction (2026-07-29): hide redundant Dashboard and Terminal facts when Launch equals Planning.
 */
import type { RootContext } from '@openspecui/core'

/** Presentation relationship between the Launch project and writable Planning root. */
export type RootTopology = 'collapsed' | 'distinct' | 'unresolved'

function normalizeObservedPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  if (normalized === '/') return normalized
  return normalized.replace(/\/$/, '')
}

/** Compare server-observed physical Root identities without inferring from other health facts. */
export function selectRootTopology(
  context: Pick<RootContext, 'launchProject' | 'planningRoot'> | null | undefined
): RootTopology {
  const planningPath = context?.planningRoot?.path
  if (!context || !planningPath) return 'unresolved'

  const launchPath = context.launchProject.physicalPath
  if (!launchPath) return 'unresolved'

  return normalizeObservedPath(launchPath) === normalizeObservedPath(planningPath)
    ? 'collapsed'
    : 'distinct'
}
