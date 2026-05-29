import {
  ConfigManager,
  GlobalSettingsManager,
  LocalModelAssetStateSchema,
  type BatchTranslateEvent,
  type ServiceTranslationEngineId,
  type TranslationModelDownloadPlan,
  type TranslatorFactory,
} from '@openspecui/core'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TranslationEngineService } from './translation-engine-service.js'

const llamaCreateContextMock = vi.hoisted(() =>
  vi.fn(async () => ({
    getSequence: () => ({ id: 'sequence' }),
    dispose: vi.fn(),
  }))
)
const llamaLoadModelMock = vi.hoisted(() =>
  vi.fn(async () => ({
    createContext: llamaCreateContextMock,
    dispose: vi.fn(),
  }))
)
const llamaGetLlamaMock = vi.hoisted(() => vi.fn(async () => ({ loadModel: llamaLoadModelMock })))
const runtimeDependencyTreeMock = vi.hoisted(() =>
  vi.fn(async () => ({
    dependencies: {
      '@huggingface/transformers': {
        dependencies: {
          'onnxruntime-node': {},
        },
      },
      ctranslate2: {},
      'node-llama-cpp': {},
    },
  }))
)

vi.mock('@huggingface/hub', async (importOriginal) => {
  const original = await importOriginal<typeof import('@huggingface/hub')>()
  return {
    ...original,
    listFiles: vi.fn(async function* () {
      yield { path: 'config.json', type: 'file', size: 10 }
      yield { path: 'onnx/encoder_model_q4.onnx', type: 'file', size: 12_000_000 }
      yield { path: 'onnx/decoder_model_merged_q4.onnx', type: 'file', size: 18_000_000 }
    }),
  }
})

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(),
}))

vi.mock('ctranslate2', () => ({
  Ct2Translator: vi.fn(),
}))

vi.mock('node-llama-cpp', async (importOriginal) => {
  const original = await importOriginal<typeof import('node-llama-cpp')>()
  return {
    ...original,
    getLlama: llamaGetLlamaMock,
  }
})

vi.mock('./runtime-package-host.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./runtime-package-host.js')>()
  return {
    ...original,
    readRuntimeHostPackageDependencyTree: runtimeDependencyTreeMock,
  }
})

type TestableTranslationEngineService = TranslationEngineService & {
  loadFactory(
    engineId: ServiceTranslationEngineId,
    model: string | undefined,
    settingsSnapshot?: Awaited<ReturnType<GlobalSettingsManager['readSettings']>>
  ): Promise<TranslatorFactory>
}

