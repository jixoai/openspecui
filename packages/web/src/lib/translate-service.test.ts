import {
  LocalModelAssetStateSchema,
  createTranslationEngineLifecycleStatus,
  type LocalModelAssetState,
} from '@openspecui/core/translator'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveTranslateServiceState } from './translate-service'

const panelStateQueryMock = vi.hoisted(() => vi.fn())
const ct2PanelStateQueryMock = vi.hoisted(() => vi.fn())
const llamaPanelStateQueryMock = vi.hoisted(() => vi.fn())
const engineLifecycleQueryMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    localModels: {
      panelState: {
        query: panelStateQueryMock,
      },
    },
    localCt2Models: {
      panelState: {
        query: ct2PanelStateQueryMock,
      },
    },
    localLlamaModels: {
      panelState: {
        query: llamaPanelStateQueryMock,
      },
    },
    translationCache: {
      read: {
        query: vi.fn(),
      },
      write: {
        mutate: vi.fn(),
      },
    },
    translationEngines: {
      getLifecycle: {
        query: engineLifecycleQueryMock,
      },
      batchTranslate: {
        subscribe: vi.fn(),
      },
    },
  },
}))

vi.mock('@/lib/browser-translation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/browser-translation')>()
  return {
    ...original,
    getBrowserSupportTableState: vi.fn(() => null),
    scanBrowserTranslationPairs: vi.fn(),
  }
})

