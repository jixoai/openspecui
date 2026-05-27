import { join } from 'node:path'
import { sanitizeLocalModelPathSegment } from './local-model-cache-path.js'
import { getOpenSpecUICacheDir } from './translation-cache-path.js'

export function getDefaultLocalCt2ModelCacheRoot(): string {
  return join(getOpenSpecUICacheDir(), 'translation-engines', 'local-ct2')
}

export function getDefaultLocalCt2ModelCacheDir(): string {
  return join(getDefaultLocalCt2ModelCacheRoot(), 'hf-cache')
}

export function getDefaultLocalCt2ModelIndexPath(): string {
  return join(getDefaultLocalCt2ModelCacheRoot(), 'models.json')
}

export function getDefaultLocalCt2ModelProfileManifestPath(): string {
  return join(getDefaultLocalCt2ModelCacheRoot(), 'profile-manifests.json')
}

export function getDefaultLocalCt2ModelFetchCachePath(): string {
  return join(getDefaultLocalCt2ModelCacheRoot(), 'fetch-cache.json')
}

export function getLocalCt2ModelArtifactRoot(cacheDir: string, modelId: string): string {
  return join(cacheDir, 'artifacts', sanitizeLocalModelPathSegment(modelId))
}

export function getLocalCt2ModelArtifactGroupRoot(
  cacheDir: string,
  modelId: string,
  groupId: string
): string {
  return join(
    getLocalCt2ModelArtifactRoot(cacheDir, modelId),
    sanitizeLocalModelPathSegment(groupId)
  )
}
