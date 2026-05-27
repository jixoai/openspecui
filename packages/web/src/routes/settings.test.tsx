import type {
  LocalModelAssetLog,
  LocalModelAssetState,
  LocalModelCatalogItem,
  TranslationModelDownloadPlan,
} from '@openspecui/core/translator'
import { LocalModelAssetStateSchema } from '@openspecui/core/translator'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSyncExternalStore, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Settings } from './settings'

const TEST_LOCAL_MODEL_COMMIT_HASH = 'abcdef1234567890abcdef1234567890abcdef12'
const TEST_LOCAL_MODEL_SHORT_COMMIT_HASH = TEST_LOCAL_MODEL_COMMIT_HASH.slice(0, 6)

function createLocalAssetStateForTest(
  input: Omit<LocalModelAssetState, 'version' | 'profileLoad' | 'groupsState'> &
    Partial<Pick<LocalModelAssetState, 'version' | 'profileLoad' | 'groupsState'>>
): LocalModelAssetState {
  return LocalModelAssetStateSchema.parse(input)
}

const {
  useConfigSubscriptionMock,
  useGlobalSettingsSubscriptionMock,
  staticModeMock,
  useServerStatusMock,
} = vi.hoisted(() => ({
  useConfigSubscriptionMock: vi.fn(),
  useGlobalSettingsSubscriptionMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
  useServerStatusMock: vi.fn(),
}))

const tocRenderMock = vi.hoisted(() => vi.fn())

const { prepareBrowserTranslationMock, updateConfigMock, updateGlobalSettingsMock } = vi.hoisted(
  () => ({
    prepareBrowserTranslationMock: vi.fn(),
    updateConfigMock: vi.fn(),
    updateGlobalSettingsMock: vi.fn(),
  })
)

const browserTranslationMock = vi.hoisted(() => ({
  getState: vi.fn(() => null),
  scan: vi.fn(async (targetLanguage: string) => ({
    state: 'ready',
    message: 'Browser translation pairs: 1 downloadable.',
    table: {
      targetLanguage,
      checked: 1,
      total: 1,
      updatedAt: 1,
      rows: [
        {
          sourceLanguage: 'en',
          targetLanguage,
          availability: 'downloadable',
        },
      ],
    },
  })),
  createExecution: vi.fn(() => ({
    factory: {
      create: vi.fn(async () => ({
        batchTranslate: async function* (inputs: string[]) {
          yield { index: 0, output: `browser:${inputs[0] ?? ''}` }
        },
        destroy: vi.fn(),
      })),
    },
    cacheIdentity: {
      engineId: 'browser',
      translatorContractVersion: 2,
    },
  })),
}))

const {
  translationEnginesMock,
  localModelsMock,
  restoreTranslationMocks,
  emitLocalModelLog,
  createDefaultLocalAssetState,
  createDefaultLocalDownloadPlan,
} = vi.hoisted(() => {
  let localModelsSubscribeLogHandlers:
    | {
        onData: (log: LocalModelAssetLog) => void
        onError?: (error: unknown) => void
      }
    | undefined

  const createDefaultLocalDownloadPlan = (
    modelId: string,
    selectedGroupId = 'q8'
  ): TranslationModelDownloadPlan => {
    const withRevision = (
      files: TranslationModelDownloadPlan['files']
    ): TranslationModelDownloadPlan['files'] =>
      files.map((file) => ({
        ...file,
        revision: TEST_LOCAL_MODEL_COMMIT_HASH,
        sourceUrl: `https://huggingface.co/${modelId}/resolve/${TEST_LOCAL_MODEL_COMMIT_HASH}/${file.path}`,
      }))
    const q8Files = withRevision([
      { path: 'config.json', sizeBytes: 1503, required: true },
      { path: 'generation_config.json', sizeBytes: 293, required: true },
      { path: 'source.spm', sizeBytes: 806435, required: true },
      { path: 'target.spm', sizeBytes: 804600, required: true },
      { path: 'onnx/encoder_model_quantized.onnx', sizeBytes: 52848230, required: true },
      { path: 'onnx/decoder_model_merged_quantized.onnx', sizeBytes: 193567130, required: true },
    ])
    const fp16Files = withRevision([
      { path: 'config.json', sizeBytes: 1503, required: true },
      { path: 'generation_config.json', sizeBytes: 293, required: true },
      { path: 'source.spm', sizeBytes: 806435, required: true },
      { path: 'target.spm', sizeBytes: 804600, required: true },
      { path: 'onnx/encoder_model_fp16.onnx', sizeBytes: 209715200, required: true },
      { path: 'onnx/decoder_model_merged_fp16.onnx', sizeBytes: 524288000, required: true },
    ])
    const groups: NonNullable<TranslationModelDownloadPlan['groups']> = [
      {
        id: 'q8',
        label: 'q8 (8-bit)',
        description: '8-bit quantized ONNX profile.',
        profile: 'q8',
        dtype: 'q8',
        commitHash: TEST_LOCAL_MODEL_COMMIT_HASH,
        shortCommitHash: TEST_LOCAL_MODEL_SHORT_COMMIT_HASH,
        estimatedTotalBytes: 246415360,
        selectable: true,
        selected: selectedGroupId === 'q8',
        files: q8Files,
      },
      {
        id: 'fp16',
        label: 'fp16',
        description: 'fp16 ONNX profile.',
        profile: 'fp16',
        dtype: 'fp16',
        commitHash: TEST_LOCAL_MODEL_COMMIT_HASH,
        shortCommitHash: TEST_LOCAL_MODEL_SHORT_COMMIT_HASH,
        estimatedTotalBytes: 734003200,
        selectable: true,
        selected: selectedGroupId === 'fp16',
        files: fp16Files,
      },
    ]
    const selectedGroup = groups.find((group) => group.selected) ?? groups[0]
    return {
      modelId,
      estimatedTotalBytes: selectedGroup.estimatedTotalBytes,
      selectedGroupId: selectedGroup.id,
      files: selectedGroup.files,
      groups,
    }
  }
  const createDefaultLocalAssetState = (
    modelId: string,
    selectedGroupId = 'q8'
  ): LocalModelAssetState => {
    const plan = createDefaultLocalDownloadPlan(modelId, selectedGroupId)
    return createLocalAssetStateForTest({
      modelId,
      status: 'not-downloaded',
      selected: true,
      progress: 0,
      resumable: false,
      plan,
      files: plan.files.map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: 0,
      })),
      updatedAt: 100,
    })
  }
  const createDefaultLocalModel = (): LocalModelCatalogItem => {
    const asset = createDefaultLocalAssetState('onnx-community/opus-mt-en-zh')
    return {
      id: 'onnx-community/opus-mt-en-zh',
      label: 'onnx-community/opus-mt-en-zh',
      summary: 'Previously selected local model. Estimated download 235 MB.',
      downloads: 0,
      likes: 0,
      tags: ['local'],
      compatibility: {
        transformersJs: true,
        onnx: true,
        localRuntimeVerified: true,
      },
      size: {
        estimatedTotalBytes: 246415360,
        primaryBytes: 246415360,
      },
      downloadGroups: asset.plan?.groups,
      languageMatch: {
        sourceMatched: false,
        targetMatched: true,
        directionalScore: 0,
      },
      asset,
      selectable: true,
      local: true,
    }
  }
  const createDefaultRemoteItems = (): LocalModelCatalogItem[] => [
    {
      id: 'onnx-community/opus-mt-en-zh',
      label: 'onnx-community/opus-mt-en-zh',
      summary:
        'Verified Transformers.js + ONNX model. Estimated download 235 MB. Tagged for translation.',
      downloads: 63,
      likes: 0,
      trendingScore: 4,
      tags: ['transformers.js', 'onnx', 'translation', 'en', 'zh'],
      compatibility: {
        transformersJs: true,
        onnx: true,
        localRuntimeVerified: true,
      },
      size: {
        estimatedTotalBytes: 246415360,
        primaryBytes: 246415360,
      },
      downloadGroups: [
        {
          id: 'q8',
          label: 'q8 (8-bit)',
          description: '8-bit quantized ONNX profile.',
          profile: 'q8',
          dtype: 'q8',
          estimatedTotalBytes: 246415360,
          selectable: true,
          selected: true,
          files: [
            { path: 'config.json', sizeBytes: 1503, required: true },
            { path: 'generation_config.json', sizeBytes: 293, required: true },
            { path: 'source.spm', sizeBytes: 806435, required: true },
            { path: 'target.spm', sizeBytes: 804600, required: true },
            { path: 'onnx/encoder_model_quantized.onnx', sizeBytes: 52848230, required: true },
            {
              path: 'onnx/decoder_model_merged_quantized.onnx',
              sizeBytes: 193567130,
              required: true,
            },
          ],
        },
        {
          id: 'fp16',
          label: 'fp16',
          description: 'fp16 ONNX profile.',
          profile: 'fp16',
          dtype: 'fp16',
          estimatedTotalBytes: 734003200,
          selectable: true,
          selected: false,
          files: [
            { path: 'config.json', sizeBytes: 1503, required: true },
            { path: 'generation_config.json', sizeBytes: 293, required: true },
            { path: 'source.spm', sizeBytes: 806435, required: true },
            { path: 'target.spm', sizeBytes: 804600, required: true },
            { path: 'onnx/encoder_model_fp16.onnx', sizeBytes: 209715200, required: true },
            {
              path: 'onnx/decoder_model_merged_fp16.onnx',
              sizeBytes: 524288000,
              required: true,
            },
          ],
        },
      ],
      languageMatch: {
        sourceMatched: false,
        targetMatched: true,
        directionalScore: 1,
      },
      asset: createLocalAssetStateForTest({
        modelId: 'onnx-community/opus-mt-en-zh',
        status: 'not-downloaded',
        selected: true,
        progress: 0,
        resumable: false,
        updatedAt: 100,
        files: [],
      }),
      selectable: true,
      local: false,
    },
    {
      id: 'Xenova/unknown-model',
      label: 'Xenova/unknown-model',
      summary: 'Missing known file size.',
      downloads: 10,
      likes: 1,
      tags: ['transformers.js', 'onnx', 'translation'],
      compatibility: {
        transformersJs: true,
        onnx: true,
        localRuntimeVerified: true,
      },
      size: {
        estimatedTotalBytes: undefined,
        primaryBytes: undefined,
      },
      downloadGroups: [
        {
          id: 'q8',
          label: 'q8 (8-bit)',
          description: '8-bit quantized ONNX profile.',
          profile: 'q8',
          dtype: 'q8',
          selectable: false,
          selected: false,
          files: [
            { path: 'onnx/encoder_model_quantized.onnx', required: true },
            { path: 'onnx/decoder_model_merged_quantized.onnx', required: true },
          ],
        },
      ],
      languageMatch: {
        sourceMatched: false,
        targetMatched: true,
        directionalScore: 1,
      },
      asset: createLocalAssetStateForTest({
        modelId: 'Xenova/unknown-model',
        status: 'not-downloaded',
        selected: false,
        updatedAt: 100,
        resumable: false,
        files: [],
      }),
      selectable: false,
      local: false,
    },
  ]
  const translationEnginesMock = {
    getModelDownloadPlan: vi.fn(),
    batchTranslate: vi.fn(),
    getInstallStatus: vi.fn(),
    install: vi.fn(),
    installStream: vi.fn(),
  }
  const localModelsMock = {
    listLocal: vi.fn(),
    searchRemote: vi.fn(),
    searchRemoteStream: vi.fn(
      (
        input: { requestId: string; query?: string; targetLanguage?: string; limit?: number },
        handlers: {
          onData: (event: {
            requestId: string
            phase: 'candidates' | 'enriched' | 'complete' | 'error'
            items?: LocalModelCatalogItem[]
          }) => void
          onError?: (error: unknown) => void
        }
      ) => {
        const unsubscribe = vi.fn()
        queueMicrotask(async () => {
          if (unsubscribe.mock.calls.length > 0) return
          const remote = (await localModelsMock.searchRemote()) as {
            items: LocalModelCatalogItem[]
          }
          handlers.onData({
            requestId: input.requestId,
            phase: 'candidates',
            items: remote.items.map((item) => ({ ...item, downloadGroups: undefined })),
          })
          if (unsubscribe.mock.calls.length > 0) return
          handlers.onData({
            requestId: input.requestId,
            phase: 'enriched',
            items: remote.items,
          })
          if (unsubscribe.mock.calls.length > 0) return
          handlers.onData({
            requestId: input.requestId,
            phase: 'complete',
            items: remote.items,
          })
        })
        return { unsubscribe }
      }
    ),
    state: vi.fn(),
    panelState: vi.fn(
      async ({
        modelId,
        selectedGroupId,
      }: {
        modelId: string
        selectedGroupId?: string
      }): Promise<{
        modelId: string
        selectedGroupId?: string
        asset: LocalModelAssetState
        downloadPlan: TranslationModelDownloadPlan | null
      }> => {
        const asset = await localModelsMock.state({ modelId, selectedGroupId })
        return {
          modelId,
          selectedGroupId,
          asset,
          downloadPlan: asset.plan ?? createDefaultLocalDownloadPlan(modelId),
        }
      }
    ),
    subscribeLogs: vi.fn(
      (
        _input: undefined,
        handlers: {
          onData: (log: LocalModelAssetLog) => void
          onError?: (error: unknown) => void
        }
      ) => {
        localModelsSubscribeLogHandlers = handlers
        return { unsubscribe: vi.fn() }
      }
    ),
    markSelected: vi.fn(async () => ({ success: true })),
    download: vi.fn(async () => ({ sessionId: 'session-1' })),
    pause: vi.fn(async () => ({ success: true })),
    resume: vi.fn(async () => ({ sessionId: 'session-2' })),
    delete: vi.fn(async () => ({ success: true })),
  }
  const restoreTranslationMocks = () => {
    translationEnginesMock.getInstallStatus.mockImplementation(async ({ engineId }) => {
      if (engineId === 'browser') {
        return { state: 'installed', message: 'Browser translator is built in.' }
      }
      if (engineId === 'openai') {
        return { state: 'installed', message: 'OpenAI completion translator is bundled.' }
      }
      return {
        state: 'installed',
        message: 'Local-Transformers runtime dependencies are installed.',
      }
    })
    translationEnginesMock.install.mockImplementation(async ({ engineId }) =>
      translationEnginesMock.getInstallStatus({ engineId })
    )
    translationEnginesMock.installStream.mockImplementation(
      (
        input: { engineId: 'browser' | 'local' | 'openai' },
        handlers: {
          onData: (event: {
            type: 'status' | 'log' | 'exit'
            status?: { state: string; message?: string; progress?: number; error?: string }
            stream?: 'stdout' | 'stderr'
            text?: string
          }) => void
          onError?: (error: unknown) => void
        }
      ) => {
        const unsubscribe = vi.fn()
        queueMicrotask(() => {
          if (unsubscribe.mock.calls.length > 0) return
          const installedStatus =
            input.engineId === 'browser'
              ? { state: 'installed', message: 'Browser translator is built in.' }
              : input.engineId === 'openai'
                ? { state: 'installed', message: 'OpenAI completion translator is bundled.' }
                : {
                    state: 'installed',
                    message: 'Local-Transformers runtime dependencies are installed.',
                  }
          handlers.onData({ type: 'status', status: installedStatus })
          if (unsubscribe.mock.calls.length > 0) return
          handlers.onData({ type: 'exit', status: installedStatus })
        })
        return { unsubscribe }
      }
    )
    translationEnginesMock.batchTranslate.mockImplementation(
      (
        input: { inputs?: string[] },
        handlers: {
          onData: (event: { index: number; output: string }) => void
          onComplete?: () => void
          onError?: (error: unknown) => void
        }
      ) => {
        const unsubscribe = vi.fn()
        queueMicrotask(() => {
          if (unsubscribe.mock.calls.length > 0) return
          handlers.onData({
            index: 0,
            output: `server:${input.inputs?.[0] ?? ''}`,
          })
          if (unsubscribe.mock.calls.length > 0) return
          handlers.onComplete?.()
        })
        return { unsubscribe }
      }
    )
    localModelsMock.listLocal.mockImplementation(
      async (): Promise<{ items: LocalModelCatalogItem[] }> => ({
        items: [createDefaultLocalModel()],
      })
    )
    localModelsMock.searchRemote.mockImplementation(
      async (): Promise<{ items: LocalModelCatalogItem[] }> => ({
        items: createDefaultRemoteItems(),
      })
    )
    localModelsMock.state.mockImplementation(
      async ({
        modelId,
        selectedGroupId,
      }: {
        modelId: string
        selectedGroupId?: string
      }): Promise<LocalModelAssetState> => createDefaultLocalAssetState(modelId, selectedGroupId)
    )
    localModelsMock.panelState.mockImplementation(
      async ({ modelId, selectedGroupId }: { modelId: string; selectedGroupId?: string }) => {
        const asset = await localModelsMock.state({ modelId, selectedGroupId })
        return {
          modelId,
          selectedGroupId,
          asset,
          downloadPlan: asset.plan ?? createDefaultLocalDownloadPlan(modelId),
        }
      }
    )
  }
  restoreTranslationMocks()
  return {
    translationEnginesMock,
    localModelsMock,
    restoreTranslationMocks,
    createDefaultLocalAssetState,
    createDefaultLocalDownloadPlan,
    emitLocalModelLog(log: LocalModelAssetLog) {
      localModelsSubscribeLogHandlers?.onData(log)
    },
  }
})

