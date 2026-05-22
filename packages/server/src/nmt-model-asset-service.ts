import { downloadFileToCacheDir, fileDownloadInfo } from '@huggingface/hub'
import type {
  ConfigManager,
  NmtLocalModelCatalogResult,
  NmtModelAssetLog,
  NmtModelAssetState,
  NmtModelCatalogItem,
  NmtModelCatalogResult,
  NmtModelCatalogSearchEvent,
  TranslationModelCandidate,
  TranslationModelSearchInput,
  TranslationModelSearchResult,
} from '@openspecui/core'
import {
  getDefaultGlobalSettingsPath,
  getTranslationEngineManifest,
  NmtModelAssetStateSchema,
  selectNmtDownloadGroup,
  type TranslationEngineManifest,
} from '@openspecui/core'
import { observable } from '@trpc/server/observable'
import { existsSync } from 'node:fs'
import { copyFile, lstat, mkdir, readlink, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  buildTransformersRemoteHost,
  normalizeHuggingFaceEndpoint,
} from './huggingface-endpoint.js'
import { ensureProxyAwareFetchDispatcher } from './network-dispatcher.js'
import { NmtModelAssetStore } from './nmt-model-asset-store.js'
import {
  getDefaultNmtModelCacheDir,
  getDefaultNmtModelFetchCachePath,
  getDefaultNmtModelIndexPath,
} from './nmt-model-cache-path.js'
import { NmtModelFetchCacheStore } from './nmt-model-fetch-cache-store.js'
import {
  getTransformersFileCacheModelPath,
  getTransformersLocalModelPath,
  readLocalNmtModelFileStatus,
} from './nmt-model-local-cache.js'
import {
  configureTransformersRuntime,
  resolveNmtModelRuntimePlan,
  type TransformersRuntimeModule,
} from './nmt-model-runtime.js'
import {
  searchNmtModels,
  searchNmtModelsProgressively,
  type ResolvedNmtModelPlan,
} from './translation-model-catalog.js'

interface GlobalSettingsManagerLike {
  readSettings(): Promise<{
    translationEngines: {
      extensions: {
        installRoot?: string
      }
      nmt: {
        model: string
        selectedGroupId?: string
        hfEndpoint: string
      }
    }
  }>
}

interface DownloadSession {
  modelId: string
  sessionId: string
  abortController: AbortController
  selectedGroupId?: string
}

type LogListener = (log: NmtModelAssetLog) => void

interface TransformersModelRegistry {
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
  clear_cache(
    modelId: string,
    options?: { cache_dir?: string }
  ): Promise<{ filesDeleted: number; filesCached: number }>
}

interface TransformersModule extends TransformersRuntimeModule {
  ModelRegistry: TransformersModelRegistry
}

export interface NmtModelAssetServiceOptions {
  projectDir: string
  configManager: ConfigManager
  globalSettingsManager: GlobalSettingsManagerLike
  now?: () => number
  indexPath?: string
  cacheDir?: string
  fetchCachePath?: string
}

export class NmtModelAssetService {
  private readonly now: () => number
  private readonly store: NmtModelAssetStore
  private readonly cacheDir: string
  private readonly fetchCacheStore: NmtModelFetchCacheStore
  private readonly listeners = new Set<LogListener>()
  private readonly sessions = new Map<string, DownloadSession>()
  private readonly logs = new Map<string, NmtModelAssetLog>()
  private transformersModulePromise: Promise<TransformersModule> | null = null
  private readonly moduleDir = dirname(fileURLToPath(import.meta.url))

  constructor(private readonly options: NmtModelAssetServiceOptions) {
    ensureProxyAwareFetchDispatcher()
    this.now = options.now ?? Date.now
    this.cacheDir = options.cacheDir ?? getDefaultNmtModelCacheDir()
    this.store = new NmtModelAssetStore({
      indexPath: options.indexPath ?? getDefaultNmtModelIndexPath(),
    })
    this.fetchCacheStore = new NmtModelFetchCacheStore({
      cachePath: options.fetchCachePath ?? getDefaultNmtModelFetchCachePath(),
      now: this.now,
    })
  }

  subscribeLogs() {
    return observable<NmtModelAssetLog>((emit) => {
      for (const log of this.logs.values()) {
        emit.next(log)
      }
      const listener = (log: NmtModelAssetLog) => emit.next(log)
      this.listeners.add(listener)
      return () => {
        this.listeners.delete(listener)
      }
    })
  }

