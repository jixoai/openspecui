import {
  buildRuntimePackageInstallCommand,
  checkLocalDirectionalModelLanguagePair,
  createCleanCliEnv,
  detectRuntimePackageManager,
  LocalModelAssetStateSchema,
  resolveRuntimePackageInstallStrategy,
  TRANSLATION_ENGINE_MANIFESTS,
  type BatchTranslateEvent,
  type BatchTranslateInput,
  type ConfigManager,
  type GlobalSettingsManager,
  type LocalModelAssetState,
  type ServiceTranslationEngineId,
  type TranslationEngineId,
  type TranslationEngineInstaller,
  type TranslationEngineInstallEvent,
  type TranslationEngineInstallLogEvent,
  type TranslationEngineInstallStatus,
  type TranslationEngineManifest,
  type TranslationModelDownloadPlan,
  type TranslationModelSearchInput,
  type TranslationModelSearchResult,
  type TranslatorFactory,
} from '@openspecui/core'
import { observable } from '@trpc/server/observable'
import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
import { searchLocalModels } from './translation-model-catalog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

type TranslationEngineSettingsSnapshot = Awaited<ReturnType<GlobalSettingsManager['readSettings']>>

export interface TranslationEngineListItem extends TranslationEngineManifest {
  selected: boolean
  installStatus: TranslationEngineInstallStatus
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
    const items = await Promise.all(
      TRANSLATION_ENGINE_MANIFESTS.map(async (manifest) => ({
        ...manifest,
        selected: config.translation.engineId === manifest.id,
        installStatus: await this.getInstallStatus(manifest.id, globalSettings),
        model:
          manifest.id === 'local'
            ? (config.translation.engines.local.model ??
              globalSettings.translationEngines.local.model)
            : manifest.id === 'openai'
              ? (config.translation.engines.openai.model ??
                globalSettings.translationEngines.openai.model)
              : undefined,
      }))
    )
    return items
  }

  async getInstallStatus(
    engineId: TranslationEngineId,
    globalSettings?: TranslationEngineSettingsSnapshot
  ): Promise<TranslationEngineInstallStatus> {
    const settings = globalSettings ?? (await this.globalSettingsManager.readSettings())
    return this.getInstaller(engineId).detectInstallState({
      projectDir: this.projectDir,
      globalSettings: settings.translationEngines,
    })
  }

  async installEngine(
    engineId: TranslationEngineId,
    callbacks?: {
      onStatus?: (status: TranslationEngineInstallStatus) => void
      onLog?: (event: TranslationEngineInstallLogEvent) => void
      signal?: AbortSignal
    }
  ): Promise<TranslationEngineInstallStatus> {
    const settings = await this.globalSettingsManager.readSettings()
    return this.getInstaller(engineId).install({
      projectDir: this.projectDir,
      globalSettings: settings.translationEngines,
      signal: callbacks?.signal,
      onStatus: callbacks?.onStatus,
      onLog: callbacks?.onLog,
    })
  }

  installEngineStream(engineId: TranslationEngineId) {
    return observable<TranslationEngineInstallEvent>((emit) => {
      let closed = false
      const controller = new AbortController()

      const push = (event: TranslationEngineInstallEvent) => {
        if (closed) return
        emit.next(event)
        if (event.type === 'exit') {
          closed = true
          emit.complete()
        }
      }

      void (async () => {
        try {
          const initialStatus = await this.getInstallStatus(engineId)
          push({ type: 'status', status: initialStatus })
          if (initialStatus.state === 'installed') {
            push({ type: 'exit', status: initialStatus })
            return
          }

          const finalStatus = await this.installEngine(engineId, {
            signal: controller.signal,
            onStatus: (status) => {
              push({ type: 'status', status })
            },
            onLog: (event) => {
              push({ type: 'log', ...event })
            },
          })
          push({ type: 'exit', status: finalStatus })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const status: TranslationEngineInstallStatus = {
            state: 'error',
            message: 'Translation engine installation failed.',
            error: message,
          }
          push({ type: 'status', status })
          push({ type: 'exit', status })
        }
      })()

      return () => {
        closed = true
        controller.abort()
      }
    })
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
          if (input.engineId === 'local') {
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

  private getInstaller(engineId: TranslationEngineId): TranslationEngineInstaller {
    if (engineId === 'browser') return browserTranslationEngineInstaller
    if (engineId === 'openai') return openAITranslationEngineInstaller
    return createLocalTranslationEngineInstaller()
  }
}

const browserTranslationEngineInstaller: TranslationEngineInstaller = {
  async detectInstallState() {
    return { state: 'installed', message: 'Browser translator is built in.' }
  },
  async install() {
    return { state: 'installed', message: 'Browser translator is built in.' }
  },
}

const openAITranslationEngineInstaller: TranslationEngineInstaller = {
  async detectInstallState() {
    return { state: 'installed', message: 'OpenAI completion translator is bundled.' }
  },
  async install() {
    return { state: 'installed', message: 'OpenAI completion translator is bundled.' }
  },
}

function createLocalTranslationEngineInstaller(): TranslationEngineInstaller {
  return {
    async detectInstallState() {
      return detectLocalTranslationRuntimeInstallState()
    },
    async install(input) {
      input.onStatus?.({
        state: 'installing',
        message: 'Installing Local-Transformers runtime dependencies.',
      })
      return installLocalTranslationRuntime(input)
    },
  }
}

async function detectLocalTranslationRuntimeInstallState(): Promise<TranslationEngineInstallStatus> {
  const runtimeHost = resolveRuntimeHostPackageContext(__dirname)
  try {
    const tree = await readRuntimeHostPackageDependencyTree({
      runtimeHost,
      packageNames: ['@huggingface/transformers', 'onnxruntime-node'],
    })
    const hasTransformers = hasRuntimePackageDependencyPath(tree, ['@huggingface/transformers'])
    const hasOnnxRuntime = hasRuntimePackageDependencyPath(tree, [
      '@huggingface/transformers',
      'onnxruntime-node',
    ])
    if (!hasTransformers || !hasOnnxRuntime) {
      throw new Error(buildMissingRuntimeDependencyMessage({ hasTransformers, hasOnnxRuntime }))
    }
    return {
      state: 'installed',
      message: 'Local-Transformers runtime dependencies are installed.',
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Local-Transformers runtime dependencies are not installed.'
    return {
      state: 'not-installed',
      message: 'Install the Local-Transformers runtime package to enable server-side translation.',
      error: message,
    }
  }
}

async function installLocalTranslationRuntime(
  input: Parameters<TranslationEngineInstaller['install']>[0]
): Promise<TranslationEngineInstallStatus> {
  const runtimeHost = resolveRuntimeHostPackageContext(__dirname)
  const packageManager = detectRuntimePackageManager({ startDir: runtimeHost.packageDir })
  const strategy = resolveRuntimePackageInstallStrategy(packageManager.id)
  const runtimePackage = readRuntimeHostPackageDependencyRequest({
    runtimeHost,
    packageName: '@huggingface/transformers',
    fallbackRange: '~4.2.0',
  })
  const installCommand = buildRuntimePackageInstallCommand({
    packageManager: packageManager.id,
    packages: [runtimePackage],
    dependencyField: 'optionalDependencies',
    ignoreWorkspace: runtimeHost.packageName === '@openspecui/server',
    allowBuildPackages: ['onnxruntime-node'],
  })
  if (!installCommand) {
    const message = `Automatic Local-Transformers runtime installation is not supported for runtime host package manager "${packageManager.id}". Install ${runtimePackage} manually in ${runtimeHost.packageName}.`
    input.onStatus?.({
      state: 'error',
      message: 'Failed to resolve a supported Local-Transformers runtime installer.',
      error: message,
    })
    throw new Error(message)
  }

  input.onLog?.({
    stream: 'stdout',
    text: `${installCommand.displayCommand}\n`,
  })

  let child
  try {
    child = spawn(installCommand.cmd, installCommand.args, {
      cwd: runtimeHost.packageDir,
      shell: false,
      env: createCleanCliEnv(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    input.onStatus?.({
      state: 'error',
      message: 'Failed to start Local-Transformers runtime installation.',
      error: message,
    })
    throw new Error(message)
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
        const text = data.toString()
        input.onLog?.({ stream: 'stdout', text })
      })
      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        input.onLog?.({ stream: 'stderr', text })
      })
      child.on('error', (error) => {
        reject(error)
      })
      child.on('close', (exitCode) => {
        if (exitCode === 0) {
          resolve()
          return
        }
        reject(`${installCommand.displayCommand} exited with code ${exitCode ?? 'unknown'}.`)
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    input.onStatus?.({
      state: 'error',
      message: 'Local-Transformers runtime installation failed.',
      error: message,
    })
    throw new Error(message)
  } finally {
    input.signal?.removeEventListener('abort', abort)
  }

  if (strategy && !strategy.preservesDependencyField) {
    normalizeRuntimeHostOptionalDependencies({
      runtimeHost,
      packageNames: ['@huggingface/transformers'],
    })
  }

  const finalStatus = await detectLocalTranslationRuntimeInstallState()
  input.onStatus?.(finalStatus)
  return finalStatus
}

function buildMissingRuntimeDependencyMessage(input: {
  hasTransformers: boolean
  hasOnnxRuntime: boolean
}): string {
  const missing: string[] = []
  if (!input.hasTransformers) missing.push('@huggingface/transformers')
  if (!input.hasOnnxRuntime) missing.push('onnxruntime-node')
  return `Missing runtime dependency: ${missing.join(', ')}`
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
