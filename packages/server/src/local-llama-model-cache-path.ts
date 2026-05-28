import { join } from 'node:path'
import { sanitizeLocalModelPathSegment } from './local-model-cache-path.js'
import { getOpenSpecUICacheDir } from './translation-cache-path.js'

export function getDefaultLocalLlamaModelCacheRoot(): string {
  return join(getOpenSpecUICacheDir(), 'translation-engines', 'local-llama')
}

export function getDefaultLocalLlamaModelCacheDir(): string {
  return join(getDefaultLocalLlamaModelCacheRoot(), 'hf-cache')
}

export function getDefaultLocalLlamaModelIndexPath(): string {
  return join(getDefaultLocalLlamaModelCacheRoot(), 'models.json')
}

export function getDefaultLocalLlamaModelProfileManifestPath(): string {
  return join(getDefaultLocalLlamaModelCacheRoot(), 'profile-manifests.json')
}

export function getDefaultLocalLlamaModelFetchCachePath(): string {
  return join(getDefaultLocalLlamaModelCacheRoot(), 'fetch-cache.json')
}

export function getLocalLlamaModelArtifactRoot(cacheDir: string, modelId: string): string {
  return join(cacheDir, 'artifacts', sanitizeLocalModelPathSegment(modelId))
}

export function getLocalLlamaModelArtifactGroupRoot(
  cacheDir: string,
  modelId: string,
  groupId: string
): string {
  return join(
    getLocalLlamaModelArtifactRoot(cacheDir, modelId),
    sanitizeLocalModelPathSegment(groupId)
  )
}
