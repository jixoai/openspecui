import {
  SERVICE_TRANSLATION_ENGINE_IDS,
  TRANSLATION_ENGINE_MANIFESTS,
  getDefaultGlobalSettingsPath,
  getTranslationEngineManifest,
  type ConfigManager,
  type GlobalSettingsManager,
  type NmtModelAssetState,
  type RichTranslationInput,
  type ServiceTranslationEngineId,
  type TranslationEngineId,
  type TranslationEngineManifest,
  type TranslationInstallLog,
  type TranslationModelDownloadPlan,
  type TranslationModelSearchInput,
  type TranslationModelSearchResult,
  type TranslatorFactory,
} from '@openspecui/core'
import { observable } from '@trpc/server/observable'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ensureProxyAwareFetchDispatcher } from './network-dispatcher.js'
import { NmtModelAssetStore } from './nmt-model-asset-store.js'
import {
  getDefaultNmtModelCacheDir,
  getDefaultNmtModelFetchCachePath,
  getDefaultNmtModelIndexPath,
} from './nmt-model-cache-path.js'
import { NmtModelFetchCacheStore } from './nmt-model-fetch-cache-store.js'
import { readLocalNmtModelFileStatus } from './nmt-model-local-cache.js'
import {
  resolveNmtModelRuntimePlanFromProject,
  type NmtRuntimeSettingsReader,
  type TransformersRuntimeModule,
} from './nmt-model-runtime.js'
import { createExtensionInstallCommand, detectPackageRunner } from './package-runner.js'
import { searchNmtModels } from './translation-model-catalog.js'

export interface TranslationEngineListItem extends TranslationEngineManifest {
  selected: boolean
  status: 'available' | 'not-installed' | 'installing' | 'error' | 'unavailable'
  message?: string
  model?: string
}

export interface TranslationEngineServiceOptions {
  projectDir: string
  configManager: ConfigManager
  globalSettingsManager: GlobalSettingsManager
  now?: () => number
  nmtCacheDir?: string
  nmtAssetIndexPath?: string
  nmtFetchCachePath?: string
}

interface InstallSession {
  engineId: ServiceTranslationEngineId
  child: ChildProcess | null
  abortController: AbortController
  sessionId: string
  completionPromise: Promise<void>
  resolveCompletion: () => void
  rejectCompletion: (error: Error) => void
  lastInstallLogAt?: number
  lastInstallLogSignature?: string
}

type LogListener = (log: TranslationInstallLog) => void

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

const __dirname = dirname(fileURLToPath(import.meta.url))

export class TranslationEngineService {
  private readonly projectDir: string
  private readonly configManager: ConfigManager
  private readonly globalSettingsManager: GlobalSettingsManager
  private readonly now: () => number
  private readonly nmtCacheDir: string
  private readonly nmtAssetStore: NmtModelAssetStore
  private readonly nmtFetchCacheStore: NmtModelFetchCacheStore
  private readonly listeners = new Set<LogListener>()
  private readonly sessions = new Map<ServiceTranslationEngineId, InstallSession>()
  private readonly logs = new Map<ServiceTranslationEngineId, TranslationInstallLog>()

  constructor(options: TranslationEngineServiceOptions) {
    ensureProxyAwareFetchDispatcher()
    this.projectDir = options.projectDir
    this.configManager = options.configManager
    this.globalSettingsManager = options.globalSettingsManager
    this.now = options.now ?? Date.now
    this.nmtCacheDir = options.nmtCacheDir ?? getDefaultNmtModelCacheDir()
    this.nmtAssetStore = new NmtModelAssetStore({
      indexPath: options.nmtAssetIndexPath ?? getDefaultNmtModelIndexPath(),
    })
    this.nmtFetchCacheStore = new NmtModelFetchCacheStore({
      cachePath: options.nmtFetchCachePath ?? getDefaultNmtModelFetchCachePath(),
      now: this.now,
    })
  }

