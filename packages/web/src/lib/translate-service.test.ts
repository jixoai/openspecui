import { LocalModelAssetStateSchema, type LocalModelAssetState } from '@openspecui/core/translator'
import { describe, expect, it, vi } from 'vitest'
import { resolveTranslateServiceState } from './translate-service'

const panelStateQueryMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    localModels: {
      panelState: {
        query: panelStateQueryMock,
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
    expect(updates).toEqual(['checking'])
    expect(state.status).toEqual({
      state: 'ready',
      engineId: 'local',
      message: 'Selected local model files are ready.',
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