  async listLocalCatalog(): Promise<NmtLocalModelCatalogResult> {
    const localMap = await this.store.readMap()
    const items = await Promise.all(
      [...localMap.values()].map(async (state) => {
        const asset = await this.refreshCachedState(state)
        const syntheticCandidate: TranslationModelCandidate = {
          id: state.modelId,
          label: state.modelId,
          summary:
            state.plan?.estimatedTotalBytes !== undefined
              ? `Previously selected local model. Estimated download ${formatBytes(state.plan.estimatedTotalBytes)}.`
              : 'Previously selected local model.',
          downloads: 0,
          likes: 0,
          tags: ['local'],
          compatibility: {
            transformersJs: true,
            onnx: true,
            localRuntimeVerified: true,
          },
          size: {
            estimatedTotalBytes: state.plan?.estimatedTotalBytes,
            primaryBytes: state.plan?.estimatedTotalBytes,
          },
          downloadGroups: state.plan?.groups,
          languageMatch: {
            sourceMatched: false,
            targetMatched: false,
            directionalScore: 0,
          },
        }
        return toCatalogItem(syntheticCandidate, asset)
      })
    )
    items.sort(compareCatalogItems)
    return { items }
  }

  async searchRemoteCatalog(input: TranslationModelSearchInput): Promise<NmtModelCatalogResult> {
    const [remote, localMap, selectedModel] = await Promise.all([
      this.searchRemote(input),
      this.store.readMap(),
      this.readSelectedModel(),
    ])
    const items = await this.decorateCatalogItems(remote.items, localMap, selectedModel)
    items.sort(compareCatalogItems)
    return {
      items,
      nextCursor: remote.nextCursor,
    }
  }

  subscribeRemoteCatalog(input: TranslationModelSearchInput & { requestId: string }) {
    return observable<NmtModelCatalogSearchEvent>((emit) => {
      let active = true
      void (async () => {
        try {
          const events = await searchNmtModelsProgressively(input, {
            fetchCacheStore: this.fetchCacheStore,
            hfEndpoint: await this.readHuggingFaceEndpoint(),
          })
          for (const event of events) {
            if (!active) return
            const localMap = await this.store.readMap()
            const selectedModel = await this.readSelectedModel()
            const items = event.items
              ? await this.decorateCatalogItems(event.items, localMap, selectedModel, {
                  includeLocalOnly: false,
                })
              : undefined
            emit.next({
              requestId: event.requestId,
              phase: event.phase,
              items,
              nextCursor: event.nextCursor,
              message: event.message,
            })
          }
        } catch (error) {
          if (!active) return
          emit.next({
            requestId: input.requestId,
            phase: 'error',
            message: error instanceof Error ? error.message : 'Unable to search remote NMT models.',
          })
        }
      })()
      return () => {
        active = false
      }
    })
  }

  async listCatalog(input: TranslationModelSearchInput): Promise<NmtModelCatalogResult> {
    return this.searchRemoteCatalog(input)
  }

