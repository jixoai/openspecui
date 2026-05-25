import { downloadFile, fileDownloadInfo } from '@huggingface/hub'
import type {
  ConfigManager,
  LocalModelAssetLog,
  LocalModelAssetState,
  LocalModelCatalogItem,
  LocalModelCatalogLocalResult,
  LocalModelCatalogResult,
  LocalModelCatalogSearchEvent,
  LocalModelDownloadStatus,
  LocalModelLifecycleFileState,
  LocalModelProfileManifest,
  LocalModelProfileManifestGroup,
  TranslationDownloadGroupPlan,
  TranslationModelCandidate,
  TranslationModelDownloadPlan,
  TranslationModelSearchInput,
  TranslationModelSearchResult,
} from '@openspecui/core'
import {
  buildLocalDownloadPlanFromRepositoryFiles,
  LocalModelAssetStateSchema,
  LocalModelLifecycleFileStateSchema,
  LocalModelLifecycleGroupStateSchema,
  LocalModelProfileManifestSchema,
  selectLocalDownloadGroup,
} from '@openspecui/core'
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
import { normalizeHuggingFaceEndpoint } from './huggingface-endpoint.js'
import { LocalModelAssetStore } from './local-model-asset-store.js'
import {
  getDefaultLocalModelCacheDir,
  getDefaultLocalModelFetchCachePath,
  getDefaultLocalModelIndexPath,
  getDefaultLocalModelProfileManifestPath,
  getLocalModelProfileGroupRoot,
} from './local-model-cache-path.js'
import { LocalModelFetchCacheStore } from './local-model-fetch-cache-store.js'
import { LocalModelProfileManifestStore } from './local-model-profile-manifest-store.js'
import {
  getTransformersFileCacheModelPath,
  getTransformersLocalModelPath,
} from './local-model-local-cache.js'
import {
  readLocalModelRepositorySnapshot,
  type TransformersRuntimeModule,
} from './local-model-runtime.js'
import { ensureProxyAwareFetchDispatcher } from './network-dispatcher.js'
import { isRetryableNetworkError } from './network-retry.js'
import {
  searchLocalModels,
  searchLocalModelsProgressively,
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
  groupId: string
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
  profileManifestPath?: string
  cacheDir?: string
  fetchCachePath?: string
  networkRetryPolicy?: LocalModelNetworkRetryPolicy
}

