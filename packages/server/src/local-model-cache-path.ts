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

export function getDefaultLocalModelFetchCachePath(): string {
  return join(getDefaultLocalModelCacheRoot(), 'fetch-cache.json')
}