  async readSelectedModelState(
    modelId: string,
    selectedGroupId?: string
  ): Promise<NmtModelAssetState> {
    const state = (await this.store.readMap()).get(modelId)
    if (state) return this.refreshCachedState(state, selectedGroupId)
    const session = this.sessions.get(modelId)
    if (session) {
      const selected = modelId === (await this.readSelectedModel())
      const plan = await this.readPlanForState(modelId, selectedGroupId ?? session.selectedGroupId)
      const selectedGroup = selectNmtDownloadGroup(plan, selectedGroupId ?? session.selectedGroupId)
      const files = (selectedGroup?.files ?? plan?.files ?? []).map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: 0,
      }))
      return NmtModelAssetStateSchema.parse({
        modelId,
        plan: plan ?? undefined,
        status: 'downloading',
        selected,
        resumable: true,
        totalBytes: selectedGroup?.estimatedTotalBytes ?? plan?.estimatedTotalBytes,
        progress: 0,
        files,
        updatedAt: this.now(),
      })
    }
    return NmtModelAssetStateSchema.parse({
      modelId,
      status: 'not-downloaded',
      selected: modelId === (await this.readSelectedModel()),
      updatedAt: this.now(),
    })
  }

  async startDownload(modelId: string, selectedGroupId?: string): Promise<{ sessionId: string }> {
    return this.runDownload(modelId, 'downloading', 'Downloading NMT model', selectedGroupId)
  }

  async resumeDownload(modelId: string, selectedGroupId?: string): Promise<{ sessionId: string }> {
    return this.runDownload(modelId, 'downloading', 'Resuming NMT model download', selectedGroupId)
  }

  async pauseDownload(modelId: string): Promise<{ success: true }> {
    const session = this.sessions.get(modelId)
    if (session) {
      session.abortController.abort()
      this.sessions.delete(modelId)
    }
    const current = await this.readSelectedModelState(modelId)
    const nextState = NmtModelAssetStateSchema.parse({
      ...current,
      status: 'paused',
      resumable: true,
      updatedAt: this.now(),
    })
    await this.store.upsert(nextState)
    this.emitLog({
      engineId: 'nmt',
      modelId,
      selectedGroupId: current.plan?.selectedGroupId,
      status: 'paused',
      message: 'NMT model download paused.',
      progress: nextState.progress,
      bytesDownloaded: nextState.bytesDownloaded,
      totalBytes: nextState.totalBytes,
      resumable: true,
      files: nextState.files,
      updatedAt: this.now(),
    })
    return { success: true }
  }

  async deleteModel(modelId: string): Promise<{ success: true }> {
    const session = this.sessions.get(modelId)
    session?.abortController.abort()
    this.sessions.delete(modelId)
    const current = await this.readSelectedModelState(modelId)
    await this.store.upsert(
      NmtModelAssetStateSchema.parse({
        ...current,
        status: 'deleting',
        updatedAt: this.now(),
      })
    )
    this.emitLog({
      engineId: 'nmt',
      modelId,
      selectedGroupId: current.plan?.selectedGroupId,
      status: 'deleting',
      message: 'Deleting local NMT model files.',
      files: current.files,
      updatedAt: this.now(),
    })
    await mkdir(this.cacheDir, { recursive: true })
    await rm(getTransformersLocalModelPath(this.cacheDir, modelId), {
      recursive: true,
      force: true,
    })
    await rm(getTransformersFileCacheModelPath(this.cacheDir, modelId), {
      recursive: true,
      force: true,
    })
    await rm(getHubCacheRepoPath(this.cacheDir, modelId), { recursive: true, force: true })
    await this.store.remove(modelId)
    this.emitLog({
      engineId: 'nmt',
      modelId,
      selectedGroupId: current.plan?.selectedGroupId,
      status: 'not-downloaded',
      message: 'Local NMT model files were removed.',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
      files: [],
      updatedAt: this.now(),
    })
    return { success: true }
  }

  async markSelectedModel(modelId: string): Promise<void> {
    const states = await this.store.readAll()
    const nextStates = states.map((state) =>
      NmtModelAssetStateSchema.parse({
        ...state,
        selected: state.modelId === modelId,
      })
    )
    const existing = nextStates.some((state) => state.modelId === modelId)
    if (!existing) {
      nextStates.push(
        NmtModelAssetStateSchema.parse({
          modelId,
          status: 'not-downloaded',
          selected: true,
          updatedAt: this.now(),
        })
      )
    }
    await this.store.writeAll(nextStates)
  }

  private async searchRemote(
    input: TranslationModelSearchInput
  ): Promise<TranslationModelSearchResult> {
    return searchNmtModels(
      {
        query: input.query,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        limit: input.limit,
        cursor: input.cursor,
      },
      {
        fetchCacheStore: this.fetchCacheStore,
        hfEndpoint: await this.readHuggingFaceEndpoint(),
      }
    )
  }

  private async decorateCatalogItems(
    candidates: ReadonlyArray<TranslationModelCandidate>,
    localMap: Map<string, NmtModelAssetState>,
    selectedModel: string,
    options: { includeLocalOnly?: boolean } = {}
  ): Promise<NmtModelCatalogItem[]> {
    const seen = new Set<string>()
    const remoteItems = await Promise.all(
      candidates.map(async (candidate) => {
        seen.add(candidate.id)
        const localState = localMap.get(candidate.id)
        const asset = localState
          ? await this.refreshCachedState(localState)
          : NmtModelAssetStateSchema.parse({
              modelId: candidate.id,
              status: 'not-downloaded',
              selected: candidate.id === selectedModel,
              updatedAt: this.now(),
            })
        return toCatalogItem(candidate, asset)
      })
    )

    const localOnlyItems =
      options.includeLocalOnly === false
        ? []
        : await Promise.all(
            [...localMap.values()]
              .filter((state) => !seen.has(state.modelId))
              .map(async (state) => {
                const asset = await this.refreshCachedState(state)
                const syntheticCandidate: TranslationModelCandidate = {
                  id: state.modelId,
                  label: state.modelId,
                  summary:
                    state.plan?.estimatedTotalBytes !== undefined
                      ? `Previously selected local model. Estimated download ${formatBytes(state.plan.estimatedTotalBytes)}.`
                      : 'Previously selected local model.',
                  downloads: 0,
                  likes: 0,
                  tags: ['local'],
                  compatibility: {
                    transformersJs: true,
                    onnx: true,
                    localRuntimeVerified: true,
                  },
                  size: {
                    estimatedTotalBytes: state.plan?.estimatedTotalBytes,
                    primaryBytes: state.plan?.estimatedTotalBytes,
                  },
                  downloadGroups: state.plan?.groups,
                  languageMatch: {
                    sourceMatched: false,
                    targetMatched: false,
                    directionalScore: 0,
                  },
                }
                return toCatalogItem(syntheticCandidate, asset)
              })
          )

    return [...remoteItems, ...localOnlyItems]
  }

  private async refreshCachedState(
    state: NmtModelAssetState,
    selectedGroupId?: string
  ): Promise<NmtModelAssetState> {
    const requestedGroupId = selectedGroupId
    const session = this.sessions.get(state.modelId)
    const selected = state.selected || state.modelId === (await this.readSelectedModel())
    if (state.status === 'deleting') {
      return NmtModelAssetStateSchema.parse({
        ...state,
        selected,
        updatedAt: this.now(),
      })
    }
    if (
      state.status === 'downloaded' &&
      state.plan &&
      (requestedGroupId === undefined || requestedGroupId === state.plan.selectedGroupId)
    ) {
      const selectedGroup = selectNmtDownloadGroup(
        state.plan,
        requestedGroupId ?? state.plan.selectedGroupId
      )
      const files = (selectedGroup?.files ?? state.plan.files).map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: file.sizeBytes,
      }))
      return NmtModelAssetStateSchema.parse({
        ...state,
        selected,
        progress: 1,
        bytesDownloaded: state.totalBytes ?? state.plan.estimatedTotalBytes,
        totalBytes: state.totalBytes ?? state.plan.estimatedTotalBytes,
        files,
        updatedAt: this.now(),
        installedAt: state.installedAt ?? this.now(),
      })
    }
    const transformers = await this.getTransformersModule()
    transformers.env.remoteHost = buildTransformersRemoteHost(await this.readHuggingFaceEndpoint())
    const [plan, persistedSelectedGroupId] = await Promise.all([
      this.readPlan(state.modelId, transformers, requestedGroupId ?? state.plan?.selectedGroupId),
      this.readSelectedGroupId(),
    ])
    if (!plan && state.status !== 'downloaded') {
      return NmtModelAssetStateSchema.parse({
        ...state,
        selected,
        plan: undefined,
      })
    }
    const effectivePlan = plan ?? {
      modelId: state.modelId,
      estimatedTotalBytes: state.totalBytes,
      files: state.files.map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        required: true,
      })),
      selectedGroupId: state.plan?.selectedGroupId,
      groups: state.plan?.groups,
    }
    const selectedGroup = selectNmtDownloadGroup(
      effectivePlan,
      requestedGroupId ?? state.plan?.selectedGroupId ?? persistedSelectedGroupId
    )
    if (requestedGroupId && requestedGroupId !== effectivePlan.selectedGroupId && !selectedGroup) {
      return NmtModelAssetStateSchema.parse({
        ...state,
        selected,
        status: 'not-downloaded',
        progress: 0,
        bytesDownloaded: 0,
        totalBytes: undefined,
        resumable: false,
        files: [],
        updatedAt: this.now(),
      })
    }
    const planFiles = selectedGroup?.files ?? effectivePlan.files
    const cacheStatus = await readLocalNmtModelFileStatus({
      cacheDir: this.cacheDir,
      modelId: state.modelId,
      files: planFiles.map((file) => file.path),
    })
    const cachedCount = cacheStatus.files.filter((file) => file.cached).length
    const totalCount = Math.max(cacheStatus.files.length, 1)
    const detectedProgress = cachedCount / totalCount
    const cachedFileSet = new Set(
      cacheStatus.files.filter((file) => file.cached).map((file) => file.file)
    )
    const runtimeAllCached = cacheStatus.allCached
    const progress = cacheStatus.allCached ? 1 : session ? state.progress : detectedProgress
    const hasPartialCache = !runtimeAllCached && cachedCount > 0
    const files = planFiles.map((file) => {
      const cached = cachedFileSet.has(file.path)
      const existingFile = state.files.find((entry) => entry.path === file.path)
      return {
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: cached ? file.sizeBytes : session ? existingFile?.downloadedBytes : 0,
      }
    })
    return NmtModelAssetStateSchema.parse({
      ...state,
      selected,
      plan: effectivePlan,
      status: runtimeAllCached
        ? 'downloaded'
        : session
          ? state.status
          : state.status === 'paused'
            ? 'paused'
            : state.status === 'error'
              ? 'error'
              : hasPartialCache
                ? 'paused'
                : 'not-downloaded',
      progress: progress === undefined ? undefined : Math.max(0, Math.min(1, progress)),
      totalBytes: effectivePlan.estimatedTotalBytes ?? state.totalBytes,
      bytesDownloaded: session
        ? state.bytesDownloaded
        : effectivePlan.estimatedTotalBytes !== undefined && progress !== undefined
          ? Math.round(effectivePlan.estimatedTotalBytes * progress)
          : state.bytesDownloaded,
      resumable:
        !runtimeAllCached &&
        (state.status === 'paused' ||
          state.status === 'error' ||
          hasPartialCache ||
          (progress !== undefined && progress > 0 && progress < 1)),
      files,
      updatedAt: this.now(),
      installedAt: runtimeAllCached ? (state.installedAt ?? this.now()) : state.installedAt,
    })
  }

  private async runDownload(
    modelId: string,
    targetStatus: 'downloading',
    messagePrefix: string,
    selectedGroupId?: string
  ): Promise<{ sessionId: string }> {
    const existing = this.sessions.get(modelId)
    if (existing) return { sessionId: existing.sessionId }
    const sessionId = `nmt-model-${sanitizeId(modelId)}-${this.now()}`
    const abortController = new AbortController()
    this.sessions.set(modelId, { modelId, sessionId, abortController, selectedGroupId })
    const current = await this.readSelectedModelState(modelId)
    const transformers = await this.getTransformersModule()
    const plan = await this.readPlan(
      modelId,
      transformers,
      selectedGroupId ?? current.plan?.selectedGroupId
    )
    if (!plan || plan.files.length === 0 || plan.estimatedTotalBytes === undefined) {
      this.sessions.delete(modelId)
      throw new Error('No concrete NMT download plan is available.')
    }
    const totalBytes = plan.estimatedTotalBytes
    const nextState = NmtModelAssetStateSchema.parse({
      ...current,
      modelId,
      plan,
      status: targetStatus,
      selected: true,
      totalBytes,
      resumable: true,
      files:
        plan?.files.map((file) => ({
          path: file.path,
          sizeBytes: file.sizeBytes,
          downloadedBytes: undefined,
        })) ?? [],
      updatedAt: this.now(),
    })
    await this.store.upsert(nextState)
    this.emitLog({
      engineId: 'nmt',
      modelId,
      selectedGroupId: nextState.plan?.selectedGroupId,
      status: targetStatus,
      message: `${messagePrefix} ${modelId}.`,
      progress: nextState.progress,
      bytesDownloaded: nextState.bytesDownloaded,
      totalBytes,
      sessionId,
      resumable: true,
      files: nextState.files,
      updatedAt: this.now(),
    })
    void this.performDownload(modelId, sessionId, abortController.signal, nextState).catch(
      (error) =>
        void this.finishDownload(
          modelId,
          sessionId,
          false,
          error instanceof Error ? error.message : String(error)
        )
    )
    return { sessionId }
  }

  private async performDownload(
    modelId: string,
    sessionId: string,
    signal: AbortSignal,
    state: NmtModelAssetState
  ): Promise<void> {
    const transformers = await this.getTransformersModule()
    await configureTransformersRuntime(transformers, this.cacheDir)
    transformers.env.remoteHost = buildTransformersRemoteHost(await this.readHuggingFaceEndpoint())
    const selectedGroup = selectNmtDownloadGroup(state.plan ?? null, state.plan?.selectedGroupId)
    const files = selectedGroup?.files ?? state.plan?.files ?? []
    const totalBytes = selectedGroup?.estimatedTotalBytes ?? state.plan?.estimatedTotalBytes
    const hfEndpoint = normalizeHuggingFaceEndpoint(await this.readHuggingFaceEndpoint())
    const downloadedFiles: NmtModelAssetState['files'] = files.map((file) => ({
      path: file.path,
      sizeBytes: file.sizeBytes,
      downloadedBytes: 0,
    }))
    let bytesDownloaded = 0

    if (files.length === 0) {
      throw new Error('No concrete NMT download files were selected.')
    }

    for (const [fileIndex, file] of files.entries()) {
      throwIfAborted(signal)
      const previousFileBytes = downloadedFiles[fileIndex]?.downloadedBytes ?? 0
      bytesDownloaded -= previousFileBytes
      downloadedFiles[fileIndex] = {
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: 0,
      }
      await this.emitDownloadProgress({
        modelId,
        sessionId,
        state,
        message: `Downloading ${file.path}.`,
        totalBytes,
        bytesDownloaded,
        files: downloadedFiles,
      })
      const cachedPath = await downloadHuggingFaceFileToCacheDirWithProgress({
        repo: { type: 'model', name: modelId },
        path: file.path,
        cacheDir: this.cacheDir,
        hubUrl: hfEndpoint,
        expectedSizeBytes: file.sizeBytes,
        fetch: createAbortableFetch(signal),
        onProgress: async (fileBytesDownloaded) => {
          throwIfAborted(signal)
          const boundedFileBytes = file.sizeBytes
            ? Math.min(file.sizeBytes, fileBytesDownloaded)
            : fileBytesDownloaded
          downloadedFiles[fileIndex] = {
            path: file.path,
            sizeBytes: file.sizeBytes,
            downloadedBytes: boundedFileBytes,
          }
          await this.emitDownloadProgress({
            modelId,
            sessionId,
            state,
            message: `Downloading ${file.path}.`,
            totalBytes,
            bytesDownloaded: bytesDownloaded + boundedFileBytes,
            files: downloadedFiles,
          })
        },
      })
      await mirrorHubCacheFileForTransformers({
        cacheDir: this.cacheDir,
        modelId,
        filePath: file.path,
        cachedPath,
      })
      throwIfAborted(signal)
      const nextDownloadedBytes = file.sizeBytes ?? 0
      bytesDownloaded += nextDownloadedBytes
      downloadedFiles[fileIndex] = {
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: file.sizeBytes,
      }
      await this.emitDownloadProgress({
        modelId,
        sessionId,
        state,
        message: `Downloaded ${file.path}.`,
        totalBytes,
        bytesDownloaded,
        files: downloadedFiles,
      })
    }

    await this.finishDownload(modelId, sessionId, true, `NMT model ${modelId} is ready.`)
  }

  private async emitDownloadProgress(input: {
    modelId: string
    sessionId: string
    state: NmtModelAssetState
    message: string
    totalBytes?: number
    bytesDownloaded: number
    files: NmtModelAssetState['files']
  }): Promise<void> {
    if (!this.isActiveSession(input.modelId, input.sessionId)) return
    const progress =
      input.totalBytes && input.totalBytes > 0
        ? Math.max(0, Math.min(1, input.bytesDownloaded / input.totalBytes))
        : undefined
    const nextState = NmtModelAssetStateSchema.parse({
      ...input.state,
      status: 'downloading',
      progress,
      bytesDownloaded: input.bytesDownloaded,
      totalBytes: input.totalBytes,
      files: input.files,
      updatedAt: this.now(),
      resumable: true,
    })
    await this.store.upsert(nextState)
    this.emitLog({
      engineId: 'nmt',
      modelId: input.modelId,
      selectedGroupId: input.state.plan?.selectedGroupId,
      status: 'downloading',
      message: input.message,
      progress,
      bytesDownloaded: input.bytesDownloaded,
      totalBytes: input.totalBytes,
      files: input.files,
      sessionId: input.sessionId,
      resumable: true,
      updatedAt: this.now(),
    })
  }

  private async finishDownload(
    modelId: string,
    sessionId: string,
    success: boolean,
    message: string
  ): Promise<void> {
    if (!this.isActiveSession(modelId, sessionId)) return
    const current = await this.readSelectedModelState(modelId)
    const nextState = NmtModelAssetStateSchema.parse({
      ...current,
      status: success ? 'downloaded' : 'error',
      progress: success ? 1 : current.progress,
      bytesDownloaded: success
        ? (current.totalBytes ?? current.bytesDownloaded)
        : current.bytesDownloaded,
      totalBytes: current.totalBytes,
      installedAt: success ? this.now() : current.installedAt,
      updatedAt: this.now(),
      error: success ? undefined : message,
      resumable: !success,
    })
    await this.store.upsert(nextState)
    this.sessions.delete(modelId)
    this.emitLog({
      engineId: 'nmt',
      modelId,
      selectedGroupId: nextState.plan?.selectedGroupId,
      status: nextState.status,
      message,
      progress: nextState.progress,
      bytesDownloaded: nextState.bytesDownloaded,
      totalBytes: nextState.totalBytes,
      sessionId,
      resumable: nextState.resumable,
      files: nextState.files,
      updatedAt: this.now(),
    })
  }

  private async readPlan(
    modelId: string,
    transformers: TransformersModule,
    selectedGroupId?: string
  ): Promise<ResolvedNmtModelPlan | null> {
    return resolveNmtModelRuntimePlan({
      modelId,
      transformers,
      cacheDir: this.cacheDir,
      selectedGroupId: selectedGroupId ?? (await this.readSelectedGroupId()),
      hfEndpoint: await this.readHuggingFaceEndpoint(),
      fetchCacheStore: this.fetchCacheStore,
    }).catch(() => null)
  }

  private async readPlanForState(
    modelId: string,
    selectedGroupId?: string
  ): Promise<ResolvedNmtModelPlan | null> {
    const transformers = await this.getTransformersModule()
    transformers.env.remoteHost = buildTransformersRemoteHost(await this.readHuggingFaceEndpoint())
    return this.readPlan(modelId, transformers, selectedGroupId)
  }

  private async readSelectedModel(): Promise<string> {
    const settings = await this.options.globalSettingsManager.readSettings()
    return settings.translationEngines.nmt.model
  }

  private async readSelectedGroupId(): Promise<string | undefined> {
    const settings = await this.options.globalSettingsManager.readSettings()
    return settings.translationEngines.nmt.selectedGroupId
  }

  private async readHuggingFaceEndpoint(): Promise<string> {
    const settings = await this.options.globalSettingsManager.readSettings()
    return settings.translationEngines.nmt.hfEndpoint
  }

  private isActiveSession(modelId: string, sessionId: string): boolean {
    return this.sessions.get(modelId)?.sessionId === sessionId
  }

  private emitLog(log: NmtModelAssetLog): void {
    this.logs.set(log.modelId, log)
    for (const listener of this.listeners) {
      listener(log)
    }
  }

  private async getTransformersModule(): Promise<TransformersModule> {
    if (!this.transformersModulePromise) {
      this.transformersModulePromise = this.loadTransformersModule()
    }
    return this.transformersModulePromise
  }

  private async loadTransformersModule(): Promise<TransformersModule> {
    const manifest = getTranslationEngineManifest('nmt')
    const localPackage = await this.resolveLocalPackage(manifest)
    if (localPackage) {
      const requireFromLocalPackage = createRequire(localPackage)
      return import(
        pathToFileURL(requireFromLocalPackage.resolve('@huggingface/transformers')).href
      ) as Promise<TransformersModule>
    }
    const installedEntry = await this.resolveInstalledExtensionEntry(manifest)
    const requireFromInstalledExtension = createRequire(installedEntry)
    return import(
      pathToFileURL(requireFromInstalledExtension.resolve('@huggingface/transformers')).href
    ) as Promise<TransformersModule>
  }

  private async resolveInstalledExtensionEntry(
    manifest: TranslationEngineManifest
  ): Promise<string> {
    const packageName = manifest.aliasName ?? manifest.packageName
    if (!packageName) {
      throw new Error(`Translation engine ${manifest.id} has no runtime package name.`)
    }
    const installRoot = await this.resolveInstallRoot()
    const requireFromInstallRoot = createRequire(join(installRoot, 'package.json'))
    return requireFromInstallRoot.resolve(packageName)
  }

  private async resolveInstallRoot(): Promise<string> {
    const settings = await this.options.globalSettingsManager.readSettings()
    return (
      settings.translationEngines.extensions.installRoot ??
      join(dirname(getDefaultGlobalSettingsPath()), 'extensions')
    )
  }

  private async resolveLocalPackage(manifest: TranslationEngineManifest): Promise<string | null> {
    if (!manifest.packageName) return null
    const packageDir = resolve(
      this.moduleDir,
      '..',
      '..',
      manifest.packageName.replace('@openspecui/', '')
    )
    const source = join(packageDir, 'src', 'index.ts')
    const dist = join(packageDir, 'dist', 'index.mjs')
    const candidates = basename(this.moduleDir) === 'src' ? [source, dist] : [dist, source]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
    return null
  }
}

