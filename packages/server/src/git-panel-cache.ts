import { resolve } from 'node:path'

import { getDashboardGitTaskStatus } from './dashboard-overview.js'

interface CacheEntry<T> {
  version: number
  value: T
}

const gitPanelCaches = {
  overview: new Map<string, CacheEntry<unknown>>(),
  entries: new Map<string, CacheEntry<unknown>>(),
  shell: new Map<string, CacheEntry<unknown>>(),
  patch: new Map<string, CacheEntry<unknown>>(),
} as const

type GitPanelCacheScope = keyof typeof gitPanelCaches

function buildCacheKey(projectDir: string, key: string): string {
  return `${resolve(projectDir)}::${key}`
}

function getCacheVersion(): number {
  return getDashboardGitTaskStatus().lastFinishedAt ?? 0
}

export async function getCachedGitPanelValue<T>(
  scope: GitPanelCacheScope,
  projectDir: string,
  key: string,
  load: () => Promise<T>
): Promise<T> {
  const cache = gitPanelCaches[scope] as Map<string, CacheEntry<T>>
  const cacheKey = buildCacheKey(projectDir, key)
  const version = getCacheVersion()
  const hit = cache.get(cacheKey)

  if (hit && hit.version === version) {
    return hit.value
  }

  const value = await load()
  cache.set(cacheKey, { version, value })
  return value
}
