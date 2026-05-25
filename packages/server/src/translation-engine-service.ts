import {
  LocalModelAssetStateSchema,
  TRANSLATION_ENGINE_MANIFESTS,
  type BatchTranslateEvent,
  type BatchTranslateInput,
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
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { LocalModelAssetStore } from './local-model-asset-store.js'
import {
  getDefaultLocalModelCacheDir,
  getDefaultLocalModelFetchCachePath,
  getDefaultLocalModelIndexPath,
} from './local-model-cache-path.js'
import { LocalModelFetchCacheStore } from './local-model-fetch-cache-store.js'
import { ensureProxyAwareFetchDispatcher } from './network-dispatcher.js'
import { searchLocalModels } from './translation-model-catalog.js'

type TranslationEngineSettingsSnapshot = Awaited<ReturnType<GlobalSettingsManager['readSettings']>>

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
  private readonly configManager: ConfigManager
  private readonly globalSettingsManager: GlobalSettingsManager
  private readonly now: () => number
  private readonly localCacheDir: string
  private readonly localAssetStore: LocalModelAssetStore

  constructor(options: TranslationEngineServiceOptions) {
    ensureProxyAwareFetchDispatcher()
    this.configManager = options.configManager
    this.globalSettingsManager = options.globalSettingsManager
    this.now = options.now ?? Date.now
    this.localCacheDir = options.localCacheDir ?? getDefaultLocalModelCacheDir()
    this.localAssetStore = new LocalModelAssetStore({
      indexPath: options.localAssetIndexPath ?? getDefaultLocalModelIndexPath(),
    })
    new LocalModelFetchCacheStore({
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
          ? (config.translation.engines.local.model ??
            globalSettings.translationEngines.local.model)
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
    return selectPersistedLocalPlan(state, input.selectedGroupId)
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
          const settingsSnapshot = await this.globalSettingsManager.readSettings()
          const effectiveModel = resolveBatchTranslateModel(input, settingsSnapshot)
          const effectiveSelectedGroupId =
            input.engineId === 'local'
              ? (input.selectedGroupId ?? settingsSnapshot.translationEngines.local.selectedGroupId)
              : undefined
          const dtype = await this.readLocalDtype(
            input.engineId,
            effectiveModel,
            effectiveSelectedGroupId
          )
          if (input.engineId === 'local' && effectiveModel) {
            await this.assertLocalModelReady(effectiveModel, effectiveSelectedGroupId)
          }
          const runtimeConfig =
            input.engineId === 'local' && effectiveModel
              ? await this.readLocalRuntimeConfig(effectiveModel, effectiveSelectedGroupId)
              : undefined
          const factory = await this.loadFactory(input.engineId, effectiveModel, settingsSnapshot)
          const translator = await factory.create({
            sourceLanguage: input.sourceLanguage,
            targetLanguage: input.targetLanguage,
            model: effectiveModel,
            dtype,
            runtimeConfig,
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
    return selectLocalPlanGroup(plan, effectiveSelectedGroupId)?.dtype
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
    const selectedGroup = selectLocalPlanGroup(plan, selectedGroupId)
    if (!plan || !selectedGroup || selectedGroup.files.length === 0) {
      throw new Error('No local runtime file plan is available for the selected model.')
    }
    const files = selectedGroup.files
    const selectedGroupState = await this.readSelectedLocalGroupState(model, selectedGroup.id)
    if (selectedGroupState?.status === 'downloaded' && selectedGroup.rootDir) {
      const missingFiles = await readMissingLocalGroupFiles(selectedGroup.rootDir, files)
      if (missingFiles.length === 0) return
    }
    if (selectedGroupState?.status === 'downloaded') {
      return
    }
    const allMissingFiles = selectedGroup.rootDir
      ? await readMissingLocalGroupFiles(selectedGroup.rootDir, files)
      : files.map((file) => file.path)
    const missingFiles = allMissingFiles.slice(0, 3)
    const suffix =
      allMissingFiles.length > missingFiles.length
        ? ` and ${allMissingFiles.length - missingFiles.length} more`
        : ''
    throw new Error(
      `Selected local model files are not installed locally: ${missingFiles.join(', ')}${suffix}.`
    )
  }

  private async readLocalRuntimeConfig(
    model: string,
    selectedGroupId?: string
  ): Promise<Record<string, unknown> | undefined> {
    const plan = await this.getModelDownloadPlan({
      engineId: 'local',
      model,
      selectedGroupId,
    })
    const selectedGroup = selectLocalPlanGroup(plan, selectedGroupId)
    const configPath = selectedGroup?.rootDir
      ? join(selectedGroup.rootDir, 'config.json')
      : join(this.localCacheDir, 'models', model, 'config.json')
    try {
      return JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
    } catch {
      return undefined
    }
  }

  private async readSelectedLocalGroupState(model: string, selectedGroupId: string) {
    const state = (await this.localAssetStore.readMap()).get(model)
    return state?.groupsState[selectedGroupId]
  }

  protected async loadFactory(
    engineId: ServiceTranslationEngineId,
    model: string | undefined,
    settingsSnapshot?: TranslationEngineSettingsSnapshot
  ): Promise<TranslatorFactory> {
    const globalSettings = settingsSnapshot ?? (await this.globalSettingsManager.readSettings())
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
}

function resolveBatchTranslateModel(
  input: BatchTranslateInput,
  settings: TranslationEngineSettingsSnapshot
): string | undefined {
  if (input.model) return input.model
  if (input.engineId === 'local') return settings.translationEngines.local.model
  if (input.engineId === 'openai') return settings.translationEngines.openai.model
  return undefined
}

function selectPersistedLocalPlan(
  state: LocalModelAssetState | undefined,
  selectedGroupId?: string
): TranslationModelDownloadPlan | null {
  if (!state) return null
  const normalizedState = LocalModelAssetStateSchema.parse(state)
  const plan = normalizedState.plan
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
  const selectedGroup = selectLocalPlanGroup(plan, selectedGroupId)
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

function selectLocalPlanGroup(
  plan: TranslationModelDownloadPlan | null | undefined,
  selectedGroupId?: string
): NonNullable<TranslationModelDownloadPlan['groups']>[number] | undefined {
  if (!plan?.groups?.length) return undefined
  const requestedGroupId = selectedGroupId ?? plan.selectedGroupId
  return (
    plan.groups.find((group) => group.id === requestedGroupId) ??
    plan.groups.find((group) => group.baseGroupId === requestedGroupId) ??
    plan.groups.find((group) => group.selected) ??
    plan.groups[0]
  )
}

async function readMissingLocalGroupFiles(
  rootDir: string,
  files: NonNullable<TranslationModelDownloadPlan['groups']>[number]['files']
): Promise<string[]> {
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const entry = await stat(join(rootDir, file.path))
        if (file.sizeBytes !== undefined && entry.size < file.sizeBytes) return file.path
        return null
      } catch {
        return file.path
      }
    })
  )
  return results.filter((file): file is string => file !== null)
}