function createAbortableFetch(signal: AbortSignal): typeof fetch {
  return (input, init) =>
    fetch(input, {
      ...init,
      signal: mergeAbortSignals(init?.signal, signal),
    })
}

function mergeAbortSignals(left: AbortSignal | null | undefined, right: AbortSignal): AbortSignal {
  if (!left) return right
  if (left === right) return right
  const controller = new AbortController()
  const abort = () => controller.abort()
  left.addEventListener('abort', abort, { once: true })
  right.addEventListener('abort', abort, { once: true })
  if (left.aborted || right.aborted) controller.abort()
  return controller.signal
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error('NMT model download aborted.')
  }
}

async function downloadHuggingFaceFileToCacheDirWithProgress(input: {
  repo: { type: 'model'; name: string }
  path: string
  cacheDir: string
  hubUrl: string
  expectedSizeBytes?: number
  fetch: typeof fetch
  onProgress: (downloadedBytes: number) => Promise<void>
}): Promise<string> {
  const revision = 'main'
  const totalBytes =
    input.expectedSizeBytes ??
    (
      await fileDownloadInfo({
        repo: input.repo,
        path: input.path,
        revision,
        hubUrl: input.hubUrl,
        fetch: input.fetch,
      })
    )?.size
  if (totalBytes === undefined) throw new Error(`Cannot get path info for ${input.path}.`)

  const cachedPath = await downloadFileToCacheDir({
    repo: input.repo,
    path: input.path,
    revision,
    hubUrl: input.hubUrl,
    cacheDir: input.cacheDir,
    fetch: createProgressFetch(input.fetch, input.onProgress, totalBytes),
  })
  await input.onProgress(totalBytes)
  return cachedPath
}

