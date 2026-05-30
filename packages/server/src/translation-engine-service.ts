import {
  buildRuntimePackageInstallCommand,
  checkLocalDirectionalModelLanguagePair,
  createCleanCliEnv,
  createTranslationEngineLifecycleStatus,
  detectRuntimePackageManager,
  getManagedLocalTranslationEngineManifest,
  getTranslationEngineLifecycleMessage,
  isDirectionalManagedLocalTranslationEngineId,
  isManagedLocalTranslationEngineId,
  isTranslationEngineDependencyReady,
  isTranslationEngineRuntimeReady,
  LocalModelAssetStateSchema,
  resolveRuntimePackageInstallStrategy,
  shouldShowTranslationEngineInstallGate,
  TRANSLATION_ENGINE_MANIFESTS,
  type BatchTranslateEvent,
  type BatchTranslateInput,
  type ConfigManager,
  type GlobalSettingsManager,
  type LocalModelAssetState,
  type ManagedLocalTranslationEngineId,
  type ServiceTranslationEngineId,
  type TranslationEngineId,
  type TranslationEngineInstallLogEvent,
  type TranslationEngineLifecycleContext,
  type TranslationEngineLifecycleController,
  type TranslationEngineLifecycleEvent,
  type TranslationEngineLifecycleStatus,
  type TranslationEngineManifest,
  type TranslationModelDownloadPlan,
  type TranslationModelSearchInput,
  type TranslationModelSearchResult,
  type TranslatorFactory,
} from '@openspecui/core'
import { observable } from '@trpc/server/observable'
import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { freemem, totalmem } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getDefaultLocalCt2ModelCacheDir,
  getDefaultLocalCt2ModelFetchCachePath,
  getDefaultLocalCt2ModelIndexPath,
} from './ct2-model-cache-path.js'
import { searchCt2Models } from './ct2-model-catalog.js'
import { searchLlamaModels } from './llama-model-catalog.js'
import {
  getDefaultLocalLlamaModelCacheDir,
  getDefaultLocalLlamaModelFetchCachePath,
  getDefaultLocalLlamaModelIndexPath,
} from './local-llama-model-cache-path.js'
import { LocalModelAssetStore } from './local-model-asset-store.js'
import {
  getDefaultLocalModelCacheDir,
  getDefaultLocalModelFetchCachePath,
  getDefaultLocalModelIndexPath,
} from './local-model-cache-path.js'
import { LocalModelFetchCacheStore } from './local-model-fetch-cache-store.js'
import { ensureProxyAwareFetchDispatcher } from './network-dispatcher.js'
import {
  hasRuntimePackageDependencyPath,
  normalizeRuntimeHostOptionalDependencies,
  readRuntimeHostPackageDependencyRequest,
  readRuntimeHostPackageDependencyTree,
  resolveRuntimeHostPackageContext,
} from './runtime-package-host.js'
import {
  resolveManagedLocalRuntimeStrategy,
  type TranslationWorkerResourceLimits,
} from './translation-engine-runtime-strategy.js'
import { searchLocalModels } from './translation-model-catalog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

type TranslationEngineSettingsSnapshot = Awaited<ReturnType<GlobalSettingsManager['readSettings']>>
type TranslationConfigSnapshot = Awaited<ReturnType<ConfigManager['readConfig']>>
type TranslationConfigPresenceSnapshot = Awaited<ReturnType<ConfigManager['readConfigPresence']>>

export interface TranslationEngineListItem extends TranslationEngineManifest {
  selected: boolean
  lifecycle: TranslationEngineLifecycleStatus
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
  localCt2CacheDir?: string
  localCt2AssetIndexPath?: string
  localCt2FetchCachePath?: string
  localLlamaCacheDir?: string
  localLlamaAssetIndexPath?: string
  localLlamaFetchCachePath?: string
  executeManagedLocalBatchTranslate?: (
    input: ManagedLocalBatchTranslateInput
  ) => AsyncGenerator<BatchTranslateEvent>
  readRuntimeMemory?: () => TranslationRuntimeMemorySnapshot
}

interface ManagedLocalBatchTranslateInput {
  engineId: ManagedLocalTranslationEngineId
  sourceLanguage: string
  targetLanguage: string
  model: string | undefined
  dtype: string | undefined
  runtimeConfig: Record<string, unknown> | undefined
  workerResourceLimits?: TranslationWorkerResourceLimits
  inputs: string[]
  instructions?: string
  context?: string
  timeoutMs?: number
  signal: AbortSignal
}

interface TranslationRuntimeMemorySnapshot {
  totalMemoryMb?: number
  availableMemoryMb?: number
  platform?: NodeJS.Platform
  arch?: string
}

export class TranslationEngineService {
  private readonly projectDir: string
  private readonly configManager: ConfigManager
  private readonly globalSettingsManager: GlobalSettingsManager
  private readonly now: () => number
  private readonly localCacheDir: string
  private readonly localCt2CacheDir: string
  private readonly localLlamaCacheDir: string
  private readonly localAssetStore: LocalModelAssetStore
  private readonly localCt2AssetStore: LocalModelAssetStore
  private readonly localLlamaAssetStore: LocalModelAssetStore
  private readonly executeManagedLocalBatchTranslate: (
    input: ManagedLocalBatchTranslateInput
  ) => AsyncGenerator<BatchTranslateEvent>
  private readonly readRuntimeMemory: () => TranslationRuntimeMemorySnapshot
  private readonly managedLocalRuntimeCompatibilityCache = new Map<
    string,
    TranslationEngineLifecycleStatus['assets']
  >()