describe('TranslationEngineService', () => {
  let tempDir: string
  let projectDir: string
  let settingsPath: string
  let localCacheDir: string
  let localAssetIndexPath: string
  let localFetchCachePath: string
  let localLlamaCacheDir: string
  let localLlamaAssetIndexPath: string
  let localLlamaFetchCachePath: string
  let service: TranslationEngineService

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openspecui-translation-engine-'))
    projectDir = tempDir
    settingsPath = join(tempDir, '.openspecui', 'settings.json')
    localCacheDir = join(tempDir, 'local-cache')
    localAssetIndexPath = join(tempDir, 'local-models.json')
    localFetchCachePath = join(tempDir, 'local-fetch-cache.json')
    localLlamaCacheDir = join(tempDir, 'local-llama-cache')
    localLlamaAssetIndexPath = join(tempDir, 'local-llama-models.json')
    localLlamaFetchCachePath = join(tempDir, 'local-llama-fetch-cache.json')
    service = new TranslationEngineService({
      projectDir,
      configManager: new ConfigManager(projectDir),
      globalSettingsManager: new GlobalSettingsManager(settingsPath),
      now: () => 100,
      localCacheDir: localCacheDir,
      localAssetIndexPath: localAssetIndexPath,
      localFetchCachePath: localFetchCachePath,
      localLlamaCacheDir,
      localLlamaAssetIndexPath,
      localLlamaFetchCachePath,
      readRuntimeMemory: () => ({
        totalMemoryMb: 16 * 1024,
        availableMemoryMb: 12 * 1024,
        platform: 'darwin',
        arch: 'arm64',
      }),
    })
    llamaCreateContextMock.mockReset()
    llamaCreateContextMock.mockResolvedValue({
      getSequence: () => ({ id: 'sequence' }),
      dispose: vi.fn(),
    })
    llamaLoadModelMock.mockReset()
    llamaLoadModelMock.mockResolvedValue({
      createContext: llamaCreateContextMock,
      dispose: vi.fn(),
    })
    llamaGetLlamaMock.mockReset()
    llamaGetLlamaMock.mockResolvedValue({ loadModel: llamaLoadModelMock })
    runtimeDependencyTreeMock.mockReset()
    runtimeDependencyTreeMock.mockResolvedValue({
      dependencies: {
        '@huggingface/transformers': {
          dependencies: {
            'onnxruntime-node': {},
          },
        },
        ctranslate2: {},
        'node-llama-cpp': {},
      },
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns ranked local model candidates from the server-side catalog', async () => {
    await new GlobalSettingsManager(settingsPath).writeSettings({
      translationEngines: {
        local: {
          hfEndpoint: 'https://hf-mirror.com',
        },
      },
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                id: 'Xenova/opus-mt-en-de',
                pipeline_tag: 'translation',
                tags: ['transformers.js', 'onnx', 'translation', 'en', 'de'],
                downloads: 502,
                likes: 12,
                trendingScore: 4,
              },
              {
                id: 'legacy/plain-model',
                pipeline_tag: 'translation',
                tags: ['translation'],
                downloads: 90,
                likes: 1,
                trendingScore: 1,
              },
            ]),
            {
              status: 200,
              headers: {
                link: '<https://huggingface.co/api/models?cursor=NEXT>; rel="next"',
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'Xenova/opus-mt-en-de',
              pipeline_tag: 'translation',
              tags: ['transformers.js', 'onnx', 'translation', 'en', 'de'],
              downloads: 502,
              likes: 12,
              trendingScore: 4,
              config: { is_encoder_decoder: true },
              siblings: [
                { rfilename: 'onnx/encoder_model_quantized.onnx', size: 35_000_000 },
                { rfilename: 'onnx/decoder_model_merged_quantized.onnx', size: 56_000_000 },
              ],
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'legacy/plain-model',
              pipeline_tag: 'translation',
              tags: ['translation'],
              downloads: 90,
              likes: 1,
              trendingScore: 1,
              siblings: [],
            }),
            { status: 200 }
          )
        )
    )

    const models = await service.searchModels({
      engineId: 'local',
      targetLanguage: 'de',
      query: 'opus',
      limit: 3,
    })

    expect(models.items.length).toBeGreaterThan(0)
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^https:\/\/hf-mirror\.com\/api\/models\?/),
      expect.any(Object)
    )
    expect(models.items.some((item) => item.compatibility.localRuntimeVerified)).toBe(true)
    expect(models.items.some((item) => (item.size.estimatedTotalBytes ?? 0) > 0)).toBe(true)
    expect(models.nextCursor).toBe('NEXT')
  })

  it('reports bundled browser and openai engines as installed', async () => {
    const browser = await service.getLifecycle('browser')
    const openai = await service.getLifecycle('openai')

    expect(browser).toMatchObject({
      dependency: {
        state: 'not-applicable',
        message: 'Browser translation support is built into the browser runtime.',
      },
    })
    expect(openai).toMatchObject({
      dependency: {
        state: 'not-applicable',
        message: 'OpenAI completion translation is bundled with the server runtime.',
      },
    })
  })

  it('selects translation engines globally when the project has no engine override', async () => {
    await service.selectEngine('local-llama')

    await expect(new GlobalSettingsManager(settingsPath).readSettings()).resolves.toMatchObject({
      translationEngines: {
        engineId: 'local-llama',
      },
    })
    await expect(
      readFile(join(projectDir, 'openspec', '.openspecui.json'), 'utf-8')
    ).rejects.toThrow()
  })

  it('keeps translation engine selection in project config when the project owns the field', async () => {
    await mkdir(join(projectDir, 'openspec'), { recursive: true })
    await writeFile(
      join(projectDir, 'openspec', '.openspecui.json'),
      JSON.stringify({ translation: { engineId: 'local' } }),
      'utf-8'
    )

    await service.selectEngine('local-llama')

    await expect(new GlobalSettingsManager(settingsPath).readSettings()).resolves.toMatchObject({
      translationEngines: {
        engineId: 'browser',
      },
    })
    await expect(readFile(join(projectDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
      '{\n  "translation": {\n    "engineId": "local-llama"\n  }\n}'
    )
  })

  it('uses strict repository profile files for local download plans', async () => {
    await writePersistedLocalAssetPlan(
      localAssetIndexPath,
      createLocalDownloadPlan('Xenova/opus-mt-en-de', 'q4', {
        configBytes: 10,
        encoderBytes: 12_000_000,
        decoderBytes: 18_000_000,
      })
    )

    const plan = await service.getModelDownloadPlan({
      engineId: 'local',
      model: 'Xenova/opus-mt-en-de',
    })

    expect(plan?.files.map((file) => file.path)).toEqual([
      'config.json',
      'onnx/encoder_model_q4.onnx',
      'onnx/decoder_model_merged_q4.onnx',
    ])
    expect(plan?.estimatedTotalBytes).toBe(30_000_010)
  })

  it('uses persisted gguf download plans for local llama models', async () => {
    await writePersistedLocalAssetPlan(
      localLlamaAssetIndexPath,
      createLlamaDownloadPlan('tencent/Hy-MT2-1.8B-1.25Bit-GGUF', 'Hy-MT2-1.8B-1.25Bit.gguf', {
        modelBytes: 461_860_736,
        rootDir: join(tempDir, 'llama-profiles', 'Hy-MT2-1.8B-1.25Bit.gguf'),
      })
    )

    const plan = await service.getModelDownloadPlan({
      engineId: 'local-llama',
      model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
      selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
    })

    expect(plan?.files.map((file) => file.path)).toEqual(['Hy-MT2-1.8B-1.25Bit.gguf'])
    expect(plan?.estimatedTotalBytes).toBe(461_860_736)
  })

  it('keeps selected local profile sizes from the asset snapshot when provider sizes are missing', async () => {
    await writePersistedLocalAssetPlan(
      localAssetIndexPath,
      createLocalDownloadPlan('Xenova/opus-mt-en-de', 'q4f16', {
        configBytes: 1_500,
        encoderBytes: 74_300_000,
        decoderBytes: 84_698_500,
      }),
      {
        status: 'paused',
        bytesDownloaded: 66_780_000,
        progress: 0.42,
        resumable: true,
      }
    )

    const plan = await service.getModelDownloadPlan({
      engineId: 'local',
      model: 'Xenova/opus-mt-en-de',
      selectedGroupId: 'q4f16',
    })

    const group = plan?.groups?.find((item) => item.id === 'q4f16')
    expect(group).toBeTruthy()
    expect(group?.estimatedTotalBytes).toBe(159_000_000)
    expect(plan?.estimatedTotalBytes).toBe(159_000_000)
    expect(group?.files.map((file) => file.sizeBytes)).toEqual([1_500, 74_300_000, 84_698_500])
  })

  it('falls back to the persisted local asset plan when runtime plan refresh fails', async () => {
    await writePersistedLocalAssetPlan(
      localAssetIndexPath,
      createLocalDownloadPlan('Xenova/opus-mt-en-de', 'q4', {
        configBytes: 1,
        encoderBytes: 35_000_000,
        decoderBytes: 56_000_000,
      }),
      { status: 'downloaded', bytesDownloaded: 91_000_001, progress: 1 }
    )

    const plan = await service.getModelDownloadPlan({
      engineId: 'local',
      model: 'Xenova/opus-mt-en-de',
      selectedGroupId: 'q4',
    })

    expect(plan).toMatchObject({
      modelId: 'Xenova/opus-mt-en-de',
      selectedGroupId: 'q4',
      estimatedTotalBytes: 91_000_001,
    })
    expect(plan?.files.map((file) => file.path)).toEqual([
      'config.json',
      'onnx/encoder_model_q4.onnx',
      'onnx/decoder_model_merged_q4.onnx',
    ])
  })

  it('passes the selected local download group dtype into batch translation runtime', async () => {
    const testableService = service as TestableTranslationEngineService
    const create = vi.fn(async () => ({
      batchTranslate: async function* (): AsyncGenerator<BatchTranslateEvent> {
        yield { index: 0, output: 'Hallo' }
      },
      destroy: vi.fn(),
    }))
    vi.spyOn(testableService, 'loadFactory').mockResolvedValue({ create })
    const plan = createLocalDownloadPlan('Xenova/opus-mt-en-de', 'q4', {
      rootDir: join(tempDir, 'profiles', 'q4'),
    })
    vi.spyOn(testableService, 'getModelDownloadPlan').mockResolvedValue(plan)
    await writePersistedLocalAssetPlan(localAssetIndexPath, plan, {
      status: 'downloaded',
      bytesDownloaded: 31,
      progress: 1,
      rootDir: join(tempDir, 'profiles', 'q4'),
    })
    await writeLocalProfileFiles(join(tempDir, 'profiles', 'q4'), [
      'config.json',
      'onnx/encoder_model_q4.onnx',
      'onnx/decoder_model_merged_q4.onnx',
    ])

    const events = await collectBatchEvents(
      service.batchTranslate({
        engineId: 'local',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        model: 'Xenova/opus-mt-en-de',
        selectedGroupId: 'q4',
        inputs: ['Hello'],
      })
    )

    expect(events).toEqual([{ index: 0, output: 'Hallo' }])
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'Xenova/opus-mt-en-de',
        dtype: 'q4',
        runtimeConfig: {
          model_type: 'marian',
          device: 'cpu',
          session_options: {
            enableCpuMemArena: false,
            enableMemPattern: false,
          },
        },
      })
    )
  })

  it('maps managed local memory budget intent into runtime strategy for local transformers', async () => {
    const testableService = service as TestableTranslationEngineService
    const create = vi.fn(async () => ({
      batchTranslate: async function* (): AsyncGenerator<BatchTranslateEvent> {
        yield { index: 0, output: 'Hallo' }
      },
      destroy: vi.fn(),
    }))
    vi.spyOn(testableService, 'loadFactory').mockResolvedValue({ create })
    await new GlobalSettingsManager(settingsPath).writeSettings({
      translationEngines: {
        local: {
          model: 'Xenova/opus-mt-en-de',
          selectedGroupId: 'q4',
          hfEndpoint: '',
          memoryBudgetPercent: 80,
        },
      },
    })
    const plan = createLocalDownloadPlan('Xenova/opus-mt-en-de', 'q4', {
      rootDir: join(tempDir, 'profiles', 'q4'),
    })
    await writePersistedLocalAssetPlan(localAssetIndexPath, plan, {
      status: 'downloaded',
      bytesDownloaded: 31,
      progress: 1,
      rootDir: join(tempDir, 'profiles', 'q4'),
    })
    await writeLocalProfileFiles(join(tempDir, 'profiles', 'q4'), [
      'config.json',
      'onnx/encoder_model_q4.onnx',
      'onnx/decoder_model_merged_q4.onnx',
    ])

    await collectBatchEvents(
      service.batchTranslate({
        engineId: 'local',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        model: 'Xenova/opus-mt-en-de',
        selectedGroupId: 'q4',
        inputs: ['Hello'],
      })
    )

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeConfig: expect.objectContaining({
          model_type: 'marian',
          device: 'gpu',
          session_options: {
            enableCpuMemArena: true,
            enableMemPattern: true,
          },
        }),
      })
    )
  })

  it('passes managed local worker resource limits derived from memory budget into the executor', async () => {
    let capturedInput:
      | Parameters<
          NonNullable<
            ConstructorParameters<
              typeof TranslationEngineService
            >[0]['executeManagedLocalBatchTranslate']
          >
        >[0]
      | undefined
    const executorService = new TranslationEngineService({
      projectDir,
      configManager: new ConfigManager(projectDir),
      globalSettingsManager: new GlobalSettingsManager(settingsPath),
      now: () => 100,
      localCacheDir,
      localAssetIndexPath,
      localFetchCachePath,
      localLlamaCacheDir,
      localLlamaAssetIndexPath,
      localLlamaFetchCachePath,
      executeManagedLocalBatchTranslate: async function* (input) {
        capturedInput = input
        yield { index: 0, output: 'Hallo' }
      },
    })
    await new GlobalSettingsManager(settingsPath).writeSettings({
      translationEngines: {
        local: {
          model: 'Xenova/opus-mt-en-de',
          selectedGroupId: 'q4',
          hfEndpoint: '',
          memoryBudgetPercent: 0,
        },
      },
    })
    const plan = createLocalDownloadPlan('Xenova/opus-mt-en-de', 'q4', {
      rootDir: join(tempDir, 'profiles', 'q4'),
    })
    await writePersistedLocalAssetPlan(localAssetIndexPath, plan, {
      status: 'downloaded',
      bytesDownloaded: 31,
      progress: 1,
      rootDir: join(tempDir, 'profiles', 'q4'),
    })
    await writeLocalProfileFiles(join(tempDir, 'profiles', 'q4'), [
      'config.json',
      'onnx/encoder_model_q4.onnx',
      'onnx/decoder_model_merged_q4.onnx',
    ])

    const events = await collectBatchEvents(
      executorService.batchTranslate({
        engineId: 'local',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        model: 'Xenova/opus-mt-en-de',
        selectedGroupId: 'q4',
        inputs: ['Hello'],
      })
    )

    expect(events).toEqual([{ index: 0, output: 'Hallo' }])
    expect(capturedInput).toMatchObject({
      engineId: 'local',
      model: 'Xenova/opus-mt-en-de',
      runtimeConfig: {
        model_type: 'marian',
        device: 'cpu',
        session_options: {
          enableCpuMemArena: false,
          enableMemPattern: false,
        },
      },
      workerResourceLimits: {
        maxOldGenerationSizeMb: 256,
        maxYoungGenerationSizeMb: 64,
        codeRangeSizeMb: 128,
        maxRssMb: 256,
      },
    })
  })

  it('rejects local batch translation when a directional model target conflicts', async () => {
    const loadFactory = vi.spyOn(service as TestableTranslationEngineService, 'loadFactory')

    await expect(
      collectBatchEvents(
        service.batchTranslate({
          engineId: 'local',
          sourceLanguage: 'en',
          targetLanguage: 'de',
          model: 'onnx-community/opus-mt-en-zh',
          selectedGroupId: 'int8-4dc37a',
          inputs: ['Hello'],
        })
      )
    ).rejects.toThrow(
      'Selected local model supports en -> zh, but document translation is configured for target de.'
    )
    expect(loadFactory).not.toHaveBeenCalled()
  })

  it('normalizes base local group ids to versioned profile groups during batch translation', async () => {
    const testableService = service as TestableTranslationEngineService
    const create = vi.fn(async () => ({
      batchTranslate: async function* (): AsyncGenerator<BatchTranslateEvent> {
        yield { index: 0, output: 'Hallo' }
      },
      destroy: vi.fn(),
    }))
    vi.spyOn(testableService, 'loadFactory').mockResolvedValue({ create })
    const versionedGroupId = 'q4-abcdef'
    const plan = createLocalDownloadPlan('Xenova/opus-mt-en-de', versionedGroupId, {
      rootDir: join(tempDir, 'profiles', versionedGroupId),
    })
    plan.selectedGroupId = versionedGroupId
    plan.groups = plan.groups?.map((group) => ({
      ...group,
      id: versionedGroupId,
      baseGroupId: 'q4',
      dtype: 'q4',
      rootDir: join(tempDir, 'profiles', versionedGroupId),
      selected: true,
    }))
    await writePersistedLocalAssetPlan(localAssetIndexPath, plan, {
      status: 'downloaded',
      bytesDownloaded: 31,
      progress: 1,
      rootDir: join(tempDir, 'profiles', versionedGroupId),
    })
    await writeLocalProfileFiles(join(tempDir, 'profiles', versionedGroupId), [
      'config.json',
      `onnx/encoder_model_${versionedGroupId}.onnx`,
      `onnx/decoder_model_merged_${versionedGroupId}.onnx`,
    ])

    const events = await collectBatchEvents(
      service.batchTranslate({
        engineId: 'local',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        model: 'Xenova/opus-mt-en-de',
        selectedGroupId: 'q4',
        inputs: ['Hello'],
      })
    )

    expect(events).toEqual([{ index: 0, output: 'Hallo' }])
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        dtype: 'q4',
        runtimeConfig: {
          model_type: 'marian',
          device: 'cpu',
          session_options: {
            enableCpuMemArena: false,
            enableMemPattern: false,
          },
        },
      })
    )
  })

  it('fails local batch translation before probing remote metadata when files are missing', async () => {
    const testableService = service as TestableTranslationEngineService
    const create = vi.fn(async () => ({
      batchTranslate: async function* (): AsyncGenerator<BatchTranslateEvent> {
        yield { index: 0, output: 'Hallo' }
      },
      destroy: vi.fn(),
    }))
    vi.spyOn(testableService, 'loadFactory').mockResolvedValue({ create })
    const plan = createLocalDownloadPlan('Xenova/opus-mt-en-de', 'q4', {
      rootDir: join(tempDir, 'profiles', 'q4'),
    })
    vi.spyOn(testableService, 'getModelDownloadPlan').mockResolvedValue(plan)
    await writePersistedLocalAssetPlan(localAssetIndexPath, plan, {
      status: 'paused',
      bytesDownloaded: 13,
      progress: 13 / 31,
      rootDir: join(tempDir, 'profiles', 'q4'),
    })
    await writeLocalProfileFiles(join(tempDir, 'profiles', 'q4'), [
      'config.json',
      'onnx/encoder_model_q4.onnx',
    ])

    await expect(
      collectBatchEvents(
        service.batchTranslate({
          engineId: 'local',
          sourceLanguage: 'en',
          targetLanguage: 'de',
          model: 'Xenova/opus-mt-en-de',
          selectedGroupId: 'q4',
          inputs: ['Hello'],
        })
      )
    ).rejects.toThrow(
      'Selected local model files are not installed locally: onnx/encoder_model_q4.onnx, onnx/decoder_model_merged_q4.onnx.'
    )
    expect(create).not.toHaveBeenCalled()
  })

  it('passes the resolved gguf model path into local llama batch translation runtime', async () => {
    const testableService = service as TestableTranslationEngineService
    const create = vi.fn(async () => ({
      batchTranslate: async function* (): AsyncGenerator<BatchTranslateEvent> {
        yield { index: 0, output: '你好' }
      },
      destroy: vi.fn(),
    }))
    vi.spyOn(testableService, 'loadFactory').mockResolvedValue({ create })
    const groupId = 'Hy-MT2-1.8B-1.25Bit.gguf'
    const rootDir = join(tempDir, 'llama-profiles', groupId)
    const plan = createLlamaDownloadPlan('tencent/Hy-MT2-1.8B-1.25Bit-GGUF', groupId, {
      modelBytes: 4,
      rootDir,
    })
    await writePersistedLocalAssetPlan(localLlamaAssetIndexPath, plan, {
      status: 'downloaded',
      bytesDownloaded: 4,
      progress: 1,
      rootDir,
    })
    await writeLocalProfileFiles(rootDir, [{ path: groupId, size: 4 }])

    const events = await collectBatchEvents(
      service.batchTranslate({
        engineId: 'local-llama',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
        selectedGroupId: groupId,
        inputs: ['Hello'],
      })
    )

    expect(events).toEqual([{ index: 0, output: '你好' }])
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
        runtimeConfig: {
          gpuLayers: 0,
          contextSize: 1024,
          batchSize: 128,
          flashAttention: false,
          useMmap: true,
          useMlock: false,
          modelPath: join(rootDir, groupId),
        },
      })
    )
    expect(llamaLoadModelMock).toHaveBeenCalledWith({
      modelPath: join(rootDir, groupId),
      gpuLayers: undefined,
    })
  })

  it('does not probe local llama runtime compatibility while reading lifecycle truth', async () => {
    const groupId = 'Hy-MT2-1.8B-1.25Bit.gguf'
    const rootDir = join(tempDir, 'llama-profiles', groupId)
    const plan = createLlamaDownloadPlan('tencent/Hy-MT2-1.8B-1.25Bit-GGUF', groupId, {
      modelBytes: 4,
      rootDir,
    })
    await writePersistedLocalAssetPlan(localLlamaAssetIndexPath, plan, {
      status: 'downloaded',
      bytesDownloaded: 4,
      progress: 1,
      rootDir,
    })
    await writeLocalProfileFiles(rootDir, [{ path: groupId, size: 4 }])
    llamaLoadModelMock.mockRejectedValueOnce(new Error('Invalid type or block size'))

    const lifecycle = await service.getLifecycle('local-llama', {
      config: {
        translation: {
          engineId: 'local-llama',
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engines: {
            local: {},
            localCt2: {},
            localLlama: {
              model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
              selectedGroupId: groupId,
            },
            openai: {},
          },
        },
      },
      globalSettings: {
        translationEngines: {
          local: { model: '', selectedGroupId: undefined, hfEndpoint: '' },
          localCt2: { model: '', selectedGroupId: undefined, hfEndpoint: '' },
          localLlama: {
            model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
            selectedGroupId: groupId,
            hfEndpoint: '',
          },
          openai: { baseUrl: '', token: '', model: '' },
        },
      },
    })

    expect(lifecycle.assets).toMatchObject({
      state: 'ready',
      message: 'Selected llama model files are ready.',
    })
    expect(lifecycle.runtime).toMatchObject({
      state: 'not-applicable',
      message: 'Run Test Translate to validate runtime errors and latency.',
    })
    expect(lifecycle.summary).toBe('Local-Llama runtime dependencies are installed.')
    expect(llamaLoadModelMock).not.toHaveBeenCalled()
  })

  it('uses one immutable settings snapshot for a batch translation subscription', async () => {
    const settingsManager = new GlobalSettingsManager(settingsPath)
    await settingsManager.writeSettings({
      translationEngines: {
        openai: {
          baseUrl: 'https://api.initial.example/v1',
          token: 'initial-token',
          model: 'initial-model',
        },
      },
    })

    const snapshotModelNames: string[] = []
    const create = vi.fn(async () => {
      await settingsManager.writeSettings({
        translationEngines: {
          openai: {
            baseUrl: 'https://api.changed.example/v1',
            token: 'changed-token',
            model: 'changed-model',
          },
        },
      })
      return {
        batchTranslate: async function* (): AsyncGenerator<BatchTranslateEvent> {
          yield { index: 0, output: 'Hallo' }
        },
        destroy: vi.fn(),
      }
    })
    vi.spyOn(service as TestableTranslationEngineService, 'loadFactory').mockImplementation(
      async (_engineId, _model, settingsSnapshot) => {
        snapshotModelNames.push(settingsSnapshot?.translationEngines.openai.model ?? 'missing')
        return { create }
      }
    )

    const events = await collectBatchEvents(
      service.batchTranslate({
        engineId: 'openai',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        inputs: ['Hello'],
      })
    )

    expect(events).toEqual([{ index: 0, output: 'Hallo' }])
    expect(snapshotModelNames).toEqual(['initial-model'])
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'initial-model',
      })
    )
  })
})

