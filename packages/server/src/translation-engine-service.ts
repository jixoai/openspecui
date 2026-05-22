import {
  TRANSLATION_ENGINE_MANIFESTS,
  type BatchTranslateInput,
  type BatchTranslateEvent,
  type ConfigManager,
  type GlobalSettingsManager,
  type LocalModelAssetState,
  type ServiceTranslationEngineId,
  type TranslationEngineId,
  type TranslationEngineManifest,
  type TranslationModelDownloadPlan,
  type TranslationModelSearchInput,
  type TranslationModelSearchResult,
  type TranslatorFactory,
} from '@openspecui/core'
import { observable } from '@trpc/server/observable'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ensureProxyAwareFetchDispatcher } from './network-dispatcher.js'
import { LocalModelAssetStore } from './local-model-asset-store.js'
import {
  getDefaultLocalModelCacheDir,
  getDefaultLocalModelFetchCachePath,
  getDefaultLocalModelIndexPath,
} from './local-model-cache-path.js'
import { LocalModelFetchCacheStore } from './local-model-fetch-cache-store.js'
import { readLocalModelFileStatus } from './local-model-local-cache.js'
import {
  resolveLocalModelRuntimePlanFromProject,
  type LocalRuntimeSettingsReader,
  type TransformersRuntimeModule,
} from './local-model-runtime.js'
import { searchLocalModels } from './translation-model-catalog.js'

export interface TranslationEngineListItem extends TranslationEngineManifest {
  selected: boolean
  status: 'available' | 'unavailable'
  message?: string
  model?: string
}

export interface TranslationEngineServiceOptions {
  projectDir: string
  configManager: ConfigManager
  globalSettingsManager: GlobalSettingsManager
  now?: () => number
  localCacheDir?: string
  localAssetIndexPath?: string
  localFetchCachePath?: string
}

export class TranslationEngineService {
  private readonly projectDir: string
  private readonly configManager: ConfigManager
  private readonly globalSettingsManager: GlobalSettingsManager
  private readonly now: () => number
  private readonly localCacheDir: string
  private readonly localAssetStore: LocalModelAssetStore
  private readonly localFetchCacheStore: LocalModelFetchCacheStore

  constructor(options: TranslationEngineServiceOptions) {
    ensureProxyAwareFetchDispatcher()
    this.projectDir = options.projectDir
    this.configManager = options.configManager
    this.globalSettingsManager = options.globalSettingsManager
    this.now = options.now ?? Date.now
    this.localCacheDir = options.localCacheDir ?? getDefaultLocalModelCacheDir()
    this.localAssetStore = new LocalModelAssetStore({
      indexPath: options.localAssetIndexPath ?? getDefaultLocalModelIndexPath(),
    })
    this.localFetchCacheStore = new LocalModelFetchCacheStore({
      cachePath: options.localFetchCachePath ?? getDefaultLocalModelFetchCachePath(),
      now: this.now,
    })
  }

  async listEngines(): Promise<TranslationEngineListItem[]> {
    const [config, globalSettings] = await Promise.all([
      this.configManager.readConfig(),
      this.globalSettingsManager.readSettings(),
    ])
    return TRANSLATION_ENGINE_MANIFESTS.map((manifest) => ({
      ...manifest,
      selected: config.translation.engineId === manifest.id,
      status: 'available',
      model:
        manifest.id === 'local'
          ? (config.translation.engines.local.model ?? globalSettings.translationEngines.local.model)
          : manifest.id === 'openai'
            ? (config.translation.engines.openai.model ??
              globalSettings.translationEngines.openai.model)
            : undefined,
    }))
  }

  async searchModels(input: TranslationModelSearchInput): Promise<TranslationModelSearchResult> {
    if (input.engineId !== 'local') {
      return { items: [] }
    }
    const globalSettings = await this.globalSettingsManager.readSettings()
    return searchLocalModels(input, {
      hfEndpoint: globalSettings.translationEngines.local.hfEndpoint,
    })
  }