  constructor(options: TranslationEngineServiceOptions) {
    ensureProxyAwareFetchDispatcher()
    this.projectDir = options.projectDir
    this.configManager = options.configManager
    this.globalSettingsManager = options.globalSettingsManager
    this.now = options.now ?? Date.now
    this.localCacheDir = options.localCacheDir ?? getDefaultLocalModelCacheDir()
    this.localCt2CacheDir = options.localCt2CacheDir ?? getDefaultLocalCt2ModelCacheDir()
    this.localLlamaCacheDir = options.localLlamaCacheDir ?? getDefaultLocalLlamaModelCacheDir()
    this.localAssetStore = new LocalModelAssetStore({
      indexPath: options.localAssetIndexPath ?? getDefaultLocalModelIndexPath(),
    })
    this.localCt2AssetStore = new LocalModelAssetStore({
      indexPath: options.localCt2AssetIndexPath ?? getDefaultLocalCt2ModelIndexPath(),
    })
    this.localLlamaAssetStore = new LocalModelAssetStore({
      indexPath: options.localLlamaAssetIndexPath ?? getDefaultLocalLlamaModelIndexPath(),
    })
    this.executeManagedLocalBatchTranslate =
      options.executeManagedLocalBatchTranslate ??
      ((input) => this.executeManagedLocalBatchTranslateDirect(input))
    this.readRuntimeMemory = options.readRuntimeMemory ?? readCurrentRuntimeMemory
    new LocalModelFetchCacheStore({
      cachePath: options.localFetchCachePath ?? getDefaultLocalModelFetchCachePath(),
      now: this.now,
    })
    new LocalModelFetchCacheStore({
      cachePath: options.localCt2FetchCachePath ?? getDefaultLocalCt2ModelFetchCachePath(),
      now: this.now,
    })
    new LocalModelFetchCacheStore({
      cachePath: options.localLlamaFetchCachePath ?? getDefaultLocalLlamaModelFetchCachePath(),
      now: this.now,
    })
  }

  async listEngines(): Promise<TranslationEngineListItem[]> {
    const [config, configPresence, globalSettings] = await Promise.all([
      this.configManager.readConfig(),
      this.configManager.readConfigPresence(),
      this.globalSettingsManager.readSettings(),
    ])
    const effectiveEngineId = resolveEffectiveTranslationEngineId(
      config,
      configPresence,
      globalSettings
    )
    const items = await Promise.all(
      TRANSLATION_ENGINE_MANIFESTS.map(async (manifest) => {
        const lifecycle = await this.getLifecycle(manifest.id, {
          config,
          globalSettings,
        })
        return {
          ...manifest,
          selected: effectiveEngineId === manifest.id,
          lifecycle,
          message:
            getTranslationEngineLifecycleMessage(lifecycle) ??
            lifecycle.summary ??
            manifest.description,
          model: resolveEngineModel(manifest.id, config, globalSettings),
        }
      })
    )
    return items
  }

  async getLifecycle(
    engineId: TranslationEngineId,
    snapshot?: {
      config?: TranslationConfigSnapshot
      globalSettings?: TranslationEngineSettingsSnapshot
    }
  ): Promise<TranslationEngineLifecycleStatus> {
    const config = snapshot?.config ?? (await this.configManager.readConfig())
    const globalSettings =
      snapshot?.globalSettings ?? (await this.globalSettingsManager.readSettings())
    const lifecycle = await this.getLifecycleController(engineId).detectLifecycle({
      projectDir: this.projectDir,
      globalSettings: globalSettings.translationEngines,
    })
    if (!isManagedLocalTranslationEngineId(engineId)) {
      return lifecycle
    }
    return mergeManagedLocalAssetLifecycle({
      lifecycle,
      asset: await this.readManagedLocalAssetLifecycle(engineId, {
        config,
        globalSettings,
      }),
    })
  }

  async installEngine(
    engineId: TranslationEngineId,
    callbacks?: {
      onLifecycle?: (status: TranslationEngineLifecycleStatus) => void
      onLog?: (event: TranslationEngineInstallLogEvent) => void
      signal?: AbortSignal
    }
  ): Promise<TranslationEngineLifecycleStatus> {
    const [config, globalSettings] = await Promise.all([
      this.configManager.readConfig(),
      this.globalSettingsManager.readSettings(),
    ])
    const lifecycle = await this.getLifecycleController(engineId).install({
      projectDir: this.projectDir,
      globalSettings: globalSettings.translationEngines,
      signal: callbacks?.signal,
      onLifecycle: callbacks?.onLifecycle,
      onLog: callbacks?.onLog,
    })
    if (!isManagedLocalTranslationEngineId(engineId)) {
      return lifecycle
    }
    return mergeManagedLocalAssetLifecycle({
      lifecycle,
      asset: await this.readManagedLocalAssetLifecycle(engineId, {
        config,
        globalSettings,
      }),
    })
  }