function dispatchPopoverToggle(element: Element, newState: 'open' | 'closed') {
  const event = new Event('toggle')
  Object.defineProperty(event, 'newState', {
    value: newState,
  })
  Object.defineProperty(event, 'oldState', {
    value: newState === 'open' ? 'closed' : 'open',
  })
  fireEvent(element, event)
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred promise was resolved before initialization.')
  }
  let reject: (reason?: unknown) => void = () => {
    throw new Error('Deferred promise was rejected before initialization.')
  }
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function createQ8PlanFilesForTest(): TranslationModelDownloadPlan['files'] {
  return [
    { path: 'config.json', sizeBytes: 1503, required: true },
    { path: 'generation_config.json', sizeBytes: 293, required: true },
    { path: 'source.spm', sizeBytes: 806435, required: true },
    { path: 'target.spm', sizeBytes: 804600, required: true },
    { path: 'onnx/encoder_model_quantized.onnx', sizeBytes: 52848230, required: true },
    { path: 'onnx/decoder_model_merged_quantized.onnx', sizeBytes: 193567130, required: true },
  ]
}

function withLocalRevisionFiles(
  modelId: string,
  files: TranslationModelDownloadPlan['files']
): TranslationModelDownloadPlan['files'] {
  return files.map((file) => ({
    ...file,
    revision: TEST_LOCAL_MODEL_COMMIT_HASH,
    sourceUrl: `https://huggingface.co/${modelId}/resolve/${TEST_LOCAL_MODEL_COMMIT_HASH}/${file.path}`,
  }))
}

function createQ8PlanForTest(modelId: string): TranslationModelDownloadPlan {
  const files = withLocalRevisionFiles(modelId, createQ8PlanFilesForTest())
  return {
    modelId,
    estimatedTotalBytes: 246415360,
    selectedGroupId: 'q8',
    files,
    groups: [
      {
        id: 'q8',
        label: 'q8 (8-bit)',
        description: '8-bit quantized ONNX profile.',
        profile: 'q8',
        dtype: 'q8',
        commitHash: TEST_LOCAL_MODEL_COMMIT_HASH,
        shortCommitHash: TEST_LOCAL_MODEL_SHORT_COMMIT_HASH,
        status: 'downloaded',
        estimatedTotalBytes: 246415360,
        selectable: true,
        selected: true,
        files,
      },
    ],
  }
}

function createFp16PlanFilesForTest(): TranslationModelDownloadPlan['files'] {
  return [
    { path: 'config.json', sizeBytes: 1503, required: true },
    { path: 'generation_config.json', sizeBytes: 293, required: true },
    { path: 'source.spm', sizeBytes: 806435, required: true },
    { path: 'target.spm', sizeBytes: 804600, required: true },
    { path: 'onnx/encoder_model_fp16.onnx', sizeBytes: 209715200, required: true },
    { path: 'onnx/decoder_model_merged_fp16.onnx', sizeBytes: 524288000, required: true },
  ]
}

function createQ4PlanFilesForTest(): TranslationModelDownloadPlan['files'] {
  return [
    { path: 'config.json', sizeBytes: 1503, required: true },
    { path: 'generation_config.json', sizeBytes: 293, required: true },
    { path: 'source.spm', sizeBytes: 806435, required: true },
    { path: 'target.spm', sizeBytes: 804600, required: true },
    { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 31457280, required: true },
    { path: 'onnx/decoder_model_merged_q4.onnx', sizeBytes: 94371840, required: true },
  ]
}

function createQ4f16PlanFilesForTest(): TranslationModelDownloadPlan['files'] {
  return [
    { path: 'config.json', sizeBytes: 1503, required: true },
    { path: 'generation_config.json', sizeBytes: 293, required: true },
    { path: 'source.spm', sizeBytes: 806435, required: true },
    { path: 'special_tokens_map.json', sizeBytes: 74, required: true },
    { path: 'target.spm', sizeBytes: 804600, required: true },
    { path: 'tokenizer_config.json', sizeBytes: 849, required: true },
    { path: 'tokenizer.json', sizeBytes: 6380952, required: true },
    { path: 'vocab.json', sizeBytes: 1747795, required: true },
    { path: 'onnx/encoder_model_q4f16.onnx', sizeBytes: 77910507, required: true },
    { path: 'onnx/decoder_model_merged_q4f16.onnx', sizeBytes: 161874559, required: true },
  ]
}

function createGroupedLocalPlanForTest(modelId: string): TranslationModelDownloadPlan {
  const q8Files = withLocalRevisionFiles(modelId, createQ8PlanFilesForTest())
  const fp16Files = withLocalRevisionFiles(modelId, createFp16PlanFilesForTest())
  return {
    modelId,
    estimatedTotalBytes: 246415360,
    selectedGroupId: 'q8',
    files: q8Files,
    groups: [
      {
        id: 'q8',
        label: 'q8 (8-bit)',
        description: '8-bit quantized ONNX profile.',
        profile: 'q8',
        dtype: 'q8',
        commitHash: TEST_LOCAL_MODEL_COMMIT_HASH,
        shortCommitHash: TEST_LOCAL_MODEL_SHORT_COMMIT_HASH,
        status: 'downloaded',
        estimatedTotalBytes: 246415360,
        selectable: true,
        selected: true,
        files: q8Files,
      },
      {
        id: 'fp16',
        label: 'fp16',
        description: 'fp16 ONNX profile.',
        profile: 'fp16',
        dtype: 'fp16',
        commitHash: TEST_LOCAL_MODEL_COMMIT_HASH,
        shortCommitHash: TEST_LOCAL_MODEL_SHORT_COMMIT_HASH,
        status: 'not-downloaded',
        estimatedTotalBytes: 734003200,
        selectable: true,
        selected: false,
        files: fp16Files,
      },
    ],
  }
}

function createTriStateGroupedLocalPlanForTest(modelId: string): TranslationModelDownloadPlan {
  const q8Files = withLocalRevisionFiles(modelId, createQ8PlanFilesForTest())
  const q4Files = withLocalRevisionFiles(modelId, createQ4PlanFilesForTest())
  const fp16Files = withLocalRevisionFiles(modelId, createFp16PlanFilesForTest())
  return {
    modelId,
    estimatedTotalBytes: 126040951,
    selectedGroupId: 'q4',
    files: q4Files,
    groups: [
      {
        id: 'q8',
        label: 'q8 (8-bit)',
        description: '8-bit quantized ONNX profile.',
        profile: 'q8',
        dtype: 'q8',
        commitHash: TEST_LOCAL_MODEL_COMMIT_HASH,
        shortCommitHash: TEST_LOCAL_MODEL_SHORT_COMMIT_HASH,
        status: 'downloaded',
        estimatedTotalBytes: 246415360,
        selectable: true,
        selected: false,
        files: q8Files,
      },
      {
        id: 'q4',
        label: 'q4',
        description: '4-bit quantized ONNX profile.',
        profile: 'q4',
        dtype: 'q4',
        commitHash: TEST_LOCAL_MODEL_COMMIT_HASH,
        shortCommitHash: TEST_LOCAL_MODEL_SHORT_COMMIT_HASH,
        status: 'paused',
        estimatedTotalBytes: 126040951,
        selectable: true,
        selected: true,
        files: q4Files,
      },
      {
        id: 'fp16',
        label: 'fp16',
        description: 'fp16 ONNX profile.',
        profile: 'fp16',
        dtype: 'fp16',
        commitHash: TEST_LOCAL_MODEL_COMMIT_HASH,
        shortCommitHash: TEST_LOCAL_MODEL_SHORT_COMMIT_HASH,
        status: 'not-downloaded',
        estimatedTotalBytes: 734003200,
        selectable: true,
        selected: false,
        files: fp16Files,
      },
    ],
  }
}

function createQ4AndQ4f16GroupedLocalPlanForTest(modelId: string): TranslationModelDownloadPlan {
  const q4Files = withLocalRevisionFiles(modelId, [
    { path: 'config.json', sizeBytes: 1520, required: true },
    { path: 'generation_config.json', sizeBytes: 288, required: true },
    { path: 'source.spm', sizeBytes: 806435, required: true },
    { path: 'special_tokens_map.json', sizeBytes: 74, required: true },
    { path: 'target.spm', sizeBytes: 804600, required: true },
    { path: 'tokenizer_config.json', sizeBytes: 849, required: true },
    { path: 'tokenizer.json', sizeBytes: 6380952, required: true },
    { path: 'vocab.json', sizeBytes: 1747795, required: true },
    { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 146255322, required: true },
    { path: 'onnx/decoder_model_merged_q4.onnx', sizeBytes: 151040867, required: true },
  ])
  const q4f16Files = withLocalRevisionFiles(
    modelId,
    createQ4f16PlanFilesForTest().map((file) => ({
      ...file,
      sizeBytes:
        file.path === 'config.json'
          ? 1520
          : file.path === 'generation_config.json'
            ? 288
            : file.path === 'onnx/encoder_model_q4f16.onnx'
              ? 77910507
              : file.path === 'onnx/decoder_model_merged_q4f16.onnx'
                ? 161874559
                : file.sizeBytes,
    }))
  )
  return {
    modelId,
    estimatedTotalBytes: 307038702,
    selectedGroupId: 'q4',
    files: q4Files,
    groups: [
      {
        id: 'q4',
        label: 'q4 (4-bit)',
        description: '4-bit quantized ONNX profile.',
        profile: 'q4',
        dtype: 'q4',
        commitHash: TEST_LOCAL_MODEL_COMMIT_HASH,
        shortCommitHash: TEST_LOCAL_MODEL_SHORT_COMMIT_HASH,
        status: 'downloaded',
        estimatedTotalBytes: 307038702,
        selectable: true,
        selected: true,
        files: q4Files,
      },
      {
        id: 'q4f16',
        label: 'q4f16',
        description: '4-bit block quantized fp16 ONNX profile.',
        profile: 'q4f16',
        dtype: 'q4f16',
        commitHash: TEST_LOCAL_MODEL_COMMIT_HASH,
        shortCommitHash: TEST_LOCAL_MODEL_SHORT_COMMIT_HASH,
        status: 'paused',
        estimatedTotalBytes: 249527579,
        selectable: true,
        selected: false,
        files: q4f16Files,
      },
    ],
  }
}

function createQ8AssetFilesForTest(
  downloadedBytesByPath: Partial<Record<string, number>>
): LocalModelAssetState['files'] {
  return createQ8PlanFilesForTest().map((file) => ({
    path: file.path,
    sizeBytes: file.sizeBytes,
    downloadedBytes: downloadedBytesByPath[file.path] ?? 0,
  }))
}

function createDownloadedQ8AssetFilesForTest(): LocalModelAssetState['files'] {
  return createQ8PlanFilesForTest().map((file) => ({
    path: file.path,
    sizeBytes: file.sizeBytes,
    downloadedBytes: file.sizeBytes,
  }))
}