function createProgressFetch(
  baseFetch: typeof fetch,
  onProgress: (downloadedBytes: number) => Promise<void>,
  fallbackTotalBytes: number
): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init)
    if (!response.body || hasRangeHeader(init?.headers) || !isHuggingFaceResolveUrl(input)) {
      return response
    }
    const contentLength = Number(response.headers.get('content-length'))
    const totalBytes =
      Number.isFinite(contentLength) && contentLength > 0 ? contentLength : fallbackTotalBytes
    return new Response(createProgressReadableStream(response.body, onProgress, totalBytes), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }
}

function isHuggingFaceResolveUrl(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return /\/(?:resolve|raw)\//.test(url) && !/\/api\//.test(url)
}

function hasRangeHeader(headers: HeadersInit | undefined): boolean {
  if (!headers) return false
  if (headers instanceof Headers) return headers.has('Range')
  if (Array.isArray(headers)) {
    return headers.some(([name]) => name.toLowerCase() === 'range')
  }
  return Object.keys(headers).some((name) => name.toLowerCase() === 'range')
}

function createProgressReadableStream(
  body: ReadableStream<Uint8Array>,
  onProgress: (downloadedBytes: number) => Promise<void>,
  totalBytes: number
): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  let downloadedBytes = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const result = await reader.read()
      if (result.done) {
        controller.close()
        return
      }
      downloadedBytes += result.value.byteLength
      await onProgress(Math.min(downloadedBytes, totalBytes))
      controller.enqueue(result.value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })
}

