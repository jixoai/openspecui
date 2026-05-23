import { downloadFile, fileDownloadInfo } from '@huggingface/hub'
import type {
  ConfigManager,
  LocalModelAssetLog,
  LocalModelAssetState,
  LocalModelCatalogItem,
  LocalModelCatalogLocalResult,
  LocalModelCatalogResult,
  LocalModelCatalogSearchEvent,
  TranslationModelCandidate,
  TranslationModelSearchInput,
  TranslationModelSearchResult,
} from '@openspecui/core'
import { LocalModelAssetStateSchema, selectLocalDownloadGroup } from '@openspecui/core'
import { observable } from '@trpc/server/observable'
import { existsSync } from 'node:fs'
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  unlink,
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import {
  buildTransformersRemoteHost,
  normalizeHuggingFaceEndpoint,
} from './huggingface-endpoint.js'
import { LocalModelAssetStore } from './local-model-asset-store.js'
import {
  getDefaultLocalModelCacheDir,
  getDefaultLocalModelFetchCachePath,
  getDefaultLocalModelIndexPath,
} from './local-model-cache-path.js'
import { LocalModelFetchCacheStore } from './local-model-fetch-cache-store.js'
import {
  getTransformersFileCacheModelPath,
  getTransformersLocalModelPath,
  readLocalModelFileStatus,
} from './local-model-local-cache.js'
import {
  configureTransformersRuntime,
  resolveLocalModelRuntimePlan,
  type TransformersRuntimeModule,
} from './local-model-runtime.js'
import { ensureProxyAwareFetchDispatcher } from './network-dispatcher.js'
import { isRetryableNetworkError } from './network-retry.js'
import {
  searchLocalModels,
  searchLocalModelsProgressively,
  type ResolvedLocalModelPlan,
} from './translation-model-catalog.js'

