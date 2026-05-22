import { listFiles } from '@huggingface/hub'
import {
  buildNmtDownloadPlanFromRepositoryFiles,
  getDefaultGlobalSettingsPath,
  getTranslationEngineManifest,
  type TranslationModelDownloadPlan,
} from '@openspecui/core'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { normalizeHuggingFaceEndpoint } from './huggingface-endpoint.js'
import { getDefaultNmtModelCacheDir } from './nmt-model-cache-path.js'
import type { NmtModelFetchCacheStore } from './nmt-model-fetch-cache-store.js'

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

export async function resolveNmtModelRuntimePlan(input: {
  modelId: string
  transformers: TransformersRuntimeModule
  cacheDir: string
  selectedGroupId?: string
  hfEndpoint?: string
  fetchCacheStore?: NmtModelFetchCacheStore
}): Promise<TranslationModelDownloadPlan | null> {
  await configureTransformersRuntime(input.transformers, input.cacheDir)
  const hubUrl = normalizeHuggingFaceEndpoint(input.hfEndpoint)
  const repositoryFiles = await readHuggingFaceRepositoryFiles({
    selectedGroupId: input.selectedGroupId,
    modelId: input.modelId,
    hubUrl,
    fetchCacheStore: input.fetchCacheStore,
  })
  const repositoryPlan = buildNmtDownloadPlanFromRepositoryFiles({
    modelId: input.modelId,
    selectedGroupId: input.selectedGroupId,
    files: repositoryFiles,
  })
  return repositoryPlan
}

export interface NmtRuntimeSettingsReader {
  readSettings(): Promise<{
    translationEngines: {
      extensions: {
        installRoot?: string
      }
      nmt?: {
        hfEndpoint?: string
      }
    }
  }>
}

export async function resolveNmtModelRuntimePlanFromProject(input: {
  projectDir: string
  globalSettingsManager: NmtRuntimeSettingsReader
  modelId: string
  cacheDir?: string
  selectedGroupId?: string
  fetchCacheStore?: NmtModelFetchCacheStore
  loadTransformersModule?: typeof loadNmtTransformersModule
}): Promise<TranslationModelDownloadPlan | null> {
  const transformers = await (input.loadTransformersModule ?? loadNmtTransformersModule)(
    input.projectDir,
    input.globalSettingsManager
  )
  const settings = await input.globalSettingsManager.readSettings()
  return resolveNmtModelRuntimePlan({
    modelId: input.modelId,
    transformers,
    cacheDir: input.cacheDir ?? getDefaultNmtModelCacheDir(),
    selectedGroupId: input.selectedGroupId,
    hfEndpoint: settings.translationEngines.nmt?.hfEndpoint,
    fetchCacheStore: input.fetchCacheStore,
  })
}

export async function readNmtModelRuntimeCacheStatus(input: {
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
  fetchCacheStore?: NmtModelFetchCacheStore
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

function createProviderFetchCache(fetchCacheStore: NmtModelFetchCacheStore): typeof fetch {
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

async function loadNmtTransformersModule(
  projectDir: string,
  globalSettingsManager: NmtRuntimeSettingsReader
): Promise<TransformersRuntimeModule> {
  const manifest = getTranslationEngineManifest('nmt')
  const localPackage = await resolveLocalPackage(projectDir, manifest)
  if (localPackage) {
    const requireFromLocalPackage = createRequire(localPackage)
    return import(
      pathToFileURL(requireFromLocalPackage.resolve('@huggingface/transformers')).href
    ) as Promise<TransformersRuntimeModule>
  }
  const installedEntry = await resolveInstalledExtensionEntry(globalSettingsManager, manifest)
  const requireFromInstalledExtension = createRequire(installedEntry)
  return import(
    pathToFileURL(requireFromInstalledExtension.resolve('@huggingface/transformers')).href
  ) as Promise<TransformersRuntimeModule>
}

async function resolveInstalledExtensionEntry(
  globalSettingsManager: NmtRuntimeSettingsReader,
  manifest: ReturnType<typeof getTranslationEngineManifest>
): Promise<string> {
  const packageName = manifest.aliasName ?? manifest.packageName
  if (!packageName) {
    throw new Error(`Translation engine ${manifest.id} has no runtime package name.`)
  }
  const settings = await globalSettingsManager.readSettings()
  const installRoot =
    settings.translationEngines.extensions.installRoot ??
    join(dirname(getDefaultGlobalSettingsPath()), 'extensions')
  const requireFromInstallRoot = createRequire(join(installRoot, 'package.json'))
  return requireFromInstallRoot.resolve(packageName)
}

async function resolveLocalPackage(
  projectDir: string,
  manifest: ReturnType<typeof getTranslationEngineManifest>
): Promise<string | null> {
  if (!manifest.packageName) return null
  const packageDir = resolve(
    projectDir,
    'packages',
    manifest.packageName.replace('@openspecui/', '')
  )
  const source = join(packageDir, 'src', 'index.ts')
  const dist = join(packageDir, 'dist', 'index.mjs')
  const candidates = [source, dist]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}