  async getModelDownloadPlan(input: {
    engineId: ServiceTranslationEngineId
    model: string
    selectedGroupId?: string
  }): Promise<TranslationModelDownloadPlan | null> {
    if (input.engineId !== 'local') return null
    const state = (await this.localAssetStore.readMap()).get(input.model)
    const plan = await resolveLocalModelRuntimePlanFromProject({
      projectDir: this.projectDir,
      globalSettingsManager: this.globalSettingsManager,
      modelId: input.model,
      selectedGroupId: input.selectedGroupId,
      cacheDir: this.localCacheDir,
      fetchCacheStore: this.localFetchCacheStore,
      loadTransformersModule: this.loadLocalTransformersModuleForPlan.bind(this),
    }).catch(() => null)
    const fallbackPlan = selectPersistedLocalPlan(state, input.selectedGroupId)
    const effectivePlan = plan ?? fallbackPlan
    if (!effectivePlan) return null
    return enrichDownloadPlanWithAssetSnapshot(effectivePlan, state, input.selectedGroupId)
  }

  async selectEngine(engineId: TranslationEngineId): Promise<{ success: true }> {
    await this.configManager.writeConfig({ translation: { engineId } })
    return { success: true }
  }

  batchTranslate(input: BatchTranslateInput) {
    return observable<BatchTranslateEvent>((emit) => {
      if (input.engineId === 'browser') {
        emit.error(new Error('Browser translator runs in the browser runtime.'))
        return () => {}
      }

      const controller = new AbortController()
      void (async () => {
        try {
          if (input.engineId === 'browser') {
            throw new Error('Browser translator runs in the browser runtime.')
          }
          const dtype = await this.readLocalDtype(
            input.engineId,
            input.model,
            input.selectedGroupId
          )
          if (input.engineId === 'local' && input.model) {
            await this.assertLocalModelReady(input.model, input.selectedGroupId)
          }
          const factory = await this.loadFactory(input.engineId, input.model)
          const translator = await factory.create({
            sourceLanguage: input.sourceLanguage,
            targetLanguage: input.targetLanguage,
            model: input.model,
            dtype,
            runtimeConfig:
              input.engineId === 'local' && input.model
                ? await this.readLocalRuntimeConfig(input.model)
                : undefined,
            signal: controller.signal,
          })
          try {
            for await (const event of translator.batchTranslate(input.inputs, {
              instructions: input.instructions,
              context: input.context,
              signal: controller.signal,
            })) {
              emit.next(event)
            }
            emit.complete()
          } finally {
            translator.destroy?.()
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            emit.error(error instanceof Error ? error : new Error(String(error)))
          }
        }
      })()

      return () => {
        controller.abort()
      }
    })
  }

  private async readLocalDtype(
    engineId: TranslationEngineId,
    model: string | undefined,
    selectedGroupId: string | undefined
  ): Promise<string | undefined> {
    if (engineId !== 'local' || !model) return undefined
    const effectiveSelectedGroupId =
      selectedGroupId ??
      (await this.globalSettingsManager.readSettings()).translationEngines.local.selectedGroupId
    if (!effectiveSelectedGroupId) return undefined
    const plan = await this.getModelDownloadPlan({
      engineId: 'local',
      model,
      selectedGroupId: effectiveSelectedGroupId,
    })
    return plan?.groups?.find((group) => group.id === effectiveSelectedGroupId)?.dtype
  }

  private async assertLocalModelReady(
    model: string,
    selectedGroupId: string | undefined
  ): Promise<void> {
    const plan = await this.getModelDownloadPlan({
      engineId: 'local',
      model,
      selectedGroupId,
    })
    const selectedGroup =
      plan?.groups?.find((group) => group.id === (selectedGroupId ?? plan.selectedGroupId)) ??
      plan?.groups?.find((group) => group.selected)
    const files = selectedGroup?.files ?? plan?.files ?? []
    if (!plan || files.length === 0) {
      throw new Error('No local runtime file plan is available for the selected model.')
    }
    const cacheStatus = await readLocalModelFileStatus({
      cacheDir: this.localCacheDir,
      modelId: model,
      files: files.map((file) => file.path),
    })
    if (cacheStatus.allCached) {
      const states = await this.localAssetStore.readMap()
      const current = states.get(model)
      if (current) {
        await this.localAssetStore.upsert({
          ...current,
          status: 'downloaded',
          progress: 1,
          bytesDownloaded: plan.estimatedTotalBytes ?? current.bytesDownloaded,
          totalBytes: plan.estimatedTotalBytes ?? current.totalBytes,
          resumable: false,
          error: undefined,
          plan,
          files: files.map((file) => ({
            path: file.path,
            sizeBytes: file.sizeBytes,
            downloadedBytes: file.sizeBytes,
          })),
          installedAt: current.installedAt ?? this.now(),
          updatedAt: this.now(),
        })
      }
      return
    }
    const allMissingFiles = cacheStatus.files
      .filter((file) => !file.cached)
      .map((file) => file.file)
    const missingFiles = allMissingFiles.slice(0, 3)
    const suffix =
      allMissingFiles.length > missingFiles.length
        ? ` and ${allMissingFiles.length - missingFiles.length} more`
        : ''
    throw new Error(
      `Selected local model files are not installed locally: ${missingFiles.join(', ')}${suffix}.`
    )
  }

