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

function getCacheVersion(scope: GitPanelCacheScope, key: string): string {
  if (isImmutableCommitDetailCache(scope, key)) {
    return 'commit-detail:immutable'
  }

  return `refresh:${getDashboardGitTaskStatus().lastFinishedAt ?? 0}`
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
  const version = getCacheVersion(scope, key)
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