function createPlanAssetFilesForTest(
  planFiles: ReadonlyArray<TranslationModelDownloadPlan['files'][number]>,
  downloadedBytesByPath: Partial<Record<string, number>>
): LocalModelAssetState['files'] {
  const uniqueFiles = new Map<string, TranslationModelDownloadPlan['files'][number]>()
  for (const file of planFiles) {
    uniqueFiles.set(file.path, file)
  }
  return [...uniqueFiles.values()].map((file) => ({
    path: file.path,
    sizeBytes: file.sizeBytes,
    downloadedBytes: downloadedBytesByPath[file.path] ?? 0,
  }))
}

function createDownloadedLocalModelForTest(modelId: string): LocalModelCatalogItem {
  const plan = createGroupedLocalPlanForTest(modelId)
  return {
    id: modelId,
    label: modelId,
    summary: 'Downloaded local model.',
    downloads: 0,
    likes: 0,
    tags: ['local'],
    compatibility: {
      transformersJs: true,
      onnx: true,
      localRuntimeVerified: true,
    },
    size: {
      estimatedTotalBytes: 246415360,
      primaryBytes: 246415360,
    },
    downloadGroups: plan.groups,
    languageMatch: {
      sourceMatched: false,
      targetMatched: true,
      directionalScore: 0,
    },
    asset: createLocalAssetStateForTest({
      modelId,
      status: 'downloaded',
      selected: true,
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      resumable: false,
      plan,
      files: createDownloadedQ8AssetFilesForTest(),
      updatedAt: 100,
    }),
    selectable: true,
    local: true,
  }
}

function createFullyDownloadedGroupedLocalModelForTest(modelId: string): LocalModelCatalogItem {
  const plan = createTriStateGroupedLocalPlanForTest(modelId)
  return {
    id: modelId,
    label: modelId,
    summary: 'Downloaded local model.',
    downloads: 0,
    likes: 0,
    tags: ['local'],
    compatibility: {
      transformersJs: true,
      onnx: true,
      localRuntimeVerified: true,
    },
    size: {
      estimatedTotalBytes: 246415360,
      primaryBytes: 246415360,
    },
    downloadGroups: plan.groups?.map((group) => ({
      ...group,
      status: 'downloaded' as const,
    })),
    languageMatch: {
      sourceMatched: false,
      targetMatched: true,
      directionalScore: 0,
    },
    asset: createLocalAssetStateForTest({
      modelId,
      status: 'downloaded',
      selected: true,
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      resumable: false,
      plan: {
        ...plan,
        groups: plan.groups?.map((group) => ({
          ...group,
          status: 'downloaded' as const,
        })),
      },
      files: createPlanAssetFilesForTest(plan.groups?.flatMap((group) => group.files) ?? [], {
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 52848230,
        'onnx/decoder_model_merged_quantized.onnx': 193567130,
        'onnx/encoder_model_q4.onnx': 10485760,
        'onnx/decoder_model_merged_q4.onnx': 10485760,
        'onnx/encoder_model_fp16.onnx': 209715200,
        'onnx/decoder_model_merged_fp16.onnx': 524288000,
      }),
      updatedAt: 100,
    }),
    selectable: true,
    local: true,
  }
}

function getTranslationTargetLanguageDialog() {
  return screen.getByRole('dialog', { name: 'Select translation target language' })
}

const reactQueryMockStore = vi.hoisted(() => {
  const cache = new Map<string, unknown>()
  const listeners = new Set<() => void>()
  let version = 0

  const serialize = (queryKey?: readonly unknown[]) => JSON.stringify(queryKey ?? [])
  const notify = () => {
    version += 1
    for (const listener of listeners) listener()
  }

  return {
    serialize,
    getSnapshot: () => version,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getQueryData<T>(queryKey?: readonly unknown[]) {
      return cache.get(serialize(queryKey)) as T | undefined
    },
    setQueryData<T>(
      queryKey: readonly unknown[] | undefined,
      updater: T | ((current: T | undefined) => T | undefined)
    ) {
      if (!queryKey) return undefined
      const key = serialize(queryKey)
      const current = cache.get(key) as T | undefined
      const next =
        typeof updater === 'function'
          ? (updater as (current: T | undefined) => T | undefined)(current)
          : updater
      if (next === undefined) {
        cache.delete(key)
      } else {
        cache.set(key, next)
      }
      notify()
      return next
    },
    seedQueryData<T>(queryKey: readonly unknown[] | undefined, value: T) {
      if (!queryKey) return
      cache.set(serialize(queryKey), value)
    },
    has(queryKey?: readonly unknown[]) {
      return cache.has(serialize(queryKey))
    },
    reset() {
      cache.clear()
      notify()
    },
  }
})

function normalizeMockQueryResult<TData>(
  value: TData | { data?: TData; isLoading?: boolean; refetch?: () => void } | undefined
) {
  if (value && typeof value === 'object' && 'data' in value) {
    return {
      isLoading: false,
      refetch: vi.fn(),
      ...value,
    }
  }
  return {
    data: value,
    isLoading: false,
    refetch: vi.fn(),
  }
}

vi.mock('@tanstack/react-query', () => ({
  useMutation: ({
    mutationFn,
    onSuccess,
    onError,
  }: {
    mutationFn?: (variables: unknown) => unknown
    onSuccess?: (data: unknown, variables: unknown) => void | Promise<void>
    onError?: (error: unknown, variables: unknown) => void | Promise<void>
  }) => ({
    mutate: vi.fn((variables: unknown) => {
      try {
        const result = mutationFn?.(variables)
        void Promise.resolve(result)
          .then((data) => onSuccess?.(data, variables))
          .catch((error) => onError?.(error, variables))
      } catch (error) {
        void onError?.(error, variables)
      }
    }),
    isPending: false,
    isSuccess: false,
  }),
  useQuery: ({ queryKey }: { queryKey?: readonly string[] }) => {
    useSyncExternalStore(
      reactQueryMockStore.subscribe,
      reactQueryMockStore.getSnapshot,
      reactQueryMockStore.getSnapshot
    )
    const key = queryKey?.join('.') ?? ''
    if (!reactQueryMockStore.has(queryKey)) {
      reactQueryMockStore.seedQueryData(queryKey, resolveQueryResultForKey(key))
      if (key.startsWith('localModels.state') && queryKey?.[1]) {
        void localModelsMock
          .state({
            modelId: queryKey[1],
            selectedGroupId: queryKey[2] || undefined,
          })
          .then((data: LocalModelAssetState) => {
            reactQueryMockStore.setQueryData(queryKey, {
              data,
              isLoading: false,
              refetch: vi.fn(),
            })
          })
      }
      if (key.startsWith('localModels.panelState') && queryKey?.[1]) {
        void localModelsMock
          .panelState({
            modelId: queryKey[1],
            selectedGroupId: queryKey[2] || undefined,
          })
          .then(
            (data: {
              modelId: string
              selectedGroupId?: string
              asset: LocalModelAssetState
              downloadPlan: TranslationModelDownloadPlan | null
            }) => {
              reactQueryMockStore.setQueryData(queryKey, {
                data,
                isLoading: false,
                refetch: vi.fn(),
              })
            }
          )
      }
    }
    return normalizeMockQueryResult(reactQueryMockStore.getQueryData(queryKey))
  },
  useQueryClient: () => ({
    setQueryData: reactQueryMockStore.setQueryData,
    getQueryData: reactQueryMockStore.getQueryData,
    invalidateQueries: vi.fn(),
  }),
}))

function resolveQueryResultForKey(key: string) {
  if (key === 'cli.getAllTools') {
    return { data: [{ value: 'claude', name: 'Claude', available: true }], isLoading: false }
  }
  if (key === 'cli.getDetectedProjectTools') {
    return { data: [{ value: 'claude', name: 'Claude' }], isLoading: false, refetch: vi.fn() }
  }
  if (key === 'cli.getProfileState') {
    return {
      data: {
        available: true,
        delivery: 'both',
        workflows: [],
        profile: 'core',
        driftStatus: 'in-sync',
        warningText: null,
      },
      isLoading: false,
      refetch: vi.fn(),
    }
  }
  if (key === 'cli.getToolInitStates') {
    return {
      data: [
        {
          toolId: 'claude',
          toolName: 'Claude',
          status: 'uninitialized',
          hasAnyArtifacts: false,
          expectedSkillCount: 0,
          presentExpectedSkillCount: 0,
          detectedSkillCount: 0,
          expectedCommandCount: 0,
          presentExpectedCommandCount: 0,
          detectedCommandCount: 0,
          missingSkillWorkflows: [],
          missingCommandWorkflows: [],
          unexpectedSkillWorkflows: [],
          unexpectedCommandWorkflows: [],
          legacyCommandWorkflows: [],
        },
      ],
      refetch: vi.fn(),
    }
  }
  if (key === 'cli.sniffGlobalCli') {
    return { data: { hasGlobal: true, version: '1.3.0', hasUpdate: false }, isLoading: false }
  }
  if (key === 'cli.checkAvailability') {
    return { data: { available: true, version: '1.3.0' }, isLoading: false, refetch: vi.fn() }
  }
  if (key === 'config.getEffectiveCliCommand') {
    return { data: 'openspec', refetch: vi.fn() }
  }
  if (key === 'config.get') {
    return {
      data: useConfigSubscriptionMock().data,
      isLoading: false,
      refetch: vi.fn(),
    }
  }
  if (key === 'globalSettings.get') {
    return {
      data: {
        translationCache: { entryLimit: 10000 },
        translationEngines: {
          openai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
          local: { model: 'Xenova/opus-mt-no-de', selectedGroupId: 'q8', hfEndpoint: '' },
        },
      },
      refetch: vi.fn(),
    }
  }
  if (key === 'translationEngines.list') {
    return {
      data: [
        {
          id: 'browser',
          label: 'Browser',
          description: 'Uses the browser Translator API and future browser-side providers.',
          technicalSummary:
            'Browser-native Web Translator adapter. Package payload is about 5 KB; browser language packs are managed by the browser.',
          runtime: 'browser',
          selected: true,
          installStatus: {
            state: 'installed',
            message: 'Browser translator is built in.',
          },
        },
        {
          id: 'local',
          label: 'Local-Transformers',
          description:
            'Runs a bundled local Transformers.js translation runtime with managed model files.',
          technicalSummary:
            'Server-side Transformers.js local adapter. Package payload is about 5 KB; selected model groups are downloaded separately and can range from tens to hundreds of MB.',
          runtime: 'server',
          selected: false,
          installStatus: {
            state: 'installed',
            message: 'Local-Transformers runtime dependencies are installed.',
          },
          model: 'Xenova/opus-mt-no-de',
        },
        {
          id: 'openai',
          label: 'OpenAI-Completion',
          description:
            'Uses an OpenAI-compatible TanStack OpenAI-Completion completion provider for context-aware translation.',
          technicalSummary:
            'Server-side TanStack OpenAI-Completion adapter for OpenAI-compatible APIs. Package payload is about 5 KB; model size stays with the remote provider.',
          runtime: 'server',
          selected: false,
          installStatus: {
            state: 'installed',
            message: 'OpenAI completion translator is bundled.',
          },
          model: 'gpt-4.1-mini',
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    }
  }
  if (key === 'localModels.listLocal') {
    return { data: undefined, isLoading: false, refetch: vi.fn() }
  }
  if (key === 'localModels.searchRemote') {
    return { data: undefined, isLoading: false, refetch: vi.fn() }
  }
  if (key.startsWith('localModels.state') || key.startsWith('localModels.panelState')) {
    return { data: undefined, isLoading: true, refetch: vi.fn() }
  }
  if (key === 'translationCache.stats') {
    return { data: { enabled: false, entryLimit: 10000, entries: 0 }, refetch: vi.fn() }
  }
  return { data: undefined, isLoading: false, refetch: vi.fn() }
}

vi.mock('@/components/terminal/terminal-invocation-settings', () => ({
  TerminalInvocationSettings: () => <div data-testid="terminal-invocation-settings" />,
}))

vi.mock('@/components/notifications/notification-settings', () => ({
  NotificationSettings: () => <div data-testid="notification-settings" />,
}))

vi.mock('@/components/sound-setting-control', () => ({
  SoundSettingControl: () => <div data-testid="sound-setting-control" />,
}))

vi.mock('@/components/cli-terminal', () => ({
  CliTerminal: () => <div data-testid="cli-terminal" />,
}))

vi.mock('@/components/toc', () => ({
  generateTimelineScope: () => '',
  Toc: ({ className, items }: { className?: string; items: { id: string; label: string }[] }) => {
    tocRenderMock({ className, itemIds: items.map((item) => item.id) })
    return <aside data-testid="settings-toc" className={className} />
  },
  TocSection: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}))

vi.mock('@/lib/browser-translation', () => ({
  createBrowserTranslationExecution: browserTranslationMock.createExecution,
  getBrowserSupportTableState: browserTranslationMock.getState,
  patchBrowserSupportTableRow: vi.fn((_targetLanguage, _row, _options) => ({
    state: 'ready',
    message: 'Browser translation pairs updated.',
    table: null,
  })),
  prepareBrowserTranslation: prepareBrowserTranslationMock,
  scanBrowserTranslationPairs: browserTranslationMock.scan,
}))

vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: () => staticModeMock(),
}))

vi.mock('@/lib/use-server-status', () => ({
  useServerStatus: () => useServerStatusMock(),
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => useConfigSubscriptionMock(),
  useGlobalSettingsSubscription: () => useGlobalSettingsSubscriptionMock(),
}))

