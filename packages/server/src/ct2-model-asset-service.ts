import type {
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
  TranslationModelSearchInput,
  TranslationModelSearchResult,
} from '@openspecui/core'
import {
  LocalModelAssetStateSchema,
  LocalModelLifecycleFileStateSchema,
  LocalModelLifecycleGroupStateSchema,
  LocalModelProfileManifestSchema,
} from '@openspecui/core'
import { resolveCt2ModelDownloadPlanFromRepositoryFiles } from '@openspecui/local-ct2-translator'
import { observable } from '@trpc/server/observable'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  getDefaultLocalCt2ModelCacheDir,
  getDefaultLocalCt2ModelFetchCachePath,
  getDefaultLocalCt2ModelIndexPath,
  getDefaultLocalCt2ModelProfileManifestPath,
  getLocalCt2ModelArtifactGroupRoot,
} from './ct2-model-cache-path.js'
import { searchCt2Models, searchCt2ModelsProgressively } from './ct2-model-catalog.js'
import { normalizeHuggingFaceEndpoint } from './huggingface-endpoint.js'
import { LocalModelAssetStore } from './local-model-asset-store.js'
import { LocalModelFetchCacheStore } from './local-model-fetch-cache-store.js'
import { LocalModelProfileManifestStore } from './local-model-profile-manifest-store.js'
import { readLocalModelRepositorySnapshot } from './local-model-runtime.js'
import { ensureProxyAwareFetchDispatcher } from './network-dispatcher.js'
import { isRetryableNetworkError } from './network-retry.js'

interface GlobalSettingsManagerLike {
  readSettings(): Promise<{
    translationEngines: {
      localCt2: {
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

const DEFAULT_NETWORK_RETRY_LIMIT = Number.POSITIVE_INFINITY
const DEFAULT_NETWORK_RETRY_DELAY_MS = 500
const DEFAULT_NETWORK_RETRY_DELAY_MAX_MS = 5_000

interface Ct2ModelNetworkRetryPolicy {
  limit?: number
  delayMs?: number
  maxDelayMs?: number
}

export interface Ct2ModelAssetServiceOptions {
  projectDir: string
  globalSettingsManager: GlobalSettingsManagerLike
  now?: () => number
  indexPath?: string
  profileManifestPath?: string
  cacheDir?: string
  fetchCachePath?: string
  networkRetryPolicy?: Ct2ModelNetworkRetryPolicy
}

export class Ct2ModelAssetService {
  private readonly now: () => number
  private readonly store: LocalModelAssetStore
  private readonly profileManifestStore: LocalModelProfileManifestStore
  private readonly cacheDir: string
  private readonly fetchCacheStore: LocalModelFetchCacheStore
  private readonly networkRetryPolicy: Required<Ct2ModelNetworkRetryPolicy>
  private readonly listeners = new Set<LogListener>()
  private readonly sessions = new Map<string, DownloadSession>()
  private readonly sessionTasks = new Map<string, Promise<void>>()
  private readonly logs = new Map<string, LocalModelAssetLog>()

  constructor(private readonly options: Ct2ModelAssetServiceOptions) {
    ensureProxyAwareFetchDispatcher()
    this.now = options.now ?? Date.now
    this.cacheDir = options.cacheDir ?? getDefaultLocalCt2ModelCacheDir()
    this.networkRetryPolicy = {
      limit: options.networkRetryPolicy?.limit ?? DEFAULT_NETWORK_RETRY_LIMIT,
      delayMs: options.networkRetryPolicy?.delayMs ?? DEFAULT_NETWORK_RETRY_DELAY_MS,
      maxDelayMs: options.networkRetryPolicy?.maxDelayMs ?? DEFAULT_NETWORK_RETRY_DELAY_MAX_MS,
    }
    this.store = new LocalModelAssetStore({
      indexPath: options.indexPath ?? getDefaultLocalCt2ModelIndexPath(),
    })
    this.profileManifestStore = new LocalModelProfileManifestStore({
      manifestPath: options.profileManifestPath ?? getDefaultLocalCt2ModelProfileManifestPath(),
    })
    this.fetchCacheStore = new LocalModelFetchCacheStore({
      cachePath: options.fetchCachePath ?? getDefaultLocalCt2ModelFetchCachePath(),
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
              ? `Previously selected CT2 model. Estimated download ${formatBytes(state.plan.estimatedTotalBytes)}.`
              : 'Previously selected CT2 model.',
          downloads: 0,
          likes: 0,
          tags: ['local-ct2'],
          compatibility: {
            transformersJs: false,
            onnx: false,
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
          const events = await searchCt2ModelsProgressively(
            {
              query: input.query,
              sourceLanguage: input.sourceLanguage,
              targetLanguage: input.targetLanguage,
              limit: input.limit,
              cursor: input.cursor,
              requestId: input.requestId,
            },
            {
              fetchCacheStore: this.fetchCacheStore,
              hfEndpoint: await this.readHuggingFaceEndpoint(),
            }
          )
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
            message: error instanceof Error ? error.message : 'Unable to search remote CT2 models.',
          })
        }
      })()
      return () => {
        active = false
      }
    })
  }

