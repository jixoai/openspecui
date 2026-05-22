import { listFiles } from '@huggingface/hub'
import {
  buildLocalDownloadPlanFromRepositoryFiles,
  type TranslationModelDownloadPlan,
} from '@openspecui/core'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { normalizeHuggingFaceEndpoint } from './huggingface-endpoint.js'
import { getDefaultLocalModelCacheDir } from './local-model-cache-path.js'
import type { LocalModelFetchCacheStore } from './local-model-fetch-cache-store.js'

export interface TransformersModelRegistry {
  get_pipeline_files(
    task: string,
    modelId: string,
    options?: { cache_dir?: string; dtype?: string }
  ): Promise<string[]>
  is_pipeline_cached_files(
    task: string,
    modelId: string,
    options?: { cache_dir?: string; dtype?: string }
  ): Promise<{ allCached: boolean; files: Array<{ file: string; cached: boolean }> }>
  get_file_metadata(
    modelId: string,
    filename: string,
    options?: { cache_dir?: string }
  ): Promise<{ exists: boolean; size?: number; fromCache?: boolean }>
}

export interface TransformersRuntimeModule {
  env: {
    cacheDir: string | null
    allowLocalModels: boolean
    localModelPath: string
    remoteHost?: string
  }
  ModelRegistry: TransformersModelRegistry
}

export async function configureTransformersRuntime(
  transformers: TransformersRuntimeModule,
  cacheDir: string
): Promise<void> {
  await mkdir(cacheDir, { recursive: true })
  transformers.env.cacheDir = cacheDir
  transformers.env.allowLocalModels = false
  transformers.env.localModelPath = join(cacheDir, 'models')
}

export async function resolveLocalModelRuntimePlan(input: {
  modelId: string
  transformers: TransformersRuntimeModule
  cacheDir: string
  selectedGroupId?: string
  hfEndpoint?: string
  fetchCacheStore?: LocalModelFetchCacheStore
}): Promise<TranslationModelDownloadPlan | null> {
  await configureTransformersRuntime(input.transformers, input.cacheDir)
  const hubUrl = normalizeHuggingFaceEndpoint(input.hfEndpoint)
  const repositoryFiles = await readHuggingFaceRepositoryFiles({
    selectedGroupId: input.selectedGroupId,
    modelId: input.modelId,
    hubUrl,
    fetchCacheStore: input.fetchCacheStore,
  })
  const repositoryPlan = buildLocalDownloadPlanFromRepositoryFiles({
    modelId: input.modelId,
    selectedGroupId: input.selectedGroupId,
    files: repositoryFiles,
  })
  return repositoryPlan
}

export interface LocalRuntimeSettingsReader {
  readSettings(): Promise<{
    translationEngines: {
      local?: {
        hfEndpoint?: string
      }
    }
  }>
}

export async function resolveLocalModelRuntimePlanFromProject(input: {
  projectDir: string
  globalSettingsManager: LocalRuntimeSettingsReader
  modelId: string
  cacheDir?: string
  selectedGroupId?: string
  fetchCacheStore?: LocalModelFetchCacheStore
  loadTransformersModule?: typeof loadLocalTransformersModule
}): Promise<TranslationModelDownloadPlan | null> {
  const transformers = await (input.loadTransformersModule ?? loadLocalTransformersModule)(
    input.projectDir,
    input.globalSettingsManager
  )
  const settings = await input.globalSettingsManager.readSettings()
  return resolveLocalModelRuntimePlan({
    modelId: input.modelId,
    transformers,
    cacheDir: input.cacheDir ?? getDefaultLocalModelCacheDir(),
    selectedGroupId: input.selectedGroupId,
    hfEndpoint: settings.translationEngines.local?.hfEndpoint,
    fetchCacheStore: input.fetchCacheStore,
  })
}

export async function readLocalModelRuntimeCacheStatus(input: {
  modelId: string
  transformers: TransformersRuntimeModule
  cacheDir: string
  dtype?: string
}): Promise<{ allCached: boolean; files: Array<{ file: string; cached: boolean }> }> {
  await configureTransformersRuntime(input.transformers, input.cacheDir)
  return input.transformers.ModelRegistry.is_pipeline_cached_files('translation', input.modelId, {
    cache_dir: input.cacheDir,
    ...(input.dtype ? { dtype: input.dtype } : {}),
  })
}

async function readHuggingFaceRepositoryFiles(input: {
  modelId: string
  selectedGroupId?: string
  hubUrl: string
  fetchCacheStore?: LocalModelFetchCacheStore
}): Promise<Array<{ path: string; sizeBytes?: number }>> {
  const files: Array<{ path: string; sizeBytes?: number }> = []
  for await (const entry of listFiles({
    repo: { type: 'model', name: input.modelId },
    recursive: true,
    expand: true,
    hubUrl: input.hubUrl,
    fetch: input.fetchCacheStore ? createProviderFetchCache(input.fetchCacheStore) : undefined,
  })) {
    if (entry.type !== 'file') continue
    files.push({
      path: entry.path,
      sizeBytes: entry.lfs?.size ?? entry.size,
    })
  }
  return files
}

function createProviderFetchCache(fetchCacheStore: LocalModelFetchCacheStore): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init)
    const url = normalizeRequestUrl(input)
    if (!url.includes('/api/models/') || !url.includes('/tree/')) return response
    await fetchCacheStore.upsertProviderFetch({
      url,
      status: response.status,
      ok: response.ok,
      headers: headersToRecord(response.headers),
      bodyText: await response.clone().text(),
    })
    return response
  }
}

function normalizeRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries())
}

async function loadLocalTransformersModule(
  _projectDir: string,
  _globalSettingsManager: LocalRuntimeSettingsReader
): Promise<TransformersRuntimeModule> {
  const mod = await import('@huggingface/transformers')
  return mod as unknown as TransformersRuntimeModule
}
