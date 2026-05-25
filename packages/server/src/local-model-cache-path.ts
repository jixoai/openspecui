import { join } from 'node:path'
import { getOpenSpecUICacheDir } from './translation-cache-path.js'

export function getDefaultLocalModelCacheRoot(): string {
  return join(getOpenSpecUICacheDir(), 'translation-engines', 'local')
}

export function getDefaultLocalModelCacheDir(): string {
  return join(getDefaultLocalModelCacheRoot(), 'hf-cache')
}

export function getDefaultLocalModelIndexPath(): string {
  return join(getDefaultLocalModelCacheRoot(), 'models.json')
}

export function getDefaultLocalModelProfileManifestPath(): string {
  return join(getDefaultLocalModelCacheRoot(), 'profile-manifests.json')
}

export function getDefaultLocalModelFetchCachePath(): string {
  return join(getDefaultLocalModelCacheRoot(), 'fetch-cache.json')
}

export function getLocalModelProfileRoot(cacheDir: string, modelId: string): string {
  return join(cacheDir, 'profiles', sanitizeLocalModelPathSegment(modelId))
}

export function getLocalModelProfileGroupRoot(
  cacheDir: string,
  modelId: string,
  groupId: string
): string {
  return join(getLocalModelProfileRoot(cacheDir, modelId), sanitizeLocalModelPathSegment(groupId))
}

export function sanitizeLocalModelPathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-')
}