  async readSelectedModelState(
    modelId: string,
    selectedGroupId?: string
  ): Promise<LocalModelAssetState> {
    const state = (await this.store.readMap()).get(modelId)
    if (state) return this.refreshCachedState(state, selectedGroupId)
    const selected = modelId === (await this.readSelectedModel())
    return this.refreshCachedState(
      LocalModelAssetStateSchema.parse({
        modelId,
        status: 'not-downloaded',
        selected,
        selectedGroupId,
        updatedAt: this.now(),
      }),
      selectedGroupId
    )
  }

  async startDownload(modelId: string, groupId?: string): Promise<{ sessionId: string }> {
    return this.runDownload(modelId, 'Downloading CT2 model', groupId)
  }

  async resumeDownload(modelId: string, groupId?: string): Promise<{ sessionId: string }> {
    return this.runDownload(modelId, 'Resuming CT2 model download', groupId)
  }

  async pauseDownload(modelId: string, groupId?: string): Promise<{ success: true }> {
    const requestedGroupId = groupId ?? (await this.readSelectedGroupId())
    if (!requestedGroupId) return { success: true }
    const current = await this.readSelectedModelState(modelId, requestedGroupId)
    const effectiveGroupId =
      current.plan?.selectedGroupId ?? current.selectedGroupId ?? requestedGroupId
    const sessionKey = buildSessionKey(modelId, effectiveGroupId)
    const session = this.sessions.get(sessionKey)
    if (session) {
      session.abortController.abort()
      this.sessions.delete(sessionKey)
    }
    const nextState = LocalModelAssetStateSchema.parse({
      ...current,
      groupsState: {
        ...current.groupsState,
        [effectiveGroupId]: LocalModelLifecycleGroupStateSchema.parse({
          ...current.groupsState[effectiveGroupId],
          groupId: effectiveGroupId,
          status: 'paused',
          resumable: true,
          updatedAt: this.now(),
        }),
      },
      updatedAt: this.now(),
    })
    const projected = await this.refreshCachedState(nextState, effectiveGroupId, {
      revalidateDisk: true,
    })
    await this.store.upsert(projected)
    this.emitLog({
      engineId: 'local-ct2',
      modelId,
      selectedGroupId: effectiveGroupId,
      groupId: effectiveGroupId,
      status: 'paused',
      message: 'CT2 model download paused.',
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
    const effectiveGroupId =
      current.plan?.selectedGroupId ?? current.selectedGroupId ?? requestedGroupId
    const sessionKey = buildSessionKey(modelId, effectiveGroupId)
    this.sessions.get(sessionKey)?.abortController.abort()
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
      engineId: 'local-ct2',
      modelId,
      selectedGroupId: effectiveGroupId,
      groupId: effectiveGroupId,
      status: 'deleting',
      message: 'Deleting CT2 model files.',
      files: current.files,
      updatedAt: this.now(),
    })
    await rm(getLocalCt2ModelArtifactGroupRoot(this.cacheDir, modelId, effectiveGroupId), {
      recursive: true,
      force: true,
    })
    const persistedManifest = await this.profileManifestStore.read(modelId)
    const nextGroupsState = { ...current.groupsState }
    delete nextGroupsState[effectiveGroupId]
    const nextManifest = persistedManifest
      ? removeManifestGroup(persistedManifest, effectiveGroupId)
      : removeManifestGroup(current.profileManifest, effectiveGroupId)
    const nextPlan = removePlanGroup(current.plan, effectiveGroupId)
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
      nextSelectedGroupId,
      { revalidateDisk: true }
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
      engineId: 'local-ct2',
      modelId,
      selectedGroupId: effectiveGroupId,
      groupId: effectiveGroupId,
      status: 'not-downloaded',
      message: 'CT2 model files were removed.',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
      files: [],
      updatedAt: this.now(),
    })
    return { success: true }
  }

  async refreshArtifacts(modelId?: string): Promise<LocalModelAssetState> {
    const targetModelId = modelId ?? (await this.readSelectedModel())
    const loadingState = LocalModelAssetStateSchema.parse({
      ...(await this.readSelectedModelState(targetModelId)),
      profileLoad: {
        status: 'loading',
        message: 'Loading CT2 model artifacts.',
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
            message: 'CT2 model artifacts are ready.',
            updatedAt: this.now(),
          },
          updatedAt: this.now(),
        }),
        undefined,
        { revalidateDisk: true }
      )
      await this.store.upsert(nextState)
      return nextState
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load CT2 model artifacts.'
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
    if (!nextStates.some((state) => state.modelId === modelId)) {
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
    for (const session of this.sessions.values()) {
      session.abortController.abort()
    }
    await Promise.allSettled(this.sessionTasks.values())
  }

  private async searchRemote(
    input: TranslationModelSearchInput
  ): Promise<TranslationModelSearchResult> {
    return searchCt2Models(
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
                      ? `Previously selected CT2 model. Estimated download ${formatBytes(state.plan.estimatedTotalBytes)}.`
                      : 'Previously selected CT2 model.',
                  downloads: 0,
                  likes: 0,
                  tags: ['local-ct2'],
                  compatibility: {
                    transformersJs: false,
                    onnx: false,
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
    selectedGroupId?: string,
    options: { revalidateDisk?: boolean } = {}
  ): Promise<LocalModelAssetState> {
    const [selectedModel, persistedSelectedGroupId, persistedManifest] = await Promise.all([
      this.readSelectedModel(),
      this.readSelectedGroupId(),
      this.profileManifestStore.read(state.modelId),
    ])
    const selected = state.selected || state.modelId === selectedModel
    const manifest =
      state.profileManifest ??
      persistedManifest ??
      createSyntheticManifestFromPlan({
        cacheDir: this.cacheDir,
        modelId: state.modelId,
        plan: state.plan,
      })
    const selectedGroupIdForProjection =
      resolveManifestGroupId(
        manifest,
        selectedGroupId ??
          persistedSelectedGroupId ??
          state.selectedGroupId ??
          state.plan?.selectedGroupId
      ) ??
      selectFirstManifestGroupId(manifest) ??
      state.plan?.selectedGroupId
    const groupsState = manifest
      ? options.revalidateDisk
        ? await this.reconcileGroupsFromDisk({
            manifest,
            groupsState: state.groupsState,
          })
        : this.reconcileGroupsFromSnapshot({
            manifest,
            groupsState: state.groupsState,
          })
      : state.groupsState
    const plan = manifest
      ? buildPlanFromManifest({
          modelId: state.modelId,
          manifest,
          groupsState,
          selectedGroupId: selectedGroupIdForProjection,
        })
      : (state.plan ?? undefined)
    const selectedPlanGroup = selectPlanGroup(plan, selectedGroupIdForProjection)
    const selectedGroupState =
      selectedPlanGroup && groupsState[selectedPlanGroup.id]
        ? groupsState[selectedPlanGroup.id]
        : undefined
    return LocalModelAssetStateSchema.parse({
      ...state,
      selected,
      selectedGroupId: selectedGroupIdForProjection,
      profileManifest: manifest,
      groupsState,
      plan,
      status: selectedGroupState?.status ?? state.status,
      progress: selectedGroupState?.progress,
      totalBytes: selectedGroupState?.totalBytes ?? selectedPlanGroup?.estimatedTotalBytes,
      bytesDownloaded: selectedGroupState?.bytesDownloaded,
      error: selectedGroupState?.error,
      resumable: selectedGroupState?.resumable ?? false,
      files:
        selectedPlanGroup?.files.map((file) => ({
          path: file.path,
          sizeBytes: file.sizeBytes,
          downloadedBytes: selectedGroupState?.files.find((entry) => entry.path === file.path)
            ?.downloadedBytes,
        })) ?? state.files,
      updatedAt: this.now(),
      installedAt: selectedGroupState?.installedAt ?? state.installedAt,
    })
  }

  private reconcileGroupsFromSnapshot(input: {
    manifest: LocalModelProfileManifest
    groupsState: LocalModelAssetState['groupsState']
  }): LocalModelAssetState['groupsState'] {
    const nextGroupsState: LocalModelAssetState['groupsState'] = { ...input.groupsState }
    for (const groupId of input.manifest.groupOrder) {
      const manifestGroup = input.manifest.groups[groupId]
      if (!manifestGroup) continue
      const current = nextGroupsState[groupId]
      const files = reconcileGroupFilesFromSnapshot({
        manifestGroup,
        currentFiles: current?.files ?? [],
        currentStatus: current?.status ?? 'not-downloaded',
      })
      const bytesDownloaded = sumDownloadedBytes(files)
      const totalBytes = manifestGroup.estimatedTotalBytes
      const status = current?.status ?? 'not-downloaded'
      nextGroupsState[groupId] = LocalModelLifecycleGroupStateSchema.parse({
        ...current,
        groupId,
        baseGroupId: manifestGroup.baseGroupId,
        status,
        rootDir: manifestGroup.rootDir,
        bytesDownloaded,
        totalBytes,
        progress:
          totalBytes && totalBytes > 0
            ? Math.max(0, Math.min(1, bytesDownloaded / totalBytes))
            : current?.progress,
        resumable:
          current?.resumable ??
          (status === 'paused' || status === 'error' || status === 'downloading'),
        error: current?.error,
        installedAt: current?.installedAt,
        updatedAt: current?.updatedAt ?? this.now(),
        files,
      })
    }
    return nextGroupsState
  }

  private async reconcileGroupsFromDisk(input: {
    manifest: LocalModelProfileManifest
    groupsState: LocalModelAssetState['groupsState']
  }): Promise<LocalModelAssetState['groupsState']> {
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
          totalBytes && totalBytes > 0
            ? Math.max(0, Math.min(1, bytesDownloaded / totalBytes))
            : undefined,
        resumable: status === 'paused' || status === 'error',
        error: status === 'error' ? current?.error : undefined,
        installedAt:
          status === 'downloaded' ? (current?.installedAt ?? this.now()) : current?.installedAt,
        updatedAt: this.now(),
        files,
      })
    }
    return nextGroupsState
  }

  private async runDownload(
    modelId: string,
    messagePrefix: string,
    groupId?: string
  ): Promise<{ sessionId: string }> {
    const effectiveGroupId = groupId ?? (await this.readSelectedGroupId())
    if (!effectiveGroupId) throw new Error('No CT2 model artifact group is selected.')
    const manifest = await this.ensureProfileManifest(modelId)
    const resolvedGroupId = resolveManifestGroupId(manifest, effectiveGroupId)
    if (!resolvedGroupId) throw new Error('No concrete CT2 model download plan is available.')
    const sessionKey = buildSessionKey(modelId, resolvedGroupId)
    const existing = this.sessions.get(sessionKey)
    if (existing) return { sessionId: existing.sessionId }
    const sessionId = `local-ct2-model-${sanitizeId(modelId)}-${sanitizeId(resolvedGroupId)}-${this.now()}`
    const abortController = new AbortController()
    this.sessions.set(sessionKey, { modelId, sessionId, abortController, groupId: resolvedGroupId })
    const current = await this.readSelectedModelState(modelId, resolvedGroupId)
    const manifestGroup = manifest.groups[resolvedGroupId]
    if (
      !manifestGroup ||
      manifestGroup.files.length === 0 ||
      manifestGroup.estimatedTotalBytes === undefined
    ) {
      this.sessions.delete(sessionKey)
      throw new Error('No concrete CT2 model download plan is available.')
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
          status: 'downloading',
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
    const projected = await this.refreshCachedState(nextState, resolvedGroupId, {
      revalidateDisk: true,
    })
    await this.store.upsert(projected)
    this.emitLog({
      engineId: 'local-ct2',
      modelId,
      selectedGroupId: resolvedGroupId,
      groupId: resolvedGroupId,
      status: 'downloading',
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
    const persistedState = (await this.store.readMap()).get(modelId)
    if (persistedState?.profileManifest) return persistedState.profileManifest
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
    const basePlan = resolveCt2ModelDownloadPlanFromRepositoryFiles({
      modelId,
      files: snapshot.files.map((file) => ({
        ...file,
        revision: snapshot.commitHash,
      })),
    })
    if (!basePlan?.groups?.length) {
      throw new Error(`No recognizable CT2 model artifacts were found for ${modelId}.`)
    }
    const groupsEntries = basePlan.groups.flatMap((group) => {
      if (!group.selectable || group.estimatedTotalBytes === undefined) return []
      const groupId = buildVersionedGroupId(group.id, snapshot.shortCommitHash)
      const rootDir = getLocalCt2ModelArtifactGroupRoot(this.cacheDir, modelId, groupId)
      return [
        [
          groupId,
          {
            id: groupId,
            baseGroupId: group.id,
            label: group.label,
            displayLabel: group.label,
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
          } satisfies LocalModelProfileManifestGroup,
        ] as const,
      ]
    })
    if (groupsEntries.length === 0) {
      throw new Error(`No selectable CT2 model artifacts were found for ${modelId}.`)
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
      throw new Error(`Unknown CT2 model artifact group: ${groupId}.`)
    }
    const files = manifestGroup.files
    const totalBytes = manifestGroup.estimatedTotalBytes
    const current = await this.readSelectedModelState(modelId, groupId)
    const currentGroup = current.groupsState[groupId]
    const downloadedFiles = await reconcileGroupFilesFromDisk({
      rootDir: manifestGroup.rootDir,
      manifestGroup,
      currentFiles: currentGroup?.files ?? [],
    })
    let bytesDownloaded = sumDownloadedBytes(downloadedFiles)
    if (files.length === 0 || totalBytes === undefined) {
      throw new Error('No concrete CT2 model download files were selected.')
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
      const sourceUrl =
        file.sourceUrl ??
        `${manifest.endpoint}/${modelId}/resolve/${manifestGroup.commitHash}/${file.path}`
      await downloadUrlFileWithProgress({
        url: sourceUrl,
        targetPath: join(manifestGroup.rootDir, file.path),
        expectedSizeBytes: file.sizeBytes,
        retryPolicy: this.networkRetryPolicy,
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
            status:
              boundedFileBytes >= (file.sizeBytes ?? Number.POSITIVE_INFINITY)
                ? 'downloaded'
                : 'downloading',
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
        onRetry: async ({ retryDelayMs }) => {
          await this.emitDownloadProgress({
            modelId,
            groupId,
            sessionId,
            message: `Connection interrupted while downloading ${file.path}. Retrying automatically in ${formatDuration(retryDelayMs)}.`,
            totalBytes,
            bytesDownloaded:
              bytesDownloaded -
              previousFileBytes +
              (downloadedFiles[fileIndex]?.downloadedBytes ?? 0),
            files: downloadedFiles,
          })
        },
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

    await this.finishDownload(modelId, groupId, sessionId, true, `CT2 model ${modelId} is ready.`)
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
    const projected = await this.refreshCachedState(nextState, input.groupId, {
      revalidateDisk: true,
    })
    await this.store.upsert(projected)
    this.emitLog({
      engineId: 'local-ct2',
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
    const projected = await this.refreshCachedState(nextState, groupId, {
      revalidateDisk: true,
    })
    await this.store.upsert(projected)
    this.sessions.delete(sessionKey)
    this.emitLog({
      engineId: 'local-ct2',
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
    return settings.translationEngines.localCt2.model
  }

  private async readSelectedGroupId(): Promise<string | undefined> {
    const settings = await this.options.globalSettingsManager.readSettings()
    return settings.translationEngines.localCt2.selectedGroupId
  }

  private async readHuggingFaceEndpoint(): Promise<string> {
    const settings = await this.options.globalSettingsManager.readSettings()
    return settings.translationEngines.localCt2.hfEndpoint
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
  if (left.local && right.local && leftProgress !== rightProgress) {
    return rightProgress - leftProgress
  }
  return right.downloads - left.downloads
}

function createSyntheticManifestFromPlan(input: {
  cacheDir: string
  modelId: string
  plan: LocalModelAssetState['plan']
}): LocalModelProfileManifest | undefined {
  const groups = input.plan?.groups ?? []
  const groupEntries = groups.flatMap((group) => {
    if (
      !group.commitHash ||
      !group.shortCommitHash ||
      group.estimatedTotalBytes === undefined ||
      !group.selectable
    ) {
      return []
    }
    return [
      [
        group.id,
        {
          id: group.id,
          baseGroupId: group.baseGroupId ?? group.id,
          label: group.label,
          displayLabel: group.label,
          description: group.description,
          profile: group.profile,
          dtype: group.dtype,
          commitHash: group.commitHash,
          shortCommitHash: group.shortCommitHash,
          rootDir:
            group.rootDir ??
            getLocalCt2ModelArtifactGroupRoot(input.cacheDir, input.modelId, group.id),
          estimatedTotalBytes: group.estimatedTotalBytes,
          selectable: group.selectable,
          files: group.files.map((file) => ({
            ...file,
            revision: file.revision ?? group.commitHash,
          })),
        } satisfies LocalModelProfileManifestGroup,
      ] as const,
    ]
  })
  if (groupEntries.length === 0) return undefined
  const firstGroup = groupEntries[0]?.[1]
  return LocalModelProfileManifestSchema.parse({
    modelId: input.modelId,
    source: 'huggingface',
    endpoint: '',
    revision: firstGroup?.commitHash ?? 'legacy',
    commitHash: firstGroup?.commitHash ?? 'legacy',
    shortCommitHash: firstGroup?.shortCommitHash ?? 'legacy',
    fetchedAt: 0,
    updatedAt: 0,
    groups: Object.fromEntries(groupEntries),
    groupOrder: groupEntries.map(([groupId]) => groupId),
  })
}

function buildPlanFromManifest(input: {
  modelId: string
  manifest: LocalModelProfileManifest
  groupsState: LocalModelAssetState['groupsState']
  selectedGroupId?: string
}) {
  const selectedGroupId =
    input.selectedGroupId && input.manifest.groups[input.selectedGroupId]?.selectable
      ? input.selectedGroupId
      : selectFirstManifestGroupId(input.manifest)
  const groups = input.manifest.groupOrder.flatMap((groupId): TranslationDownloadGroupPlan[] => {
    const manifestGroup = input.manifest.groups[groupId]
    if (!manifestGroup) return []
    const groupState = input.groupsState[groupId]
    return [
      {
        id: manifestGroup.id,
        label: formatManifestGroupChipLabel(input.manifest, manifestGroup),
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
  if (!selectedGroup) return undefined
  return {
    modelId: input.modelId,
    estimatedTotalBytes: selectedGroup.estimatedTotalBytes,
    files: selectedGroup.files,
    selectedGroupId: selectedGroup.id,
    groups,
  }
}

function formatManifestGroupChipLabel(
  manifest: LocalModelProfileManifest,
  group: LocalModelProfileManifestGroup
): string {
  if (group.commitHash === manifest.commitHash) return group.label
  return `${group.label} · ${group.shortCommitHash}`
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

function selectFirstManifestGroupId(
  manifest: LocalModelProfileManifest | undefined
): string | undefined {
  return manifest?.groupOrder.find((groupId) => manifest.groups[groupId]?.selectable)
}

function selectPlanGroup(
  plan: LocalModelAssetState['plan'] | null | undefined,
  selectedGroupId: string | undefined
): TranslationDownloadGroupPlan | null {
  if (!plan) return null
  if (selectedGroupId) {
    return plan.groups?.find((group) => group.id === selectedGroupId) ?? null
  }
  return plan.groups?.find((group) => group.selected) ?? plan.groups?.[0] ?? null
}

function removeManifestGroup(
  manifest: LocalModelProfileManifest | undefined,
  groupId: string
): LocalModelProfileManifest | undefined {
  if (!manifest) return undefined
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

function removePlanGroup(plan: LocalModelAssetState['plan'], groupId: string) {
  if (!plan) return undefined
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
        : (current?.status ?? 'not-downloaded')
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

function reconcileGroupFilesFromSnapshot(input: {
  manifestGroup: LocalModelProfileManifestGroup
  currentFiles: ReadonlyArray<LocalModelLifecycleFileState>
  currentStatus: LocalModelDownloadStatus
}): LocalModelLifecycleFileState[] {
  const currentFileByPath = new Map(input.currentFiles.map((file) => [file.path, file]))
  return input.manifestGroup.files.map((file) => {
    const current = currentFileByPath.get(file.path)
    const downloadedBytes =
      current?.downloadedBytes === undefined
        ? input.currentStatus === 'downloaded'
          ? file.sizeBytes
          : 0
        : file.sizeBytes === undefined
          ? current.downloadedBytes
          : Math.min(current.downloadedBytes, file.sizeBytes)
    const status =
      current?.status ??
      (file.sizeBytes !== undefined &&
      downloadedBytes !== undefined &&
      downloadedBytes >= file.sizeBytes
        ? 'downloaded'
        : input.currentStatus === 'downloaded'
          ? 'downloaded'
          : input.currentStatus === 'paused' ||
              input.currentStatus === 'downloading' ||
              input.currentStatus === 'error'
            ? input.currentStatus
            : 'not-downloaded')
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
  return status === 'queued' || status === 'downloading' || status === 'deleting'
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

function buildSessionKey(modelId: string, groupId: string): string {
  return `${modelId}::${groupId}`
}

function buildVersionedGroupId(baseGroupId: string, shortCommitHash: string): string {
  return `${sanitizeId(baseGroupId)}-${sanitizeId(shortCommitHash)}`
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

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms} ms`
  return `${(ms / 1_000).toFixed(ms >= 10_000 ? 0 : 1)} s`
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error('CT2 model download aborted.')
  }
}

async function readPathSize(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size
  } catch {
    return null
  }
}

async function downloadUrlFileWithProgress(input: {
  url: string
  targetPath: string
  expectedSizeBytes?: number
  retryPolicy: Required<Ct2ModelNetworkRetryPolicy>
  signal: AbortSignal
  onProgress: (downloadedBytes: number) => Promise<void>
  onRetry?: (input: { retryDelayMs: number }) => Promise<void>
}): Promise<void> {
  if (input.expectedSizeBytes !== undefined) {
    const existingTargetSize = await readPathSize(input.targetPath)
    if (existingTargetSize !== null && existingTargetSize >= input.expectedSizeBytes) {
      await input.onProgress(input.expectedSizeBytes)
      return
    }
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= input.retryPolicy.limit; attempt += 1) {
    try {
      throwIfAborted(input.signal)
      await streamDownloadAttempt(input)
      return
    } catch (error) {
      lastError = error
      if (!isRetryableDownloadError(error) || attempt === input.retryPolicy.limit) {
        throw error
      }
      const retryDelayMs = Math.min(
        input.retryPolicy.maxDelayMs,
        input.retryPolicy.delayMs * (attempt + 1)
      )
      await input.onRetry?.({ retryDelayMs })
      await delay(retryDelayMs, input.signal)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Cannot download ${input.url}.`)
}

async function streamDownloadAttempt(input: {
  url: string
  targetPath: string
  expectedSizeBytes?: number
  signal: AbortSignal
  onProgress: (downloadedBytes: number) => Promise<void>
}): Promise<void> {
  const incompletePath = `${input.targetPath}.incomplete`
  let resumeBytes = await readPathSize(incompletePath)
  if (
    resumeBytes !== null &&
    input.expectedSizeBytes !== undefined &&
    resumeBytes > input.expectedSizeBytes
  ) {
    await rm(incompletePath, { force: true })
    resumeBytes = 0
  }
  await mkdir(dirname(input.targetPath), { recursive: true })
  const headers = new Headers()
  if ((resumeBytes ?? 0) > 0) {
    headers.set('Range', `bytes=${resumeBytes}-`)
    await input.onProgress(resumeBytes ?? 0)
  }
  let response = await fetch(input.url, {
    headers,
    signal: input.signal,
  })
  if ((resumeBytes ?? 0) > 0 && response.status === 200) {
    await response.body?.cancel().catch(() => undefined)
    await rm(incompletePath, { force: true })
    resumeBytes = 0
    response = await fetch(input.url, {
      signal: input.signal,
    })
  }
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status} for ${input.url}.`)
  }
  const body = response.body
  if (!body) {
    throw new Error(`Invalid response body for ${input.url}.`)
  }
  const fileHandle = await open(incompletePath, (resumeBytes ?? 0) > 0 ? 'a' : 'w')
  let downloadedBytes = resumeBytes ?? 0
  try {
    const reader = body.getReader()
    while (true) {
      throwIfAborted(input.signal)
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      await fileHandle.write(value)
      downloadedBytes += value.byteLength
      await input.onProgress(downloadedBytes)
    }
  } finally {
    await fileHandle.close()
  }
  if (input.expectedSizeBytes !== undefined && downloadedBytes < input.expectedSizeBytes) {
    throw new Error(
      `Incomplete response for ${input.url}: downloaded ${downloadedBytes} of ${input.expectedSizeBytes} bytes.`
    )
  }
  await finalizeDownloadedFile({
    incompletePath,
    targetPath: input.targetPath,
  })
}

async function finalizeDownloadedFile(input: {
  incompletePath: string
  targetPath: string
}): Promise<void> {
  await mkdir(dirname(input.targetPath), { recursive: true })
  await rm(input.targetPath, { force: true })
  await rename(input.incompletePath, input.targetPath)
}

function isRetryableDownloadError(error: unknown): boolean {
  if (isRetryableNetworkError(error)) return true
  if (!(error instanceof Error)) return false
  return /status 408|status 409|status 425|status 429|status 500|status 502|status 503|status 504/u.test(
    error.message
  )
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timeout)
      reject(new Error('CT2 model download aborted.'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