vi.mock('@/lib/use-cli-runner', () => ({
  useCliRunner: () => ({
    lines: [],
    status: 'idle',
    commands: {
      replaceAll: vi.fn(),
      runAll: vi.fn(),
    },
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('@/lib/terminal-bell-sound-engine', () => ({
  TerminalBellSoundEngine: class {
    init(): void {}
    async play(): Promise<void> {}
  },
}))

vi.mock('@/lib/terminal-controller', () => {
  return {
    GOOGLE_FONT_PRESETS: [],
    TERMINAL_RENDERER_ENGINES: ['xterm'],
    isTerminalRendererEngine: (value: string): value is 'xterm' => value === 'xterm',
    terminalController: {
      getConfig: () => ({
        fontSize: 13,
        fontFamily: '',
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 1000,
        useTheme: 'app',
        lightTheme: 'default-light',
        darkTheme: 'default-dark',
        rendererEngine: 'xterm',
        bellSound: 'builtin:Blow',
        bellVolume: 1,
      }),
      applyConfig: vi.fn(),
      setRendererEngine: vi.fn(),
    },
  }
})

vi.mock('@/lib/api-config', () => ({
  getApiBaseUrl: () => '',
}))

vi.mock('@/lib/theme', () => ({
  applyTheme: vi.fn(),
  getStoredTheme: () => 'system',
  persistTheme: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
  trpc: {
    cli: {
      sniffGlobalCli: {
        queryOptions: () => ({ queryKey: ['cli.getAllTools'] }),
        queryFilter: () => ({ queryKey: ['cli.sniffGlobalCli'] }),
      },
      checkAvailability: {
        queryOptions: () => ({ queryKey: ['cli.checkAvailability'] }),
        queryFilter: () => ({ queryKey: ['cli.checkAvailability'] }),
      },
      getAllTools: {
        queryOptions: () => ({ queryKey: ['cli.getAllTools'] }),
      },
      getDetectedProjectTools: {
        queryOptions: () => ({ queryKey: ['cli.getDetectedProjectTools'] }),
      },
      getProfileState: {
        queryOptions: () => ({ queryKey: ['cli.getProfileState'] }),
      },
      getToolInitStates: {
        queryOptions: () => ({ queryKey: ['cli.getToolInitStates'] }),
      },
    },
    config: {
      get: {
        queryOptions: () => ({ queryKey: ['config.get'] }),
      },
      getEffectiveCliCommand: {
        queryOptions: () => ({ queryKey: ['config.getEffectiveCliCommand'] }),
        queryFilter: () => ({ queryKey: ['config.getEffectiveCliCommand'] }),
      },
    },
    globalSettings: {
      get: {
        queryOptions: () => ({ queryKey: ['globalSettings.get'] }),
      },
    },
    translationCache: {
      stats: {
        queryOptions: () => ({ queryKey: ['translationCache.stats'] }),
      },
    },
    translationEngines: {
      list: {
        queryOptions: () => ({ queryKey: ['translationEngines.list'] }),
      },
      getInstallStatus: {
        queryOptions: (input?: { engineId: string }) => ({
          queryKey: ['translationEngines.getInstallStatus', input?.engineId ?? ''],
        }),
      },
      install: {
        mutationOptions: () => ({}),
      },
      installStream: {
        subscriptionOptions: () => ({}),
      },
    },
    localModels: {
      listLocal: {
        queryOptions: () => ({ queryKey: ['localModels.listLocal'] }),
      },
      searchRemote: {
        queryOptions: () => ({ queryKey: ['localModels.searchRemote'] }),
      },
      state: {
        queryOptions: (input?: { modelId: string; selectedGroupId?: string }) => ({
          queryKey: ['localModels.state', input?.modelId ?? '', input?.selectedGroupId ?? ''],
        }),
      },
      panelState: {
        queryOptions: (input?: { modelId: string; selectedGroupId?: string }) => ({
          queryKey: ['localModels.panelState', input?.modelId ?? '', input?.selectedGroupId ?? ''],
        }),
      },
    },
  },
  trpcClient: {
    cli: {
      execute: {
        mutate: vi.fn(),
      },
    },
    config: {
      update: {
        mutate: updateConfigMock,
      },
    },
    globalSettings: {
      update: {
        mutate: updateGlobalSettingsMock,
      },
    },
    translationCache: {
      clean: {
        mutate: vi.fn(),
      },
      clear: {
        mutate: vi.fn(),
      },
    },
    translationEngines: {
      getInstallStatus: {
        query: translationEnginesMock.getInstallStatus,
      },
      install: {
        mutate: translationEnginesMock.install,
      },
      installStream: {
        subscribe: translationEnginesMock.installStream,
      },
      getModelDownloadPlan: {
        query: translationEnginesMock.getModelDownloadPlan,
      },
      batchTranslate: {
        subscribe: translationEnginesMock.batchTranslate,
      },
    },
    localModels: {
      listLocal: {
        query: localModelsMock.listLocal,
      },
      searchRemote: {
        query: localModelsMock.searchRemote,
      },
      searchRemoteStream: {
        subscribe: localModelsMock.searchRemoteStream,
      },
      state: {
        query: localModelsMock.state,
      },
      panelState: {
        query: localModelsMock.panelState,
      },
      subscribeLogs: {
        subscribe: localModelsMock.subscribeLogs,
      },
      markSelected: {
        mutate: localModelsMock.markSelected,
      },
      download: {
        mutate: localModelsMock.download,
      },
      pause: {
        mutate: localModelsMock.pause,
      },
      resume: {
        mutate: localModelsMock.resume,
      },
      delete: {
        mutate: localModelsMock.delete,
      },
    },
  },
}))

describe('Settings', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    restoreTranslationMocks()
    reactQueryMockStore.reset()
    vi.clearAllMocks()
    vi.useRealTimers()
  })
  beforeEach(() => {
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: {
        translationCache: { entryLimit: 10000 },
        translationEngines: {
          extensions: {
            engines: {
              local: { status: 'not-installed' },
              openai: { status: 'not-installed' },
            },
          },
          openai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
          local: { model: 'Xenova/opus-mt-no-de', selectedGroupId: 'q8', hfEndpoint: '' },
        },
      },
      isLoading: false,
      error: null,
    })
  })

  it('renders force init as the shared Switch control', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({ data: {} })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    const forceSwitch = await screen.findByRole('switch', { name: 'Force non-interactive init' })
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())

    expect(forceSwitch).toHaveAttribute('aria-checked', 'true')
    expect(forceSwitch.className).toContain('w-11')
  })

  it('renders translation settings and initializes browser support when enabled', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    prepareBrowserTranslationMock.mockResolvedValue({ availability: 'available' })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getByRole('heading', { name: 'Translation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Translation target language' })).toHaveTextContent(
      'Chinese 中文'
    )
    expect(screen.getByRole('button', { name: 'Direct' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bilingual' })).toBeTruthy()
    expect(
      screen.getByText(/Package payload is about 5 KB; browser language packs are managed/)
    ).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Enable translation cache' })).toBeTruthy()

    fireEvent.click(screen.getByRole('switch', { name: 'Enable document translation' }))

    await waitFor(() =>
      expect(updateConfigMock).toHaveBeenCalledWith({ translation: { enabled: true } })
    )
    await waitFor(() =>
      expect(browserTranslationMock.scan).toHaveBeenCalledWith('zh', expect.any(Object))
    )
  })

  it('checks browser translation support automatically after selecting the browser engine', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(browserTranslationMock.scan).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('combobox', { name: 'Engine' }))
    const browserOption = await screen.findByRole('option', { name: 'Browser' })
    fireEvent.mouseMove(browserOption)
    fireEvent.click(browserOption)

    await waitFor(() =>
      expect(updateConfigMock).toHaveBeenCalledWith({ translation: { engineId: 'browser' } })
    )
    await waitFor(() =>
      expect(browserTranslationMock.scan).toHaveBeenCalledWith('zh', expect.any(Object))
    )
    expect(prepareBrowserTranslationMock).not.toHaveBeenCalled()
  })

  it('restores the persisted Local engine before probing browser capability', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getByRole('combobox', { name: 'Engine' })).toHaveTextContent('Local-Transformers')
    expect(browserTranslationMock.scan).not.toHaveBeenCalled()
  })

  it('shows an install action for a non-installed service engine before rendering engine cards', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })
    reactQueryMockStore.setQueryData(['translationEngines.list'], [
      {
        id: 'browser',
        label: 'Browser',
        description: 'Uses the browser Translator API and future browser-side providers.',
        technicalSummary:
          'Browser-native Web Translator adapter. Package payload is about 5 KB; browser language packs are managed by the browser.',
        runtime: 'browser',
        selected: false,
        installStatus: { state: 'installed', message: 'Browser translator is built in.' },
      },
      {
        id: 'local',
        label: 'Local-Transformers',
        description:
          'Runs a bundled local Transformers.js translation runtime with managed model files.',
        technicalSummary:
          'Server-side Transformers.js local adapter. Package payload is about 5 KB; selected model groups are downloaded separately and can range from tens to hundreds of MB.',
        runtime: 'server',
        selected: true,
        installStatus: {
          state: 'not-installed',
          message:
            'Install the Local-Transformers runtime package to enable server-side translation.',
        },
        model: 'Xenova/opus-mt-no-de',
      },
      {
        id: 'openai',
        label: 'OpenAI-Completion',
        description:
          'Uses an OpenAI-compatible TanStack OpenAI-Completion completion provider for context-aware translation.',
        technicalSummary:
          'Server-side TanStack OpenAI-Completion adapter for OpenAI-compatible APIs. Package payload is about 5 KB; model size stays with the remote provider.',
        runtime: 'server',
        selected: false,
        installStatus: {
          state: 'installed',
          message: 'OpenAI completion translator is bundled.',
        },
        model: 'gpt-4.1-mini',
      },
    ])

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getByRole('button', { name: 'Install translation engine' })).toBeTruthy()
    expect(
      screen.getByText(/Install the Local-Transformers runtime package to enable server-side translation\./)
    ).toBeTruthy()
    expect(screen.queryByLabelText('Local download profiles')).toBeNull()
  })

  it('streams install logs into the shared description area while installing a service engine', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })
    reactQueryMockStore.setQueryData(['translationEngines.list'], [
      {
        id: 'browser',
        label: 'Browser',
        description: 'Uses the browser Translator API and future browser-side providers.',
        technicalSummary:
          'Browser-native Web Translator adapter. Package payload is about 5 KB; browser language packs are managed by the browser.',
        runtime: 'browser',
        selected: false,
        installStatus: { state: 'installed', message: 'Browser translator is built in.' },
      },
      {
        id: 'local',
        label: 'Local-Transformers',
        description:
          'Runs a bundled local Transformers.js translation runtime with managed model files.',
        technicalSummary:
          'Server-side Transformers.js local adapter. Package payload is about 5 KB; selected model groups are downloaded separately and can range from tens to hundreds of MB.',
        runtime: 'server',
        selected: true,
        installStatus: {
          state: 'not-installed',
          message:
            'Install the Local-Transformers runtime package to enable server-side translation.',
        },
        model: 'Xenova/opus-mt-no-de',
      },
      {
        id: 'openai',
        label: 'OpenAI-Completion',
        description:
          'Uses an OpenAI-compatible TanStack OpenAI-Completion completion provider for context-aware translation.',
        technicalSummary:
          'Server-side TanStack OpenAI-Completion adapter for OpenAI-compatible APIs. Package payload is about 5 KB; model size stays with the remote provider.',
        runtime: 'server',
        selected: false,
        installStatus: {
          state: 'installed',
          message: 'OpenAI completion translator is bundled.',
        },
        model: 'gpt-4.1-mini',
      },
    ])
    translationEnginesMock.installStream.mockImplementationOnce((_input, handlers) => {
      const unsubscribe = vi.fn()
      queueMicrotask(() => {
        if (unsubscribe.mock.calls.length > 0) return
        handlers.onData({
          type: 'status',
          status: { state: 'installing', message: 'Installing Local-Transformers runtime.' },
        })
        window.setTimeout(() => {
          if (unsubscribe.mock.calls.length > 0) return
          handlers.onData({
            type: 'log',
            stream: 'stdout',
            text: 'npm install @huggingface/transformers@~4.2.0\n',
          })
        }, 0)
        window.setTimeout(() => {
          if (unsubscribe.mock.calls.length > 0) return
          handlers.onData({
            type: 'log',
            stream: 'stdout',
            text: 'added 1 package\n',
          })
        }, 1)
      })
      return { unsubscribe }
    })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Install translation engine' }))
    await waitFor(() =>
      expect(screen.getByText(/npm install @huggingface\/transformers@~4\.2\.0/)).toBeTruthy()
    )
    expect(screen.getByText(/added 1 package/)).toBeTruthy()
  })

  it('shows downstream engine cards again after service engine installation completes', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })
    reactQueryMockStore.setQueryData(['translationEngines.list'], [
      {
        id: 'browser',
        label: 'Browser',
        description: 'Uses the browser Translator API and future browser-side providers.',
        technicalSummary:
          'Browser-native Web Translator adapter. Package payload is about 5 KB; browser language packs are managed by the browser.',
        runtime: 'browser',
        selected: false,
        installStatus: { state: 'installed', message: 'Browser translator is built in.' },
      },
      {
        id: 'local',
        label: 'Local-Transformers',
        description:
          'Runs a bundled local Transformers.js translation runtime with managed model files.',
        technicalSummary:
          'Server-side Transformers.js local adapter. Package payload is about 5 KB; selected model groups are downloaded separately and can range from tens to hundreds of MB.',
        runtime: 'server',
        selected: true,
        installStatus: {
          state: 'not-installed',
          message:
            'Install the Local-Transformers runtime package to enable server-side translation.',
        },
        model: 'Xenova/opus-mt-no-de',
      },
      {
        id: 'openai',
        label: 'OpenAI-Completion',
        description:
          'Uses an OpenAI-compatible TanStack OpenAI-Completion completion provider for context-aware translation.',
        technicalSummary:
          'Server-side TanStack OpenAI-Completion adapter for OpenAI-compatible APIs. Package payload is about 5 KB; model size stays with the remote provider.',
        runtime: 'server',
        selected: false,
        installStatus: {
          state: 'installed',
          message: 'OpenAI completion translator is bundled.',
        },
        model: 'gpt-4.1-mini',
      },
    ])
    translationEnginesMock.installStream.mockImplementationOnce((_input, handlers) => {
      const unsubscribe = vi.fn()
      queueMicrotask(() => {
        if (unsubscribe.mock.calls.length > 0) return
        handlers.onData({
          type: 'status',
          status: { state: 'installing', message: 'Installing Local-Transformers runtime.' },
        })
        window.setTimeout(() => {
          if (unsubscribe.mock.calls.length > 0) return
          handlers.onData({
            type: 'exit',
            status: {
              state: 'installed',
              message: 'Local-Transformers runtime dependencies are installed.',
            },
          })
        }, 0)
      })
      return { unsubscribe }
    })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Install translation engine' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Local download profiles')).toBeTruthy()
    )
  })

  it('renders browser language-pair chips from the support table', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    browserTranslationMock.scan.mockResolvedValueOnce({
      state: 'ready',
      message: 'Browser translation pairs: 1 ready · 1 downloadable.',
      table: {
        targetLanguage: 'zh',
        checked: 2,
        total: 2,
        updatedAt: 1,
        rows: [
          {
            sourceLanguage: 'en',
            targetLanguage: 'zh',
            availability: 'available',
          },
          {
            sourceLanguage: 'ja',
            targetLanguage: 'zh',
            availability: 'downloadable',
          },
        ],
      },
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'browser',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getByLabelText('Browser translation language pairs')).toBeTruthy()
    expect(screen.getByText('en -> zh')).toBeTruthy()
    expect(screen.getByText('ja -> zh')).toBeTruthy()
  })

  it('keeps browser language-pair chip order stable across availability states', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    browserTranslationMock.scan.mockResolvedValueOnce({
      state: 'ready',
      message: 'Browser translation pairs: 2 ready.',
      table: {
        targetLanguage: 'zh',
        checked: 2,
        total: 2,
        updatedAt: 1,
        rows: [
          {
            sourceLanguage: 'en',
            targetLanguage: 'zh',
            availability: 'downloading',
          },
          {
            sourceLanguage: 'es',
            targetLanguage: 'zh',
            availability: 'available',
          },
        ],
      },
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'browser',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const pairLabels = within(screen.getByLabelText('Browser translation language pairs'))
      .getAllByRole('button')
      .map((button) => button.textContent)
    expect(pairLabels[0]).toContain('en -> zh')
    expect(pairLabels[1]).toContain('es -> zh')
    expect(screen.getByRole('button', { name: 'en -> zh' })).toHaveClass('text-sky-700')
    expect(screen.getByRole('button', { name: 'es -> zh' })).toHaveClass('text-emerald-700')
  }, 10000)

  it('uses project Local model settings before global settings resolve', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'fp16' },
            openai: {},
          },
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const profileList = await screen.findByLabelText('Local download profiles')
    expect(screen.getByRole('combobox', { name: 'Engine' })).toHaveTextContent('Local-Transformers')
    expect(screen.getByRole('button', { name: 'Local model' })).toHaveTextContent(
      'Xenova/opus-mt-en-zh'
    )
    await waitFor(() =>
      expect(within(profileList).getByRole('button', { name: /^fp16/i })).toHaveTextContent(
        '700 MB'
      )
    )
    expect(localModelsMock.panelState).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'Xenova/opus-mt-en-zh',
        selectedGroupId: 'fp16',
      })
    )
  })

  it('uses project Local model settings over global defaults for the translation smoke test', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: {
        translationCache: { entryLimit: 10000 },
        translationEngines: {
          openai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
          local: {
            model: 'onnx-community/opus-mt-en-zh',
            selectedGroupId: 'int8-4dc37a',
            hfEndpoint: '',
          },
        },
      },
      isLoading: false,
      error: null,
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q8',
            },
            openai: {},
          },
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    await waitFor(() =>
      expect(localModelsMock.panelState).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'onnx-community/opus-mt-en-zh',
          selectedGroupId: 'q8',
        })
      )
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open translation test' }))
    const dialog = screen.getByRole('dialog', { name: 'Translation Test', hidden: true })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run Test' }))

    expect(
      await within(dialog).findByText('server:My name is Sarah and I live in London.')
    ).toBeTruthy()
    expect(translationEnginesMock.batchTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        engineId: 'local',
        targetLanguage: 'zh',
        model: 'onnx-community/opus-mt-en-zh',
        selectedGroupId: 'q8',
        inputs: ['My name is Sarah and I live in London.'],
      }),
      expect.any(Object)
    )
  })

  it('does not refresh remote Local model profiles on initial mount when local profiles exist', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: {
        translationCache: { entryLimit: 10000 },
        translationEngines: {
          openai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
          local: {
            model: 'onnx-community/opus-mt-en-zh',
            selectedGroupId: 'q8',
            hfEndpoint: 'https://hf-mirror.com',
          },
        },
      },
      isLoading: false,
      error: null,
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())

    expect(localModelsMock.listLocal).toHaveBeenCalled()
    expect(localModelsMock.searchRemoteStream).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Local model' })).toHaveTextContent(
      'onnx-community/opus-mt-en-zh'
    )
    expect(screen.getByLabelText('Local download profiles')).toBeTruthy()
    expect(screen.queryByText('Loading remote models…')).toBeNull()
  })

  it('shows bundled engine status without install controls while the engine list is still resolving', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: {
        translationCache: { entryLimit: 10000 },
        translationEngines: {
          openai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
          local: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'q8', hfEndpoint: '' },
        },
      },
      isLoading: false,
      error: null,
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getByRole('combobox', { name: 'Engine' })).toHaveTextContent('Local-Transformers')
    expect(screen.getByText(/selected model groups are downloaded separately/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull()
  })

  it('hides engine progress after a service engine is already installed', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'openai',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getAllByRole('button', { name: 'Installed' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Install')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('searches Local-Transformers models through the autocomplete popover and shows the download plan', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Local model' }))
    dispatchPopoverToggle(screen.getByRole('dialog', { name: 'Select local model' }), 'open')
    const input = screen.getByRole('textbox', { name: 'Search local models' })
    fireEvent.change(input, { target: { value: 'opus' } })

    await waitFor(() =>
      expect(localModelsMock.searchRemoteStream).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'opus', targetLanguage: 'de' }),
        expect.any(Object)
      )
    )
    expect(
      await screen.findByRole('option', { name: /onnx-community\/opus-mt-en-zh/ })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: /onnx-community\/opus-mt-en-zh/ }))

    await waitFor(() => {
      expect(screen.getByText(/Download files/i)).toBeTruthy()
      expect(screen.getAllByText('235 MB').length).toBeGreaterThan(0)
    })
    expect(localModelsMock.listLocal).toHaveBeenCalled()
    await waitFor(() => expect(localModelsMock.searchRemoteStream).toHaveBeenCalled())
    expect(localModelsMock.panelState).toHaveBeenCalled()
    expect(screen.getAllByText(/q8/).length).toBeGreaterThan(0)
    expect(screen.getByText('Local Model')).toBeTruthy()
  }, 10000)

  it('persists Local model commits into the document translation runtime identity', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: {
              model: 'Xenova/opus-mt-no-de',
              selectedGroupId: 'q8',
            },
            openai: {},
          },
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Local model' }))
    dispatchPopoverToggle(screen.getByRole('dialog', { name: 'Select local model' }), 'open')
    const input = screen.getByRole('textbox', { name: 'Search local models' })
    fireEvent.change(input, { target: { value: 'opus' } })

    const nextModelOption = await screen.findByRole('option', {
      name: /onnx-community\/opus-mt-en-zh/,
    })
    fireEvent.click(nextModelOption)

    await waitFor(() =>
      expect(localModelsMock.markSelected).toHaveBeenCalledWith({
        modelId: 'onnx-community/opus-mt-en-zh',
      })
    )
    expect(updateGlobalSettingsMock).toHaveBeenCalledWith({
      translationEngines: {
        local: { model: 'onnx-community/opus-mt-en-zh', selectedGroupId: null },
      },
    })
    expect(updateConfigMock).toHaveBeenCalledWith({
      translation: {
        engines: {
          local: { model: 'onnx-community/opus-mt-en-zh', selectedGroupId: null },
        },
      },
    })
  })

  it('persists Local profile selection into the document translation runtime identity', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: {
              model: 'Xenova/opus-mt-no-de',
              selectedGroupId: 'q8',
            },
            openai: {},
          },
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const profileList = await screen.findByLabelText('Local download profiles')
    fireEvent.click(within(profileList).getByRole('button', { name: /^fp16/i }))

    expect(updateGlobalSettingsMock).toHaveBeenCalledWith({
      translationEngines: { local: { selectedGroupId: 'fp16' } },
    })
    expect(updateConfigMock).toHaveBeenCalledWith({
      translation: { engines: { local: { selectedGroupId: 'fp16' } } },
    })
  })

  it('saves the Local-Transformers Hugging Face endpoint from the advanced provider popover', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Local provider settings' }))
    dispatchPopoverToggle(screen.getByRole('dialog', { name: 'Local provider settings' }), 'open')
    const endpointInput = screen.getByLabelText('HF Endpoint')
    fireEvent.change(endpointInput, { target: { value: 'https://hf-mirror.com' } })
    fireEvent.keyDown(endpointInput, { key: 'Enter' })

    await waitFor(() =>
      expect(updateGlobalSettingsMock).toHaveBeenCalledWith({
        translationEngines: { local: { hfEndpoint: 'https://hf-mirror.com' } },
      })
    )
  })

  it('shows plan loading and a single-line Local-Transformers status message', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    localModelsMock.panelState.mockImplementation(
      async ({ modelId, selectedGroupId }: { modelId: string; selectedGroupId?: string }) =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                modelId,
                selectedGroupId,
                asset: createDefaultLocalAssetState(modelId),
                downloadPlan: createDefaultLocalDownloadPlan(modelId),
              }),
            20
          )
        )
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())

    expect(screen.getByText('Download files')).toBeTruthy()
    expect(screen.queryByText('Resolving download profiles…')).toBeNull()
    expect(screen.queryByText('Resolving…')).toBeNull()
    expect(screen.getAllByText(/Not downloaded/).length).toBeLessThanOrEqual(1)
  })

  it('shows a circular download control for an uninstalled Local model and keeps unknown-size models disabled', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const downloadButton = await screen.findByRole('button', { name: 'Download model' })
    expect(downloadButton).toHaveAttribute('data-local-plan-action', 'download')
    expect(downloadButton.className).not.toContain('group')
    expect(screen.queryByRole('button', { name: 'Pause download' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Local model' }))
    dispatchPopoverToggle(screen.getByRole('dialog', { name: 'Select local model' }), 'open')
    const input = screen.getByRole('textbox', { name: 'Search local models' })
    fireEvent.change(input, { target: { value: 'unknown' } })
    await waitFor(() =>
      expect(localModelsMock.searchRemoteStream).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'unknown', targetLanguage: 'de' }),
        expect.any(Object)
      )
    )
    const disabledOption = await screen.findByRole('option', { name: /Xenova\/unknown-model/ })
    expect(disabledOption).toHaveAttribute('disabled')
  })

  it('only exposes the hover pause affordance while an Local model is downloading', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    localModelsMock.state.mockImplementation(async () => ({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'downloading',
      selected: true,
      progress: 0.42,
      bytesDownloaded: 103494451,
      totalBytes: 246415360,
      resumable: true,
      plan: createQ8PlanForTest('Xenova/opus-mt-no-de'),
      files: createQ8AssetFilesForTest({
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 52848230,
        'onnx/decoder_model_merged_quantized.onnx': 50646221,
      }),
      updatedAt: 100,
    }))
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const pauseButton = await screen.findByRole('button', { name: 'Pause download' })
    expect(pauseButton).toHaveAttribute('data-local-plan-action', 'pause')
    expect(pauseButton.className).toContain('group')
    expect(within(pauseButton).getByText('42%').className).toContain('group-hover:hidden')
    expect(
      within(screen.getByLabelText('Local download profiles')).getByRole('button', { name: /q8/i })
        .className
    ).toContain('border-solid')
    expect(screen.queryByRole('button', { name: 'Download model' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resume download' })).toBeNull()
  })

  it('updates Local download progress from the server panel snapshot after subscription logs arrive', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    let serverAsset: LocalModelAssetState = createLocalAssetStateForTest({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'not-downloaded',
      selected: true,
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 246415360,
      resumable: false,
      plan: createQ8PlanForTest('Xenova/opus-mt-no-de'),
      files: createQ8AssetFilesForTest({
        'config.json': 0,
        'generation_config.json': 0,
        'source.spm': 0,
        'target.spm': 0,
        'onnx/encoder_model_quantized.onnx': 0,
        'onnx/decoder_model_merged_quantized.onnx': 0,
      }),
      updatedAt: 100,
    })
    localModelsMock.state.mockImplementation(async () => serverAsset)
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    await screen.findByRole('button', { name: 'Download model' })

    localModelsMock.panelState.mockClear()
    serverAsset = {
      ...serverAsset,
      status: 'downloading',
      progress: 0.42,
      bytesDownloaded: 103494451,
      totalBytes: 246415360,
      resumable: true,
      files: createQ8AssetFilesForTest({
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 50646221,
        'onnx/decoder_model_merged_quantized.onnx': 0,
      }),
      updatedAt: 200,
    }
    emitLocalModelLog({
      engineId: 'local',
      modelId: 'Xenova/opus-mt-no-de',
      selectedGroupId: 'q8',
      status: 'downloading',
      message: 'Downloading onnx/encoder_model_quantized.onnx.',
      progress: 0.42,
      bytesDownloaded: 103494451,
      totalBytes: 246415360,
      sessionId: 'session-1',
      resumable: true,
      files: createQ8AssetFilesForTest({
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 50646221,
        'onnx/decoder_model_merged_quantized.onnx': 0,
      }),
      updatedAt: 200,
    })

    await waitFor(() =>
      expect(localModelsMock.panelState).toHaveBeenCalledWith({
        modelId: 'Xenova/opus-mt-no-de',
        selectedGroupId: 'q8',
      })
    )
    expect(await screen.findByRole('button', { name: 'Pause download' })).toBeTruthy()
    expect(screen.getByText('Revision')).toBeTruthy()
    expect(screen.getByRole('link', { name: TEST_LOCAL_MODEL_COMMIT_HASH })).toHaveAttribute(
      'href',
      `https://huggingface.co/Xenova/opus-mt-no-de/tree/${TEST_LOCAL_MODEL_COMMIT_HASH}`
    )
    expect(screen.queryByText('Downloading onnx/encoder_model_quantized.onnx.')).toBeNull()
    expect(screen.getByText('48.3 MB / 50.4 MB')).toBeTruthy()
  })

  it('does not synthesize Local completion UI from subscription logs without server panel truth', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    const modelId = 'Xenova/opus-mt-no-de'
    const serverAsset: LocalModelAssetState = createLocalAssetStateForTest({
      modelId,
      status: 'not-downloaded',
      selected: true,
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 246415360,
      resumable: false,
      plan: createQ8PlanForTest(modelId),
      files: createQ8AssetFilesForTest({}),
      updatedAt: 100,
    })
    localModelsMock.state.mockImplementation(async () => serverAsset)
    localModelsMock.panelState.mockImplementation(async ({ selectedGroupId }) => ({
      modelId,
      selectedGroupId,
      asset: serverAsset,
      downloadPlan: serverAsset.plan ?? null,
    }))
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(await screen.findByRole('button', { name: 'Download model' })).toBeTruthy()
    localModelsMock.panelState.mockClear()

    emitLocalModelLog({
      engineId: 'local',
      modelId,
      selectedGroupId: 'q8',
      status: 'downloaded',
      message: `Local model ${modelId} is ready.`,
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      sessionId: 'session-1',
      resumable: false,
      files: createDownloadedQ8AssetFilesForTest(),
      updatedAt: 200,
    })

    await waitFor(() =>
      expect(localModelsMock.panelState).toHaveBeenCalledWith({
        modelId,
        selectedGroupId: 'q8',
      })
    )
    expect(screen.getByRole('button', { name: 'Download model' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete model' })).toBeNull()
    expect(
      screen.queryByLabelText('Downloaded', {
        selector: '[data-local-plan-action="downloaded"]',
      })
    ).toBeNull()
    expect(screen.getByText('0 B / 50.4 MB')).toBeTruthy()
  })

  it('keeps a stable Local log subscription while progress events stream in', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    let serverAsset: LocalModelAssetState = createLocalAssetStateForTest({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'not-downloaded',
      selected: true,
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 246415360,
      resumable: false,
      plan: createQ8PlanForTest('Xenova/opus-mt-no-de'),
      files: createQ8AssetFilesForTest({
        'config.json': 0,
        'generation_config.json': 0,
        'source.spm': 0,
        'target.spm': 0,
        'onnx/encoder_model_quantized.onnx': 0,
        'onnx/decoder_model_merged_quantized.onnx': 0,
      }),
      updatedAt: 100,
    })
    localModelsMock.state.mockImplementation(async () => serverAsset)
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    await screen.findByRole('button', { name: 'Download model' })
    expect(localModelsMock.subscribeLogs).toHaveBeenCalledTimes(1)

    serverAsset = {
      ...serverAsset,
      status: 'downloading',
      progress: 0.2,
      bytesDownloaded: 49283072,
      resumable: true,
      files: createQ8AssetFilesForTest({
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 47685693,
        'onnx/decoder_model_merged_quantized.onnx': 0,
      }),
      updatedAt: 200,
    }
    emitLocalModelLog({
      engineId: 'local',
      modelId: 'Xenova/opus-mt-no-de',
      selectedGroupId: 'q8',
      status: 'downloading',
      message: 'Downloading onnx/encoder_model_quantized.onnx.',
      progress: 0.2,
      bytesDownloaded: 49283072,
      totalBytes: 246415360,
      sessionId: 'session-1',
      resumable: true,
      files: createQ8AssetFilesForTest({
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 47685693,
        'onnx/decoder_model_merged_quantized.onnx': 0,
      }),
      updatedAt: 200,
    })

    expect(await screen.findByText('45.5 MB / 50.4 MB')).toBeTruthy()

    serverAsset = {
      ...serverAsset,
      status: 'downloading',
      progress: 0.62,
      bytesDownloaded: 152777523,
      resumable: true,
      files: createQ8AssetFilesForTest({
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 52848230,
        'onnx/decoder_model_merged_quantized.onnx': 98316362,
      }),
      updatedAt: 300,
    }
    emitLocalModelLog({
      engineId: 'local',
      modelId: 'Xenova/opus-mt-no-de',
      selectedGroupId: 'q8',
      status: 'downloading',
      message: 'Downloading onnx/decoder_model_merged_quantized.onnx.',
      progress: 0.62,
      bytesDownloaded: 152777523,
      totalBytes: 246415360,
      sessionId: 'session-1',
      resumable: true,
      files: createQ8AssetFilesForTest({
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 52848230,
        'onnx/decoder_model_merged_quantized.onnx': 98316362,
      }),
      updatedAt: 300,
    })

    expect(await screen.findByText('93.8 MB / 185 MB')).toBeTruthy()
    expect(localModelsMock.subscribeLogs).toHaveBeenCalledTimes(1)
  })

  it('drives Local download, pause, resume, complete, and delete UI from server panel snapshots', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    const modelId = 'Xenova/opus-mt-no-de'
    const buildQ8Plan = (
      status: NonNullable<TranslationModelDownloadPlan['groups']>[number]['status']
    ): TranslationModelDownloadPlan => {
      const plan = createQ8PlanForTest(modelId)
      return {
        ...plan,
        groups: plan.groups?.map((group) => ({
          ...group,
          status,
        })),
      }
    }
    const buildAsset = (
      input: Pick<LocalModelAssetState, 'status' | 'progress' | 'bytesDownloaded' | 'resumable'> & {
        downloadedBytes: Partial<Record<string, number>>
      }
    ): LocalModelAssetState => {
      const plan = buildQ8Plan(input.status)
      return createLocalAssetStateForTest({
        modelId,
        status: input.status,
        selected: true,
        progress: input.progress,
        bytesDownloaded: input.bytesDownloaded,
        totalBytes: 246415360,
        resumable: input.resumable,
        plan,
        files: createQ8AssetFilesForTest(input.downloadedBytes),
        updatedAt: 100,
      })
    }
    let serverAsset = buildAsset({
      status: 'not-downloaded',
      progress: 0,
      bytesDownloaded: 0,
      resumable: false,
      downloadedBytes: {},
    })
    localModelsMock.state.mockImplementation(async () => serverAsset)
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const downloadButton = await screen.findByRole('button', { name: 'Download model' })
    fireEvent.click(downloadButton)
    expect(localModelsMock.download).toHaveBeenCalledWith({ modelId, groupId: 'q8' })
    expect(screen.getByRole('button', { name: 'Download model' })).toBeTruthy()

    localModelsMock.panelState.mockClear()
    serverAsset = buildAsset({
      status: 'downloading',
      progress: 0.2,
      bytesDownloaded: 49283072,
      resumable: true,
      downloadedBytes: {
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 47685693,
      },
    })
    emitLocalModelLog({
      engineId: 'local',
      modelId,
      selectedGroupId: 'q8',
      status: 'downloading',
      message: 'Downloading onnx/encoder_model_quantized.onnx.',
      progress: 0.2,
      bytesDownloaded: 49283072,
      totalBytes: 246415360,
      sessionId: 'session-1',
      resumable: true,
      files: serverAsset.files,
      updatedAt: 200,
    })
    expect(await screen.findByRole('button', { name: 'Pause download' })).toBeTruthy()
    expect(screen.getByText('45.5 MB / 50.4 MB')).toBeTruthy()
    expect(localModelsMock.panelState).toHaveBeenCalledWith({ modelId, selectedGroupId: 'q8' })

    fireEvent.click(screen.getByRole('button', { name: 'Pause download' }))
    expect(localModelsMock.pause).toHaveBeenCalledWith({ modelId, groupId: 'q8' })
    serverAsset = buildAsset({
      status: 'paused',
      progress: 0.2,
      bytesDownloaded: 49283072,
      resumable: true,
      downloadedBytes: {
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 47685693,
      },
    })
    emitLocalModelLog({
      engineId: 'local',
      modelId,
      selectedGroupId: 'q8',
      status: 'paused',
      message: 'Local model download paused.',
      progress: 0.2,
      bytesDownloaded: 49283072,
      totalBytes: 246415360,
      resumable: true,
      files: serverAsset.files,
      updatedAt: 300,
    })
    expect(await screen.findByRole('button', { name: 'Resume download' })).toBeTruthy()
    expect(screen.getByText('Revision')).toBeTruthy()
    expect(screen.getByRole('link', { name: TEST_LOCAL_MODEL_COMMIT_HASH })).toHaveAttribute(
      'href',
      `https://huggingface.co/${modelId}/tree/${TEST_LOCAL_MODEL_COMMIT_HASH}`
    )
    expect(screen.queryByText('Local model download paused.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Resume download' }))
    expect(localModelsMock.resume).toHaveBeenCalledWith({ modelId, groupId: 'q8' })
    serverAsset = buildAsset({
      status: 'downloaded',
      progress: 1,
      bytesDownloaded: 246415360,
      resumable: false,
      downloadedBytes: Object.fromEntries(
        createQ8PlanFilesForTest().map((file) => [file.path, file.sizeBytes ?? 0])
      ),
    })
    emitLocalModelLog({
      engineId: 'local',
      modelId,
      selectedGroupId: 'q8',
      status: 'downloaded',
      message: `Local model ${modelId} is ready.`,
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      sessionId: 'session-1',
      resumable: false,
      files: serverAsset.files,
      updatedAt: 400,
    })
    expect(
      await screen.findByLabelText('Downloaded', {
        selector: '[data-local-plan-action="downloaded"]',
      })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete model' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete model' }))
    expect(localModelsMock.delete).toHaveBeenCalledWith({ modelId, groupId: 'q8' })
    serverAsset = buildAsset({
      status: 'deleting',
      progress: 1,
      bytesDownloaded: 246415360,
      resumable: false,
      downloadedBytes: Object.fromEntries(
        createQ8PlanFilesForTest().map((file) => [file.path, file.sizeBytes ?? 0])
      ),
    })
    emitLocalModelLog({
      engineId: 'local',
      modelId,
      selectedGroupId: 'q8',
      status: 'deleting',
      message: 'Deleting local model files.',
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      files: serverAsset.files,
      updatedAt: 500,
    })
    expect(await screen.findByText('Removing local model files…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete model' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resume download' })).toBeNull()

    serverAsset = buildAsset({
      status: 'not-downloaded',
      progress: 0,
      bytesDownloaded: 0,
      resumable: false,
      downloadedBytes: {},
    })
    emitLocalModelLog({
      engineId: 'local',
      modelId,
      selectedGroupId: 'q8',
      status: 'not-downloaded',
      message: 'Local model files were removed.',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 246415360,
      files: serverAsset.files,
      updatedAt: 600,
    })
    expect(await screen.findByRole('button', { name: 'Download model' })).toBeTruthy()
    expect(screen.getByText('onnx/encoder_model_quantized.onnx')).toBeTruthy()
    expect(screen.getByText('0 B / 50.4 MB')).toBeTruthy()
    expect(localModelsMock.subscribeLogs).toHaveBeenCalledTimes(1)
  }, 15_000)

  it('uses only the outer progress ring for downloaded Local-Transformers action styling', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    const groupedPlan = createGroupedLocalPlanForTest('Xenova/opus-mt-no-de')
    localModelsMock.state.mockImplementation(
      async ({
        selectedGroupId,
      }: {
        modelId: string
        selectedGroupId?: string
      }): Promise<LocalModelAssetState> => {
        const selectedGroup = groupedPlan.groups?.find((group) => group.id === selectedGroupId)
        if (selectedGroup?.id === 'fp16') {
          const fp16Plan: TranslationModelDownloadPlan = {
            ...groupedPlan,
            selectedGroupId: 'fp16',
            files: selectedGroup.files,
            groups: groupedPlan.groups?.map((group) => ({
              ...group,
              selected: group.id === 'fp16',
            })),
          }
          return createLocalAssetStateForTest({
            modelId: 'Xenova/opus-mt-no-de',
            status: 'not-downloaded',
            selected: true,
            progress: 0,
            bytesDownloaded: 0,
            totalBytes: undefined,
            resumable: false,
            plan: fp16Plan,
            files: selectedGroup.files.map((file) => ({
              path: file.path,
              sizeBytes: file.sizeBytes,
              downloadedBytes: 0,
            })),
            updatedAt: 101,
          })
        }
        return createLocalAssetStateForTest({
          modelId: 'Xenova/opus-mt-no-de',
          status: 'downloaded',
          selected: true,
          progress: 1,
          bytesDownloaded: 246415360,
          totalBytes: 246415360,
          resumable: false,
          plan: groupedPlan,
          files: createDownloadedQ8AssetFilesForTest(),
          updatedAt: 100,
        })
      }
    )
    localModelsMock.listLocal.mockResolvedValueOnce({
      items: [createDownloadedLocalModelForTest('Xenova/opus-mt-no-de')],
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const downloadedAction = await screen.findByLabelText('Downloaded', {
      selector: '[data-local-plan-action="downloaded"]',
    })
    expect(downloadedAction).toHaveAttribute('data-local-plan-action', 'downloaded')
    expect(downloadedAction.className).not.toContain('shadow')
    expect(downloadedAction.className).not.toContain('border')
    const deleteButton = screen.getByRole('button', { name: 'Delete model' })
    expect(deleteButton.className).not.toContain('border')
    expect(deleteButton.className).not.toContain('shadow')
  })

  it('switches the displayed download file list when a different Local profile chip is selected', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(await screen.findByText('config.json')).toBeTruthy()
    expect(await screen.findByText('onnx/encoder_model_quantized.onnx')).toBeTruthy()
    expect(screen.queryByText('onnx/encoder_model_fp16.onnx')).toBeNull()

    const profileList = await screen.findByLabelText('Local download profiles')
    const fp16Chip = within(profileList).getByRole('button', { name: /^fp16/i })
    expect(fp16Chip).toHaveTextContent('700 MB')
    fireEvent.click(fp16Chip)

    expect(await screen.findByText('config.json')).toBeTruthy()
    expect(await screen.findByText('onnx/encoder_model_fp16.onnx')).toBeTruthy()
    expect(screen.getByText('onnx/decoder_model_merged_fp16.onnx')).toBeTruthy()
    expect(screen.queryByText('onnx/encoder_model_quantized.onnx')).toBeNull()
  })

  it('renders Local profile chips under the model selector instead of inside Download files', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const modelButton = await screen.findByRole('button', { name: 'Local model' })
    const downloadFiles = screen.getByText('Download files')
    const profileList = await screen.findByLabelText('Local download profiles')
    const q8Chip = within(profileList).getByRole('button', { name: /q8/i })
    const fp16Chip = within(profileList).getByRole('button', { name: /fp16/i })

    expect(
      modelButton.compareDocumentPosition(profileList) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      profileList.compareDocumentPosition(downloadFiles) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      within(downloadFiles.closest('div') ?? document.body).queryByRole('button', { name: /q8/i })
    ).toBeNull()
    expect(screen.queryByText(/Local models stay at the top of the chooser/i)).toBeNull()
    expect(q8Chip).toHaveTextContent('235 MB')
    expect(fp16Chip).toHaveTextContent('700 MB')
  })

  it('does not treat an uninstalled Local profile as downloaded when another profile is cached', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    const groupedPlan = createGroupedLocalPlanForTest('Xenova/opus-mt-no-de')
    localModelsMock.state.mockImplementation(
      async ({
        selectedGroupId,
      }: {
        modelId: string
        selectedGroupId?: string
      }): Promise<LocalModelAssetState> => {
        const selectedGroup = groupedPlan.groups?.find((group) => group.id === selectedGroupId)
        if (selectedGroup?.id === 'fp16') {
          const fp16Plan: TranslationModelDownloadPlan = {
            ...groupedPlan,
            selectedGroupId: 'fp16',
            files: selectedGroup.files,
            groups: groupedPlan.groups?.map((group) => ({
              ...group,
              selected: group.id === 'fp16',
            })),
          }
          return createLocalAssetStateForTest({
            modelId: 'Xenova/opus-mt-no-de',
            status: 'not-downloaded',
            selected: true,
            progress: 0,
            bytesDownloaded: 0,
            totalBytes: undefined,
            resumable: false,
            plan: fp16Plan,
            files: selectedGroup.files.map((file) => ({
              path: file.path,
              sizeBytes: file.sizeBytes,
              downloadedBytes: 0,
            })),
            updatedAt: 101,
          })
        }
        return createLocalAssetStateForTest({
          modelId: 'Xenova/opus-mt-no-de',
          status: 'downloaded',
          selected: true,
          progress: 1,
          bytesDownloaded: 246415360,
          totalBytes: 246415360,
          resumable: false,
          plan: groupedPlan,
          files: createDownloadedQ8AssetFilesForTest(),
          updatedAt: 100,
        })
      }
    )
    localModelsMock.listLocal.mockResolvedValueOnce({
      items: [createDownloadedLocalModelForTest('Xenova/opus-mt-no-de')],
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(
      await screen.findByLabelText('Downloaded', {
        selector: '[data-local-plan-action="downloaded"]',
      })
    ).toBeTruthy()

    fireEvent.click(
      within(screen.getByLabelText('Local download profiles')).getByRole('button', {
        name: /^fp16/i,
      })
    )

    expect(await screen.findByText('onnx/encoder_model_fp16.onnx')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download model' })).toHaveAttribute(
      'data-local-plan-action',
      'download'
    )
    expect(
      within(screen.getByLabelText('Local download profiles')).getByRole('button', {
        name: /fp16/i,
      })
    ).toHaveTextContent('700 MB')
    const profileList = screen.getByLabelText('Local download profiles')
    expect(within(profileList).getByRole('button', { name: /q8/i }).className).toContain(
      'border-dashed'
    )
    expect(within(profileList).getByRole('button', { name: /q8/i }).className).toContain(
      'text-emerald-700'
    )
    expect(within(profileList).getByRole('button', { name: /q8/i }).className).not.toContain('bg-')
    expect(within(profileList).getByRole('button', { name: /fp16/i }).className).toContain(
      'border-solid'
    )
    expect(within(profileList).getByRole('button', { name: /fp16/i }).className).toContain(
      'text-foreground'
    )
    expect(within(profileList).getByRole('button', { name: /fp16/i }).className).not.toContain(
      'bg-'
    )
    expect(
      screen.queryByLabelText('Downloaded', { selector: '[data-local-plan-action]' })
    ).toBeNull()
  })

  it('loads group-specific Local asset truth when switching to another partially cached profile', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    const plan = createQ4AndQ4f16GroupedLocalPlanForTest('onnx-community/opus-mt-en-zh')
    const localSnapshotAsset: LocalModelAssetState = createLocalAssetStateForTest({
      modelId: 'onnx-community/opus-mt-en-zh',
      status: 'downloaded',
      selected: true,
      progress: 1,
      bytesDownloaded: 307038702,
      totalBytes: 307038702,
      resumable: false,
      plan,
      files: createPlanAssetFilesForTest(plan.groups?.flatMap((group) => group.files) ?? [], {
        'config.json': 1520,
        'generation_config.json': 288,
        'source.spm': 806435,
        'special_tokens_map.json': 74,
        'target.spm': 804600,
        'tokenizer_config.json': 849,
        'tokenizer.json': 6380952,
        'vocab.json': 1747795,
        'onnx/encoder_model_q4.onnx': 146255322,
        'onnx/decoder_model_merged_q4.onnx': 151040867,
        'onnx/encoder_model_q4f16.onnx': 0,
        'onnx/decoder_model_merged_q4f16.onnx': 0,
      }),
      updatedAt: 100,
    })
    const q4f16State: LocalModelAssetState = createLocalAssetStateForTest({
      modelId: 'onnx-community/opus-mt-en-zh',
      status: 'paused',
      selected: true,
      progress: 0.039,
      bytesDownloaded: 9742513,
      totalBytes: 249527579,
      resumable: true,
      plan: {
        ...plan,
        selectedGroupId: 'q4f16',
        groups: plan.groups?.map((group) => ({
          ...group,
          status:
            group.id === 'q4'
              ? ('downloaded' as const)
              : group.id === 'q4f16'
                ? ('paused' as const)
                : ('not-downloaded' as const),
        })),
      },
      files: createPlanAssetFilesForTest(plan.groups?.flatMap((group) => group.files) ?? [], {
        'config.json': 1520,
        'generation_config.json': 288,
        'source.spm': 806435,
        'special_tokens_map.json': 74,
        'target.spm': 804600,
        'tokenizer_config.json': 849,
        'tokenizer.json': 6380952,
        'vocab.json': 1747795,
        'onnx/encoder_model_q4.onnx': 0,
        'onnx/decoder_model_merged_q4.onnx': 0,
        'onnx/encoder_model_q4f16.onnx': 0,
        'onnx/decoder_model_merged_q4f16.onnx': 0,
      }),
      updatedAt: 120,
    })
    localModelsMock.listLocal.mockResolvedValueOnce({
      items: [
        {
          id: 'onnx-community/opus-mt-en-zh',
          label: 'onnx-community/opus-mt-en-zh',
          summary: 'Previously selected local model. Estimated download 293 MB.',
          downloads: 0,
          likes: 0,
          tags: ['local'],
          compatibility: {
            transformersJs: true,
            onnx: true,
            localRuntimeVerified: true,
          },
          size: {
            estimatedTotalBytes: 307038702,
            primaryBytes: 307038702,
          },
          downloadGroups: plan.groups,
          languageMatch: {
            sourceMatched: false,
            targetMatched: true,
            directionalScore: 0,
          },
          asset: localSnapshotAsset,
          selectable: true,
          local: true,
        },
      ],
    })
    localModelsMock.state.mockImplementation(
      async ({ selectedGroupId }: { modelId: string; selectedGroupId?: string }) =>
        selectedGroupId === 'q4f16' ? q4f16State : localSnapshotAsset
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q4',
            },
          },
        },
      },
    })
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: {
        translationCache: { entryLimit: 10000 },
        translationEngines: {
          openai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
          local: {
            model: 'onnx-community/opus-mt-en-zh',
            selectedGroupId: 'q4',
            hfEndpoint: '',
          },
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(
      await screen.findByLabelText('Downloaded', {
        selector: '[data-local-plan-action="downloaded"]',
      })
    ).toBeTruthy()

    const profileList = await screen.findByLabelText('Local download profiles')
    fireEvent.click(within(profileList).getByRole('button', { name: /^q4f16/i }))

    await waitFor(() =>
      expect(localModelsMock.state).toHaveBeenCalledWith({
        modelId: 'onnx-community/opus-mt-en-zh',
        selectedGroupId: 'q4f16',
      })
    )
    expect(await screen.findByRole('button', { name: 'Resume download' })).toHaveAttribute(
      'data-local-plan-action',
      'resume'
    )
    expect(screen.getByText('source.spm')).toBeTruthy()
    expect(screen.getByText('788 KB / 788 KB')).toBeTruthy()
  })

  it('renders Local profile chips with downloaded, partial, and not-started states', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    const plan = createTriStateGroupedLocalPlanForTest('Xenova/opus-mt-no-de')
    localModelsMock.state.mockImplementation(async () => ({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'paused',
      selected: true,
      progress: 0.38,
      bytesDownloaded: 126040951,
      totalBytes: 126040951,
      resumable: true,
      plan,
      files: createPlanAssetFilesForTest(plan.groups?.flatMap((group) => group.files) ?? [], {
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 52848230,
        'onnx/decoder_model_merged_quantized.onnx': 193567130,
        'onnx/encoder_model_q4.onnx': 10485760,
        'onnx/decoder_model_merged_q4.onnx': 0,
        'onnx/encoder_model_fp16.onnx': 0,
        'onnx/decoder_model_merged_fp16.onnx': 0,
      }),
      updatedAt: 100,
    }))
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: {
              model: 'Xenova/opus-mt-no-de',
              selectedGroupId: 'q4',
            },
          },
        },
      },
    })
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: {
        translationCache: { entryLimit: 10000 },
        translationEngines: {
          openai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
          local: { model: 'Xenova/opus-mt-no-de', selectedGroupId: 'q4', hfEndpoint: '' },
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const profileList = await screen.findByLabelText('Local download profiles')
    const downloadedChip = within(profileList).getByRole('button', { name: /q8/i })
    const partialChip = within(profileList).getByRole('button', { name: /^q4/i })
    const notStartedChip = within(profileList).getByRole('button', { name: /^fp16/i })

    expect(downloadedChip.className).toContain('border-dashed')
    expect(downloadedChip.className).toContain('text-emerald-700')
    expect(partialChip.className).toContain('border-solid')
    expect(partialChip.className).toContain('text-sky-700')
    expect(notStartedChip.className).toContain('border-dashed')
    expect(notStartedChip.className).not.toContain('text-sky-700')
    expect(notStartedChip.className).not.toContain('text-emerald-700')
  })

  it('keeps every downloaded Local profile chip green even when another profile is selected', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    const model = createFullyDownloadedGroupedLocalModelForTest('onnx-community/opus-mt-en-zh')
    localModelsMock.listLocal.mockResolvedValueOnce({
      items: [model],
    })
    localModelsMock.state.mockResolvedValue({
      ...model.asset,
      plan: {
        ...model.asset.plan!,
        selectedGroupId: 'q8',
        groups: model.asset.plan?.groups?.map((group) => ({
          ...group,
          selected: group.id === 'q8',
          status: 'downloaded' as const,
        })),
      },
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const profileList = await screen.findByLabelText('Local download profiles')

    expect(within(profileList).getByRole('button', { name: /^q4/i }).className).toContain(
      'text-emerald-700'
    )
    expect(within(profileList).getByRole('button', { name: /^fp16/i }).className).toContain(
      'text-emerald-700'
    )
  })

  it('keeps Local profile chip status from server group truth while selection changes', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    const modelId = 'onnx-community/opus-mt-en-zh'
    const q4Plan = createQ4AndQ4f16GroupedLocalPlanForTest(modelId)
    const q4Files = q4Plan.groups?.find((group) => group.id === 'q4')?.files ?? []
    const q4f16Files = q4Plan.groups?.find((group) => group.id === 'q4f16')?.files ?? []
    const bnb4Files = q4f16Files.map((file) => ({
      ...file,
      path: file.path.includes('encoder_model_q4f16')
        ? 'onnx/encoder_model_bnb4.onnx'
        : file.path.includes('decoder_model_merged_q4f16')
          ? 'onnx/decoder_model_merged_bnb4.onnx'
          : file.path,
      sizeBytes: file.path.includes('encoder_model_q4f16')
        ? 91226112
        : file.path.includes('decoder_model_merged_q4f16')
          ? 203423744
          : file.sizeBytes,
    }))
    const q8Files = createQ8PlanFilesForTest()
    const totalBytes = (files: TranslationModelDownloadPlan['files']) =>
      files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0)
    const groups = [
      {
        id: 'q4',
        label: 'q4 (4-bit)',
        profile: 'q4',
        dtype: 'q4',
        status: 'downloaded' as const,
        estimatedTotalBytes: totalBytes(q4Files),
        selectable: true,
        selected: true,
        files: q4Files,
      },
      {
        id: 'q4f16',
        label: 'q4f16',
        profile: 'q4f16',
        dtype: 'q4f16',
        status: 'downloaded' as const,
        estimatedTotalBytes: totalBytes(q4f16Files),
        selectable: true,
        selected: false,
        files: q4f16Files,
      },
      {
        id: 'bnb4',
        label: 'bnb4',
        profile: 'bnb4',
        dtype: 'bnb4',
        status: 'downloading' as const,
        estimatedTotalBytes: totalBytes(bnb4Files),
        selectable: true,
        selected: false,
        files: bnb4Files,
      },
      {
        id: 'q8',
        label: 'q8 (8-bit)',
        profile: 'q8',
        dtype: 'q8',
        status: 'downloaded' as const,
        estimatedTotalBytes: totalBytes(q8Files),
        selectable: true,
        selected: false,
        files: q8Files,
      },
    ]
    const buildAsset = (selectedGroupId: string): LocalModelAssetState => {
      const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0]
      const selectedFiles = selectedGroup.files
      return createLocalAssetStateForTest({
        modelId,
        status: 'downloaded',
        selected: true,
        progress: 1,
        bytesDownloaded: selectedGroup.estimatedTotalBytes,
        totalBytes: selectedGroup.estimatedTotalBytes,
        resumable: false,
        plan: {
          modelId,
          estimatedTotalBytes: selectedGroup.estimatedTotalBytes,
          selectedGroupId,
          files: selectedFiles,
          groups: groups.map((group) => ({
            ...group,
            selected: group.id === selectedGroupId,
          })),
        },
        files: createPlanAssetFilesForTest(
          selectedFiles,
          Object.fromEntries(selectedFiles.map((file) => [file.path, file.sizeBytes ?? 0]))
        ),
        updatedAt: 100,
      })
    }
    localModelsMock.listLocal.mockResolvedValueOnce({
      items: [
        {
          id: modelId,
          label: modelId,
          summary: 'Downloaded local model.',
          downloads: 0,
          likes: 0,
          tags: ['local'],
          compatibility: {
            transformersJs: true,
            onnx: true,
            localRuntimeVerified: true,
          },
          size: {
            estimatedTotalBytes: totalBytes(q4Files),
            primaryBytes: totalBytes(q4Files),
          },
          downloadGroups: groups,
          languageMatch: {
            sourceMatched: false,
            targetMatched: true,
            directionalScore: 0,
          },
          asset: buildAsset('q4'),
          selectable: true,
          local: true,
        },
      ],
    })
    localModelsMock.state.mockImplementation(
      async ({ selectedGroupId }: { modelId: string; selectedGroupId?: string }) =>
        buildAsset(selectedGroupId ?? 'q4')
    )
    const pendingQ4f16PanelState = createDeferred<{
      modelId: string
      selectedGroupId?: string
      asset: LocalModelAssetState
      downloadPlan: TranslationModelDownloadPlan | null
    }>()
    localModelsMock.panelState.mockImplementation(
      async ({ selectedGroupId }: { modelId: string; selectedGroupId?: string }) => {
        if (selectedGroupId === 'q4f16') {
          return pendingQ4f16PanelState.promise
        }
        const selectedGroupIdFromServer = selectedGroupId ?? 'q4'
        const asset = buildAsset(selectedGroupIdFromServer)
        return {
          modelId,
          selectedGroupId: selectedGroupIdFromServer,
          asset,
          downloadPlan: asset.plan ?? null,
        }
      }
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: {
              model: modelId,
              selectedGroupId: 'q4',
            },
          },
        },
      },
    })
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: {
        translationCache: { entryLimit: 10000 },
        translationEngines: {
          openai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
          local: { model: modelId, selectedGroupId: 'q4', hfEndpoint: '' },
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const profileList = await screen.findByLabelText('Local download profiles')
    const q4Chip = within(profileList).getByRole('button', { name: /^q4 /i })
    const q4f16Chip = within(profileList).getByRole('button', { name: /^q4f16/i })
    const bnb4Chip = within(profileList).getByRole('button', { name: /^bnb4/i })

    expect(q4Chip.className).toContain('border-solid')
    expect(q4Chip.className).toContain('text-emerald-700')
    expect(bnb4Chip.className).toContain('border-dashed')
    expect(bnb4Chip.className).toContain('text-sky-700')
    expect(screen.getByText('onnx/encoder_model_q4.onnx')).toBeTruthy()

    fireEvent.click(q4f16Chip)

    await waitFor(() =>
      expect(localModelsMock.panelState).toHaveBeenCalledWith({
        modelId,
        selectedGroupId: 'q4f16',
      })
    )
    const pendingProfileList = screen.getByLabelText('Local download profiles')
    const pendingQ4Chip = within(pendingProfileList).getByRole('button', { name: /^q4 /i })
    const pendingQ4f16Chip = within(pendingProfileList).getByRole('button', { name: /^q4f16/i })
    const pendingBnb4Chip = within(pendingProfileList).getByRole('button', { name: /^bnb4/i })
    expect(pendingQ4Chip.className).toContain('border-solid')
    expect(pendingQ4Chip.className).toContain('text-emerald-700')
    expect(pendingQ4f16Chip.className).toContain('border-dashed')
    expect(pendingQ4f16Chip.className).toContain('text-emerald-700')
    expect(pendingBnb4Chip.className).toContain('border-dashed')
    expect(pendingBnb4Chip.className).toContain('text-sky-700')
    expect(screen.queryByText('Loading model files…')).toBeNull()
    expect(screen.getByText('onnx/encoder_model_q4.onnx')).toBeTruthy()

    const q4f16Asset = buildAsset('q4f16')
    await act(async () => {
      pendingQ4f16PanelState.resolve({
        modelId,
        selectedGroupId: 'q4f16',
        asset: q4f16Asset,
        downloadPlan: q4f16Asset.plan ?? null,
      })
    })

    const updatedProfileList = await screen.findByLabelText('Local download profiles')
    const updatedQ4Chip = within(updatedProfileList).getByRole('button', { name: /^q4 /i })
    const updatedQ4f16Chip = within(updatedProfileList).getByRole('button', { name: /^q4f16/i })
    const updatedBnb4Chip = within(updatedProfileList).getByRole('button', { name: /^bnb4/i })
    await waitFor(() => expect(updatedQ4f16Chip.className).toContain('border-solid'))
    expect(updatedQ4Chip.className).toContain('border-dashed')
    expect(updatedQ4Chip.className).toContain('text-emerald-700')
    expect(updatedQ4f16Chip.className).toContain('text-emerald-700')
    expect(updatedBnb4Chip.className).toContain('border-dashed')
    expect(updatedBnb4Chip.className).toContain('text-sky-700')
    expect(screen.getByText('onnx/encoder_model_q4f16.onnx')).toBeTruthy()
  })

  it('locks deleting state and hides resume/delete actions while removal is in progress', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    localModelsMock.state.mockImplementation(async () => ({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'deleting',
      selected: true,
      progress: 0.42,
      resumable: false,
      plan: createQ8PlanForTest('Xenova/opus-mt-no-de'),
      files: createQ8AssetFilesForTest({
        'onnx/encoder_model_quantized.onnx': 22196257,
        'onnx/decoder_model_merged_quantized.onnx': 81298194,
      }),
      updatedAt: 100,
    }))
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Resume download' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete model' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pause download' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download model' })).toBeNull()
  })

  it('renders downloaded Local-Transformers plan as a ready card when runtime plan is unavailable', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    localModelsMock.panelState.mockResolvedValueOnce({
      modelId: 'Xenova/opus-mt-no-de',
      selectedGroupId: 'q8',
      asset: createLocalAssetStateForTest({
        modelId: 'Xenova/opus-mt-no-de',
        status: 'downloaded',
        selected: true,
        progress: 1,
        bytesDownloaded: 246415360,
        totalBytes: 246415360,
        resumable: false,
        files: createDownloadedQ8AssetFilesForTest(),
        updatedAt: 100,
      }),
      downloadPlan: null,
    })
    localModelsMock.listLocal.mockResolvedValueOnce({
      items: [createDownloadedLocalModelForTest('Xenova/opus-mt-no-de')],
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(await screen.findByText('config.json')).toBeTruthy()
    expect(await screen.findByText('onnx/encoder_model_quantized.onnx')).toBeTruthy()
    expect(screen.queryByText('No runtime download plan available.')).toBeNull()
    expect(
      screen.getByLabelText('Downloaded', { selector: '[data-local-plan-action="downloaded"]' })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete model' })).toBeTruthy()
  })

  it('loads downloaded Local-Transformers chips from local state before runtime plan resolution', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    const localPlan = createQ8PlanForTest('Xenova/opus-mt-no-de')
    const localAsset: LocalModelAssetState = createLocalAssetStateForTest({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'downloaded',
      selected: true,
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      resumable: false,
      plan: localPlan,
      files: createDownloadedQ8AssetFilesForTest(),
      updatedAt: 100,
    })
    localModelsMock.listLocal.mockResolvedValueOnce({
      items: [
        {
          id: 'Xenova/opus-mt-no-de',
          label: 'Xenova/opus-mt-no-de',
          summary: 'Downloaded local model.',
          downloads: 0,
          likes: 0,
          tags: ['local'],
          compatibility: {
            transformersJs: true,
            onnx: true,
            localRuntimeVerified: true,
          },
          size: {
            estimatedTotalBytes: 246415360,
            primaryBytes: 246415360,
          },
          downloadGroups: localPlan.groups,
          languageMatch: {
            sourceMatched: false,
            targetMatched: true,
            directionalScore: 0,
          },
          asset: localAsset,
          selectable: true,
          local: true,
        },
      ],
    })
    localModelsMock.state.mockResolvedValue(localAsset)
    localModelsMock.panelState.mockResolvedValue({
      modelId: 'Xenova/opus-mt-no-de',
      selectedGroupId: 'q8',
      asset: localAsset,
      downloadPlan: localPlan,
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    await waitFor(() =>
      expect(
        screen.getByLabelText('Downloaded', { selector: '[data-local-plan-action="downloaded"]' })
      ).toBeTruthy()
    )
    expect(screen.getByText('config.json')).toBeTruthy()
    expect(screen.queryByText('Loading model files…')).toBeNull()
    expect(localModelsMock.panelState).toHaveBeenCalled()
    expect(localModelsMock.panelState).toHaveBeenCalled()
  })

  it('runs a browser translation smoke test from the dialog beside the engine selector', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'browser',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.queryByLabelText('Translation test source text')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open translation test' }))
    const dialog = screen.getByRole('dialog', { name: 'Translation Test', hidden: true })
    const sourceText = within(dialog).getByRole('textbox', { name: 'Translation test source text' })
    expect(sourceText).toHaveValue('')
    expect(sourceText).toHaveAttribute('placeholder', 'My name is Sarah and I live in London.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run Test' }))

    expect(
      await within(dialog).findByText('browser:My name is Sarah and I live in London.')
    ).toBeTruthy()
    expect(translationEnginesMock.batchTranslate).not.toHaveBeenCalled()
  })

  it('runs a server translation smoke test for the selected service engine from the dialog', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getByRole('button', { name: 'Open translation test' }).className).toContain(
      'bg-primary'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open translation test' }))
    const dialog = screen.getByRole('dialog', { name: 'Translation Test', hidden: true })
    const sourceText = within(dialog).getByRole('textbox', { name: 'Translation test source text' })
    expect(sourceText).toHaveValue('')
    expect(sourceText).toHaveAttribute(
      'placeholder',
      'Dette er en liten oversettelsestest fra norsk til tysk.'
    )
    await waitFor(() => expect(screen.getAllByText('q8 (8-bit)').length).toBeGreaterThan(0))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run Test' }))

    expect(
      await within(dialog).findByText(
        'server:Dette er en liten oversettelsestest fra norsk til tysk.'
      )
    ).toBeTruthy()
    expect(translationEnginesMock.batchTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        engineId: 'local',
        sourceLanguage: 'no',
        targetLanguage: 'de',
        model: 'Xenova/opus-mt-no-de',
        selectedGroupId: 'q8',
        inputs: ['Dette er en liten oversettelsestest fra norsk til tysk.'],
      }),
      expect.any(Object)
    )
  })

  it('switches the translation test placeholder with the selected source language', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'browser',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Open translation test' }))
    const testDialog = screen.getByRole('dialog', { name: 'Translation Test', hidden: true })
    fireEvent.click(
      within(testDialog).getByRole('button', { name: 'Translation test source language' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Select translation test source language' })
    dispatchPopoverToggle(dialog, 'open')
    const searchInput = screen.getByRole('textbox', {
      name: 'Search translation test source languages',
    })
    fireEvent.change(searchInput, { target: { value: 'deutsch' } })
    const option = await within(dialog).findByRole('option', { name: /German Deutsch/ })
    fireEvent.click(option)

    const sourceText = within(testDialog).getByRole('textbox', {
      name: 'Translation test source text',
    })
    expect(sourceText).toHaveValue('')
    expect(sourceText).toHaveAttribute(
      'placeholder',
      'Dies ist ein kurzer Satz zum Testen der Übersetzung.'
    )
  })

  it('searches translation languages by native label and stores the selected code', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Translation target language' }))
    const dialog = getTranslationTargetLanguageDialog()
    dispatchPopoverToggle(dialog, 'open')
    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })
    fireEvent.change(searchInput, { target: { value: '繁體' } })
    const option = await within(dialog).findByRole('option', {
      name: /Chinese \(Traditional\) 繁體中文/,
    })
    fireEvent.click(option)

    await waitFor(() =>
      expect(updateConfigMock).toHaveBeenCalledWith({ translation: { targetLanguage: 'zh-Hant' } })
    )
  })

  it('keeps the selected language on open and exposes an explicit clear action', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Translation target language' }))
    const dialog = getTranslationTargetLanguageDialog()
    dispatchPopoverToggle(dialog, 'open')
    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })

    expect(screen.getByRole('button', { name: 'Translation target language' })).toHaveTextContent(
      'Chinese 中文'
    )
    expect(searchInput).toHaveValue('')
    expect(dialog.querySelector('[aria-label="Clear search"]')).toBeTruthy()
  })

  it('uses popover theme tokens for the translation language dialog in dark mode-safe surfaces', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Translation target language' }))
    const popover = getTranslationTargetLanguageDialog()
    dispatchPopoverToggle(popover, 'open')

    expect(popover.className).toContain('bg-popover')
    expect(popover.className).toContain('text-popover-foreground')
    const selectedOption = screen
      .getAllByRole('option', { name: /Chinese 中文/ })
      .find((option) => popover.contains(option))
    expect(selectedOption?.className).toContain('bg-primary/10')
  })

  it('keeps the popover open when the inner search input is clicked', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Translation target language' }))
    const popover = getTranslationTargetLanguageDialog()
    dispatchPopoverToggle(popover, 'open')

    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })
    fireEvent.click(searchInput)

    expect(screen.getByRole('button', { name: 'Translation target language' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(searchInput).toHaveValue('')
  })

  it('restores the previous valid language when the popover closes without a selection', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Translation target language' }))
    const popover = getTranslationTargetLanguageDialog()
    dispatchPopoverToggle(popover, 'open')
    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })
    fireEvent.change(searchInput, { target: { value: 'japanese' } })

    expect(searchInput).toHaveValue('japanese')

    dispatchPopoverToggle(popover, 'closed')

    expect(screen.getByRole('button', { name: 'Translation target language' })).toHaveTextContent(
      'Chinese 中文'
    )
    expect(popover.querySelector('[aria-label="Clear search"]')).toBeTruthy()
    expect(updateConfigMock).not.toHaveBeenCalledWith({ translation: { targetLanguage: '' } })
  }, 10000)

  it('renders the shared ToC before settings content so narrow mode can collapse above content', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({ data: {} })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(tocRenderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        className: expect.stringContaining('toc-page-sidebar'),
        itemIds: expect.arrayContaining(['settings-translation']),
      })
    )

    const toc = screen.getByTestId('settings-toc')
    const content = document.querySelector('.toc-page-content')
    expect(content).toBeInstanceOf(HTMLElement)
    if (!(content instanceof HTMLElement)) {
      throw new Error('Settings content element missing')
    }
    expect(toc.compareDocumentPosition(content)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})