function createLocalDownloadPlan(
  modelId: string,
  dtype: string,
  options: {
    configBytes?: number
    encoderBytes?: number
    decoderBytes?: number
    rootDir?: string
  } = {}
): TranslationModelDownloadPlan {
  const configBytes = options.configBytes ?? 1
  const encoderBytes = options.encoderBytes ?? 12
  const decoderBytes = options.decoderBytes ?? 18
  const estimatedTotalBytes = configBytes + encoderBytes + decoderBytes
  return {
    modelId,
    estimatedTotalBytes,
    selectedGroupId: dtype,
    files: [
      { path: 'config.json', sizeBytes: configBytes, required: true },
      { path: `onnx/encoder_model_${dtype}.onnx`, sizeBytes: encoderBytes, required: true },
      { path: `onnx/decoder_model_merged_${dtype}.onnx`, sizeBytes: decoderBytes, required: true },
    ],
    groups: [
      {
        id: dtype,
        label: dtype,
        dtype,
        estimatedTotalBytes,
        rootDir: options.rootDir,
        selectable: true,
        selected: true,
        files: [
          { path: 'config.json', sizeBytes: configBytes, required: true },
          { path: `onnx/encoder_model_${dtype}.onnx`, sizeBytes: encoderBytes, required: true },
          {
            path: `onnx/decoder_model_merged_${dtype}.onnx`,
            sizeBytes: decoderBytes,
            required: true,
          },
        ],
      },
    ],
  }
}

