import {
  ConfigManager,
  GlobalSettingsManager,
  NmtModelAssetStateSchema,
  type TranslationEngineManifest,
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
      yield {
        path: 'config.json',
        type: 'file',
        size: 10,
      }
      yield {
        path: 'onnx/encoder_model_q4.onnx',
        type: 'file',
        size: 12_000_000,
      }
      yield {
        path: 'onnx/decoder_model_merged_q4.onnx',
        type: 'file',
        size: 18_000_000,
      }
    }),
  }
})

type TestableTranslationEngineService = TranslationEngineService & {
  resolveLocalPackage(manifest: TranslationEngineManifest): Promise<string | null>
  loadFactory(engineId: 'nmt' | 'ai', model: string | undefined): Promise<TranslatorFactory>
  getModelDownloadPlan(input: {
    engineId: 'nmt'
    model: string
    selectedGroupId?: string
  }): Promise<{
    modelId: string
    estimatedTotalBytes?: number
    files: Array<{ path: string; sizeBytes?: number; required: boolean }>
    selectedGroupId?: string
    groups?: Array<{
      id: string
      label: string
      dtype?: string
      estimatedTotalBytes?: number
      selectable: boolean
      selected: boolean
      files: Array<{ path: string; sizeBytes?: number; required: boolean }>
    }>
  } | null>
  loadNmtTransformersModuleForPlan(
    projectDir: string,
    globalSettingsManager: GlobalSettingsManager
  ): Promise<{
    env: {
      cacheDir: string | null
      allowLocalModels: boolean
      localModelPath: string
    }
    ModelRegistry: {
      get_pipeline_files(
        task: string,
        modelId: string,
        options?: { cache_dir?: string }
      ): Promise<string[]>
      is_pipeline_cached_files(
        task: string,
        modelId: string,
        options?: { cache_dir?: string }
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
  let nmtCacheDir: string
  let nmtAssetIndexPath: string
  let nmtFetchCachePath: string
  let service: TranslationEngineService

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openspecui-translation-engine-'))
    projectDir = tempDir
    settingsPath = join(tempDir, '.openspecui', 'settings.json')
    nmtCacheDir = join(tempDir, 'nmt-cache')
    nmtAssetIndexPath = join(tempDir, 'nmt-models.json')
    nmtFetchCachePath = join(tempDir, 'nmt-fetch-cache.json')
    service = new TranslationEngineService({
      projectDir,
      configManager: new ConfigManager(projectDir),
      globalSettingsManager: new GlobalSettingsManager(settingsPath),
      now: () => 100,
      nmtCacheDir,
      nmtAssetIndexPath,
      nmtFetchCachePath,
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns ranked NMT model candidates from the server-side catalog', async () => {
    await new GlobalSettingsManager(settingsPath).writeSettings({
      translationEngines: {
        nmt: {
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
      engineId: 'nmt',
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

  it('uses strict repository profile files for NMT download plans', async () => {
    const testableService = service as TestableTranslationEngineService
    vi.spyOn(testableService, 'loadNmtTransformersModuleForPlan').mockResolvedValue({
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
        get_file_metadata: vi.fn(async (modelId, filename) => ({
          exists: true,
          size: filename.endsWith('runtime-a.onnx') ? 12_000_000 : 18_000_000,
          fromCache: false,
        })),
      },
    })

    const plan = await service.getModelDownloadPlan({
      engineId: 'nmt',
      model: 'Xenova/opus-mt-en-de',
    })

    expect(plan?.files.map((file) => file.path)).toEqual([
      'config.json',
      'onnx/encoder_model_q4.onnx',
      'onnx/decoder_model_merged_q4.onnx',
    ])
    expect(plan?.estimatedTotalBytes).toBe(30_000_010)
  })

  it('keeps selected NMT profile sizes from the local asset snapshot when provider sizes are missing', async () => {
    const testableService = service as TestableTranslationEngineService
    await writeFile(
      nmtAssetIndexPath,
      JSON.stringify(
        [
          NmtModelAssetStateSchema.parse({
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
    vi.spyOn(testableService, 'loadNmtTransformersModuleForPlan').mockResolvedValue({
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
      engineId: 'nmt',
      model: 'Xenova/opus-mt-en-de',
      selectedGroupId: 'q4f16',
    })

    const group = plan?.groups?.find((item) => item.id === 'q4f16')
    expect(group?.selectable).toBe(true)
    expect(group?.estimatedTotalBytes).toBe(159_000_000)
    expect(plan?.estimatedTotalBytes).toBe(159_000_000)
    expect(group?.files.map((file) => file.sizeBytes)).toEqual([1_500, 74_300_000, 84_698_500])
  })

  it('passes the selected NMT download group dtype into translation runtime', async () => {
    const testableService = service as TestableTranslationEngineService
    const create = vi.fn(async () => ({
      translate: vi.fn(async () => 'Hallo'),
      destroy: vi.fn(),
    }))
    vi.spyOn(testableService, 'loadFactory').mockResolvedValue({ create })
    vi.spyOn(testableService, 'getModelDownloadPlan').mockResolvedValue({
      modelId: 'Xenova/opus-mt-en-de',
      estimatedTotalBytes: 30,
      selectedGroupId: 'q4',
      files: [
        { path: 'config.json', sizeBytes: 1, required: true },
        { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 12, required: true },
        { path: 'onnx/decoder_model_merged_q4.onnx', sizeBytes: 18, required: true },
      ],
      groups: [
        {
          id: 'q4',
          label: 'q4 (4-bit)',
          dtype: 'q4',
          estimatedTotalBytes: 31,
          selectable: true,
          selected: true,
          files: [
            { path: 'config.json', sizeBytes: 1, required: true },
            { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 12, required: true },
            { path: 'onnx/decoder_model_merged_q4.onnx', sizeBytes: 18, required: true },
          ],
        },
      ],
    })
    await writeNmtCachedFiles(nmtCacheDir, 'Xenova/opus-mt-en-de', [
      'config.json',
      'onnx/encoder_model_q4.onnx',
      'onnx/decoder_model_merged_q4.onnx',
    ])

    await service.translate({
      engineId: 'nmt',
      sourceLanguage: 'en',
      targetLanguage: 'de',
      model: 'Xenova/opus-mt-en-de',
      selectedGroupId: 'q4',
      text: 'Hello',
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'Xenova/opus-mt-en-de',
        dtype: 'q4',
        runtimeConfig: { model_type: 'marian' },
      })
    )
  })

  it('fails NMT translation before Transformers can probe remote metadata when files are missing', async () => {
    const testableService = service as TestableTranslationEngineService
    const create = vi.fn(async () => ({
      translate: vi.fn(async () => 'Hallo'),
      destroy: vi.fn(),
    }))
    vi.spyOn(testableService, 'loadFactory').mockResolvedValue({ create })
    vi.spyOn(testableService, 'getModelDownloadPlan').mockResolvedValue({
      modelId: 'Xenova/opus-mt-en-de',
      estimatedTotalBytes: 30,
      selectedGroupId: 'q4',
      files: [
        { path: 'config.json', sizeBytes: 1, required: true },
        { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 12, required: true },
        { path: 'onnx/decoder_model_merged_q4.onnx', sizeBytes: 18, required: true },
      ],
      groups: [
        {
          id: 'q4',
          label: 'q4 (4-bit)',
          dtype: 'q4',
          estimatedTotalBytes: 31,
          selectable: true,
          selected: true,
          files: [
            { path: 'config.json', sizeBytes: 1, required: true },
            { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 12, required: true },
            { path: 'onnx/decoder_model_merged_q4.onnx', sizeBytes: 18, required: true },
          ],
        },
      ],
    })
    await writeNmtCachedFiles(nmtCacheDir, 'Xenova/opus-mt-en-de', [
      'config.json',
      'onnx/encoder_model_q4.onnx',
    ])

    await expect(
      service.translate({
        engineId: 'nmt',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        model: 'Xenova/opus-mt-en-de',
        selectedGroupId: 'q4',
        text: 'Hello',
      })
    ).rejects.toThrow(
      'Selected NMT model files are not installed locally: onnx/decoder_model_merged_q4.onnx.'
    )
    expect(create).not.toHaveBeenCalled()
  })

  it('marks a local NMT package installed immediately in local workspace mode', async () => {
    const testableService = service as TestableTranslationEngineService

    vi.spyOn(testableService, 'resolveLocalPackage').mockResolvedValue(
      join(projectDir, 'packages', 'nmt-translator', 'src', 'index.ts')
    )
    vi.spyOn(testableService, 'loadFactory').mockResolvedValue({
      create: vi.fn(),
    })

    const result = await service.installEngine('nmt')

    const settings = await new GlobalSettingsManager(settingsPath).readSettings()
    expect(result.sessionId).toBeTruthy()
    expect(settings.translationEngines.extensions.engines.nmt.status).toBe('installed')
    expect(settings.translationEngines.extensions.engines.nmt.message).toContain(
      'NMT translator package is ready.'
    )
  })

  it('marks the NMT package installed without forcing a model prepare step', async () => {
    const logs: string[] = []
    const testableService = service as TestableTranslationEngineService

    vi.spyOn(testableService, 'resolveLocalPackage').mockResolvedValue(
      join(projectDir, 'packages', 'nmt-translator', 'src', 'index.ts')
    )
    vi.spyOn(testableService, 'loadFactory').mockResolvedValue({
      create: vi.fn(),
    })

    const subscription = service.subscribeLogs().subscribe({
      next(log) {
        logs.push(`${log.message}|${log.progress ?? 'none'}`)
      },
    })

    try {
      await service.installEngine('nmt')
    } finally {
      subscription.unsubscribe()
    }

    expect(logs.at(-1)).toContain('NMT translator package is ready.')
  })
})

async function writeNmtCachedFiles(
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
