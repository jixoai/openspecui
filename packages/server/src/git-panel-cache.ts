/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Cache Git panel projections by canonical repository cwd and selector.
 * 2. Deduplicate concurrent loads without sharing mutable data across repository scopes.
 * 3. Invalidate one repository's mutable cache while keeping commit detail immutable.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 */
import { resolve } from 'node:path'

import { getDashboardGitTaskStatus } from './dashboard-overview.js'

interface CacheEntry<T> {
  version: string
  value: T
}

interface PendingCacheEntry<T> {
  version: string
  promise: Promise<T>
}

const gitPanelCaches = {
  overview: new Map<string, CacheEntry<unknown>>(),
  entries: new Map<string, CacheEntry<unknown>>(),
  meta: new Map<string, CacheEntry<unknown>>(),
  shell: new Map<string, CacheEntry<unknown>>(),
  files: new Map<string, CacheEntry<unknown>>(),
  snapshot: new Map<string, CacheEntry<unknown>>(),
  patch: new Map<string, CacheEntry<unknown>>(),
} as const

const gitPanelPendingCaches = {
  overview: new Map<string, PendingCacheEntry<unknown>>(),
  entries: new Map<string, PendingCacheEntry<unknown>>(),
  meta: new Map<string, PendingCacheEntry<unknown>>(),
  shell: new Map<string, PendingCacheEntry<unknown>>(),
  files: new Map<string, PendingCacheEntry<unknown>>(),
  snapshot: new Map<string, PendingCacheEntry<unknown>>(),
  patch: new Map<string, PendingCacheEntry<unknown>>(),
} as const

const gitPanelRefreshVersions = new Map<string, number>()

type GitPanelCacheScope = keyof typeof gitPanelCaches

function buildCacheKey(projectDir: string, key: string): string {
  return `${resolve(projectDir)}::${key}`
}

function isImmutableCommitDetailCache(scope: GitPanelCacheScope, key: string): boolean {
  return (
    (scope === 'meta' ||
      scope === 'shell' ||
      scope === 'files' ||
      scope === 'snapshot' ||
      scope === 'patch') &&
    key.startsWith('commit:')
  )
}

function getCacheVersion(scope: GitPanelCacheScope, projectDir: string, key: string): string {
  if (isImmutableCommitDetailCache(scope, key)) {
    return 'commit-detail:immutable'
  }

  const repositoryKey = resolve(projectDir)
  return `refresh:${getDashboardGitTaskStatus().lastFinishedAt ?? 0}:${gitPanelRefreshVersions.get(repositoryKey) ?? 0}`
}

/** Invalidate mutable panel data for one selected repository without affecting another scope. */
export function invalidateGitPanelCache(projectDir: string): void {
  const repositoryKey = resolve(projectDir)
  gitPanelRefreshVersions.set(repositoryKey, (gitPanelRefreshVersions.get(repositoryKey) ?? 0) + 1)
}

export async function getCachedGitPanelValue<T>(
  scope: GitPanelCacheScope,
  projectDir: string,
  key: string,
  load: () => Promise<T>
): Promise<T> {
  const cache = gitPanelCaches[scope] as Map<string, CacheEntry<T>>
  const pendingCache = gitPanelPendingCaches[scope] as Map<string, PendingCacheEntry<T>>
  const cacheKey = buildCacheKey(projectDir, key)
  const version = getCacheVersion(scope, projectDir, key)
  const hit = cache.get(cacheKey)

  if (hit && hit.version === version) {
    return hit.value
  }

  const pending = pendingCache.get(cacheKey)
  if (pending && pending.version === version) {
    return pending.promise
  }

  const promise = load()
    .then((value) => {
      cache.set(cacheKey, { version, value })
      return value
    })
    .finally(() => {
      const current = pendingCache.get(cacheKey)
      if (current?.promise === promise) {
        pendingCache.delete(cacheKey)
      }
    })

  pendingCache.set(cacheKey, { version, promise })
  return promise
}