function createLlamaDownloadPlan(
  modelId: string,
  groupId: string,
  options: {
    modelBytes?: number
    rootDir?: string
  } = {}
): TranslationModelDownloadPlan {
  const modelBytes = options.modelBytes ?? 461_860_736
  return {
    modelId,
    estimatedTotalBytes: modelBytes,
    selectedGroupId: groupId,
    files: [{ path: groupId, sizeBytes: modelBytes, required: true }],
    groups: [
      {
        id: groupId,
        baseGroupId: groupId.replace(/\.gguf$/u, ''),
        label: groupId.replace(/\.gguf$/u, ''),
        estimatedTotalBytes: modelBytes,
        rootDir: options.rootDir,
        selectable: true,
        selected: true,
        files: [{ path: groupId, sizeBytes: modelBytes, required: true }],
      },
    ],
  }
}

async function writePersistedLocalAssetPlan(
  indexPath: string,
  plan: TranslationModelDownloadPlan,
  options: {
    status?: 'paused' | 'downloaded'
    bytesDownloaded?: number
    progress?: number
    resumable?: boolean
    rootDir?: string
  } = {}
): Promise<void> {
  const group = plan.groups?.find((item) => item.id === plan.selectedGroupId) ?? plan.groups?.[0]
  const status = options.status ?? 'not-downloaded'
  await writeFile(
    indexPath,
    JSON.stringify(
      [
        LocalModelAssetStateSchema.parse({
          modelId: plan.modelId,
          status,
          selected: true,
          progress: options.progress,
          bytesDownloaded: options.bytesDownloaded,
          totalBytes: plan.estimatedTotalBytes,
          resumable: options.resumable ?? status === 'paused',
          plan,
          groupsState: group
            ? {
                [group.id]: {
                  groupId: group.id,
                  status,
                  rootDir: options.rootDir ?? group.rootDir,
                  bytesDownloaded: options.bytesDownloaded,
                  totalBytes: plan.estimatedTotalBytes,
                  progress: options.progress,
                  resumable: options.resumable ?? status === 'paused',
                  files: group.files.map((file) => ({
                    path: file.path,
                    sizeBytes: file.sizeBytes,
                    downloadedBytes:
                      status === 'downloaded'
                        ? file.sizeBytes
                        : file.path === 'config.json'
                          ? file.sizeBytes
                          : 0,
                    required: file.required,
                    status:
                      status === 'downloaded' || file.path === 'config.json'
                        ? 'downloaded'
                        : 'not-downloaded',
                  })),
                },
              }
            : {},
          files: plan.files.map((file) => ({
            path: file.path,
            sizeBytes: file.sizeBytes,
            downloadedBytes: status === 'downloaded' ? file.sizeBytes : 0,
          })),
        }),
      ],
      null,
      2
    ),
    'utf8'
  )
}

async function writeLocalProfileFiles(
  rootDir: string,
  files: ReadonlyArray<string | { path: string; size?: number }>
): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      const relativePath = typeof file === 'string' ? file : file.path
      const size = typeof file === 'string' ? undefined : file.size
      const path = join(rootDir, relativePath)
      await mkdir(dirname(path), { recursive: true })
      if (relativePath === 'config.json') {
        await writeFile(path, '{"model_type":"marian"}')
        return
      }
      await writeFile(path, Buffer.alloc(size ?? 6, 'a'))
    })
  )
}

async function collectBatchEvents(
  stream: ReturnType<TranslationEngineService['batchTranslate']>
): Promise<BatchTranslateEvent[]> {
  return new Promise((resolve, reject) => {
    const events: BatchTranslateEvent[] = []
    const subscription = stream.subscribe({
      next(event) {
        events.push(event)
      },
      error(error) {
        reject(error)
      },
      complete() {
        resolve(events)
      },
    })
    void subscription
  })
}