  private async readLocalRuntimeConfig(model: string): Promise<Record<string, unknown> | undefined> {
    try {
      return JSON.parse(
        await readFile(join(this.localCacheDir, 'models', model, 'config.json'), 'utf8')
      ) as Record<string, unknown>
    } catch {
      return undefined
    }
  }

  protected async loadFactory(
    engineId: ServiceTranslationEngineId,
    model: string | undefined
  ): Promise<TranslatorFactory> {
    const globalSettings = await this.globalSettingsManager.readSettings()
    if (engineId === 'local') {
      const mod = (await import('@openspecui/local-translator')) as unknown as {
        createLocalTranslatorFactory: (options?: {
          defaultModel?: string
          cacheDir?: string
          localOnly?: boolean
        }) => TranslatorFactory
      }
      return mod.createLocalTranslatorFactory({
        defaultModel: model ?? globalSettings.translationEngines.local.model,
        cacheDir: this.localCacheDir,
        localOnly: true,
      })
    }
    const mod = (await import('@openspecui/openai-completion-translator')) as unknown as {
      createOpenAICompletionTranslatorFactory: (options: {
        baseUrl: string
        token: string
        model: string
      }) => TranslatorFactory
    }
    return mod.createOpenAICompletionTranslatorFactory({
      baseUrl: globalSettings.translationEngines.openai.baseUrl,
      token: globalSettings.translationEngines.openai.token,
      model: model ?? globalSettings.translationEngines.openai.model,
    })
  }

  protected async loadLocalTransformersModuleForPlan(
    _projectDir: string,
    _globalSettingsManager: LocalRuntimeSettingsReader
  ): Promise<TransformersRuntimeModule> {
    const mod = await import('@huggingface/transformers')
    return mod as unknown as TransformersRuntimeModule
  }
}

function enrichDownloadPlanWithAssetSnapshot(
  plan: TranslationModelDownloadPlan,
  state: LocalModelAssetState | undefined,
  selectedGroupId?: string
): TranslationModelDownloadPlan {
  if (!state?.plan) return plan
  const assetGroup = state.plan.groups?.find(
    (group) => group.id === (selectedGroupId ?? plan.selectedGroupId)
  )
  const mergedGroups = plan.groups?.map((group) => {
    const matchingAssetGroup = state.plan?.groups?.find((asset) => asset.id === group.id)
    if (!matchingAssetGroup) return group
    return {
      ...group,
      estimatedTotalBytes: group.estimatedTotalBytes ?? matchingAssetGroup.estimatedTotalBytes,
      files: group.files.map((file) => {
        const matchingAssetFile = matchingAssetGroup.files.find((asset) => asset.path === file.path)
        return matchingAssetFile?.sizeBytes !== undefined && file.sizeBytes === undefined
          ? { ...file, sizeBytes: matchingAssetFile.sizeBytes }
          : file
      }),
    }
  })
  return {
    ...plan,
    estimatedTotalBytes:
      plan.estimatedTotalBytes ?? assetGroup?.estimatedTotalBytes ?? state.plan.estimatedTotalBytes,
    groups: mergedGroups,
  }
}

function selectPersistedLocalPlan(
  state: LocalModelAssetState | undefined,
  selectedGroupId?: string
): TranslationModelDownloadPlan | null {
  const plan = state?.plan
  if (!plan) return null
  if (!selectedGroupId || !plan.groups?.length) {
    return {
      ...plan,
      files: [...plan.files],
      groups: plan.groups?.map((group) => ({
        ...group,
        files: [...group.files],
      })),
    }
  }
  const selectedGroup = plan.groups.find((group) => group.id === selectedGroupId)
  if (!selectedGroup) return null
  return {
    modelId: plan.modelId,
    estimatedTotalBytes: selectedGroup.estimatedTotalBytes,
    files: [...selectedGroup.files],
    selectedGroupId: selectedGroup.id,
    groups: plan.groups.map((group) => ({
      ...group,
      selected: group.id === selectedGroup.id,
      files: [...group.files],
    })),
  }
}