describe('translate service', () => {
  beforeEach(() => {
    panelStateQueryMock.mockReset()
    ct2PanelStateQueryMock.mockReset()
    llamaPanelStateQueryMock.mockReset()
    engineLifecycleQueryMock.mockReset()
    engineLifecycleQueryMock.mockResolvedValue(
      createTranslationEngineLifecycleStatus({
        dependency: {
          state: 'installed',
          message: 'Runtime dependencies are installed.',
        },
        runtime: {
          state: 'ready',
          message: 'Runtime is ready.',
        },
      })
    )
  })

  it('rejects a local directional model when the document target conflicts', async () => {
    const state = await resolveTranslateServiceState({
      config: {
        enabled: true,
        targetLanguage: 'de',
        displayMode: 'direct',
        cacheEnabled: false,
        engineId: 'local',
        engines: {
          local: {
            model: 'onnx-community/opus-mt-en-zh',
            selectedGroupId: 'int8-4dc37a',
          },
          localCt2: {},
          localLlama: {},
          openai: {},
        },
      },
      hasSource: true,
    })

    expect(panelStateQueryMock).not.toHaveBeenCalled()
    expect(state.status).toEqual({
      state: 'unavailable',
      engineId: 'local',
      message:
        'Selected local model supports en -> zh, but document translation is configured for target de.',
    })
  })

  it('owns local model availability checks and accepts base selected group ids', async () => {
    panelStateQueryMock.mockResolvedValueOnce({
      modelId: 'Xenova/opus-mt-en-zh',
      selectedGroupId: 'q4-abcdef',
      asset: createDownloadedLocalAssetState(),
      downloadPlan: null,
    })

    const updates: string[] = []
    const state = await resolveTranslateServiceState({
      config: {
        enabled: true,
        targetLanguage: 'zh',
        displayMode: 'direct',
        cacheEnabled: false,
        engineId: 'local',
        engines: {
          local: {
            model: 'Xenova/opus-mt-en-zh',
            selectedGroupId: 'q4',
          },
          localCt2: {},
          localLlama: {},
          openai: {},
        },
      },
      hasSource: true,
      onUpdate: (nextState) => updates.push(nextState.status.state),
    })

    expect(panelStateQueryMock).toHaveBeenCalledWith({
      modelId: 'Xenova/opus-mt-en-zh',
      selectedGroupId: 'q4',
    })
    expect(updates).toEqual(['checking', 'checking'])
    expect(state.status).toEqual({
      state: 'ready',
      engineId: 'local',
      message: 'Selected local model files are ready.',
    })
  })

  it('routes local-ct2 model availability checks through the ct2 panel state endpoint', async () => {
    ct2PanelStateQueryMock.mockResolvedValueOnce({
      modelId: 'ooeoeo/opus-mt-en-zh-ct2-float16',
      selectedGroupId: 'float16',
      asset: createDownloadedCt2AssetState(),
      downloadPlan: null,
    })

    const state = await resolveTranslateServiceState({
      config: {
        enabled: true,
        targetLanguage: 'zh',
        displayMode: 'direct',
        cacheEnabled: false,
        engineId: 'local-ct2',
        engines: {
          local: {},
          localCt2: {
            model: 'ooeoeo/opus-mt-en-zh-ct2-float16',
            selectedGroupId: 'float16',
          },
          localLlama: {},
          openai: {},
        },
      },
      hasSource: true,
    })

    expect(panelStateQueryMock).not.toHaveBeenCalled()
    expect(ct2PanelStateQueryMock).toHaveBeenCalledWith({
      modelId: 'ooeoeo/opus-mt-en-zh-ct2-float16',
      selectedGroupId: 'float16',
    })
    expect(state.status).toEqual({
      state: 'ready',
      engineId: 'local-ct2',
      message: 'Selected local model files are ready.',
    })
  })

  it('routes local-llama availability checks through the llama panel state endpoint without directional gating', async () => {
    llamaPanelStateQueryMock.mockResolvedValueOnce({
      modelId: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
      selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
      asset: createDownloadedLlamaAssetState(),
      downloadPlan: null,
    })

    const state = await resolveTranslateServiceState({
      config: {
        enabled: true,
        targetLanguage: 'zh',
        displayMode: 'direct',
        cacheEnabled: false,
        engineId: 'local-llama',
        engines: {
          local: {},
          localCt2: {},
          localLlama: {
            model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
            selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
          },
          openai: {},
        },
      },
      hasSource: true,
    })

    expect(panelStateQueryMock).not.toHaveBeenCalled()
    expect(ct2PanelStateQueryMock).not.toHaveBeenCalled()
    expect(llamaPanelStateQueryMock).toHaveBeenCalledWith({
      modelId: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
      selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
    })
    expect(state.status).toEqual({
      state: 'ready',
      engineId: 'local-llama',
      message: 'Selected local model files are ready.',
    })
  })

  it('surfaces local-llama runtime compatibility failures before treating downloaded files as ready', async () => {
    engineLifecycleQueryMock.mockResolvedValueOnce(
      createTranslationEngineLifecycleStatus({
        dependency: {
          state: 'installed',
          message: 'Runtime dependencies are installed.',
        },
        runtime: {
          state: 'ready',
          message: 'Runtime is ready.',
        },
        assets: {
          state: 'error',
          message:
            'Selected llama GGUF group Hy-MT2-1.8B-1.25Bit cannot be loaded by the current node-llama-cpp runtime: Invalid type or block size',
          error: 'Invalid type or block size',
        },
      })
    )
    llamaPanelStateQueryMock.mockResolvedValueOnce({
      modelId: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
      selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
      asset: createDownloadedLlamaAssetState(),
      downloadPlan: null,
    })

    const state = await resolveTranslateServiceState({
      config: {
        enabled: true,
        targetLanguage: 'zh',
        displayMode: 'direct',
        cacheEnabled: false,
        engineId: 'local-llama',
        engines: {
          local: {},
          localCt2: {},
          localLlama: {
            model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
            selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
          },
          openai: {},
        },
      },
      hasSource: true,
    })

    expect(state.status).toEqual({
      state: 'unavailable',
      engineId: 'local-llama',
      message:
        'Selected llama GGUF group Hy-MT2-1.8B-1.25Bit cannot be loaded by the current node-llama-cpp runtime: Invalid type or block size',
    })
  })

  it('surfaces runtime lifecycle failures before checking local assets', async () => {
    engineLifecycleQueryMock.mockResolvedValueOnce(
      createTranslationEngineLifecycleStatus({
        dependency: {
          state: 'installed',
          message: 'Runtime dependencies are installed.',
        },
        runtime: {
          state: 'failed',
          message: 'Local runtime could not be loaded.',
          error: 'Native binding failed to load.',
        },
      })
    )

    const state = await resolveTranslateServiceState({
      config: {
        enabled: true,
        targetLanguage: 'zh',
        displayMode: 'direct',
        cacheEnabled: false,
        engineId: 'local',
        engines: {
          local: {
            model: 'Xenova/opus-mt-en-zh',
            selectedGroupId: 'q4',
          },
          localCt2: {},
          localLlama: {},
          openai: {},
        },
      },
      hasSource: true,
    })

    expect(panelStateQueryMock).not.toHaveBeenCalled()
    expect(state.status).toEqual({
      state: 'unavailable',
      engineId: 'local',
      message: 'Native binding failed to load.',
    })
  })
})