  installEngineStream(engineId: TranslationEngineId) {
    return observable<TranslationEngineLifecycleEvent>((emit) => {
      let closed = false
      const controller = new AbortController()

      const push = (event: TranslationEngineLifecycleEvent) => {
        if (closed) return
        emit.next(event)
        if (event.type === 'exit') {
          closed = true
          emit.complete()
        }
      }

      void (async () => {
        try {
          const initialLifecycle = await this.getLifecycle(engineId)
          push({ type: 'status', lifecycle: initialLifecycle })
          if (!shouldShowTranslationEngineInstallGate(initialLifecycle)) {
            push({ type: 'exit', lifecycle: initialLifecycle })
            return
          }

          const finalLifecycle = await this.installEngine(engineId, {
            signal: controller.signal,
            onLifecycle: (lifecycle) => {
              push({ type: 'status', lifecycle })
            },
            onLog: (event) => {
              push({ type: 'log', ...event })
            },
          })
          push({ type: 'exit', lifecycle: finalLifecycle })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const lifecycle = createTranslationEngineLifecycleStatus({
            dependency: {
              state: 'error',
              message: 'Translation engine installation failed.',
              error: message,
            },
            runtime: {
              state: 'error',
              error: message,
            },
            summary: 'Translation engine installation failed.',
          })
          push({ type: 'status', lifecycle })
          push({ type: 'exit', lifecycle })
        }
      })()

      return () => {
        closed = true
        controller.abort()
      }
    })
  }

  async searchModels(input: TranslationModelSearchInput): Promise<TranslationModelSearchResult> {
    const globalSettings = await this.globalSettingsManager.readSettings()
    if (input.engineId === 'local') {
      return searchLocalModels(input, {
        hfEndpoint: globalSettings.translationEngines.local.hfEndpoint,
      })
    }
    if (input.engineId === 'local-ct2') {
      return searchCt2Models(input, {
        hfEndpoint: globalSettings.translationEngines.localCt2.hfEndpoint,
      })
    }
    if (input.engineId === 'local-llama') {
      return searchLlamaModels(input, {
        hfEndpoint: globalSettings.translationEngines.localLlama.hfEndpoint,
      })
    }
    return { items: [] }
  }

  async getModelDownloadPlan(input: {
    engineId: ServiceTranslationEngineId
    model: string
    selectedGroupId?: string
  }): Promise<TranslationModelDownloadPlan | null> {
    const state =
      input.engineId === 'local'
        ? (await this.localAssetStore.readMap()).get(input.model)
        : input.engineId === 'local-ct2'
          ? (await this.localCt2AssetStore.readMap()).get(input.model)
          : input.engineId === 'local-llama'
            ? (await this.localLlamaAssetStore.readMap()).get(input.model)
            : undefined
    if (!state) return null
    return selectPersistedLocalPlan(state, input.selectedGroupId)
  }