export class LocalModelAssetService {
  private readonly now: () => number
  private readonly store: LocalModelAssetStore
  private readonly profileManifestStore: LocalModelProfileManifestStore
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
    this.profileManifestStore = new LocalModelProfileManifestStore({
      manifestPath: options.profileManifestPath ?? getDefaultLocalModelProfileManifestPath(),
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
    const selected = modelId === (await this.readSelectedModel())
    const baseState = LocalModelAssetStateSchema.parse({
      modelId,
      status: 'not-downloaded',
      selected,
      selectedGroupId,
      updatedAt: this.now(),
    })
    return this.refreshCachedState(baseState, selectedGroupId)
  }

  async startDownload(modelId: string, groupId?: string): Promise<{ sessionId: string }> {
    return this.runDownload(modelId, 'downloading', 'Downloading local model', groupId)
  }

  async resumeDownload(modelId: string, groupId?: string): Promise<{ sessionId: string }> {
    return this.runDownload(
      modelId,
      'downloading',
      'Resuming local model download',
      groupId
    )
  }

  async pauseDownload(modelId: string, groupId?: string): Promise<{ success: true }> {
    const requestedGroupId = groupId ?? (await this.readSelectedGroupId())
    if (!requestedGroupId) return { success: true }
    const current = await this.readSelectedModelState(modelId, requestedGroupId)
    const effectiveGroupId = current.plan?.selectedGroupId ?? current.selectedGroupId ?? requestedGroupId
    const sessionKey = buildSessionKey(modelId, effectiveGroupId)
    const session = this.sessions.get(sessionKey)
    if (session) {
      session.abortController.abort()
      this.sessions.delete(sessionKey)
    }
    const nextGroupsState = {
      ...current.groupsState,
      [effectiveGroupId]: LocalModelLifecycleGroupStateSchema.parse({
        ...current.groupsState[effectiveGroupId],
        groupId: effectiveGroupId,
        status: 'paused',
        resumable: true,
        updatedAt: this.now(),
      }),
    }
    const nextState = LocalModelAssetStateSchema.parse({
      ...current,
      groupsState: nextGroupsState,
      updatedAt: this.now(),
    })
    const projected = await this.refreshCachedState(nextState, effectiveGroupId)
    await this.store.upsert(projected)
    this.emitLog({
      engineId: 'local',
      modelId,
      selectedGroupId: effectiveGroupId,
      groupId: effectiveGroupId,
      status: 'paused',
      message: 'Local model download paused.',
      progress: projected.progress,
      bytesDownloaded: projected.bytesDownloaded,
      totalBytes: projected.totalBytes,
      resumable: true,
      files: projected.files,
      updatedAt: this.now(),
    })
    return { success: true }
  }

  async deleteModel(modelId: string, groupId?: string): Promise<{ success: true }> {
    const requestedGroupId = groupId ?? (await this.readSelectedGroupId())
    if (!requestedGroupId) {
      await this.store.remove(modelId)
      await this.profileManifestStore.remove(modelId)
      return { success: true }
    }
    const current = await this.readSelectedModelState(modelId, requestedGroupId)
    const effectiveGroupId = current.plan?.selectedGroupId ?? current.selectedGroupId ?? requestedGroupId
    const sessionKey = buildSessionKey(modelId, effectiveGroupId)
    const session = this.sessions.get(sessionKey)
    session?.abortController.abort()
    this.sessions.delete(sessionKey)
    await this.store.upsert(
      LocalModelAssetStateSchema.parse({
        ...current,
        groupsState: {
          ...current.groupsState,
          [effectiveGroupId]: LocalModelLifecycleGroupStateSchema.parse({
            ...current.groupsState[effectiveGroupId],
            groupId: effectiveGroupId,
            status: 'deleting',
            updatedAt: this.now(),
          }),
        },
        updatedAt: this.now(),
      })
    )
    this.emitLog({
      engineId: 'local',
      modelId,
      selectedGroupId: effectiveGroupId,
      groupId: effectiveGroupId,
      status: 'deleting',
      message: 'Deleting local model files.',
      files: current.files,
      updatedAt: this.now(),
    })
    await rm(getLocalModelProfileGroupRoot(this.cacheDir, modelId, effectiveGroupId), {
      recursive: true,
      force: true,
    })
    const persistedManifest = await this.profileManifestStore.read(modelId)
    const nextGroupsState = { ...current.groupsState }
    delete nextGroupsState[effectiveGroupId]
    const isPersistedManifestGroup = Boolean(persistedManifest?.groups[effectiveGroupId])
    const nextManifest = isPersistedManifestGroup
      ? persistedManifest
      : current.profileManifest
        ? removeManifestGroup(current.profileManifest, effectiveGroupId)
        : undefined
    const nextPlan = isPersistedManifestGroup
      ? undefined
      : current.plan
        ? removePlanGroup(current.plan, effectiveGroupId)
        : undefined
    const nextSelectedGroupId =
      current.selectedGroupId === effectiveGroupId ? undefined : current.selectedGroupId
    const nextState = await this.refreshCachedState(
      LocalModelAssetStateSchema.parse({
        ...current,
        selectedGroupId: nextSelectedGroupId,
        profileManifest: nextManifest,
        groupsState: nextGroupsState,
        plan: nextPlan,
        updatedAt: this.now(),
      }),
      nextSelectedGroupId
    )
    if (nextState.profileManifest) {
      await this.profileManifestStore.upsert(nextState.profileManifest)
    } else {
      await this.profileManifestStore.remove(modelId)
    }
    if (nextState.profileManifest || nextState.plan?.groups?.length) {
      await this.store.upsert(nextState)
    } else {
      await this.store.remove(modelId)
    }
    this.emitLog({
      engineId: 'local',
      modelId,
      selectedGroupId: effectiveGroupId,
      groupId: effectiveGroupId,
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

  async refreshProfiles(modelId?: string): Promise<LocalModelAssetState> {
    const targetModelId = modelId ?? (await this.readSelectedModel())
    const loadingState = LocalModelAssetStateSchema.parse({
      ...(await this.readSelectedModelState(targetModelId)),
      profileLoad: {
        status: 'loading',
        message: 'Loading local model profiles.',
        updatedAt: this.now(),
      },
      updatedAt: this.now(),
    })
    await this.store.upsert(loadingState)
    try {
      const manifest = await this.createProfileManifest(targetModelId)
      await this.profileManifestStore.upsert(manifest)
      const current = await this.readSelectedModelState(targetModelId)
      const nextState = await this.refreshCachedState(
        LocalModelAssetStateSchema.parse({
          ...current,
          profileManifest: manifest,
          profileLoad: {
            status: 'ready',
            message: 'Local model profiles are ready.',
            updatedAt: this.now(),
          },
          updatedAt: this.now(),
        })
      )
      await this.store.upsert(nextState)
      return nextState
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load local model profiles.'
      const failedState = LocalModelAssetStateSchema.parse({
        ...(await this.readSelectedModelState(targetModelId)),
        profileLoad: {
          status: 'error',
          error: message,
          updatedAt: this.now(),
        },
        updatedAt: this.now(),
      })
      await this.store.upsert(failedState)
      throw error
    }
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
    await Promise.all(
      [...this.sessionTasks.entries()]
        .filter(([sessionKey]) => sessionKey.startsWith(`${modelId}:`))
        .map(([, task]) => task)
    )
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
    const [selectedModel, persistedSelectedGroupId] = await Promise.all([
      this.readSelectedModel(),
      this.readSelectedGroupId(),
    ])
    const selected = state.selected || state.modelId === selectedModel
    const selectedGroupIdFromSettings = selectedGroupId ?? persistedSelectedGroupId
    const manifest =
      state.profileManifest ?? (await this.profileManifestStore.read(state.modelId)) ?? undefined
    const migrated = migrateLegacyStateToGroups(state, manifest, this.now())
    const manifestWithHistoricalGroups = mergeHistoricalGroupsIntoManifest({
      cacheDir: this.cacheDir,
      modelId: state.modelId,
      manifest,
      groupsState: migrated.groupsState,
      fallbackPlan: migrated.plan,
    })
    const selectedGroupIdForProjection =
      resolveManifestGroupId(
        manifestWithHistoricalGroups,
        selectedGroupIdFromSettings ?? migrated.selectedGroupId ?? migrated.plan?.selectedGroupId
      ) ?? selectFirstManifestGroupId(manifestWithHistoricalGroups)
    const reconciledGroupsState = await this.reconcileGroupsFromDisk({
      modelId: state.modelId,
      manifest: manifestWithHistoricalGroups,
      groupsState: migrated.groupsState,
    })
    const plan = buildPlanFromManifest({
      modelId: state.modelId,
      manifest: manifestWithHistoricalGroups,
      groupsState: reconciledGroupsState,
      selectedGroupId: selectedGroupIdForProjection,
    })
    const selectedPlanGroup = selectLocalDownloadGroup(plan, selectedGroupIdForProjection)
    const selectedGroupState =
      selectedPlanGroup && reconciledGroupsState[selectedPlanGroup.id]
        ? reconciledGroupsState[selectedPlanGroup.id]
        : undefined
    const files =
      selectedPlanGroup?.files.map((file) => {
        const stateFile = selectedGroupState?.files.find((entry) => entry.path === file.path)
        return {
          path: file.path,
          sizeBytes: file.sizeBytes,
          downloadedBytes: stateFile?.downloadedBytes ?? 0,
        }
      }) ?? []
    const status = selectedGroupState?.status ?? 'not-downloaded'
    return LocalModelAssetStateSchema.parse({
      ...migrated,
      selected,
      selectedGroupId: selectedGroupIdForProjection,
      profileManifest: manifestWithHistoricalGroups,
      groupsState: reconciledGroupsState,
      plan: plan ?? undefined,
      status,
      progress: selectedGroupState?.progress,
      totalBytes: selectedGroupState?.totalBytes ?? selectedPlanGroup?.estimatedTotalBytes,
      bytesDownloaded: selectedGroupState?.bytesDownloaded,
      error: selectedGroupState?.error,
      resumable: selectedGroupState?.resumable ?? false,
      files,
      updatedAt: this.now(),
      installedAt: selectedGroupState?.installedAt ?? state.installedAt,
    })
  }

  private async reconcileGroupsFromDisk(input: {
    modelId: string
    manifest: LocalModelProfileManifest | undefined
    groupsState: LocalModelAssetState['groupsState']
  }): Promise<LocalModelAssetState['groupsState']> {
    if (!input.manifest) return input.groupsState
    const nextGroupsState: LocalModelAssetState['groupsState'] = { ...input.groupsState }
    for (const groupId of input.manifest.groupOrder) {
      const manifestGroup = input.manifest.groups[groupId]
      if (!manifestGroup) continue
      const current = nextGroupsState[groupId]
      if (isActiveDownloadStatus(current?.status ?? 'not-downloaded')) {
        nextGroupsState[groupId] = LocalModelLifecycleGroupStateSchema.parse({
          ...current,
          groupId,
          baseGroupId: manifestGroup.baseGroupId,
          rootDir: manifestGroup.rootDir,
          totalBytes: manifestGroup.estimatedTotalBytes,
          files: reconcileGroupFiles({
            manifestGroup,
            currentFiles: current?.files ?? [],
          }),
        })
        continue
      }
      const files = await reconcileGroupFilesFromDisk({
        rootDir: manifestGroup.rootDir,
        manifestGroup,
        currentFiles: current?.files ?? [],
      })
      const bytesDownloaded = sumDownloadedBytes(files)
      const totalBytes = manifestGroup.estimatedTotalBytes
      const allComplete =
        files.length > 0 &&
        files.every(
          (file) =>
            file.sizeBytes !== undefined &&
            (file.downloadedBytes ?? 0) >= file.sizeBytes &&
            file.status === 'downloaded'
        )
      const hasPartial = files.some((file) => (file.downloadedBytes ?? 0) > 0)
      const status: LocalModelDownloadStatus = allComplete
        ? 'downloaded'
        : current?.status === 'error'
          ? 'error'
          : current?.status === 'paused'
            ? 'paused'
          : hasPartial
            ? 'paused'
            : 'not-downloaded'
      nextGroupsState[groupId] = LocalModelLifecycleGroupStateSchema.parse({
        ...current,
        groupId,
        baseGroupId: manifestGroup.baseGroupId,
        status,
        rootDir: manifestGroup.rootDir,
        bytesDownloaded,
        totalBytes,
        progress:
          totalBytes && totalBytes > 0 ? Math.max(0, Math.min(1, bytesDownloaded / totalBytes)) : undefined,
        resumable: status === 'paused' || status === 'error',
        error: status === 'error' ? current?.error : undefined,
        installedAt: status === 'downloaded' ? (current?.installedAt ?? this.now()) : current?.installedAt,
        updatedAt: this.now(),
        files,
      })
    }
    return nextGroupsState
  }

  private async runDownload(
    modelId: string,
    targetStatus: 'downloading',
    messagePrefix: string,
    groupId?: string
  ): Promise<{ sessionId: string }> {
    const effectiveGroupId = groupId ?? (await this.readSelectedGroupId())
    if (!effectiveGroupId) throw new Error('No local model profile is selected.')
    const manifest = await this.ensureProfileManifest(modelId)
    const resolvedGroupId = resolveManifestGroupId(manifest, effectiveGroupId)
    if (!resolvedGroupId) throw new Error('No concrete local model download plan is available.')
    const sessionKey = buildSessionKey(modelId, resolvedGroupId)
    const existing = this.sessions.get(sessionKey)
    if (existing) return { sessionId: existing.sessionId }
    const sessionId = `local-model-${sanitizeId(modelId)}-${sanitizeId(resolvedGroupId)}-${this.now()}`
    const abortController = new AbortController()
    this.sessions.set(sessionKey, { modelId, sessionId, abortController, groupId: resolvedGroupId })
    const current = await this.readSelectedModelState(modelId, resolvedGroupId)
    const manifestGroup = manifest.groups[resolvedGroupId]
    if (!manifestGroup || manifestGroup.files.length === 0 || manifestGroup.estimatedTotalBytes === undefined) {
      this.sessions.delete(sessionKey)
      throw new Error('No concrete local model download plan is available.')
    }
    const totalBytes = manifestGroup.estimatedTotalBytes
    const currentGroup = current.groupsState[resolvedGroupId]
    const resumedFiles = await reconcileGroupFilesFromDisk({
      rootDir: manifestGroup.rootDir,
      manifestGroup,
      currentFiles: currentGroup?.files ?? [],
    })
    const resumedBytesDownloaded = sumDownloadedBytes(resumedFiles)
    const nextState = LocalModelAssetStateSchema.parse({
      ...current,
      modelId,
      selected: true,
      profileManifest: manifest,
      groupsState: {
        ...current.groupsState,
        [resolvedGroupId]: LocalModelLifecycleGroupStateSchema.parse({
          ...currentGroup,
          groupId: resolvedGroupId,
          baseGroupId: manifestGroup.baseGroupId,
          status: targetStatus,
          rootDir: manifestGroup.rootDir,
          bytesDownloaded: resumedBytesDownloaded,
          progress: totalBytes > 0 ? resumedBytesDownloaded / totalBytes : currentGroup?.progress,
          totalBytes,
          resumable: true,
          files: resumedFiles,
          updatedAt: this.now(),
        }),
      },
      updatedAt: this.now(),
    })
    const projected = await this.refreshCachedState(nextState, resolvedGroupId)
    await this.store.upsert(projected)
    this.emitLog({
      engineId: 'local',
      modelId,
      selectedGroupId: resolvedGroupId,
      groupId: resolvedGroupId,
      status: targetStatus,
      message: `${messagePrefix} ${modelId}.`,
      progress: projected.progress,
      bytesDownloaded: projected.bytesDownloaded,
      totalBytes,
      sessionId,
      resumable: true,
      files: projected.files,
      updatedAt: this.now(),
    })
    const task = this.performDownload(modelId, resolvedGroupId, sessionId, abortController.signal)
      .catch((error) =>
        this.finishDownload(
          modelId,
          resolvedGroupId,
          sessionId,
          false,
          error instanceof Error ? error.message : String(error)
        )
      )
      .finally(() => {
        if (this.sessionTasks.get(sessionKey) === task) {
          this.sessionTasks.delete(sessionKey)
        }
    })
    this.sessionTasks.set(sessionKey, task)
    return { sessionId }
  }

  private async ensureProfileManifest(modelId: string): Promise<LocalModelProfileManifest> {
    const existing = await this.profileManifestStore.read(modelId)
    if (existing) return existing
    const manifest = await this.createProfileManifest(modelId)
    await this.profileManifestStore.upsert(manifest)
    return manifest
  }

  private async createProfileManifest(modelId: string): Promise<LocalModelProfileManifest> {
    const hfEndpoint = await this.readHuggingFaceEndpoint()
    const snapshot = await readLocalModelRepositorySnapshot({
      modelId,
      hfEndpoint,
      fetchCacheStore: this.fetchCacheStore,
    })
    const basePlan = buildLocalDownloadPlanFromRepositoryFiles({
      modelId,
      files: snapshot.files.map((file) => ({
        ...file,
        revision: snapshot.commitHash,
      })),
    })
    if (!basePlan?.groups?.length) {
      throw new Error(`No recognizable local model profiles were found for ${modelId}.`)
    }
    const groupsEntries = basePlan.groups.flatMap((group) => {
      if (!group.selectable || group.estimatedTotalBytes === undefined) return []
      const groupId = buildVersionedGroupId(group.id, snapshot.shortCommitHash)
      const rootDir = getLocalModelProfileGroupRoot(this.cacheDir, modelId, groupId)
      const manifestGroup: LocalModelProfileManifestGroup = {
        id: groupId,
        baseGroupId: group.id,
        label: group.label,
        displayLabel: `${group.label} ${formatBytes(group.estimatedTotalBytes)} · ${snapshot.shortCommitHash}`,
        description: group.description,
        profile: group.profile,
        dtype: group.dtype,
        commitHash: snapshot.commitHash,
        shortCommitHash: snapshot.shortCommitHash,
        rootDir,
        estimatedTotalBytes: group.estimatedTotalBytes,
        selectable: group.selectable,
        files: group.files.map((file) => ({
          ...file,
          revision: snapshot.commitHash,
          sourceUrl:
            file.sourceUrl ??
            `${normalizeHuggingFaceEndpoint(hfEndpoint)}/${modelId}/resolve/${snapshot.commitHash}/${file.path}`,
        })),
      }
      return [[groupId, manifestGroup] as const]
    })
    if (groupsEntries.length === 0) {
      throw new Error(`No selectable local model profiles were found for ${modelId}.`)
    }
    return LocalModelProfileManifestSchema.parse({
      modelId,
      source: 'huggingface',
      endpoint: normalizeHuggingFaceEndpoint(hfEndpoint),
      revision: snapshot.revision,
      commitHash: snapshot.commitHash,
      shortCommitHash: snapshot.shortCommitHash,
      fetchedAt: this.now(),
      updatedAt: this.now(),
      raw: snapshot.raw,
      groups: Object.fromEntries(groupsEntries),
      groupOrder: groupsEntries.map(([groupId]) => groupId),
    })
  }

  private async performDownload(
    modelId: string,
    groupId: string,
    sessionId: string,
    signal: AbortSignal
  ): Promise<void> {
    const manifest = await this.ensureProfileManifest(modelId)
    const manifestGroup = manifest.groups[groupId]
    if (!manifestGroup) {
      throw new Error(`Unknown local model profile: ${groupId}.`)
    }
    const files = manifestGroup.files
    const totalBytes = manifestGroup.estimatedTotalBytes
    const hfEndpoint = normalizeHuggingFaceEndpoint(await this.readHuggingFaceEndpoint())
    const current = await this.readSelectedModelState(modelId, groupId)
    const currentGroup = current.groupsState[groupId]
    const downloadedFiles = await reconcileGroupFilesFromDisk({
      rootDir: manifestGroup.rootDir,
      manifestGroup,
      currentFiles: currentGroup?.files ?? [],
    })
    let bytesDownloaded = sumDownloadedBytes(downloadedFiles)

    if (files.length === 0 || totalBytes === undefined) {
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
        required: file.required,
        status: previousFileBytes > 0 ? 'paused' : 'not-downloaded',
      }
      await this.emitDownloadProgress({
        modelId,
        groupId,
        sessionId,
        message: `Downloading ${file.path}.`,
        totalBytes,
        bytesDownloaded,
        files: downloadedFiles,
      })
      const cachedPath = await downloadHuggingFaceFileToCacheDirWithProgress({
        repo: { type: 'model', name: modelId },
        path: file.path,
        cacheDir: this.cacheDir,
        targetPath: join(manifestGroup.rootDir, file.path),
        hubUrl: hfEndpoint,
        revision: manifestGroup.commitHash,
        etag: file.etag,
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
            required: file.required,
            status: boundedFileBytes >= (file.sizeBytes ?? Number.POSITIVE_INFINITY) ? 'downloaded' : 'downloading',
          }
          await this.emitDownloadProgress({
            modelId,
            groupId,
            sessionId,
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
            groupId,
            sessionId,
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
        profileRoot: manifestGroup.rootDir,
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
        required: file.required,
        status: 'downloaded',
      }
      await this.emitDownloadProgress({
        modelId,
        groupId,
        sessionId,
        message: `Downloaded ${file.path}.`,
        totalBytes,
        bytesDownloaded,
        files: downloadedFiles,
      })
    }

    await this.finishDownload(modelId, groupId, sessionId, true, `Local model ${modelId} is ready.`)
  }

  private async emitDownloadProgress(input: {
    modelId: string
    groupId: string
    sessionId: string
    message: string
    totalBytes?: number
    bytesDownloaded: number
    files: LocalModelLifecycleFileState[]
  }): Promise<void> {
    if (!this.isActiveSession(input.modelId, input.groupId, input.sessionId)) return
    const progress =
      input.totalBytes && input.totalBytes > 0
        ? Math.max(0, Math.min(1, input.bytesDownloaded / input.totalBytes))
        : undefined
    const current = await this.readSelectedModelState(input.modelId, input.groupId)
    const currentGroup = current.groupsState[input.groupId]
    const nextState = LocalModelAssetStateSchema.parse({
      ...current,
      groupsState: {
        ...current.groupsState,
        [input.groupId]: LocalModelLifecycleGroupStateSchema.parse({
          ...currentGroup,
          groupId: input.groupId,
          status: 'downloading',
          bytesDownloaded: input.bytesDownloaded,
          totalBytes: input.totalBytes,
          progress,
          resumable: true,
          files: input.files,
          updatedAt: this.now(),
        }),
      },
      updatedAt: this.now(),
    })
    const projected = await this.refreshCachedState(nextState, input.groupId)
    await this.store.upsert(projected)
    this.emitLog({
      engineId: 'local',
      modelId: input.modelId,
      selectedGroupId: input.groupId,
      groupId: input.groupId,
      status: 'downloading',
      message: input.message,
      progress,
      bytesDownloaded: input.bytesDownloaded,
      totalBytes: input.totalBytes,
      files: input.files.map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: file.downloadedBytes,
      })),
      sessionId: input.sessionId,
      resumable: true,
      updatedAt: this.now(),
    })
  }

  private async finishDownload(
    modelId: string,
    groupId: string,
    sessionId: string,
    success: boolean,
    message: string
  ): Promise<void> {
    if (!this.isActiveSession(modelId, groupId, sessionId)) return
    const sessionKey = buildSessionKey(modelId, groupId)
    const current = await this.readSelectedModelState(modelId, groupId)
    const currentGroup = current.groupsState[groupId]
    const totalBytes = currentGroup?.totalBytes ?? current.totalBytes
    const files = success
      ? current.files.map((file) =>
          LocalModelLifecycleFileStateSchema.parse({
            ...file,
            required: true,
            downloadedBytes: file.sizeBytes,
            status: 'downloaded',
            updatedAt: this.now(),
          })
        )
      : (currentGroup?.files ?? []).map((file) =>
          LocalModelLifecycleFileStateSchema.parse({
            ...file,
            status: file.status === 'downloaded' ? 'downloaded' : 'paused',
            updatedAt: this.now(),
          })
        )
    const nextState = LocalModelAssetStateSchema.parse({
      ...current,
      groupsState: {
        ...current.groupsState,
        [groupId]: LocalModelLifecycleGroupStateSchema.parse({
          ...currentGroup,
          groupId,
          status: success ? 'downloaded' : 'error',
          progress: success ? 1 : current.progress,
          bytesDownloaded: success ? totalBytes : current.bytesDownloaded,
          totalBytes,
          installedAt: success ? this.now() : currentGroup?.installedAt,
          updatedAt: this.now(),
          error: success ? undefined : message,
          resumable: !success,
          files,
        }),
      },
      updatedAt: this.now(),
    })
    const projected = await this.refreshCachedState(nextState, groupId)
    await this.store.upsert(projected)
    this.sessions.delete(sessionKey)
    this.emitLog({
      engineId: 'local',
      modelId,
      selectedGroupId: groupId,
      groupId,
      status: projected.status,
      message,
      progress: projected.progress,
      bytesDownloaded: projected.bytesDownloaded,
      totalBytes: projected.totalBytes,
      sessionId,
      resumable: projected.resumable,
      files: projected.files,
      updatedAt: this.now(),
    })
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

  private isActiveSession(modelId: string, groupId: string, sessionId: string): boolean {
    return this.sessions.get(buildSessionKey(modelId, groupId))?.sessionId === sessionId
  }

  private emitLog(log: LocalModelAssetLog): void {
    this.logs.set(log.modelId, log)
    for (const listener of this.listeners) {
      listener(log)
    }
  }

  async getTransformersModule(): Promise<TransformersModule> {
    if (!this.transformersModulePromise) {
      this.transformersModulePromise = this.loadTransformersModule()
    }
    return this.transformersModulePromise
  }

  private async loadTransformersModule(): Promise<TransformersModule> {
    return import('@huggingface/transformers') as Promise<TransformersModule>
  }
}

function buildSessionKey(modelId: string, groupId: string): string {
  return `${modelId}::${groupId}`
}

function buildVersionedGroupId(baseGroupId: string, shortCommitHash: string): string {
  return `${sanitizeId(baseGroupId)}-${sanitizeId(shortCommitHash)}`
}

function selectFirstManifestGroupId(
  manifest: LocalModelProfileManifest | undefined
): string | undefined {
  return manifest?.groupOrder.find((groupId) => manifest.groups[groupId]?.selectable)
}

function resolveManifestGroupId(
  manifest: LocalModelProfileManifest | undefined,
  requestedGroupId: string | undefined
): string | undefined {
  if (!manifest || !requestedGroupId) return requestedGroupId
  if (manifest.groups[requestedGroupId]?.selectable) return requestedGroupId
  return manifest.groupOrder.find((groupId) => {
    const group = manifest.groups[groupId]
    return group?.selectable && group.baseGroupId === requestedGroupId
  })
}

function removeManifestGroup(
  manifest: LocalModelProfileManifest,
  groupId: string
): LocalModelProfileManifest | undefined {
  const groups = { ...manifest.groups }
  delete groups[groupId]
  const groupOrder = manifest.groupOrder.filter((id) => id !== groupId)
  if (groupOrder.length === 0) return undefined
  return LocalModelProfileManifestSchema.parse({
    ...manifest,
    groups,
    groupOrder,
  })
}

function removePlanGroup(
  plan: TranslationModelDownloadPlan,
  groupId: string
): TranslationModelDownloadPlan | undefined {
  const groups = plan.groups?.filter((group) => group.id !== groupId)
  if (!groups?.length) return undefined
  const selectedGroup = groups.find((group) => group.selected) ?? groups[0]
  return {
    ...plan,
    selectedGroupId: selectedGroup?.id,
    estimatedTotalBytes: selectedGroup?.estimatedTotalBytes,
    files: selectedGroup?.files ?? [],
    groups: groups.map((group) => ({
      ...group,
      selected: group.id === selectedGroup?.id,
    })),
  }
}

function migrateLegacyStateToGroups(
  state: LocalModelAssetState,
  manifest: LocalModelProfileManifest | undefined,
  now: number
): LocalModelAssetState {
  const selectedGroupId = state.selectedGroupId ?? state.plan?.selectedGroupId
  const groupsState = { ...state.groupsState }
  for (const group of manifest ? [] : (state.plan?.groups ?? [])) {
    if (groupsState[group.id] || !group.status || group.status === 'not-downloaded') {
      continue
    }
    const groupStatus = group.status
    const manifestGroup = manifest?.groups[group.id]
    const groupFiles =
      group.id === selectedGroupId && state.files.length > 0
        ? state.files.map((file) => ({
            ...file,
            required: true,
            status:
              file.sizeBytes !== undefined &&
              (file.downloadedBytes ?? 0) >= file.sizeBytes
                ? 'downloaded'
                : normalizeLiveStatusForStoredState(groupStatus),
          }))
        : group.files.map((file) => ({
            ...file,
            downloadedBytes: groupStatus === 'downloaded' ? file.sizeBytes : 0,
            status: normalizeLiveStatusForStoredState(groupStatus),
          }))
    const bytesDownloaded = sumDownloadedBytes(groupFiles)
    const totalBytes = group.estimatedTotalBytes
    groupsState[group.id] = LocalModelLifecycleGroupStateSchema.parse({
      groupId: group.id,
      baseGroupId: group.baseGroupId ?? manifestGroup?.baseGroupId ?? group.id,
      status: normalizeLiveStatusForStoredState(groupStatus),
      rootDir: group.rootDir ?? manifestGroup?.rootDir,
      bytesDownloaded,
      totalBytes,
      progress:
        totalBytes && totalBytes > 0
          ? Math.max(0, Math.min(1, bytesDownloaded / totalBytes))
          : group.progress,
      resumable:
        group.resumable ??
        (groupStatus === 'paused' ||
          groupStatus === 'downloading' ||
          groupStatus === 'queued' ||
          groupStatus === 'error'),
      error: group.error,
      installedAt: groupStatus === 'downloaded' ? (state.installedAt ?? now) : undefined,
      updatedAt: state.updatedAt ?? now,
      files: groupFiles,
    })
  }
  if (
    selectedGroupId &&
    !groupsState[selectedGroupId] &&
    state.files.length > 0 &&
    state.status !== 'not-downloaded'
  ) {
    const manifestGroup = manifest?.groups[selectedGroupId]
    groupsState[selectedGroupId] = LocalModelLifecycleGroupStateSchema.parse({
      groupId: selectedGroupId,
      baseGroupId: manifestGroup?.baseGroupId ?? selectedGroupId,
      status: normalizeLiveStatusForStoredState(state.status),
      rootDir: manifestGroup?.rootDir,
      bytesDownloaded: state.bytesDownloaded,
      totalBytes: state.totalBytes,
      progress: state.progress,
      resumable: state.resumable,
      error: state.error,
      installedAt: state.installedAt,
      updatedAt: state.updatedAt ?? now,
      files: state.files.map((file) =>
        LocalModelLifecycleFileStateSchema.parse({
          ...file,
          required: true,
          status:
            file.sizeBytes !== undefined &&
            (file.downloadedBytes ?? 0) >= file.sizeBytes
              ? 'downloaded'
              : state.status === 'downloaded'
                ? 'downloaded'
                : normalizeLiveStatusForStoredState(state.status),
        })
      ),
    })
  }
  return LocalModelAssetStateSchema.parse({
    ...state,
    selectedGroupId,
    groupsState,
  })
}

function mergeHistoricalGroupsIntoManifest(input: {
  cacheDir: string
  modelId: string
  manifest: LocalModelProfileManifest | undefined
  groupsState: LocalModelAssetState['groupsState']
  fallbackPlan: LocalModelAssetState['plan']
}): LocalModelProfileManifest | undefined {
  const existing = input.manifest
  const groups = existing ? { ...existing.groups } : {}
  const groupOrder = existing ? [...existing.groupOrder] : []
  const fallbackGroups = input.fallbackPlan?.groups ?? []
  for (const fallbackGroup of fallbackGroups) {
    if (groups[fallbackGroup.id]) continue
    const state = input.groupsState[fallbackGroup.id]
    const commitHash = fallbackGroup.commitHash ?? 'legacy'
    const shortCommitHash = fallbackGroup.shortCommitHash ?? 'legacy'
    groups[fallbackGroup.id] = {
      id: fallbackGroup.id,
      baseGroupId: fallbackGroup.baseGroupId ?? fallbackGroup.id,
      label: fallbackGroup.label,
      displayLabel:
        fallbackGroup.shortCommitHash && !fallbackGroup.label.includes(fallbackGroup.shortCommitHash)
          ? `${fallbackGroup.label} · ${fallbackGroup.shortCommitHash}`
          : fallbackGroup.label,
      description: fallbackGroup.description,
      profile: fallbackGroup.profile,
      dtype: fallbackGroup.dtype,
      commitHash,
      shortCommitHash,
      rootDir:
        fallbackGroup.rootDir ??
        state?.rootDir ??
        getLocalModelProfileGroupRoot(input.cacheDir, input.modelId, fallbackGroup.id),
      estimatedTotalBytes: fallbackGroup.estimatedTotalBytes,
      selectable: fallbackGroup.selectable,
      files: fallbackGroup.files.map((file) => ({
        ...file,
        revision: file.revision ?? (commitHash === 'legacy' ? undefined : commitHash),
      })),
    }
    groupOrder.push(fallbackGroup.id)
  }
  if (!existing && groupOrder.length === 0) return undefined
  return LocalModelProfileManifestSchema.parse({
    modelId: input.modelId,
    source: 'huggingface',
    endpoint: existing?.endpoint ?? '',
    revision: existing?.revision ?? 'legacy',
    commitHash: existing?.commitHash ?? 'legacy',
    shortCommitHash: existing?.shortCommitHash ?? 'legacy',
    fetchedAt: existing?.fetchedAt ?? 0,
    updatedAt: existing?.updatedAt ?? 0,
    raw: existing?.raw,
    groups,
    groupOrder,
  })
}

function buildPlanFromManifest(input: {
  modelId: string
  manifest: LocalModelProfileManifest | undefined
  groupsState: LocalModelAssetState['groupsState']
  selectedGroupId?: string
}): TranslationModelDownloadPlan | null {
  if (!input.manifest) return null
  const selectedGroupId =
    input.selectedGroupId && input.manifest.groups[input.selectedGroupId]?.selectable
      ? input.selectedGroupId
      : selectFirstManifestGroupId(input.manifest)
  const groups = input.manifest.groupOrder.flatMap((groupId): TranslationDownloadGroupPlan[] => {
    const manifestGroup = input.manifest?.groups[groupId]
    if (!manifestGroup) return []
    const groupState = input.groupsState[groupId]
    return [
      {
        id: manifestGroup.id,
        label: manifestGroup.displayLabel,
        description: manifestGroup.description,
        profile: manifestGroup.profile,
        dtype: manifestGroup.dtype,
        estimatedTotalBytes: manifestGroup.estimatedTotalBytes,
        baseGroupId: manifestGroup.baseGroupId,
        commitHash: manifestGroup.commitHash,
        shortCommitHash: manifestGroup.shortCommitHash,
        rootDir: manifestGroup.rootDir,
        status: groupState?.status ?? 'not-downloaded',
        progress: groupState?.progress,
        bytesDownloaded: groupState?.bytesDownloaded,
        totalBytes: groupState?.totalBytes ?? manifestGroup.estimatedTotalBytes,
        resumable: groupState?.resumable,
        error: groupState?.error,
        selectable: manifestGroup.selectable,
        selected: manifestGroup.id === selectedGroupId,
        files: manifestGroup.files.map((file) => ({
          ...file,
          required: file.required,
        })),
      },
    ]
  })
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0]
  if (!selectedGroup) return null
  return {
    modelId: input.modelId,
    estimatedTotalBytes: selectedGroup.estimatedTotalBytes,
    files: selectedGroup.files,
    selectedGroupId: selectedGroup.id,
    groups,
  }
}

function reconcileGroupFiles(input: {
  manifestGroup: LocalModelProfileManifestGroup
  currentFiles: ReadonlyArray<LocalModelLifecycleFileState>
}): LocalModelLifecycleFileState[] {
  const currentFileByPath = new Map(input.currentFiles.map((file) => [file.path, file]))
  return input.manifestGroup.files.map((file) => {
    const current = currentFileByPath.get(file.path)
    const downloadedBytes =
      current?.downloadedBytes === undefined
        ? 0
        : file.sizeBytes === undefined
          ? current.downloadedBytes
          : Math.min(current.downloadedBytes, file.sizeBytes)
    const status =
      file.sizeBytes !== undefined && downloadedBytes >= file.sizeBytes
        ? 'downloaded'
        : current?.status ?? 'not-downloaded'
    return LocalModelLifecycleFileStateSchema.parse({
      path: file.path,
      sizeBytes: file.sizeBytes,
      downloadedBytes,
      required: file.required,
      status,
      updatedAt: current?.updatedAt,
      error: current?.error,
    })
  })
}

async function reconcileGroupFilesFromDisk(input: {
  rootDir: string
  manifestGroup: LocalModelProfileManifestGroup
  currentFiles: ReadonlyArray<LocalModelLifecycleFileState>
}): Promise<LocalModelLifecycleFileState[]> {
  const currentFileByPath = new Map(input.currentFiles.map((file) => [file.path, file]))
  return Promise.all(
    input.manifestGroup.files.map(async (file) => {
      const current = currentFileByPath.get(file.path)
      const diskBytes = await readPathSize(join(input.rootDir, file.path))
      const downloadedBytes =
        diskBytes === null
          ? (current?.downloadedBytes ?? 0)
          : file.sizeBytes === undefined
            ? diskBytes
            : Math.min(diskBytes, file.sizeBytes)
      const status =
        file.sizeBytes !== undefined && downloadedBytes >= file.sizeBytes
          ? 'downloaded'
          : downloadedBytes > 0
            ? 'paused'
            : 'not-downloaded'
      return LocalModelLifecycleFileStateSchema.parse({
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes,
        required: file.required,
        status,
        updatedAt: current?.updatedAt,
        error: current?.error,
      })
    })
  )
}

function isActiveDownloadStatus(status: LocalModelDownloadStatus): boolean {
  return (
    status === 'queued' ||
    status === 'downloading' ||
    status === 'deleting'
  )
}

function normalizeLiveStatusForStoredState(status: LocalModelDownloadStatus): LocalModelDownloadStatus {
  if (status === 'queued' || status === 'downloading') return 'paused'
  return status
}

function sumDownloadedBytes(
  files: ReadonlyArray<{ sizeBytes?: number; downloadedBytes?: number }>
): number {
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
  targetPath: string
  hubUrl: string
  revision: string
  etag?: string
  expectedSizeBytes?: number
  retryPolicy: Required<LocalModelNetworkRetryPolicy>
  fetch: typeof fetch
  signal: AbortSignal
  onProgress: (downloadedBytes: number) => Promise<void>
  onRetry?: (input: { retryDelayMs: number; phase: 'metadata' | 'download' }) => Promise<void>
}): Promise<string> {
  let lastError: unknown
  const info = await readHuggingFaceFileDownloadInfoWithRetry({
    repo: input.repo,
    path: input.path,
    revision: input.revision,
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
    revision: input.revision,
    etag: input.etag ?? info.etag,
  })

  const existingTargetSize = await readPathSize(input.targetPath)
  if (existingTargetSize !== null && existingTargetSize >= totalBytes) {
    await input.onProgress(totalBytes)
    return input.targetPath
  }

  for (let attempt = 0; attempt <= input.retryPolicy.limit; attempt += 1) {
    try {
      throwIfAborted(input.signal)
      let resumeBytes = await readPathSize(`${input.targetPath}.incomplete`)
      if (resumeBytes !== null && resumeBytes > totalBytes) {
        await rm(`${input.targetPath}.incomplete`, { force: true })
        resumeBytes = 0
      }
      if (resumeBytes !== null && resumeBytes > 0) {
        await input.onProgress(Math.min(resumeBytes, totalBytes))
      }
      const downloadedViaFetch = await streamDownloadToIncompleteFile({
        url: info.url,
        incompletePath: `${input.targetPath}.incomplete`,
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
          revision: input.revision,
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
          incompletePath: `${input.targetPath}.incomplete`,
          startBytes: resumeBytes ?? 0,
          totalBytes,
          onProgress: input.onProgress,
        })
      }
      const incompleteSize = await readPathSize(`${input.targetPath}.incomplete`)
      if (incompleteSize === null || incompleteSize < totalBytes) {
        throw new Error(
          `Incomplete response for file ${input.path}: downloaded ${incompleteSize ?? 0} of ${totalBytes} bytes.`
        )
      }
      await finalizeDownloadedFile({
        incompletePath: `${input.targetPath}.incomplete`,
        targetPath: input.targetPath,
      })
      await mirrorDownloadedFileToHubCache({
        targetPath: input.targetPath,
        cachePaths,
      })
      await input.onProgress(totalBytes)
      return input.targetPath
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

async function finalizeDownloadedFile(input: {
  incompletePath: string
  targetPath: string
}): Promise<void> {
  await mkdir(dirname(input.targetPath), { recursive: true })
  await rm(input.targetPath, { force: true })
  await rename(input.incompletePath, input.targetPath)
}

async function mirrorDownloadedFileToHubCache(input: {
  targetPath: string
  cachePaths: HubCacheFilePaths
}): Promise<void> {
  await mkdir(dirname(input.cachePaths.blobPath), { recursive: true })
  await mkdir(dirname(input.cachePaths.pointerPath), { recursive: true })
  await rm(input.cachePaths.blobPath, { force: true })
  await copyFile(input.targetPath, input.cachePaths.blobPath)
  await unlink(input.cachePaths.pointerPath).catch(() => undefined)
  await symlink(input.cachePaths.blobPath, input.cachePaths.pointerPath)
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
  profileRoot: string
  filePath: string
  cachedPath: string
}): Promise<void> {
  const sourcePath = await resolveRealCacheFile(input.cachedPath)
  await copyFileIfMissing(sourcePath, join(input.profileRoot, input.filePath))
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
  const downloadGroups = asset.plan?.groups ?? candidate.downloadGroups
  const hasSelectableGroup = downloadGroups?.some((group) => group.selectable) ?? false
  return {
    ...candidate,
    downloadGroups,
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
