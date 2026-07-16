/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Enumerate static routes from snapshot identities without loading the render runtime.
 * 2. Resolve static page titles through the same compound Spec identity contract.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 */
import type { ExportSnapshot } from '@openspecui/core'
import {
  specIdentityFromRoute,
  specIdentityKey,
  specRoutePath,
} from '@openspecui/core/spec-catalog'

/** Return every route that must be pre-rendered for one snapshot. */
export function getRoutes(snapshot: ExportSnapshot): string[] {
  return [
    '/dashboard',
    '/specs',
    '/changes',
    '/archive',
    '/config',
    '/settings',
    ...snapshot.specs.map((spec) => specRoutePath(spec.identity)),
    ...snapshot.changes.map((change) => `/changes/${change.id}`),
    ...snapshot.archives.map((archive) => `/archive/${archive.id}`),
  ]
}

/** Resolve the display title for a pre-rendered route. */
export function getTitle(path: string, snapshot: ExportSnapshot): string {
  if (path === '/dashboard' || path === '/') return 'Dashboard'
  if (path === '/specs') return 'Specifications'
  if (path === '/changes') return 'Active Changes'
  if (path === '/archive') return 'Archived Changes'
  if (path === '/config') return 'Config'
  if (path === '/settings') return 'Settings'

  const ownedSpecMatch = path.match(/^\/specs\/owned\/([^/]+)$/)
  if (ownedSpecMatch) {
    const identity = specIdentityFromRoute({ specId: decodeURIComponent(ownedSpecMatch[1] ?? '') })
    return (
      snapshot.specs.find((spec) => specIdentityKey(spec.identity) === specIdentityKey(identity))
        ?.name || 'Spec'
    )
  }

  const changeMatch = path.match(/^\/changes\/(.+)$/)
  if (changeMatch)
    return snapshot.changes.find((change) => change.id === changeMatch[1])?.name || 'Change'

  const archiveMatch = path.match(/^\/archive\/(.+)$/)
  if (archiveMatch)
    return snapshot.archives.find((archive) => archive.id === archiveMatch[1])?.name || 'Archive'

  return 'OpenSpec UI'
}
