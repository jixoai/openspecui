import {
  ConfigManager,
  GlobalSettingsManager,
  LocalModelAssetStateSchema,
  type BatchTranslateEvent,
  type ServiceTranslationEngineId,
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
        runtimeConfig: { model_type: 'marian' },
      })
    )
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
  files: ReadonlyArray<string>
): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      const path = join(rootDir, file)
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