  async listEngines(): Promise<TranslationEngineListItem[]> {
    const [config, globalSettings] = await Promise.all([
      this.configManager.readConfig(),
      this.globalSettingsManager.readSettings(),
    ])
    return TRANSLATION_ENGINE_MANIFESTS.map((manifest) => {
      const engineId = manifest.id
      if (engineId === 'browser') {
        return {
          ...manifest,
          selected: config.translation.engineId === engineId,
          status: 'available' as const,
        }
      }
      const serviceId = engineId
      const installState = globalSettings.translationEngines.extensions.engines[serviceId]
      const activeLog = this.logs.get(serviceId)
      const status = activeLog?.status === 'installing' ? 'installing' : installState.status
      return {
        ...manifest,
        selected: config.translation.engineId === engineId,
        status:
          status === 'installed'
            ? 'available'
            : status === 'installing'
              ? 'installing'
              : status === 'error'
                ? 'error'
                : 'not-installed',
        message: activeLog?.message ?? installState.message,
        model:
          serviceId === 'ai'
            ? (config.translation.engines.ai.model ?? globalSettings.translationEngines.ai.model)
            : (config.translation.engines.nmt.model ?? globalSettings.translationEngines.nmt.model),
      }
    })
  }

  async searchModels(input: TranslationModelSearchInput): Promise<TranslationModelSearchResult> {
    if (input.engineId === 'nmt') {
      const globalSettings = await this.globalSettingsManager.readSettings()
      return searchNmtModels(input, {
        hfEndpoint: globalSettings.translationEngines.nmt.hfEndpoint,
      })
    }
    return { items: [] }
  }

  async getModelDownloadPlan(input: {
    engineId: ServiceTranslationEngineId
    model: string
    selectedGroupId?: string
  }): Promise<TranslationModelDownloadPlan | null> {
    if (input.engineId === 'nmt') {
      const plan = await resolveNmtModelRuntimePlanFromProject({
        projectDir: this.projectDir,
        globalSettingsManager: this.globalSettingsManager,
        modelId: input.model,
        selectedGroupId: input.selectedGroupId,
        cacheDir: this.nmtCacheDir,
        fetchCacheStore: this.nmtFetchCacheStore,
        loadTransformersModule: this.loadNmtTransformersModuleForPlan.bind(this),
      }).catch(() => null)
      if (!plan) return null
      const state = (await this.nmtAssetStore.readMap()).get(input.model)
      return enrichDownloadPlanWithAssetSnapshot(plan, state, input.selectedGroupId)
    }
    return null
  }

  subscribeLogs() {
    return observable<TranslationInstallLog>((emit) => {
      for (const log of this.logs.values()) {
        emit.next(log)
      }
      const listener = (log: TranslationInstallLog) => emit.next(log)
      this.listeners.add(listener)
      return () => {
        this.listeners.delete(listener)
      }
    })
  }

  async selectEngine(engineId: TranslationEngineId): Promise<{ success: true }> {
    await this.configManager.writeConfig({ translation: { engineId } })
    return { success: true }
  }

  async ensureInstalled(engineId: ServiceTranslationEngineId): Promise<void> {
    const settings = await this.globalSettingsManager.readSettings()
    if (settings.translationEngines.extensions.engines[engineId].status === 'installed') {
      return
    }
    const { sessionId } = await this.installEngine(engineId)
    const session = this.sessions.get(engineId)
    if (sessionId && session) {
      await session.completionPromise
      return
    }
    const nextSettings = await this.globalSettingsManager.readSettings()
    if (nextSettings.translationEngines.extensions.engines[engineId].status !== 'installed') {
      throw new Error(
        nextSettings.translationEngines.extensions.engines[engineId].message ?? 'Install failed.'
      )
    }
  }