function createDownloadedLocalAssetState(): LocalModelAssetState {
  return LocalModelAssetStateSchema.parse({
    modelId: 'Xenova/opus-mt-en-zh',
    version: 2,
    status: 'downloaded',
    selected: true,
    selectedGroupId: 'q4-abcdef',
    progress: 1,
    bytesDownloaded: 30,
    totalBytes: 30,
    resumable: false,
    groupsState: {},
    profileLoad: {
      status: 'ready',
    },
    plan: {
      modelId: 'Xenova/opus-mt-en-zh',
      estimatedTotalBytes: 30,
      selectedGroupId: 'q4-abcdef',
      files: [
        { path: 'config.json', sizeBytes: 10, required: true },
        { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 20, required: true },
      ],
      groups: [
        {
          id: 'q4-abcdef',
          baseGroupId: 'q4',
          label: 'q4',
          dtype: 'q4',
          estimatedTotalBytes: 30,
          selectable: true,
          selected: true,
          files: [
            { path: 'config.json', sizeBytes: 10, required: true },
            { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 20, required: true },
          ],
        },
      ],
    },
    files: [
      { path: 'config.json', sizeBytes: 10, downloadedBytes: 10 },
      { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 20, downloadedBytes: 20 },
    ],
  })
}

function createDownloadedCt2AssetState(): LocalModelAssetState {
  return LocalModelAssetStateSchema.parse({
    modelId: 'ooeoeo/opus-mt-en-zh-ct2-float16',
    version: 2,
    status: 'downloaded',
    selected: true,
    selectedGroupId: 'float16',
    progress: 1,
    bytesDownloaded: 30,
    totalBytes: 30,
    resumable: false,
    groupsState: {},
    profileLoad: {
      status: 'ready',
    },
    plan: {
      modelId: 'ooeoeo/opus-mt-en-zh-ct2-float16',
      estimatedTotalBytes: 30,
      selectedGroupId: 'float16',
      files: [
        { path: 'config.json', sizeBytes: 5, required: true },
        { path: 'model.bin', sizeBytes: 10, required: true },
        { path: 'source.spm', sizeBytes: 5, required: true },
        { path: 'target.spm', sizeBytes: 5, required: true },
        { path: 'shared_vocabulary.json', sizeBytes: 5, required: true },
      ],
      groups: [
        {
          id: 'float16',
          label: 'float16',
          estimatedTotalBytes: 30,
          selectable: true,
          selected: true,
          files: [
            { path: 'config.json', sizeBytes: 5, required: true },
            { path: 'model.bin', sizeBytes: 10, required: true },
            { path: 'source.spm', sizeBytes: 5, required: true },
            { path: 'target.spm', sizeBytes: 5, required: true },
            { path: 'shared_vocabulary.json', sizeBytes: 5, required: true },
          ],
        },
      ],
    },
    files: [
      { path: 'config.json', sizeBytes: 5, downloadedBytes: 5 },
      { path: 'model.bin', sizeBytes: 10, downloadedBytes: 10 },
      { path: 'source.spm', sizeBytes: 5, downloadedBytes: 5 },
      { path: 'target.spm', sizeBytes: 5, downloadedBytes: 5 },
      { path: 'shared_vocabulary.json', sizeBytes: 5, downloadedBytes: 5 },
    ],
  })
}

function createDownloadedLlamaAssetState(): LocalModelAssetState {
  return LocalModelAssetStateSchema.parse({
    modelId: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
    version: 2,
    status: 'downloaded',
    selected: true,
    selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
    progress: 1,
    bytesDownloaded: 30,
    totalBytes: 30,
    resumable: false,
    groupsState: {},
    profileLoad: {
      status: 'ready',
    },
    plan: {
      modelId: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
      estimatedTotalBytes: 30,
      selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
      files: [{ path: 'Hy-MT2-1.8B-1.25Bit.gguf', sizeBytes: 30, required: true }],
      groups: [
        {
          id: 'Hy-MT2-1.8B-1.25Bit.gguf',
          label: 'Hy-MT2-1.8B-1.25Bit',
          estimatedTotalBytes: 30,
          selectable: true,
          selected: true,
          files: [{ path: 'Hy-MT2-1.8B-1.25Bit.gguf', sizeBytes: 30, required: true }],
        },
      ],
    },
    files: [{ path: 'Hy-MT2-1.8B-1.25Bit.gguf', sizeBytes: 30, downloadedBytes: 30 }],
  })
}