async function mirrorHubCacheFileForTransformers(input: {
  cacheDir: string
  modelId: string
  filePath: string
  cachedPath: string
}): Promise<void> {
  const sourcePath = await resolveRealCacheFile(input.cachedPath)
  await copyFileIfMissing(
    sourcePath,
    join(getTransformersLocalModelPath(input.cacheDir, input.modelId), input.filePath)
  )
  await copyFileIfMissing(
    sourcePath,
    join(getTransformersFileCacheModelPath(input.cacheDir, input.modelId), input.filePath)
  )
}

async function copyFileIfMissing(sourcePath: string, targetPath: string): Promise<void> {
  if (existsSync(targetPath)) return
  await mkdir(dirname(targetPath), { recursive: true })
  await copyFile(sourcePath, targetPath)
}

async function readSymlinkTarget(path: string): Promise<string> {
  return readlink(path)
}

async function resolveRealCacheFile(path: string): Promise<string> {
  const stat = await lstat(path)
  if (!stat.isSymbolicLink()) return path
  return resolve(dirname(path), await readSymlinkTarget(path))
}

function getHubCacheRepoPath(cacheDir: string, modelId: string): string {
  return join(cacheDir, `models--${modelId.split('/').join('--')}`)
}

function toCatalogItem(
  candidate: TranslationModelCandidate,
  asset: NmtModelAssetState
): NmtModelCatalogItem {
  const hasSelectableGroup = candidate.downloadGroups?.some((group) => group.selectable) ?? false
  return {
    ...candidate,
    asset,
    selectable: hasSelectableGroup || (candidate.size.estimatedTotalBytes ?? 0) > 0,
    local:
      asset.status === 'downloaded' ||
      asset.status === 'paused' ||
      asset.status === 'downloading' ||
      (asset.progress ?? 0) > 0,
  }
}

function compareCatalogItems(left: NmtModelCatalogItem, right: NmtModelCatalogItem): number {
  if (left.local !== right.local) return left.local ? -1 : 1
  if (left.asset.selected !== right.asset.selected) return left.asset.selected ? -1 : 1
  const rightProgress = right.asset.progress ?? 0
  const leftProgress = left.asset.progress ?? 0
  if (left.local && right.local && leftProgress !== rightProgress)
    return rightProgress - leftProgress
  return right.downloads - left.downloads
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-')
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const digits = size >= 100 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(digits)} ${units[unitIndex]}`
}