  async installEngine(engineId: ServiceTranslationEngineId): Promise<{ sessionId: string | null }> {
    const existing = this.sessions.get(engineId)
    if (existing) return { sessionId: existing.sessionId }

    const manifest = getTranslationEngineManifest(engineId)
    const sessionId = `${engineId}-${this.now()}`
    const abortController = new AbortController()
    const runner = detectPackageRunner({ cwd: this.projectDir })
    const completion = createDeferred<void>()

    const localPackage = await this.resolveLocalPackage(manifest)
    if (localPackage || runner.id === 'local') {
      if (!localPackage) {
        await this.setInstallState(engineId, {
          status: 'error',
          message: 'Local translator package is unavailable. Build or link the workspace package.',
          updatedAt: this.now(),
        })
        this.emitLog({
          engineId,
          status: 'error',
          message: 'Local translator package is unavailable.',
          sessionId,
          updatedAt: this.now(),
        })
        return { sessionId }
      }
      this.emitLog({
        engineId,
        status: 'installing',
        message: 'Using local workspace package.',
        sessionId,
        updatedAt: this.now(),
      })
      await this.setInstallState(engineId, {
        status: 'installing',
        message: 'Using local workspace package.',
        updatedAt: this.now(),
      })
      this.sessions.set(engineId, {
        engineId,
        child: null,
        abortController,
        sessionId,
        completionPromise: completion.promise,
        resolveCompletion: completion.resolve,
        rejectCompletion: completion.reject,
      })
      try {
        await this.verifyInstalledEngine(engineId, sessionId, abortController.signal)
        return { sessionId }
      } catch (error) {
        await this.finishInstall(engineId, sessionId, false, getErrorMessage(error))
        return { sessionId }
      }
    }

    const command = createExtensionInstallCommand({ runner: runner.id, manifest })
    if (!command) {
      throw new Error(`Translation engine ${engineId} is not installable.`)
    }

    const installRoot = await this.ensureInstallRoot()
    await this.ensureExtensionPackageJson(installRoot)
    this.emitLog({
      engineId,
      status: 'installing',
      message: `Installing ${manifest.packageName} with ${runner.id}.`,
      sessionId,
      updatedAt: this.now(),
    })
    await this.setInstallState(engineId, {
      status: 'installing',
      message: `Installing with ${runner.id}.`,
      updatedAt: this.now(),
    })

    const child = spawn(command.command, command.args, {
      cwd: installRoot,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const session: InstallSession = {
      engineId,
      child,
      abortController,
      sessionId,
      completionPromise: completion.promise,
      resolveCompletion: completion.resolve,
      rejectCompletion: completion.reject,
    }
    this.sessions.set(engineId, session)

    child.stdout?.on('data', (chunk: Buffer) => {
      this.emitLog({
        engineId,
        status: 'installing',
        message: trimLogLine(chunk.toString()) || `Installing ${manifest.packageName}.`,
        sessionId,
        updatedAt: this.now(),
      })
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      this.emitLog({
        engineId,
        status: 'installing',
        message: trimLogLine(chunk.toString()) || `Installing ${manifest.packageName}.`,
        sessionId,
        updatedAt: this.now(),
      })
    })
    child.on('error', (error) => {
      void this.finishInstall(engineId, sessionId, false, error.message)
    })
    child.on('close', (code) => {
      if (code !== 0) {
        void this.finishInstall(
          engineId,
          sessionId,
          false,
          `Install failed with exit code ${code}.`
        )
        return
      }
      void this.verifyInstalledEngine(engineId, sessionId, abortController.signal).catch(
        (error) => {
          void this.finishInstall(engineId, sessionId, false, getErrorMessage(error))
        }
      )
    })
    return { sessionId }
  }

  async cancelInstall(engineId: ServiceTranslationEngineId): Promise<{ success: true }> {
    const session = this.sessions.get(engineId)
    if (!session) return { success: true }
    session.abortController.abort()
    session.child?.kill('SIGTERM')
    this.sessions.delete(engineId)
    session.rejectCompletion(new Error('Installation cancelled.'))
    await this.setInstallState(engineId, {
      status: 'not-installed',
      message: 'Installation cancelled.',
      updatedAt: this.now(),
    })
    this.emitLog({
      engineId,
      status: 'not-installed',
      message: 'Installation cancelled.',
      updatedAt: this.now(),
    })
    return { success: true }
  }

  async translate(input: {
    engineId: TranslationEngineId
    sourceLanguage: string
    targetLanguage: string
    model?: string
    selectedGroupId?: string
    text?: string
    rich?: RichTranslationInput
  }): Promise<{ text: string; engineVersion?: string; model?: string }> {
    if (input.engineId === 'browser') {
      throw new Error('Browser translator runs in the browser runtime.')
    }
    const engineId = input.engineId
    const dtype = await this.readNmtDtype(input.engineId, input.model, input.selectedGroupId)
    if (engineId === 'nmt' && input.model) {
      await this.assertNmtModelReady(input.model, input.selectedGroupId)
    }
    const factory = await this.loadFactory(engineId, input.model)
    const translator = await factory.create({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      model: input.model,
      dtype,
      runtimeConfig:
        engineId === 'nmt' && input.model
          ? await this.readNmtRuntimeConfig(input.model)
          : undefined,
    })
    try {
      const text =
        input.rich !== undefined
          ? await translator.translate(input.rich)
          : await translator.translate(input.text ?? '')
      return { text, model: input.model }
    } finally {
      translator.destroy?.()
    }
  }

  private async readNmtDtype(
    engineId: TranslationEngineId,
    model: string | undefined,
    selectedGroupId: string | undefined
  ): Promise<string | undefined> {
    if (engineId !== 'nmt' || !model) return undefined
    const effectiveSelectedGroupId =
      selectedGroupId ??
      (await this.globalSettingsManager.readSettings()).translationEngines.nmt.selectedGroupId
    if (!effectiveSelectedGroupId) return undefined
    const plan = await this.getModelDownloadPlan({
      engineId: 'nmt',
      model,
      selectedGroupId: effectiveSelectedGroupId,
    })
    return plan?.groups?.find((group) => group.id === effectiveSelectedGroupId)?.dtype
  }

  private async assertNmtModelReady(
    model: string,
    selectedGroupId: string | undefined
  ): Promise<void> {
    const plan = await this.getModelDownloadPlan({
      engineId: 'nmt',
      model,
      selectedGroupId,
    })
    const selectedGroup =
      plan?.groups?.find((group) => group.id === (selectedGroupId ?? plan.selectedGroupId)) ??
      plan?.groups?.find((group) => group.selected)
    const files = selectedGroup?.files ?? plan?.files ?? []
    if (!plan || files.length === 0) {
      throw new Error('No local NMT runtime file plan is available for the selected model.')
    }
    const cacheStatus = await readLocalNmtModelFileStatus({
      cacheDir: this.nmtCacheDir,
      modelId: model,
      files: files.map((file) => file.path),
    })
    if (cacheStatus.allCached) {
      const states = await this.nmtAssetStore.readMap()
      const current = states.get(model)
      if (current) {
        await this.nmtAssetStore.upsert({
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
      `Selected NMT model files are not installed locally: ${missingFiles.join(', ')}${suffix}.`
    )
  }

  private async readNmtRuntimeConfig(model: string): Promise<Record<string, unknown> | undefined> {
    try {
      return JSON.parse(
        await readFile(join(this.nmtCacheDir, 'models', model, 'config.json'), 'utf8')
      ) as Record<string, unknown>
    } catch {
      return undefined
    }
  }

  private async loadFactory(
    engineId: ServiceTranslationEngineId,
    model: string | undefined
  ): Promise<TranslatorFactory> {
    const globalSettings = await this.globalSettingsManager.readSettings()
    if (engineId === 'nmt') {
      const mod = (await this.importEngineModule(engineId)) as {
        createNmtTranslatorFactory: (options?: {
          defaultModel?: string
          cacheDir?: string
          localOnly?: boolean
        }) => TranslatorFactory
      }
      return mod.createNmtTranslatorFactory({
        defaultModel: model ?? globalSettings.translationEngines.nmt.model,
        cacheDir: this.nmtCacheDir,
        localOnly: true,
      })
    }
    const mod = (await this.importEngineModule(engineId)) as {
      createAiTranslatorFactory: (options: {
        baseUrl: string
        token: string
        model: string
      }) => TranslatorFactory
    }
    return mod.createAiTranslatorFactory({
      baseUrl: globalSettings.translationEngines.ai.baseUrl,
      token: globalSettings.translationEngines.ai.token,
      model: model ?? globalSettings.translationEngines.ai.model,
    })
  }

  private async verifyInstalledEngine(
    engineId: ServiceTranslationEngineId,
    sessionId: string,
    signal: AbortSignal
  ): Promise<void> {
    if (!this.isActiveSession(engineId, sessionId)) {
      return
    }
    const [config, globalSettings] = await Promise.all([
      this.configManager.readConfig(),
      this.globalSettingsManager.readSettings(),
    ])
    const model =
      engineId === 'ai'
        ? (config.translation.engines.ai.model ?? globalSettings.translationEngines.ai.model)
        : (config.translation.engines.nmt.model ?? globalSettings.translationEngines.nmt.model)
    const factory = await this.loadFactory(engineId, model)
    if (!this.isActiveSession(engineId, sessionId) || signal.aborted) {
      return
    }
    if (engineId === 'ai' && typeof factory.prepare === 'function') {
      await factory.prepare({
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model,
        signal,
        monitor: {
          setStatus: (status) => {
            if (!this.isActiveSession(engineId, sessionId) || signal.aborted) {
              return
            }
            this.emitLog({
              engineId,
              status: 'installing',
              message: status.message,
              ...(status.progress === undefined ? {} : { progress: status.progress }),
              sessionId,
              updatedAt: this.now(),
            })
          },
        },
      })
    }
    await this.finishInstall(
      engineId,
      sessionId,
      true,
      engineId === 'nmt'
        ? 'NMT translator package is ready. Select a model to download it.'
        : `AI translator ${model} is ready.`
    )
  }

  private async importEngineModule(engineId: ServiceTranslationEngineId): Promise<unknown> {
    const manifest = getTranslationEngineManifest(engineId)
    const localPackage = await this.resolveLocalPackage(manifest)
    if (localPackage) {
      return import(pathToFileURL(localPackage).href)
    }
    const installRoot = await this.ensureInstallRoot()
    const requireFromCache = createRequire(join(installRoot, 'package.json'))
    if (!manifest.aliasName) {
      throw new Error(`Translation engine ${engineId} has no package alias.`)
    }
    return import(pathToFileURL(requireFromCache.resolve(manifest.aliasName)).href)
  }

  protected async loadNmtTransformersModuleForPlan(
    _projectDir: string,
    globalSettingsManager: NmtRuntimeSettingsReader
  ): Promise<TransformersRuntimeModule> {
    const manifest = getTranslationEngineManifest('nmt')
    const localPackage = await this.resolveLocalPackage(manifest)
    if (localPackage) {
      const requireFromLocalPackage = createRequire(localPackage)
      return import(
        pathToFileURL(requireFromLocalPackage.resolve('@huggingface/transformers')).href
      ) as Promise<TransformersRuntimeModule>
    }
    const installRoot =
      (await globalSettingsManager.readSettings()).translationEngines.extensions.installRoot ??
      join(dirname(getDefaultGlobalSettingsPath()), 'extensions')
    const requireFromInstallRoot = createRequire(join(installRoot, 'package.json'))
    return import(
      pathToFileURL(requireFromInstallRoot.resolve(manifest.aliasName ?? manifest.packageName!))
        .href
    ) as Promise<TransformersRuntimeModule>
  }

  private async resolveLocalPackage(manifest: TranslationEngineManifest): Promise<string | null> {
    if (!manifest.packageName) return null
    const packageDir = resolve(
      __dirname,
      '..',
      '..',
      manifest.packageName.replace('@openspecui/', '')
    )
    const source = join(packageDir, 'src', 'index.ts')
    const dist = join(packageDir, 'dist', 'index.mjs')
    const candidates = basename(__dirname) === 'src' ? [source, dist] : [dist, source]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
    return null
  }

  private async ensureInstallRoot(): Promise<string> {
    const settings = await this.globalSettingsManager.readSettings()
    const root =
      settings.translationEngines.extensions.installRoot ??
      join(dirname(getDefaultGlobalSettingsPath()), 'extensions')
    await mkdir(root, { recursive: true })
    return root
  }

  private async ensureExtensionPackageJson(installRoot: string): Promise<void> {
    const packageJsonPath = join(installRoot, 'package.json')
    if (existsSync(packageJsonPath)) return
    await writeFile(
      packageJsonPath,
      `${JSON.stringify({ private: true, type: 'module', dependencies: {} }, null, 2)}\n`,
      'utf8'
    )
  }

  private async finishInstall(
    engineId: ServiceTranslationEngineId,
    sessionId: string,
    success: boolean,
    message: string
  ): Promise<void> {
    if (!this.isActiveSession(engineId, sessionId)) {
      return
    }
    const session = this.sessions.get(engineId)
    this.sessions.delete(engineId)
    const manifest = getTranslationEngineManifest(engineId)
    await this.setInstallState(engineId, {
      status: success ? 'installed' : 'error',
      version: success ? manifest.versionRange : undefined,
      message,
      installedAt: success ? this.now() : undefined,
      updatedAt: this.now(),
    })
    this.emitLog({
      engineId,
      status: success ? 'installed' : 'error',
      message,
      progress: success ? 1 : undefined,
      sessionId,
      updatedAt: this.now(),
    })
    if (success) {
      session?.resolveCompletion()
    } else {
      session?.rejectCompletion(new Error(message))
    }
  }

  private async setInstallState(
    engineId: ServiceTranslationEngineId,
    state: {
      status: 'not-installed' | 'installed' | 'installing' | 'error'
      version?: string
      message?: string
      installedAt?: number
      updatedAt?: number
    }
  ): Promise<void> {
    await this.globalSettingsManager.writeSettings({
      translationEngines: {
        extensions: {
          engines: {
            [engineId]: state,
          },
        },
      },
    })
  }

  private emitLog(log: TranslationInstallLog): void {
    if (this.shouldCoalesceInstallLog(log)) {
      return
    }
    this.logs.set(log.engineId, log)
    for (const listener of this.listeners) {
      listener(log)
    }
  }

  private isActiveSession(engineId: ServiceTranslationEngineId, sessionId: string): boolean {
    const session = this.sessions.get(engineId)
    return session?.sessionId === sessionId
  }

  private shouldCoalesceInstallLog(log: TranslationInstallLog): boolean {
    if (log.status !== 'installing' || !log.sessionId) {
      return false
    }
    const session = this.sessions.get(log.engineId)
    if (!session || session.sessionId !== log.sessionId) {
      return false
    }

    const progressBucket =
      log.progress === undefined
        ? ''
        : String(Math.max(0, Math.min(100, Math.round(log.progress * 100))))
    const signature = `${log.status}:${log.message}:${progressBucket}`
    if (signature === session.lastInstallLogSignature) {
      return true
    }

    const isProgressLog = log.progress !== undefined && log.progress < 1
    const withinThrottleWindow =
      session.lastInstallLogAt !== undefined && log.updatedAt - session.lastInstallLogAt < 250
    if (isProgressLog && withinThrottleWindow) {
      return true
    }

    session.lastInstallLogAt = log.updatedAt
    session.lastInstallLogSignature = signature
    return false
  }
}

export const translationEngineInstallInputSchema = {
  engineId: SERVICE_TRANSLATION_ENGINE_IDS,
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve']
  let reject!: Deferred<T>['reject']
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function trimLogLine(value: string): string {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1)
      ?.slice(0, 240) ?? ''
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function enrichDownloadPlanWithAssetSnapshot(
  plan: TranslationModelDownloadPlan,
  state: NmtModelAssetState | undefined,
  selectedGroupId: string | undefined
): TranslationModelDownloadPlan {
  if (!state?.files.length) return plan
  const stateFiles = new Map(state.files.map((file) => [file.path, file]))
  const enrichFile = (file: TranslationModelDownloadPlan['files'][number]) => ({
    ...file,
    sizeBytes: file.sizeBytes ?? stateFiles.get(file.path)?.sizeBytes,
  })
  const groups = plan.groups?.map((group) => {
    const files = group.files.map(enrichFile)
    const estimatedTotalBytes = files.every((file) => file.sizeBytes !== undefined)
      ? files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0)
      : group.estimatedTotalBytes
    return {
      ...group,
      files,
      estimatedTotalBytes,
      selectable:
        group.selectable || (estimatedTotalBytes !== undefined && estimatedTotalBytes > 0),
    }
  })
  const selectedGroup =
    groups?.find((group) => group.id === selectedGroupId && group.selectable) ??
    groups?.find((group) => group.id === plan.selectedGroupId && group.selectable) ??
    groups?.find((group) => group.selected && group.selectable)
  const files = (selectedGroup?.files ?? plan.files).map(enrichFile)
  const estimatedTotalBytes = selectedGroup?.estimatedTotalBytes ?? plan.estimatedTotalBytes
  return {
    ...plan,
    files,
    groups: groups?.map((group) => ({ ...group, selected: group.id === selectedGroup?.id })),
    selectedGroupId: selectedGroup?.id ?? plan.selectedGroupId,
    estimatedTotalBytes,
  }
}
