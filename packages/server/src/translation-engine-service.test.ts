import {
  ConfigManager,
  GlobalSettingsManager,
  LocalModelAssetStateSchema,
  type BatchTranslateEvent,
  type TranslationModelDownloadPlan,
  type TranslatorFactory,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TranslationEngineService } from './translation-engine-service.js'

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

type TestableTranslationEngineService = TranslationEngineService & {
  loadFactory(
    engineId: 'local' | 'openai',
    model: string | undefined
  ): Promise<TranslatorFactory>
  loadLocalTransformersModuleForPlan(
    projectDir: string,
    globalSettingsManager: GlobalSettingsManager
  ): Promise<{
    env: {
      cacheDir: string | null
      allowLocalModels: boolean
      localModelPath: string
      remoteHost?: string
    }
    ModelRegistry: {
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
    }
  }>
}

describe('TranslationEngineService', () => {
  let tempDir: string
  let projectDir: string
  let settingsPath: string
  let localCacheDir: string
  let localAssetIndexPath: string
  let localFetchCachePath: string
  let service: TranslationEngineService

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openspecui-translation-engine-'))
    projectDir = tempDir
    settingsPath = join(tempDir, '.openspecui', 'settings.json')
    localCacheDir = join(tempDir, 'local-cache')
    localAssetIndexPath = join(tempDir, 'local-models.json')
    localFetchCachePath = join(tempDir, 'local-fetch-cache.json')
    service = new TranslationEngineService({
      projectDir,
      configManager: new ConfigManager(projectDir),
      globalSettingsManager: new GlobalSettingsManager(settingsPath),
      now: () => 100,
      localCacheDir: localCacheDir,
      localAssetIndexPath: localAssetIndexPath,
      localFetchCachePath: localFetchCachePath,
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

  it('uses strict repository profile files for local download plans', async () => {
    const testableService = service as TestableTranslationEngineService
    vi.spyOn(testableService, 'loadLocalTransformersModuleForPlan').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
        remoteHost: 'https://huggingface.co/',
      },
      ModelRegistry: {
        get_pipeline_files: vi.fn(async () => [
          'onnx/encoder_model_q4.onnx',
          'onnx/decoder_model_merged_q4.onnx',
        ]),
        is_pipeline_cached_files: vi.fn(async () => ({
          allCached: false,
          files: [
            { file: 'onnx/encoder_model_q4.onnx', cached: false },
            { file: 'onnx/decoder_model_merged_q4.onnx', cached: false },
          ],
        })),
        get_file_metadata: vi.fn(async (_modelId, filename) => ({
          exists: true,
          size: filename.endsWith('encoder_model_q4.onnx') ? 12_000_000 : 18_000_000,
          fromCache: false,
        })),
      },
    })

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

  it('keeps selected local profile sizes from the asset snapshot when provider sizes are missing', async () => {
    const testableService = service as TestableTranslationEngineService
    await writeFile(
      localAssetIndexPath,
      JSON.stringify(
        [
          LocalModelAssetStateSchema.parse({
            modelId: 'Xenova/opus-mt-en-de',
            status: 'paused',
            selected: true,
            progress: 0.42,
            totalBytes: 159_000_000,
            bytesDownloaded: 66_780_000,
            resumable: true,
            plan: {
              modelId: 'Xenova/opus-mt-en-de',
              selectedGroupId: 'q4f16',
              estimatedTotalBytes: 159_000_000,
              files: [
                { path: 'config.json', sizeBytes: 1_500, required: true },
                {
                  path: 'onnx/encoder_model_q4f16.onnx',
                  sizeBytes: 74_300_000,
                  required: true,
                },
                {
                  path: 'onnx/decoder_model_merged_q4f16.onnx',
                  sizeBytes: 84_698_500,
                  required: true,
                },
              ],
              groups: [
                {
                  id: 'q4f16',
                  label: 'q4f16',
                  dtype: 'q4f16',
                  estimatedTotalBytes: 159_000_000,
                  selectable: true,
                  selected: true,
                  files: [
                    { path: 'config.json', sizeBytes: 1_500, required: true },
                    {
                      path: 'onnx/encoder_model_q4f16.onnx',
                      sizeBytes: 74_300_000,
                      required: true,
                    },
                    {
                      path: 'onnx/decoder_model_merged_q4f16.onnx',
                      sizeBytes: 84_698_500,
                      required: true,
                    },
                  ],
                },
              ],
            },
            files: [
              { path: 'config.json', sizeBytes: 1_500, downloadedBytes: 1_500 },
              {
                path: 'onnx/encoder_model_q4f16.onnx',
                sizeBytes: 74_300_000,
                downloadedBytes: 0,
              },
              {
                path: 'onnx/decoder_model_merged_q4f16.onnx',
                sizeBytes: 84_698_500,
                downloadedBytes: 66_778_500,
              },
            ],
          }),
        ],
        null,
        2
      ),
      'utf8'
    )
    vi.spyOn(testableService, 'loadLocalTransformersModuleForPlan').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
        remoteHost: 'https://huggingface.co/',
      },
      ModelRegistry: {
        get_pipeline_files: vi.fn(),
        is_pipeline_cached_files: vi.fn(),
        get_file_metadata: vi.fn(),
      },
    })
    vi.mocked(await import('@huggingface/hub')).listFiles.mockImplementationOnce(
      async function* () {
        yield { path: 'config.json', type: 'file' }
        yield { path: 'onnx/encoder_model_q4f16.onnx', type: 'file' }
        yield { path: 'onnx/decoder_model_merged_q4f16.onnx', type: 'file' }
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
    const testableService = service as TestableTranslationEngineService
    await writeFile(
      localAssetIndexPath,
      JSON.stringify(
        [
          LocalModelAssetStateSchema.parse({
            modelId: 'Xenova/opus-mt-en-de',
            status: 'downloaded',
            selected: true,
            progress: 1,
            totalBytes: 91_000_001,
            bytesDownloaded: 91_000_001,
            resumable: false,
            plan: {
              modelId: 'Xenova/opus-mt-en-de',
              selectedGroupId: 'q4',
              estimatedTotalBytes: 91_000_001,
              files: [
                { path: 'config.json', sizeBytes: 1, required: true },
                { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 35_000_000, required: true },
                {
                  path: 'onnx/decoder_model_merged_q4.onnx',
                  sizeBytes: 56_000_000,
                  required: true,
                },
              ],
              groups: [
                {
                  id: 'q4',
                  label: 'q4',
                  dtype: 'q4',
                  estimatedTotalBytes: 91_000_001,
                  selectable: true,
                  selected: true,
                  files: [
                    { path: 'config.json', sizeBytes: 1, required: true },
                    { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 35_000_000, required: true },
                    {
                      path: 'onnx/decoder_model_merged_q4.onnx',
                      sizeBytes: 56_000_000,
                      required: true,
                    },
                  ],
                },
              ],
            },
            files: [
              { path: 'config.json', sizeBytes: 1, downloadedBytes: 1 },
              { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 35_000_000, downloadedBytes: 35_000_000 },
              {
                path: 'onnx/decoder_model_merged_q4.onnx',
                sizeBytes: 56_000_000,
                downloadedBytes: 56_000_000,
              },
            ],
          }),
        ],
        null,
        2
      ),
      'utf8'
    )
    vi.spyOn(testableService, 'loadLocalTransformersModuleForPlan').mockRejectedValue(
      new TypeError('fetch failed')
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
    vi.spyOn(testableService, 'getModelDownloadPlan').mockResolvedValue(
      createLocalDownloadPlan('Xenova/opus-mt-en-de', 'q4')
    )
    await writeLocalCachedFiles(localCacheDir, 'Xenova/opus-mt-en-de', [
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
        runtimeConfig: { model_type: 'marian' },
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
    vi.spyOn(testableService, 'getModelDownloadPlan').mockResolvedValue(
      createLocalDownloadPlan('Xenova/opus-mt-en-de', 'q4')
    )
    await writeLocalCachedFiles(localCacheDir, 'Xenova/opus-mt-en-de', [
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
      'Selected local model files are not installed locally: onnx/decoder_model_merged_q4.onnx.'
    )
    expect(create).not.toHaveBeenCalled()
  })
})

function createLocalDownloadPlan(
  modelId: string,
  dtype: string
): TranslationModelDownloadPlan {
  return {
    modelId,
    estimatedTotalBytes: 31,
    selectedGroupId: dtype,
    files: [
      { path: 'config.json', sizeBytes: 1, required: true },
      { path: `onnx/encoder_model_${dtype}.onnx`, sizeBytes: 12, required: true },
      { path: `onnx/decoder_model_merged_${dtype}.onnx`, sizeBytes: 18, required: true },
    ],
    groups: [
      {
        id: dtype,
        label: dtype,
        dtype,
        estimatedTotalBytes: 31,
        selectable: true,
        selected: true,
        files: [
          { path: 'config.json', sizeBytes: 1, required: true },
          { path: `onnx/encoder_model_${dtype}.onnx`, sizeBytes: 12, required: true },
          { path: `onnx/decoder_model_merged_${dtype}.onnx`, sizeBytes: 18, required: true },
        ],
      },
    ],
  }
}

async function writeLocalCachedFiles(
  cacheDir: string,
  modelId: string,
  files: ReadonlyArray<string>
): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      const path = join(cacheDir, 'models', modelId, file)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, file === 'config.json' ? '{"model_type":"marian"}' : 'cached')
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