interface GlobalSettingsManagerLike {
  readSettings(): Promise<{
    translationEngines: {
      local: {
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

type LogListener = (log: LocalModelAssetLog) => void

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

const DEFAULT_NETWORK_RETRY_LIMIT = Number.POSITIVE_INFINITY
const DEFAULT_NETWORK_RETRY_DELAY_MS = 500
const DEFAULT_NETWORK_RETRY_DELAY_MAX_MS = 5_000

interface LocalModelNetworkRetryPolicy {
  limit?: number
  delayMs?: number
  maxDelayMs?: number
}

export interface LocalModelAssetServiceOptions {
  projectDir: string
  configManager: ConfigManager
  globalSettingsManager: GlobalSettingsManagerLike
  now?: () => number
  indexPath?: string
  cacheDir?: string
  fetchCachePath?: string
  networkRetryPolicy?: LocalModelNetworkRetryPolicy
}

export class LocalModelAssetService {
  private readonly now: () => number
  private readonly store: LocalModelAssetStore
  private readonly cacheDir: string
  private readonly fetchCacheStore: LocalModelFetchCacheStore
  private readonly networkRetryPolicy: Required<LocalModelNetworkRetryPolicy>
  private readonly listeners = new Set<LogListener>()
  private readonly sessions = new Map<string, DownloadSession>()
  private readonly sessionTasks = new Map<string, Promise<void>>()
  private readonly logs = new Map<string, LocalModelAssetLog>()
  private transformersModulePromise: Promise<TransformersModule> | null = null

  constructor(private readonly options: LocalModelAssetServiceOptions) {
    ensureProxyAwareFetchDispatcher()
    this.now = options.now ?? Date.now
    this.cacheDir = options.cacheDir ?? getDefaultLocalModelCacheDir()
    this.networkRetryPolicy = {
      limit: options.networkRetryPolicy?.limit ?? DEFAULT_NETWORK_RETRY_LIMIT,
      delayMs: options.networkRetryPolicy?.delayMs ?? DEFAULT_NETWORK_RETRY_DELAY_MS,
      maxDelayMs: options.networkRetryPolicy?.maxDelayMs ?? DEFAULT_NETWORK_RETRY_DELAY_MAX_MS,
    }
    this.store = new LocalModelAssetStore({
      indexPath: options.indexPath ?? getDefaultLocalModelIndexPath(),
    })
    this.fetchCacheStore = new LocalModelFetchCacheStore({
      cachePath: options.fetchCachePath ?? getDefaultLocalModelFetchCachePath(),
      now: this.now,
    })
  }

  subscribeLogs() {
    return observable<LocalModelAssetLog>((emit) => {
      for (const log of this.logs.values()) {
        emit.next(log)
      }
      const listener = (log: LocalModelAssetLog) => emit.next(log)
      this.listeners.add(listener)
      return () => {
        this.listeners.delete(listener)
      }
    })
  }

  async listLocalCatalog(): Promise<LocalModelCatalogLocalResult> {
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

  async searchRemoteCatalog(input: TranslationModelSearchInput): Promise<LocalModelCatalogResult> {
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
    return observable<LocalModelCatalogSearchEvent>((emit) => {
      let active = true
      void (async () => {
        try {
          const events = await searchLocalModelsProgressively(input, {
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
            message:
              error instanceof Error ? error.message : 'Unable to search remote local models.',
          })
        }
      })()
      return () => {
        active = false
      }
    })
  }

  async listCatalog(input: TranslationModelSearchInput): Promise<LocalModelCatalogResult> {
    return this.searchRemoteCatalog(input)
  }

  async readSelectedModelState(
    modelId: string,
    selectedGroupId?: string
  ): Promise<LocalModelAssetState> {
    const state = (await this.store.readMap()).get(modelId)
    if (state) return this.refreshCachedState(state, selectedGroupId)
    const session = this.sessions.get(modelId)
    if (session) {
      const selected = modelId === (await this.readSelectedModel())
      const plan = await this.readPlanForState(modelId, selectedGroupId ?? session.selectedGroupId)
      const selectedGroup = selectLocalDownloadGroup(
        plan,
        selectedGroupId ?? session.selectedGroupId
      )
      const files = (selectedGroup?.files ?? plan?.files ?? []).map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: 0,
      }))
      return LocalModelAssetStateSchema.parse({
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
    return LocalModelAssetStateSchema.parse({
      modelId,
      status: 'not-downloaded',
      selected: modelId === (await this.readSelectedModel()),
      updatedAt: this.now(),
    })
  }

  async startDownload(modelId: string, selectedGroupId?: string): Promise<{ sessionId: string }> {
    return this.runDownload(modelId, 'downloading', 'Downloading local model', selectedGroupId)
  }

  async resumeDownload(modelId: string, selectedGroupId?: string): Promise<{ sessionId: string }> {
    return this.runDownload(
      modelId,
      'downloading',
      'Resuming local model download',
      selectedGroupId
    )
  }

  async pauseDownload(modelId: string): Promise<{ success: true }> {
    const session = this.sessions.get(modelId)
    if (session) {
      session.abortController.abort()
      this.sessions.delete(modelId)
    }
    const current = await this.readSelectedModelState(modelId)
    const nextState = LocalModelAssetStateSchema.parse({
      ...current,
      status: 'paused',
      resumable: true,
      updatedAt: this.now(),
    })
    await this.store.upsert(nextState)
    this.emitLog({
      engineId: 'local',
      modelId,
      selectedGroupId: current.plan?.selectedGroupId,
      status: 'paused',
      message: 'Local model download paused.',
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
      LocalModelAssetStateSchema.parse({
        ...current,
        status: 'deleting',
        updatedAt: this.now(),
      })
    )
    this.emitLog({
      engineId: 'local',
      modelId,
      selectedGroupId: current.plan?.selectedGroupId,
      status: 'deleting',
      message: 'Deleting local model files.',
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
      engineId: 'local',
      modelId,
      selectedGroupId: current.plan?.selectedGroupId,
      status: 'not-downloaded',
      message: 'Local model files were removed.',
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
      LocalModelAssetStateSchema.parse({
        ...state,
        selected: state.modelId === modelId,
      })
    )
    const existing = nextStates.some((state) => state.modelId === modelId)
    if (!existing) {
      nextStates.push(
        LocalModelAssetStateSchema.parse({
          modelId,
          status: 'not-downloaded',
          selected: true,
          updatedAt: this.now(),
        })
      )
    }
    await this.store.writeAll(nextStates)
  }

  async waitForModelTask(modelId: string): Promise<void> {
    await this.sessionTasks.get(modelId)
  }

  async close(): Promise<void> {
    const sessions = [...this.sessions.values()]
    for (const session of sessions) {
      session.abortController.abort()
    }
    await Promise.allSettled(this.sessionTasks.values())
  }

  private async searchRemote(
    input: TranslationModelSearchInput
  ): Promise<TranslationModelSearchResult> {
    return searchLocalModels(
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
    localMap: Map<string, LocalModelAssetState>,
    selectedModel: string,
    options: { includeLocalOnly?: boolean } = {}
  ): Promise<LocalModelCatalogItem[]> {
    const seen = new Set<string>()
    const remoteItems = await Promise.all(
      candidates.map(async (candidate) => {
        seen.add(candidate.id)
        const localState = localMap.get(candidate.id)
        const asset = localState
          ? await this.refreshCachedState(localState)
          : LocalModelAssetStateSchema.parse({
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
    state: LocalModelAssetState,
    selectedGroupId?: string
  ): Promise<LocalModelAssetState> {
    const requestedGroupId = selectedGroupId
    const session = this.sessions.get(state.modelId)
    const selected = state.selected || state.modelId === (await this.readSelectedModel())
    if (state.status === 'deleting') {
      return LocalModelAssetStateSchema.parse({
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
      const selectedGroup = selectLocalDownloadGroup(
        state.plan,
        requestedGroupId ?? state.plan.selectedGroupId
      )
      const files = (selectedGroup?.files ?? state.plan.files).map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: file.sizeBytes,
      }))
      return LocalModelAssetStateSchema.parse({
        ...state,
        selected,
        status: 'downloaded',
        progress: 1,
        bytesDownloaded: state.totalBytes ?? state.plan.estimatedTotalBytes,
        totalBytes: state.totalBytes ?? state.plan.estimatedTotalBytes,
        resumable: false,
        error: undefined,
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
      return LocalModelAssetStateSchema.parse({
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
    const selectedGroup = selectLocalDownloadGroup(
      effectivePlan,
      requestedGroupId ?? state.plan?.selectedGroupId ?? persistedSelectedGroupId
    )
    if (requestedGroupId && requestedGroupId !== effectivePlan.selectedGroupId && !selectedGroup) {
      return LocalModelAssetStateSchema.parse({
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
    const cacheStatus = await readLocalModelFileStatus({
      cacheDir: this.cacheDir,
      modelId: state.modelId,
      files: planFiles.map((file: { path: string }) => file.path),
    })
    const sameRequestedGroup =
      requestedGroupId === undefined || requestedGroupId === state.plan?.selectedGroupId
    const cachedFileSet = new Set(
      cacheStatus.files.filter((file) => file.cached).map((file) => file.file)
    )
    const runtimeAllCached = cacheStatus.allCached
    const files = planFiles.map((file) => {
      const cached = cachedFileSet.has(file.path)
      const existingFile = state.files.find((entry) => entry.path === file.path)
      const existingDownloadedBytes = existingFile?.downloadedBytes ?? 0
      const downloadedBytes =
        file.sizeBytes === undefined
          ? cached
            ? existingDownloadedBytes
            : existingDownloadedBytes
          : cached
            ? file.sizeBytes
            : Math.min(existingDownloadedBytes, file.sizeBytes)
      return {
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes,
      }
    })
    const detectedBytesDownloaded = sumDownloadedBytes(files)
    const detectedProgress =
      effectivePlan.estimatedTotalBytes !== undefined && effectivePlan.estimatedTotalBytes > 0
        ? detectedBytesDownloaded / effectivePlan.estimatedTotalBytes
        : runtimeAllCached
          ? 1
          : undefined
    const progress = cacheStatus.allCached ? 1 : session ? state.progress : detectedProgress
    const hasPartialCache = !runtimeAllCached && detectedBytesDownloaded > 0
    return LocalModelAssetStateSchema.parse({
      ...state,
      selected,
      plan: effectivePlan,
      status: runtimeAllCached
        ? 'downloaded'
        : session
          ? state.status
          : sameRequestedGroup && state.status === 'paused'
            ? 'paused'
            : sameRequestedGroup && state.status === 'error'
              ? 'error'
              : hasPartialCache
                ? 'paused'
                : 'not-downloaded',
      progress: progress === undefined ? undefined : Math.max(0, Math.min(1, progress)),
      totalBytes: effectivePlan.estimatedTotalBytes ?? state.totalBytes,
      bytesDownloaded: session ? state.bytesDownloaded : detectedBytesDownloaded,
      error: runtimeAllCached ? undefined : state.error,
      resumable: runtimeAllCached
        ? false
        : (sameRequestedGroup && state.status === 'paused') ||
          (sameRequestedGroup && state.status === 'error') ||
          hasPartialCache ||
          (progress !== undefined && progress > 0 && progress < 1),
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
    const sessionId = `local-model-${sanitizeId(modelId)}-${this.now()}`
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
      throw new Error('No concrete local model download plan is available.')
    }
    const totalBytes = plan.estimatedTotalBytes
    const resumedFiles = buildDownloadStateFiles({
      planFiles: plan.files,
      currentFiles: current.files,
    })
    const resumedBytesDownloaded = sumDownloadedBytes(resumedFiles)
    const nextState = LocalModelAssetStateSchema.parse({
      ...current,
      modelId,
      plan,
      status: targetStatus,
      selected: true,
      bytesDownloaded: resumedBytesDownloaded,
      progress: totalBytes > 0 ? resumedBytesDownloaded / totalBytes : current.progress,
      totalBytes,
      resumable: true,
      files: resumedFiles,
      updatedAt: this.now(),
    })
    await this.store.upsert(nextState)
    this.emitLog({
      engineId: 'local',
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
    const task = this.performDownload(modelId, sessionId, abortController.signal, nextState)
      .catch((error) =>
        this.finishDownload(
          modelId,
          sessionId,
          false,
          error instanceof Error ? error.message : String(error)
        )
      )
      .finally(() => {
        if (this.sessionTasks.get(modelId) === task) {
          this.sessionTasks.delete(modelId)
        }
      })
    this.sessionTasks.set(modelId, task)
    return { sessionId }
  }

  private async performDownload(
    modelId: string,
    sessionId: string,
    signal: AbortSignal,
    state: LocalModelAssetState
  ): Promise<void> {
    const transformers = await this.getTransformersModule()
    await configureTransformersRuntime(transformers, this.cacheDir)
    transformers.env.remoteHost = buildTransformersRemoteHost(await this.readHuggingFaceEndpoint())
    const selectedGroup = selectLocalDownloadGroup(state.plan ?? null, state.plan?.selectedGroupId)
    const files = selectedGroup?.files ?? state.plan?.files ?? []
    const totalBytes = selectedGroup?.estimatedTotalBytes ?? state.plan?.estimatedTotalBytes
    const hfEndpoint = normalizeHuggingFaceEndpoint(await this.readHuggingFaceEndpoint())
    const downloadedFiles = buildDownloadStateFiles({
      planFiles: files,
      currentFiles: state.files,
    })
    let bytesDownloaded = sumDownloadedBytes(downloadedFiles)

    if (files.length === 0) {
      throw new Error('No concrete local model download files were selected.')
    }

    for (const [fileIndex, file] of files.entries()) {
      throwIfAborted(signal)
      const previousFileBytes = downloadedFiles[fileIndex]?.downloadedBytes ?? 0
      if (file.sizeBytes !== undefined && previousFileBytes >= file.sizeBytes) {
        continue
      }
      downloadedFiles[fileIndex] = {
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: previousFileBytes,
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
        retryPolicy: this.networkRetryPolicy,
        fetch: createAbortableFetch(signal),
        signal,
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
            bytesDownloaded: bytesDownloaded - previousFileBytes + boundedFileBytes,
            files: downloadedFiles,
          })
        },
        onRetry: async ({ retryDelayMs, phase }) => {
          const retryTarget = phase === 'metadata' ? `metadata for ${file.path}` : `${file.path}`
          await this.emitDownloadProgress({
            modelId,
            sessionId,
            state,
            message: `Connection interrupted while downloading ${retryTarget}. Retrying automatically in ${formatDuration(retryDelayMs)}.`,
            totalBytes,
            bytesDownloaded:
              bytesDownloaded -
              previousFileBytes +
              (downloadedFiles[fileIndex]?.downloadedBytes ?? 0),
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
      bytesDownloaded = bytesDownloaded - previousFileBytes + nextDownloadedBytes
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

    await this.finishDownload(modelId, sessionId, true, `Local model ${modelId} is ready.`)
  }

  private async emitDownloadProgress(input: {
    modelId: string
    sessionId: string
    state: LocalModelAssetState
    message: string
    totalBytes?: number
    bytesDownloaded: number
    files: LocalModelAssetState['files']
  }): Promise<void> {
    if (!this.isActiveSession(input.modelId, input.sessionId)) return
    const progress =
      input.totalBytes && input.totalBytes > 0
        ? Math.max(0, Math.min(1, input.bytesDownloaded / input.totalBytes))
        : undefined
    const nextState = LocalModelAssetStateSchema.parse({
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
      engineId: 'local',
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
    const nextState = LocalModelAssetStateSchema.parse({
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
      engineId: 'local',
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
  ): Promise<ResolvedLocalModelPlan | null> {
    return resolveLocalModelRuntimePlan({
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
  ): Promise<ResolvedLocalModelPlan | null> {
    const transformers = await this.getTransformersModule()
    transformers.env.remoteHost = buildTransformersRemoteHost(await this.readHuggingFaceEndpoint())
    return this.readPlan(modelId, transformers, selectedGroupId)
  }

  private async readSelectedModel(): Promise<string> {
    const settings = await this.options.globalSettingsManager.readSettings()
    return settings.translationEngines.local.model
  }

  private async readSelectedGroupId(): Promise<string | undefined> {
    const settings = await this.options.globalSettingsManager.readSettings()
    return settings.translationEngines.local.selectedGroupId
  }

  private async readHuggingFaceEndpoint(): Promise<string> {
    const settings = await this.options.globalSettingsManager.readSettings()
    return settings.translationEngines.local.hfEndpoint
  }

  private isActiveSession(modelId: string, sessionId: string): boolean {
    return this.sessions.get(modelId)?.sessionId === sessionId
  }

  private emitLog(log: LocalModelAssetLog): void {
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
    return import('@huggingface/transformers') as Promise<TransformersModule>
  }
}

function buildDownloadStateFiles(input: {
  planFiles: ReadonlyArray<{ path: string; sizeBytes?: number }>
  currentFiles: ReadonlyArray<LocalModelAssetState['files'][number]>
}): LocalModelAssetState['files'] {
  const currentFileByPath = new Map(input.currentFiles.map((file) => [file.path, file]))
  return input.planFiles.map((file) => {
    const currentFile = currentFileByPath.get(file.path)
    const downloadedBytes = currentFile?.downloadedBytes
    return {
      path: file.path,
      sizeBytes: file.sizeBytes,
      downloadedBytes:
        downloadedBytes === undefined
          ? 0
          : file.sizeBytes === undefined
            ? downloadedBytes
            : Math.min(downloadedBytes, file.sizeBytes),
    }
  })
}

function sumDownloadedBytes(files: ReadonlyArray<LocalModelAssetState['files'][number]>): number {
  return files.reduce((total, file) => {
    const downloadedBytes = file.downloadedBytes ?? 0
    if (file.sizeBytes === undefined) return total + downloadedBytes
    return total + Math.min(downloadedBytes, file.sizeBytes)
  }, 0)
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
    throw new Error('Local model download aborted.')
  }
}

async function downloadHuggingFaceFileToCacheDirWithProgress(input: {
  repo: { type: 'model'; name: string }
  path: string
  cacheDir: string
  hubUrl: string
  expectedSizeBytes?: number
  retryPolicy: Required<LocalModelNetworkRetryPolicy>
  fetch: typeof fetch
  signal: AbortSignal
  onProgress: (downloadedBytes: number) => Promise<void>
  onRetry?: (input: { retryDelayMs: number; phase: 'metadata' | 'download' }) => Promise<void>
}): Promise<string> {
  const revision = 'main'
  let lastError: unknown
  const info = await readHuggingFaceFileDownloadInfoWithRetry({
    repo: input.repo,
    path: input.path,
    revision,
    hubUrl: input.hubUrl,
    retryPolicy: input.retryPolicy,
    fetch: input.fetch,
    signal: input.signal,
    onRetry: input.onRetry,
  })
  if (!info) throw new Error(`Cannot get path info for ${input.path}.`)
  const totalBytes = input.expectedSizeBytes ?? info.size
  if (totalBytes === undefined) throw new Error(`Cannot get path info for ${input.path}.`)
  const cachePaths = getHubCacheFilePaths({
    cacheDir: input.cacheDir,
    modelId: input.repo.name,
    filePath: input.path,
    revision,
    etag: info.etag,
  })

  const existingPointerSize = await readPathSize(cachePaths.pointerPath)
  if (existingPointerSize !== null && existingPointerSize >= totalBytes) {
    await input.onProgress(totalBytes)
    return cachePaths.pointerPath
  }

  for (let attempt = 0; attempt <= input.retryPolicy.limit; attempt += 1) {
    try {
      throwIfAborted(input.signal)
      let resumeBytes = await readPathSize(cachePaths.incompletePath)
      if (resumeBytes !== null && resumeBytes > totalBytes) {
        await rm(cachePaths.incompletePath, { force: true })
        resumeBytes = 0
      }
      if (resumeBytes !== null && resumeBytes > 0) {
        await input.onProgress(Math.min(resumeBytes, totalBytes))
      }
      const downloadedViaFetch = await streamDownloadToIncompleteFile({
        url: info.url,
        incompletePath: cachePaths.incompletePath,
        startBytes: resumeBytes ?? 0,
        totalBytes,
        accessToken: undefined,
        fetch: input.fetch,
        signal: input.signal,
        onProgress: input.onProgress,
      })
      if (!downloadedViaFetch) {
        const blob = await downloadFile({
          repo: input.repo,
          path: input.path,
          revision,
          hubUrl: input.hubUrl,
          fetch: input.fetch,
          downloadInfo: info,
          xet: false,
        })
        if (!blob) {
          throw new Error(`Invalid response for file ${input.path}.`)
        }

        const downloadBlob =
          resumeBytes && resumeBytes > 0 ? blob.slice(resumeBytes, totalBytes) : blob
        await appendBlobToIncompleteFile({
          blob: downloadBlob,
          incompletePath: cachePaths.incompletePath,
          startBytes: resumeBytes ?? 0,
          totalBytes,
          onProgress: input.onProgress,
        })
      }
      await finalizeHubCacheFile(cachePaths)
      await input.onProgress(totalBytes)
      return cachePaths.pointerPath
    } catch (error) {
      lastError = error
      if (!isRetryableDownloadError(error) || attempt === input.retryPolicy.limit) {
        throw error
      }
      const retryDelayMs = Math.min(
        input.retryPolicy.maxDelayMs,
        input.retryPolicy.delayMs * (attempt + 1)
      )
      await input.onRetry?.({ retryDelayMs, phase: 'download' })
      await delay(retryDelayMs, input.signal)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Cannot download ${input.path}.`)
}

async function readHuggingFaceFileDownloadInfoWithRetry(input: {
  repo: { type: 'model'; name: string }
  path: string
  revision: string
  hubUrl: string
  retryPolicy: Required<LocalModelNetworkRetryPolicy>
  fetch: typeof fetch
  signal: AbortSignal
  onRetry?: (input: { retryDelayMs: number; phase: 'metadata' | 'download' }) => Promise<void>
}) {
  let lastError: unknown
  for (let attempt = 0; attempt <= input.retryPolicy.limit; attempt += 1) {
    try {
      throwIfAborted(input.signal)
      return await fileDownloadInfo({
        repo: input.repo,
        path: input.path,
        revision: input.revision,
        hubUrl: input.hubUrl,
        fetch: input.fetch,
      })
    } catch (error) {
      lastError = error
      if (!isRetryableDownloadError(error) || attempt === input.retryPolicy.limit) {
        throw error
      }
      const retryDelayMs = Math.min(
        input.retryPolicy.maxDelayMs,
        input.retryPolicy.delayMs * (attempt + 1)
      )
      await input.onRetry?.({ retryDelayMs, phase: 'metadata' })
      await delay(retryDelayMs, input.signal)
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Cannot get path info for ${input.path}.`)
}

async function appendBlobToIncompleteFile(input: {
  blob: Blob
  incompletePath: string
  startBytes: number
  totalBytes: number
  onProgress: (downloadedBytes: number) => Promise<void>
}): Promise<void> {
  await mkdir(dirname(input.incompletePath), { recursive: true })
  const fileHandle = await open(input.incompletePath, 'a')
  const reader = input.blob.stream().getReader()
  let downloadedBytes = input.startBytes
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      await fileHandle.write(result.value)
      downloadedBytes += result.value.byteLength
      await input.onProgress(Math.min(downloadedBytes, input.totalBytes))
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    await fileHandle.close()
  }
}

async function streamDownloadToIncompleteFile(input: {
  url: string
  incompletePath: string
  startBytes: number
  totalBytes: number
  accessToken?: string
  fetch: typeof fetch
  signal: AbortSignal
  onProgress: (downloadedBytes: number) => Promise<void>
}): Promise<boolean> {
  const headers = new Headers()
  if (input.accessToken) {
    headers.set('Authorization', `Bearer ${input.accessToken}`)
  }
  if (input.startBytes > 0) {
    headers.set('Range', `bytes=${input.startBytes}-`)
  }
  const response = await input.fetch(input.url, {
    method: 'GET',
    headers,
    signal: input.signal,
  })
  if (!response.ok && response.status !== 206) {
    throw new Error(`Invalid response for file download: status ${response.status}.`)
  }
  if (!response.body) {
    return false
  }

  await mkdir(dirname(input.incompletePath), { recursive: true })
  const fileHandle = await open(input.incompletePath, input.startBytes > 0 ? 'a' : 'w')
  const reader = response.body.getReader()
  let downloadedBytes = input.startBytes
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      await fileHandle.write(result.value)
      downloadedBytes += result.value.byteLength
      await input.onProgress(Math.min(downloadedBytes, input.totalBytes))
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    await fileHandle.close()
  }
  return true
}

async function finalizeHubCacheFile(input: {
  blobPath: string
  incompletePath: string
  pointerPath: string
}): Promise<void> {
  await mkdir(dirname(input.blobPath), { recursive: true })
  await mkdir(dirname(input.pointerPath), { recursive: true })
  await rm(input.blobPath, { force: true })
  await rename(input.incompletePath, input.blobPath)
  await unlink(input.pointerPath).catch(() => undefined)
  await symlink(input.blobPath, input.pointerPath)
}

interface HubCacheFilePaths {
  blobPath: string
  incompletePath: string
  pointerPath: string
}

function getHubCacheFilePaths(input: {
  cacheDir: string
  modelId: string
  filePath: string
  revision: string
  etag: string
}): HubCacheFilePaths {
  const repoPath = getHubCacheRepoPath(input.cacheDir, input.modelId)
  const snapshotId = sanitizeEtag(input.etag) || sanitizeId(input.revision)
  const blobPath = join(repoPath, 'blobs', sanitizeEtag(input.etag))
  return {
    blobPath,
    incompletePath: `${blobPath}.incomplete`,
    pointerPath: join(repoPath, 'snapshots', snapshotId, input.filePath),
  }
}

async function readPathSize(path: string): Promise<number | null> {
  try {
    const entry = await stat(path)
    return entry.size
  } catch {
    return null
  }
}

function isRetryableDownloadError(error: unknown): boolean {
  return isRetryableNetworkError(error, { treatUnknownAsRetryable: true })
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(new Error('Local model download aborted.'))
    }
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer)
        reject(new Error('Local model download aborted.'))
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms} ms`
  const seconds = ms / 1_000
  return seconds >= 10 ? `${Math.round(seconds)} s` : `${seconds.toFixed(1)} s`
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
  asset: LocalModelAssetState
): LocalModelCatalogItem {
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

function compareCatalogItems(left: LocalModelCatalogItem, right: LocalModelCatalogItem): number {
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

function sanitizeEtag(value: string): string {
  const normalized = value.replace(/^W\//, '').replace(/^"+|"+$/g, '')
  return sanitizeId(normalized)
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