  async selectEngine(engineId: TranslationEngineId): Promise<{ success: true }> {
    const configPresence = await this.configManager.readConfigPresence()
    if (configPresence.translation.engineId) {
      await this.configManager.writeConfig({ translation: { engineId } })
    } else {
      await this.globalSettingsManager.writeSettings({ translationEngines: { engineId } })
    }
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
          if (isDirectionalManagedLocalTranslationEngineId(input.engineId)) {
            const directionCheck = checkLocalDirectionalModelLanguagePair({
              model: effectiveModel,
              sourceLanguage: input.sourceLanguage,
              targetLanguage: input.targetLanguage,
            })
            if (!directionCheck.supported) {
              throw new Error(
                directionCheck.message ??
                  'Selected local model does not support the requested translation direction.'
              )
            }
          }
          const effectiveSelectedGroupId =
            input.engineId === 'local'
              ? (input.selectedGroupId ?? settingsSnapshot.translationEngines.local.selectedGroupId)
              : input.engineId === 'local-ct2'
                ? (input.selectedGroupId ??
                  settingsSnapshot.translationEngines.localCt2.selectedGroupId)
                : input.engineId === 'local-llama'
                  ? (input.selectedGroupId ??
                    settingsSnapshot.translationEngines.localLlama.selectedGroupId)
                  : undefined
          const dtype = await this.readLocalDtype(
            input.engineId,
            effectiveModel,
            effectiveSelectedGroupId
          )
          if (isManagedLocalTranslationEngineId(input.engineId) && effectiveModel) {
            await this.assertManagedLocalModelReady(
              input.engineId,
              effectiveModel,
              effectiveSelectedGroupId
            )
          }
          const runtimePlan =
            isManagedLocalTranslationEngineId(input.engineId) && effectiveModel
              ? await this.readManagedLocalRuntimePlan(
                  input.engineId,
                  effectiveModel,
                  effectiveSelectedGroupId,
                  settingsSnapshot.translationEngines
                )
              : undefined
          if (isManagedLocalTranslationEngineId(input.engineId)) {
            for await (const event of this.executeManagedLocalBatchTranslate({
              engineId: input.engineId,
              sourceLanguage: input.sourceLanguage,
              targetLanguage: input.targetLanguage,
              model: effectiveModel,
              dtype,
              runtimeConfig: runtimePlan?.runtimeConfig,
              workerResourceLimits: runtimePlan?.workerResourceLimits,
              inputs: input.inputs,
              instructions: input.instructions,
              context: input.context,
              timeoutMs: input.timeoutMs,
              signal: controller.signal,
            })) {
              emit.next(event)
            }
            emit.complete()
            return
          }

          const factory = await this.loadFactory(input.engineId, effectiveModel, settingsSnapshot)
          const translator = await factory.create({
            sourceLanguage: input.sourceLanguage,
            targetLanguage: input.targetLanguage,
            model: effectiveModel,
            dtype,
            runtimeConfig: runtimePlan?.runtimeConfig,
            signal: controller.signal,
          })
          try {
            for await (const event of translator.batchTranslate(input.inputs, {
              instructions: input.instructions,
              context: input.context,
              signal: controller.signal,
              timeoutMs: input.timeoutMs,
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

  private async assertManagedLocalModelReady(
    engineId: ManagedLocalTranslationEngineId,
    model: string,
    selectedGroupId: string | undefined
  ): Promise<void> {
    const plan = await this.getModelDownloadPlan({
      engineId,
      model,
      selectedGroupId,
    })
    const selectedGroup = selectLocalPlanGroup(plan, selectedGroupId)
    if (!plan || !selectedGroup || selectedGroup.files.length === 0) {
      throw new Error('No local runtime file plan is available for the selected model.')
    }
    const files = selectedGroup.files
    const selectedGroupState = await this.readSelectedManagedLocalGroupState(
      engineId,
      model,
      selectedGroup.id
    )
    if (selectedGroupState?.status === 'downloaded' && selectedGroup.rootDir) {
      const missingFiles = await readMissingLocalGroupFiles(selectedGroup.rootDir, files)
      if (missingFiles.length === 0) {
        const runtimeCompatibility = await this.readManagedLocalRuntimeCompatibility({
          engineId,
          model,
          selectedGroup,
          selectedGroupState,
        })
        if (runtimeCompatibility?.state === 'error') {
          throw new Error(runtimeCompatibility.message ?? runtimeCompatibility.error)
        }
        return
      }
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
    const engineLabel = getManagedLocalTranslationEngineManifest(engineId).modelLabel.toLowerCase()
    throw new Error(
      `Selected ${engineLabel} files are not installed locally: ${missingFiles.join(', ')}${suffix}.`
    )
  }

  private async readManagedLocalRuntimeCompatibility(input: {
    engineId: ManagedLocalTranslationEngineId
    model: string
    selectedGroup: NonNullable<TranslationModelDownloadPlan['groups']>[number]
    selectedGroupState: LocalModelAssetState['groupsState'][string] | undefined
  }): Promise<TranslationEngineLifecycleStatus['assets'] | null> {
    if (input.engineId !== 'local-llama') return null

    const ggufFile = input.selectedGroup.files[0]?.path
    if (!input.selectedGroup.rootDir || !ggufFile) {
      return {
        state: 'error',
        message: 'Selected llama GGUF files are incomplete for runtime probing.',
      }
    }

    const cacheKey = [
      input.engineId,
      input.model,
      input.selectedGroup.id,
      input.selectedGroup.rootDir,
      input.selectedGroupState?.installedAt ?? 0,
    ].join('|')
    const cached = this.managedLocalRuntimeCompatibilityCache.get(cacheKey)
    if (cached) return cached

    const ggufPath = join(input.selectedGroup.rootDir, ggufFile)
    try {
      const mod = (await import('@openspecui/local-llama-translator')) as {
        probeLocalLlamaRuntimeModel: (input: {
          model: string
          cacheDir?: string
          runtimeConfig?: Record<string, unknown>
        }) => Promise<void>
      }
      await mod.probeLocalLlamaRuntimeModel({
        model: input.model,
        cacheDir: this.localLlamaCacheDir,
        runtimeConfig: { modelPath: ggufPath },
      })
      const result: TranslationEngineLifecycleStatus['assets'] = {
        state: 'ready',
        message: 'Selected llama GGUF files are ready for the current node-llama-cpp runtime.',
      }
      this.managedLocalRuntimeCompatibilityCache.set(cacheKey, result)
      return result
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      const result: TranslationEngineLifecycleStatus['assets'] = {
        state: 'error',
        message: formatManagedLocalRuntimeCompatibilityMessage({
          engineId: input.engineId,
          groupLabel: input.selectedGroup.label,
          detail,
        }),
        error: detail,
      }
      this.managedLocalRuntimeCompatibilityCache.set(cacheKey, result)
      return result
    }
  }

  private async readManagedLocalRuntimePlan(
    engineId: ManagedLocalTranslationEngineId,
    model: string,
    selectedGroupId: string | undefined,
    globalSettings: TranslationEngineSettingsSnapshot['translationEngines']
  ): Promise<{
    runtimeConfig: Record<string, unknown>
    workerResourceLimits?: TranslationWorkerResourceLimits
  }> {
    const plan = await this.getModelDownloadPlan({
      engineId,
      model,
      selectedGroupId,
    })
    const selectedGroup = selectLocalPlanGroup(plan, selectedGroupId)
    const runtimeMemory = this.readRuntimeMemory()
    const strategy = resolveManagedLocalRuntimeStrategy({
      engineId,
      globalSettings,
      totalMemoryMb: runtimeMemory.totalMemoryMb,
      availableMemoryMb: runtimeMemory.availableMemoryMb,
      platform: runtimeMemory.platform,
      arch: runtimeMemory.arch,
      modelSizeBytes: selectedGroup?.estimatedTotalBytes ?? plan?.estimatedTotalBytes,
    })
    if (strategy.rejection) {
      throw new Error(strategy.rejection.reason)
    }
    if (engineId === 'local-llama') {
      const ggufPath =
        selectedGroup?.rootDir && selectedGroup.files[0]?.path
          ? join(selectedGroup.rootDir, selectedGroup.files[0].path)
          : selectedGroup?.rootDir
      return {
        runtimeConfig: ggufPath
          ? { ...strategy.runtimeConfig, modelPath: ggufPath }
          : strategy.runtimeConfig,
        workerResourceLimits: strategy.worker.resourceLimits,
      }
    }
    const configPath = selectedGroup?.rootDir
      ? join(selectedGroup.rootDir, 'config.json')
      : join(
          engineId === 'local' ? this.localCacheDir : this.localCt2CacheDir,
          'models',
          model,
          'config.json'
        )
    try {
      const runtimeConfig = JSON.parse(await readFile(configPath, 'utf8')) as Record<
        string,
        unknown
      >
      if (engineId === 'local-ct2' && selectedGroup?.rootDir) {
        return {
          runtimeConfig: {
            ...runtimeConfig,
            ...strategy.runtimeConfig,
            modelPath: selectedGroup.rootDir,
          },
          workerResourceLimits: strategy.worker.resourceLimits,
        }
      }
      return {
        runtimeConfig: {
          ...runtimeConfig,
          ...strategy.runtimeConfig,
        },
        workerResourceLimits: strategy.worker.resourceLimits,
      }
    } catch {
      if (engineId === 'local-ct2' && selectedGroup?.rootDir) {
        return {
          runtimeConfig: { ...strategy.runtimeConfig, modelPath: selectedGroup.rootDir },
          workerResourceLimits: strategy.worker.resourceLimits,
        }
      }
      return {
        runtimeConfig: strategy.runtimeConfig,
        workerResourceLimits: strategy.worker.resourceLimits,
      }
    }
  }

  private async readSelectedManagedLocalGroupState(
    engineId: ManagedLocalTranslationEngineId,
    model: string,
    selectedGroupId: string
  ) {
    const state =
      engineId === 'local'
        ? (await this.localAssetStore.readMap()).get(model)
        : engineId === 'local-ct2'
          ? (await this.localCt2AssetStore.readMap()).get(model)
          : (await this.localLlamaAssetStore.readMap()).get(model)
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
    if (engineId === 'local-ct2') {
      const mod = (await import('@openspecui/local-ct2-translator')) as unknown as {
        createLocalCt2TranslatorFactory: (options?: {
          defaultModel?: string
          cacheDir?: string
        }) => TranslatorFactory
      }
      return mod.createLocalCt2TranslatorFactory({
        defaultModel: model ?? globalSettings.translationEngines.localCt2.model,
        cacheDir: this.localCt2CacheDir,
      })
    }
    if (engineId === 'local-llama') {
      const mod = (await import('@openspecui/local-llama-translator')) as unknown as {
        createLocalLlamaTranslatorFactory: (options?: {
          defaultModel?: string
          cacheDir?: string
        }) => TranslatorFactory
      }
      return mod.createLocalLlamaTranslatorFactory({
        defaultModel: model ?? globalSettings.translationEngines.localLlama.model,
        cacheDir: this.localLlamaCacheDir,
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

  private async *executeManagedLocalBatchTranslateDirect(
    input: ManagedLocalBatchTranslateInput
  ): AsyncGenerator<BatchTranslateEvent> {
    const settingsSnapshot = await this.globalSettingsManager.readSettings()
    const factory = await this.loadFactory(input.engineId, input.model, settingsSnapshot)
    const translator = await factory.create({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      model: input.model,
      dtype: input.dtype,
      runtimeConfig: input.runtimeConfig,
      signal: input.signal,
    })
    try {
      for await (const event of translator.batchTranslate(input.inputs, {
        instructions: input.instructions,
        context: input.context,
        signal: input.signal,
        timeoutMs: input.timeoutMs,
      })) {
        yield event
      }
    } finally {
      translator.destroy?.()
    }
  }

  private async readManagedLocalAssetLifecycle(
    engineId: ManagedLocalTranslationEngineId,
    snapshot: {
      config?: TranslationConfigSnapshot
      globalSettings?: TranslationEngineSettingsSnapshot
    }
  ): Promise<TranslationEngineLifecycleStatus['assets']> {
    const config = snapshot.config ?? (await this.configManager.readConfig())
    const globalSettings =
      snapshot.globalSettings ?? (await this.globalSettingsManager.readSettings())
    const selection = resolveManagedLocalSelection(engineId, config, globalSettings)
    if (!selection.model) {
      return {
        state: 'missing',
        message: 'Select a model before translating.',
      }
    }
    const state =
      engineId === 'local'
        ? (await this.localAssetStore.readMap()).get(selection.model)
        : engineId === 'local-ct2'
          ? (await this.localCt2AssetStore.readMap()).get(selection.model)
          : (await this.localLlamaAssetStore.readMap()).get(selection.model)
    const plan = selectPersistedLocalPlan(state, selection.selectedGroupId)
    const selectedGroup = selectLocalPlanGroup(plan, selection.selectedGroupId)
    if (!plan || !selectedGroup || selectedGroup.files.length === 0) {
      return {
        state: 'missing',
        message: `Selected ${getManagedLocalAssetLabel(engineId)} files are not installed locally.`,
      }
    }
    const groupState =
      state?.groupsState[selectedGroup.id] ??
      (selectedGroup.baseGroupId ? state?.groupsState[selectedGroup.baseGroupId] : undefined)
    if (
      groupState?.status === 'downloading' ||
      groupState?.status === 'queued' ||
      groupState?.status === 'paused' ||
      state?.status === 'downloading' ||
      state?.status === 'queued' ||
      state?.status === 'paused'
    ) {
      return {
        state: 'downloading',
        message: `Downloading ${getManagedLocalAssetLabel(engineId)} files.`,
        progress: groupState?.progress ?? state?.progress,
      }
    }
    const missingFiles = selectedGroup.rootDir
      ? await readMissingLocalGroupFiles(selectedGroup.rootDir, selectedGroup.files)
      : selectedGroup.files.map((file) => file.path)
    if (
      missingFiles.length === 0 &&
      (groupState?.status === 'downloaded' || state?.status === 'downloaded')
    ) {
      return {
        state: 'ready',
        message: `Selected ${getManagedLocalAssetLabel(engineId)} files are ready.`,
      }
    }
    return {
      state: 'missing',
      message: `Selected ${getManagedLocalAssetLabel(engineId)} files are not installed locally.`,
    }
  }

  private getLifecycleController(
    engineId: TranslationEngineId
  ): TranslationEngineLifecycleController {
    if (engineId === 'browser') return browserTranslationEngineLifecycleController
    if (engineId === 'openai') return openAITranslationEngineLifecycleController
    if (engineId === 'local-ct2') return createManagedLocalLifecycleController('local-ct2')
    if (engineId === 'local-llama') return createManagedLocalLifecycleController('local-llama')
    return createManagedLocalLifecycleController('local')
  }
}

const browserTranslationEngineLifecycleController: TranslationEngineLifecycleController = {
  async detectLifecycle() {
    return createTranslationEngineLifecycleStatus({
      dependency: {
        state: 'not-applicable',
        message: 'Browser translation support is built into the browser runtime.',
      },
      runtime: {
        state: 'not-applicable',
        message: 'Browser translation support is validated in the browser runtime.',
      },
      assets: {
        state: 'not-applicable',
      },
      summary: 'Browser translation support is built into the browser runtime.',
    })
  },
  async install() {
    return browserTranslationEngineLifecycleController.detectLifecycle({
      projectDir: '',
      globalSettings: {
        engineId: 'browser',
        local: { model: '', hfEndpoint: '', memoryBudgetPercent: 25 },
        localCt2: { model: '', hfEndpoint: '', memoryBudgetPercent: 25 },
        localLlama: { model: '', hfEndpoint: '', memoryBudgetPercent: 25 },
        openai: { baseUrl: '', token: '', model: '' },
      },
    })
  },
}

const openAITranslationEngineLifecycleController: TranslationEngineLifecycleController = {
  async detectLifecycle() {
    return createTranslationEngineLifecycleStatus({
      dependency: {
        state: 'not-applicable',
        message: 'OpenAI completion translation is bundled with the server runtime.',
      },
      runtime: {
        state: 'not-applicable',
        message: 'OpenAI provider validation happens when requests are sent.',
      },
      assets: {
        state: 'not-applicable',
      },
      summary: 'OpenAI completion translation is bundled with the server runtime.',
    })
  },
  async install() {
    return openAITranslationEngineLifecycleController.detectLifecycle({
      projectDir: '',
      globalSettings: {
        engineId: 'browser',
        local: { model: '', hfEndpoint: '', memoryBudgetPercent: 25 },
        localCt2: { model: '', hfEndpoint: '', memoryBudgetPercent: 25 },
        localLlama: { model: '', hfEndpoint: '', memoryBudgetPercent: 25 },
        openai: { baseUrl: '', token: '', model: '' },
      },
    })
  },
}

function createManagedLocalLifecycleController(
  engineId: ManagedLocalTranslationEngineId
): TranslationEngineLifecycleController {
  return {
    async detectLifecycle() {
      return detectManagedLocalLifecycle(engineId)
    },
    async install(input) {
      return installManagedLocalRuntime(engineId, input)
    },
  }
}

function resolveEngineModel(
  engineId: TranslationEngineId,
  config: TranslationConfigSnapshot,
  globalSettings: TranslationEngineSettingsSnapshot
): string | undefined {
  if (engineId === 'local') {
    return config.translation.engines.local.model ?? globalSettings.translationEngines.local.model
  }
  if (engineId === 'local-ct2') {
    return (
      config.translation.engines.localCt2.model ?? globalSettings.translationEngines.localCt2.model
    )
  }
  if (engineId === 'local-llama') {
    return (
      config.translation.engines.localLlama.model ??
      globalSettings.translationEngines.localLlama.model
    )
  }
  if (engineId === 'openai') {
    return config.translation.engines.openai.model ?? globalSettings.translationEngines.openai.model
  }
  return undefined
}

function resolveEffectiveTranslationEngineId(
  config: TranslationConfigSnapshot,
  configPresence: TranslationConfigPresenceSnapshot,
  globalSettings: TranslationEngineSettingsSnapshot
): TranslationEngineId {
  return configPresence.translation.engineId
    ? config.translation.engineId
    : globalSettings.translationEngines.engineId
}

function resolveManagedLocalSelection(
  engineId: ManagedLocalTranslationEngineId,
  config: TranslationConfigSnapshot,
  globalSettings: TranslationEngineSettingsSnapshot
): {
  model: string
  selectedGroupId?: string
} {
  const manifest = getManagedLocalTranslationEngineManifest(engineId)
  if (manifest.settingsKey === 'local') {
    return {
      model:
        config.translation.engines.local.model ??
        globalSettings.translationEngines.local.model ??
        manifest.defaultModel,
      selectedGroupId:
        config.translation.engines.local.selectedGroupId ??
        globalSettings.translationEngines.local.selectedGroupId,
    }
  }
  if (manifest.settingsKey === 'localLlama') {
    return {
      model:
        config.translation.engines.localLlama.model ??
        globalSettings.translationEngines.localLlama.model ??
        manifest.defaultModel,
      selectedGroupId:
        config.translation.engines.localLlama.selectedGroupId ??
        globalSettings.translationEngines.localLlama.selectedGroupId,
    }
  }
  return {
    model:
      config.translation.engines.localCt2.model ??
      globalSettings.translationEngines.localCt2.model ??
      manifest.defaultModel,
    selectedGroupId:
      config.translation.engines.localCt2.selectedGroupId ??
      globalSettings.translationEngines.localCt2.selectedGroupId,
  }
}

function getManagedLocalAssetLabel(engineId: ManagedLocalTranslationEngineId): string {
  const manifest = getManagedLocalTranslationEngineManifest(engineId)
  return manifest.modelLabel.toLowerCase()
}

function mergeManagedLocalAssetLifecycle(input: {
  lifecycle: TranslationEngineLifecycleStatus
  asset: TranslationEngineLifecycleStatus['assets']
}): TranslationEngineLifecycleStatus {
  if (
    !isTranslationEngineDependencyReady(input.lifecycle) ||
    !isTranslationEngineRuntimeReady(input.lifecycle)
  ) {
    return {
      ...input.lifecycle,
      assets: input.asset,
    }
  }
  return {
    ...input.lifecycle,
    assets: input.asset,
    summary:
      (input.asset.state === 'error' ? (input.asset.message ?? input.asset.error) : undefined) ??
      input.lifecycle.summary ??
      getTranslationEngineLifecycleMessage(input.lifecycle),
  }
}

async function detectManagedLocalLifecycle(
  engineId: ManagedLocalTranslationEngineId
): Promise<TranslationEngineLifecycleStatus> {
  const manifest = getManagedLocalTranslationEngineManifest(engineId)
  const dependency = await detectManagedLocalDependency(engineId)
  if (dependency.state !== 'installed') {
    return createTranslationEngineLifecycleStatus({
      dependency,
      runtime: {
        state: 'not-applicable',
        message: manifest.installDescription,
      },
      summary: manifest.installDescription,
    })
  }
  return createTranslationEngineLifecycleStatus({
    dependency,
    runtime: {
      state: 'not-applicable',
      message: 'Run Test Translate to validate runtime errors and latency.',
    },
    summary: dependency.message ?? manifest.description,
  })
}

async function detectManagedLocalDependency(
  engineId: ManagedLocalTranslationEngineId
): Promise<TranslationEngineLifecycleStatus['dependency']> {
  const manifest = getManagedLocalTranslationEngineManifest(engineId)
  const runtimeHost = resolveRuntimeHostPackageContext(__dirname)
  const spec = getManagedLocalRuntimeSpec(engineId)
  try {
    const tree = await readRuntimeHostPackageDependencyTree({
      runtimeHost,
      packageNames: spec.packageNames,
    })
    const missing = spec.detectMissing(tree)
    if (missing.length > 0) {
      return {
        state: 'missing',
        message: manifest.installDescription,
        error: `Missing runtime dependency: ${missing.join(', ')}`,
      }
    }
    return {
      state: 'installed',
      message: `${manifest.label} runtime dependencies are installed.`,
    }
  } catch (error) {
    return {
      state: 'missing',
      message: manifest.installDescription,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function installManagedLocalRuntime(
  engineId: ManagedLocalTranslationEngineId,
  input: TranslationEngineLifecycleContext
): Promise<TranslationEngineLifecycleStatus> {
  const manifest = getManagedLocalTranslationEngineManifest(engineId)
  input.onLifecycle?.(
    createTranslationEngineLifecycleStatus({
      dependency: {
        state: 'installing',
        message: `Installing ${manifest.label} runtime dependencies.`,
      },
      runtime: {
        state: 'not-applicable',
      },
      summary: `Installing ${manifest.label} runtime dependencies.`,
    })
  )

  const runtimeHost = resolveRuntimeHostPackageContext(__dirname)
  const packageManager = detectRuntimePackageManager({ startDir: runtimeHost.packageDir })
  const strategy = resolveRuntimePackageInstallStrategy(packageManager.id)
  const spec = getManagedLocalRuntimeSpec(engineId)
  const runtimePackage = readRuntimeHostPackageDependencyRequest({
    runtimeHost,
    packageName: manifest.runtimePackageName,
    fallbackRange: spec.fallbackRange,
  })
  const installCommand = buildRuntimePackageInstallCommand({
    packageManager: packageManager.id,
    packages: [runtimePackage],
    dependencyField: 'optionalDependencies',
    ignoreWorkspace: runtimeHost.packageName === '@openspecui/server',
    allowBuildPackages: spec.allowBuildPackages,
  })
  if (!installCommand) {
    return createTranslationEngineLifecycleStatus({
      dependency: {
        state: 'error',
        message: `Failed to resolve a supported ${manifest.label} runtime installer.`,
        error: `Automatic ${manifest.label} runtime installation is not supported for runtime host package manager "${packageManager.id}". Install ${runtimePackage} manually in ${runtimeHost.packageName}.`,
      },
      runtime: {
        state: 'error',
      },
      summary: `Failed to resolve a supported ${manifest.label} runtime installer.`,
    })
  }

  input.onLog?.({
    stream: 'stdout',
    text: `${installCommand.displayCommand}\n`,
  })

  const installError = await runRuntimeInstallCommand({
    command: installCommand,
    cwd: runtimeHost.packageDir,
    signal: input.signal,
    onLog: input.onLog,
  })
  if (installError) {
    return createTranslationEngineLifecycleStatus({
      dependency: {
        state: 'error',
        message: `${manifest.label} runtime installation failed.`,
        error: installError,
      },
      runtime: {
        state: 'error',
        error: installError,
      },
      summary: `${manifest.label} runtime installation failed.`,
    })
  }

  if (strategy && !strategy.preservesDependencyField) {
    normalizeRuntimeHostOptionalDependencies({
      runtimeHost,
      packageNames: [manifest.runtimePackageName],
    })
  }

  const finalLifecycle = await detectManagedLocalLifecycle(engineId)
  input.onLifecycle?.(finalLifecycle)
  return finalLifecycle
}

async function runRuntimeInstallCommand(input: {
  command: {
    cmd: string
    args: string[]
    displayCommand: string
  }
  cwd: string
  signal?: AbortSignal
  onLog?: (event: TranslationEngineInstallLogEvent) => void
}): Promise<string | null> {
  let child
  try {
    child = spawn(input.command.cmd, input.command.args, {
      cwd: input.cwd,
      shell: false,
      env: createCleanCliEnv(),
    })
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }

  const abort = () => {
    try {
      child.kill()
    } catch {
      // ignore
    }
  }
  input.signal?.addEventListener('abort', abort, { once: true })

  try {
    await new Promise<void>((resolve, reject) => {
      child.stdout?.on('data', (data: Buffer) => {
        input.onLog?.({ stream: 'stdout', text: data.toString() })
      })
      child.stderr?.on('data', (data: Buffer) => {
        input.onLog?.({ stream: 'stderr', text: data.toString() })
      })
      child.on('error', (error) => {
        reject(error)
      })
      child.on('close', (exitCode) => {
        if (exitCode === 0) {
          resolve()
          return
        }
        reject(
          new Error(`${input.command.displayCommand} exited with code ${exitCode ?? 'unknown'}.`)
        )
      })
    })
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  } finally {
    input.signal?.removeEventListener('abort', abort)
  }
}

function getManagedLocalRuntimeSpec(engineId: ManagedLocalTranslationEngineId): {
  packageNames: string[]
  allowBuildPackages: string[]
  fallbackRange: string
  detectMissing(tree: Parameters<typeof hasRuntimePackageDependencyPath>[0]): string[]
} {
  if (engineId === 'local') {
    return {
      packageNames: ['@huggingface/transformers', 'onnxruntime-node'],
      allowBuildPackages: ['onnxruntime-node'],
      fallbackRange: '~4.2.0',
      detectMissing(tree) {
        const missing: string[] = []
        if (!hasRuntimePackageDependencyPath(tree, ['@huggingface/transformers'])) {
          missing.push('@huggingface/transformers')
        }
        if (
          !hasRuntimePackageDependencyPath(tree, ['@huggingface/transformers', 'onnxruntime-node'])
        ) {
          missing.push('onnxruntime-node')
        }
        return missing
      },
    }
  }
  if (engineId === 'local-llama') {
    return {
      packageNames: ['node-llama-cpp'],
      allowBuildPackages: ['node-llama-cpp'],
      fallbackRange: '~3.18.1',
      detectMissing(tree) {
        return hasRuntimePackageDependencyPath(tree, ['node-llama-cpp']) ? [] : ['node-llama-cpp']
      },
    }
  }
  return {
    packageNames: ['ctranslate2'],
    allowBuildPackages: ['ctranslate2'],
    fallbackRange: '^0.1.0',
    detectMissing(tree) {
      return hasRuntimePackageDependencyPath(tree, ['ctranslate2']) ? [] : ['ctranslate2']
    },
  }
}

function resolveBatchTranslateModel(
  input: BatchTranslateInput,
  settings: TranslationEngineSettingsSnapshot
): string | undefined {
  if (input.model) return input.model
  if (input.engineId === 'local') return settings.translationEngines.local.model
  if (input.engineId === 'local-ct2') return settings.translationEngines.localCt2.model
  if (input.engineId === 'local-llama') return settings.translationEngines.localLlama.model
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

function formatManagedLocalRuntimeCompatibilityMessage(input: {
  engineId: ManagedLocalTranslationEngineId
  groupLabel: string
  detail: string
}): string {
  if (input.engineId === 'local-llama') {
    return `Selected llama GGUF group ${input.groupLabel} cannot be loaded by the current node-llama-cpp runtime: ${input.detail}`
  }
  return input.detail
}

function readProcessTotalMemoryMb(): number | undefined {
  const totalMemory = Reflect.get(process, 'constrainedMemory')
  if (typeof totalMemory === 'function') {
    const value = totalMemory.call(process)
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.round(value / (1024 * 1024))
    }
  }
  const value = totalmem()
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value / (1024 * 1024))
  }
  return undefined
}

function readProcessAvailableMemoryMb(): number | undefined {
  const value = freemem()
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value / (1024 * 1024))
  }
  return undefined
}

function readCurrentRuntimeMemory(): TranslationRuntimeMemorySnapshot {
  return {
    totalMemoryMb: readProcessTotalMemoryMb(),
    availableMemoryMb: readProcessAvailableMemoryMb(),
    platform: process.platform,
    arch: process.arch,
  }
}
