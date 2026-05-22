import { join } from 'node:path'
import { getOpenSpecUICacheDir } from './translation-cache-path.js'

export function getDefaultNmtModelCacheRoot(): string {
  return join(getOpenSpecUICacheDir(), 'translation-engines', 'nmt')
}

export function getDefaultNmtModelCacheDir(): string {
  return join(getDefaultNmtModelCacheRoot(), 'hf-cache')
}

export function getDefaultNmtModelIndexPath(): string {
  return join(getDefaultNmtModelCacheRoot(), 'models.json')
}

export function getDefaultNmtModelFetchCachePath(): string {
  return join(getDefaultNmtModelCacheRoot(), 'fetch-cache.json')
}
