import { listFiles, modelInfo } from '@huggingface/hub'
import {
  buildLocalDownloadPlanFromRepositoryFiles,
  type LocalRepositoryFile,
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

export interface LocalModelRepositorySnapshot {
  modelId: string
  revision: string
  commitHash: string
  shortCommitHash: string
  files: LocalRepositoryFile[]
  raw?: unknown
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

export async function readLocalModelRepositorySnapshot(input: {
  modelId: string
  hfEndpoint?: string
  fetchCacheStore?: LocalModelFetchCacheStore
  revision?: string
}): Promise<LocalModelRepositorySnapshot> {
  return readHuggingFaceRepositorySnapshot({
    modelId: input.modelId,
    hubUrl: normalizeHuggingFaceEndpoint(input.hfEndpoint),
    fetchCacheStore: input.fetchCacheStore,
    revision: input.revision,
  })
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
  const snapshot = await readHuggingFaceRepositorySnapshot({
    modelId: input.modelId,
    hubUrl,
    fetchCacheStore: input.fetchCacheStore,
  })
  const repositoryPlan = buildLocalDownloadPlanFromRepositoryFiles({
    modelId: input.modelId,
    selectedGroupId: input.selectedGroupId,
    files: snapshot.files,
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

async function readHuggingFaceRepositorySnapshot(input: {
  modelId: string
  hubUrl: string
  fetchCacheStore?: LocalModelFetchCacheStore
  revision?: string
}): Promise<LocalModelRepositorySnapshot> {
  const detail = await readHuggingFaceModelSnapshotInfo(input).catch(() => null)
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const files: LocalRepositoryFile[] = []
      let commitHash = detail?.commitHash
      for await (const entry of listFiles({
        repo: { type: 'model', name: input.modelId },
        recursive: true,
        expand: true,
        revision: input.revision,
        hubUrl: input.hubUrl,
        fetch: input.fetchCacheStore ? createProviderFetchCache(input.fetchCacheStore) : undefined,
      })) {
        if (entry.type !== 'file') continue
        commitHash ??= entry.lastCommit?.id
        const etag = entry.lfs?.oid ?? entry.xetHash ?? entry.oid
        files.push({
          path: entry.path,
          sizeBytes: entry.lfs?.size ?? entry.size,
          etag,
          revision: entry.lastCommit?.id,
          sourceUrl: `${input.hubUrl}/${input.modelId}/resolve/${entry.lastCommit?.id ?? input.revision ?? 'main'}/${entry.path}`,
          raw: entry,
        })
      }
      if (files.length > 0 && commitHash) {
        return {
          modelId: input.modelId,
          revision: input.revision ?? 'main',
          commitHash,
          shortCommitHash: commitHash.slice(0, 6),
          files,
          raw: detail?.raw,
        }
      }
      lastError = new Error(`No repository files were returned for ${input.modelId}.`)
    } catch (error) {
      lastError = error
    }
    if (attempt < 2) await delay(300 * (attempt + 1))
  }
  const cachedFiles = await readCachedHuggingFaceRepositoryFiles(input)
  if (cachedFiles.files.length > 0 && cachedFiles.commitHash) {
    return {
      modelId: input.modelId,
      revision: input.revision ?? 'main',
      commitHash: cachedFiles.commitHash,
      shortCommitHash: cachedFiles.commitHash.slice(0, 6),
      files: cachedFiles.files,
      raw: cachedFiles.raw,
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Unable to read repository files for ${input.modelId}.`)
}

async function readHuggingFaceModelSnapshotInfo(input: {
  modelId: string
  hubUrl: string
  revision?: string
}): Promise<{ commitHash: string; raw: unknown }> {
  const detail = await modelInfo({
    name: input.modelId,
    hubUrl: input.hubUrl,
    revision: input.revision,
    additionalFields: ['sha'],
  })
  const raw = detail as unknown
  const commitHash =
    typeof (detail as { sha?: unknown }).sha === 'string'
      ? (detail as { sha: string }).sha
      : undefined
  if (!commitHash) {
    throw new Error(`Unable to resolve a commit hash for ${input.modelId}.`)
  }
  return { commitHash, raw }
}

async function readCachedHuggingFaceRepositoryFiles(input: {
  modelId: string
  fetchCacheStore?: LocalModelFetchCacheStore
}): Promise<{ files: LocalRepositoryFile[]; commitHash?: string; raw?: unknown }> {
  if (!input.fetchCacheStore) return { files: [] }
  const record = await input.fetchCacheStore.read(input.modelId)
  if (!record?.detailRaw) return { files: [] }
  return extractRepositoryFilesFromCachedDetail(record.detailRaw)
}

function extractRepositoryFilesFromCachedDetail(
  raw: Record<string, unknown>
): { files: LocalRepositoryFile[]; commitHash?: string; raw?: unknown } {
  const siblings = Array.isArray(raw.siblings) ? raw.siblings : []
  const commitHash = typeof raw.sha === 'string' ? raw.sha : undefined
  const files: LocalRepositoryFile[] = []
  for (const sibling of siblings) {
    if (!sibling || typeof sibling !== 'object') continue
    const record = sibling as Record<string, unknown>
    const path = typeof record.rfilename === 'string' ? record.rfilename : null
    if (!path) continue
    files.push({
      path,
      sizeBytes: typeof record.size === 'number' && Number.isFinite(record.size) ? record.size : undefined,
      revision: commitHash,
      raw: record,
    })
  }
  return { files, commitHash, raw }
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadLocalTransformersModule(
  _projectDir: string,
  _globalSettingsManager: LocalRuntimeSettingsReader
): Promise<TransformersRuntimeModule> {
  const mod = await import('@huggingface/transformers')
  return mod as unknown as TransformersRuntimeModule
}
