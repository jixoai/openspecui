import type { ConfigManager } from '@openspecui/core'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalModelAssetService } from './local-model-asset-service.js'
import { LocalModelAssetStore } from './local-model-asset-store.js'
import {
  getTransformersFileCacheModelPath,
  getTransformersLocalModelPath,
} from './local-model-local-cache.js'

const hubMock = vi.hoisted(() => ({
  downloadFile: vi.fn(),
  fileDownloadInfo: vi.fn(async (input: { path: string }) => ({
    size: input.path.includes('_q4') || input.path === 'config.json' ? 10 : 100,
    etag: `${input.path.replace(/[^a-zA-Z0-9]+/g, '-')}-etag`,
    url: `https://huggingface.co/test/resolve/main/${input.path}`,
  })),
  listFiles: vi.fn(async function* (input?: { fetch?: typeof fetch; hubUrl?: string }) {
    await input?.fetch?.(
      `${input.hubUrl ?? 'https://huggingface.co'}/api/models/onnx-community/opus-mt-en-zh/tree/main?recursive=true&expand=true`
    )
    yield { path: 'config.json', type: 'file', size: 10 }
    yield { path: 'onnx/encoder_model_q4.onnx', type: 'file', size: 10 }
    yield { path: 'onnx/decoder_model_merged_q4.onnx', type: 'file', size: 10 }
  }),
}))

vi.mock('@huggingface/hub', () => hubMock)

type TestableLocalModelAssetService = LocalModelAssetService & {
  getTransformersModule(): Promise<{
    env: {
      cacheDir: string | null
      allowLocalModels: boolean
      localModelPath: string
      remoteHost?: string
    }
    ModelRegistry: {
      get_pipeline_files: Mock
      is_pipeline_cached_files: Mock
      get_file_metadata: Mock
      clear_cache: Mock
    }
  }>
}

describe('LocalModelAssetService', () => {
  let tempDir: string
  let indexPath: string
  let cacheDir: string
  let fetchCachePath: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openspecui-nmt-assets-'))
    indexPath = join(tempDir, 'models.json')
    cacheDir = join(tempDir, 'cache')
    fetchCachePath = join(tempDir, 'fetch-cache.json')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (url.includes('/api/models/') && url.includes('/tree/')) {
          return Response.json([
            { path: 'config.json', type: 'file', size: 10 },
            { path: 'onnx/encoder_model_q4.onnx', type: 'file', size: 10 },
            { path: 'onnx/decoder_model_merged_q4.onnx', type: 'file', size: 10 },
          ])
        }
        return new Response(null, { status: 200 })
      })
    )
    hubMock.downloadFile.mockReset()
    hubMock.fileDownloadInfo.mockClear()
    hubMock.listFiles.mockClear()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(tempDir, { recursive: true, force: true })
  })

  it('downloads only selected NMT group files through the official Hugging Face hub primitives', async () => {
    hubMock.downloadFile.mockImplementation(async (input: { path: string }) =>
      createMockDownloadBlob(
        input.path === 'config.json' ? [new Uint8Array(10)] : [new Uint8Array(10)]
      )
    )

    const service = new LocalModelAssetService({
      projectDir: tempDir,
      configManager: {} as ConfigManager,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q4',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      cacheDir,
      fetchCachePath,
    }) as TestableLocalModelAssetService
    vi.spyOn(service, 'getTransformersModule').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
      },
      ModelRegistry: {
        get_pipeline_files: vi.fn(async (_task, _modelId, options?: { dtype?: string }) =>
          options?.dtype === 'q4'
            ? ['onnx/encoder_model_q4.onnx', 'onnx/decoder_model_merged_q4.onnx']
            : ['onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx']
        ),
        is_pipeline_cached_files: vi.fn(async () => ({
          allCached: false,
          files: [
            { file: 'onnx/encoder_model_q4.onnx', cached: false },
            { file: 'onnx/decoder_model_merged_q4.onnx', cached: false },
          ],
        })),
        get_file_metadata: vi.fn(async (_modelId, filePath: string) => ({
          exists: true,
          size: filePath.includes('_q4') ? 10 : 100,
          fromCache: false,
        })),
        clear_cache: vi.fn(),
      },
    })

    await service.startDownload('onnx-community/opus-mt-en-zh', 'q4')
    await waitForDownloadedState(indexPath)

    expect(hubMock.downloadFile).toHaveBeenCalledTimes(3)
    expect(hubMock.downloadFile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        repo: { type: 'model', name: 'onnx-community/opus-mt-en-zh' },
        path: 'config.json',
        hubUrl: 'https://hf-mirror.com',
        xet: false,
      })
    )
    expect(hubMock.downloadFile).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: 'onnx/encoder_model_q4.onnx',
        xet: false,
      })
    )
    expect(hubMock.downloadFile).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        path: 'onnx/decoder_model_merged_q4.onnx',
        xet: false,
      })
    )
    const state = (await new LocalModelAssetStore({ indexPath }).readAll())[0]
    expect(state).toMatchObject({
      status: 'downloaded',
      progress: 1,
      totalBytes: 30,
      bytesDownloaded: 30,
    })
    const fetchCache = JSON.parse(await readFile(fetchCachePath, 'utf8')) as {
      fetches?: Array<{ request?: { url?: string }; response?: { bodyText?: string } }>
    }
    expect(fetchCache.fetches?.some((fetch) => fetch.request?.url?.includes('/tree/main'))).toBe(
      true
    )
    expect(
      fetchCache.fetches?.some((fetch) => fetch.response?.bodyText?.includes('config.json'))
    ).toBe(true)
  })

  it('persists byte-level progress while streaming a selected NMT file', async () => {
    hubMock.downloadFile.mockImplementation(async (input: { path: string }) =>
      createMockDownloadBlob(
        input.path === 'onnx/encoder_model_q4.onnx'
          ? [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8, 9, 10])]
          : [new Uint8Array(10)]
      )
    )

    const service = new LocalModelAssetService({
      projectDir: tempDir,
      configManager: {} as ConfigManager,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q4',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      cacheDir,
      fetchCachePath,
    }) as TestableLocalModelAssetService
    vi.spyOn(service, 'getTransformersModule').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
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
        get_file_metadata: vi.fn(),
        clear_cache: vi.fn(),
      },
    })

    await service.startDownload('onnx-community/opus-mt-en-zh', 'q4')

    await waitForState(indexPath, (states) =>
      states.some((entry) =>
        entry.files?.some(
          (file) =>
            file.path === 'onnx/encoder_model_q4.onnx' &&
            typeof file.downloadedBytes === 'number' &&
            file.downloadedBytes > 0 &&
            file.downloadedBytes < 10
        )
      )
    )
    await waitForDownloadedState(indexPath)
  })

  it('persists byte-level progress while streaming an Xet-backed file download', async () => {
    hubMock.downloadFile.mockImplementation(async (input: { path: string }) =>
      createMockDownloadBlob(
        input.path === 'onnx/encoder_model_q4.onnx'
          ? [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8, 9, 10])]
          : [new Uint8Array(10)]
      )
    )

    const service = new LocalModelAssetService({
      projectDir: tempDir,
      configManager: {} as ConfigManager,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q4',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      cacheDir,
      fetchCachePath,
    }) as TestableLocalModelAssetService
    vi.spyOn(service, 'getTransformersModule').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
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
        get_file_metadata: vi.fn(),
        clear_cache: vi.fn(),
      },
    })

    await service.startDownload('onnx-community/opus-mt-en-zh', 'q4')

    await waitForState(indexPath, (states) =>
      states.some((entry) =>
        entry.files?.some(
          (file) =>
            file.path === 'onnx/encoder_model_q4.onnx' &&
            typeof file.downloadedBytes === 'number' &&
            file.downloadedBytes > 0 &&
            file.downloadedBytes < 10
        )
      )
    )
    await waitForDownloadedState(indexPath)
  })

  it('retries retryable Hugging Face download failures before marking the model as failed', async () => {
    let encoderAttempts = 0
    hubMock.downloadFile.mockImplementation(async (input: { path: string }) => {
      if (input.path === 'onnx/encoder_model_q4.onnx') {
        encoderAttempts += 1
        if (encoderAttempts === 1) {
          throw new TypeError('fetch failed')
        }
      }
      return createMockDownloadBlob([new Uint8Array(10)])
    })

    const service = new LocalModelAssetService({
      projectDir: tempDir,
      configManager: {} as ConfigManager,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q4',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      cacheDir,
      fetchCachePath,
    }) as TestableLocalModelAssetService
    vi.spyOn(service, 'getTransformersModule').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
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
        get_file_metadata: vi.fn(),
        clear_cache: vi.fn(),
      },
    })

    await service.startDownload('onnx-community/opus-mt-en-zh', 'q4')
    await waitForDownloadedState(indexPath)

    expect(encoderAttempts).toBe(2)
    const state = (await new LocalModelAssetStore({ indexPath }).readAll())[0]
    expect(state?.status).toBe('downloaded')
    expect(state?.error).toBeUndefined()
  })

  it('only falls back to error when automatic network retry is explicitly disabled', async () => {
    hubMock.downloadFile.mockImplementation(async () => {
      throw new TypeError('fetch failed')
    })

    const service = new LocalModelAssetService({
      projectDir: tempDir,
      configManager: {} as ConfigManager,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q4',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      cacheDir,
      fetchCachePath,
      networkRetryPolicy: {
        limit: 0,
      },
    }) as TestableLocalModelAssetService
    vi.spyOn(service, 'getTransformersModule').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
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
        get_file_metadata: vi.fn(),
        clear_cache: vi.fn(),
      },
    })

    await service.startDownload('onnx-community/opus-mt-en-zh', 'q4')
    await waitForState(indexPath, (states) => states.some((entry) => entry.status === 'error'))

    const state = (await new LocalModelAssetStore({ indexPath }).readAll())[0]
    expect(state?.status).toBe('error')
    expect(state?.resumable).toBe(true)
    expect(state?.error).toContain('fetch failed')
  })

  it('retries retryable Hugging Face file metadata failures before starting the streamed download', async () => {
    let metadataAttempts = 0
    hubMock.fileDownloadInfo.mockImplementation(async (input: { path: string }) => {
      if (input.path === 'onnx/encoder_model_q4.onnx') {
        metadataAttempts += 1
        if (metadataAttempts === 1) {
          throw new TypeError('fetch failed')
        }
      }
      return {
        size: input.path.includes('_q4') || input.path === 'config.json' ? 10 : 100,
        etag: `${input.path.replace(/[^a-zA-Z0-9]+/g, '-')}-etag`,
        url: `https://huggingface.co/test/resolve/main/${input.path}`,
      }
    })
    hubMock.downloadFile.mockImplementation(async () =>
      createMockDownloadBlob([new Uint8Array(10)])
    )

    const service = new LocalModelAssetService({
      projectDir: tempDir,
      configManager: {} as ConfigManager,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q4',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      cacheDir,
      fetchCachePath,
    }) as TestableLocalModelAssetService
    vi.spyOn(service, 'getTransformersModule').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
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
        get_file_metadata: vi.fn(),
        clear_cache: vi.fn(),
      },
    })

    await service.startDownload('onnx-community/opus-mt-en-zh', 'q4')
    await waitForDownloadedState(indexPath)

    expect(metadataAttempts).toBe(2)
    const state = (await new LocalModelAssetStore({ indexPath }).readAll())[0]
    expect(state).toMatchObject({
      status: 'downloaded',
      progress: 1,
      bytesDownloaded: 30,
      totalBytes: 30,
    })
    expect(state?.error).toBeUndefined()
  })

  it('retries retryable Hugging Face file metadata status failures before starting the streamed download', async () => {
    let metadataAttempts = 0
    hubMock.fileDownloadInfo.mockImplementation(async (input: { path: string }) => {
      if (input.path === 'onnx/encoder_model_q4.onnx') {
        metadataAttempts += 1
        if (metadataAttempts === 1) {
          throw Object.assign(new Error('Api error with status 503.'), {
            statusCode: 503,
          })
        }
      }
      return {
        size: input.path.includes('_q4') || input.path === 'config.json' ? 10 : 100,
        etag: `${input.path.replace(/[^a-zA-Z0-9]+/g, '-')}-etag`,
        url: `https://huggingface.co/test/resolve/main/${input.path}`,
      }
    })
    hubMock.downloadFile.mockImplementation(async () =>
      createMockDownloadBlob([new Uint8Array(10)])
    )

    const service = new LocalModelAssetService({
      projectDir: tempDir,
      configManager: {} as ConfigManager,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q4',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      cacheDir,
      fetchCachePath,
    }) as TestableLocalModelAssetService
    vi.spyOn(service, 'getTransformersModule').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
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
        get_file_metadata: vi.fn(),
        clear_cache: vi.fn(),
      },
    })

    await service.startDownload('onnx-community/opus-mt-en-zh', 'q4')
    await waitForDownloadedState(indexPath)

    expect(metadataAttempts).toBe(2)
    const state = (await new LocalModelAssetStore({ indexPath }).readAll())[0]
    expect(state).toMatchObject({
      status: 'downloaded',
      progress: 1,
      bytesDownloaded: 30,
      totalBytes: 30,
    })
    expect(state?.error).toBeUndefined()
  })

  it('auto-resumes from partially written files after a retryable stream failure', async () => {
    let encoderAttempts = 0
    hubMock.downloadFile.mockImplementation(async (input: { path: string }) => {
      if (input.path === 'onnx/encoder_model_q4.onnx') {
        encoderAttempts += 1
        if (encoderAttempts === 1) {
          return createMockDownloadBlobWithFailure({
            chunks: [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8, 9, 10])],
            failAfterChunkCount: 1,
            error: new TypeError('fetch failed'),
          })
        }
      }
      return createMockDownloadBlob([new Uint8Array(10)])
    })

    const service = new LocalModelAssetService({
      projectDir: tempDir,
      configManager: {} as ConfigManager,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q4',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      cacheDir,
      fetchCachePath,
    }) as TestableLocalModelAssetService
    vi.spyOn(service, 'getTransformersModule').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
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
        get_file_metadata: vi.fn(),
        clear_cache: vi.fn(),
      },
    })

    await service.startDownload('onnx-community/opus-mt-en-zh', 'q4')
    await waitForState(indexPath, (states) =>
      states.some((entry) =>
        entry.files?.some(
          (file) => file.path === 'onnx/encoder_model_q4.onnx' && file.downloadedBytes === 4
        )
      )
    )
    await waitForDownloadedState(indexPath)

    expect(encoderAttempts).toBe(2)
    const state = (await new LocalModelAssetStore({ indexPath }).readAll())[0]
    expect(state).toMatchObject({
      status: 'downloaded',
      progress: 1,
      bytesDownloaded: 30,
      totalBytes: 30,
    })
    expect(state?.error).toBeUndefined()
  })

  it('resumes from cached files instead of resetting completed files back to zero', async () => {
    hubMock.downloadFile.mockImplementation(async () =>
      createMockDownloadBlob([new Uint8Array(10)])
    )

    const service = new LocalModelAssetService({
      projectDir: tempDir,
      configManager: {} as ConfigManager,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q4',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      cacheDir,
      fetchCachePath,
    }) as TestableLocalModelAssetService
    vi.spyOn(service, 'getTransformersModule').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
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
        get_file_metadata: vi.fn(),
        clear_cache: vi.fn(),
      },
    })

    await writeLocalModelCacheFile({
      cacheDir,
      modelId: 'onnx-community/opus-mt-en-zh',
      path: 'config.json',
      content: 'config',
    })
    await new LocalModelAssetStore({ indexPath }).writeAll([
      {
        modelId: 'onnx-community/opus-mt-en-zh',
        status: 'paused',
        selected: true,
        progress: 1 / 3,
        bytesDownloaded: 10,
        totalBytes: 30,
        resumable: true,
        plan: {
          modelId: 'onnx-community/opus-mt-en-zh',
          estimatedTotalBytes: 30,
          selectedGroupId: 'q4',
          files: [
            { path: 'config.json', sizeBytes: 10, required: true },
            { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 10, required: true },
            { path: 'onnx/decoder_model_merged_q4.onnx', sizeBytes: 10, required: true },
          ],
        },
        files: [
          { path: 'config.json', sizeBytes: 10, downloadedBytes: 10 },
          { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 10, downloadedBytes: 0 },
          { path: 'onnx/decoder_model_merged_q4.onnx', sizeBytes: 10, downloadedBytes: 0 },
        ],
        updatedAt: 90,
      },
    ])

    await service.resumeDownload('onnx-community/opus-mt-en-zh', 'q4')
    await waitForDownloadedState(indexPath)

    expect(hubMock.downloadFile).toHaveBeenCalledTimes(2)
    expect(hubMock.downloadFile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: 'onnx/encoder_model_q4.onnx' })
    )
    expect(hubMock.downloadFile).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: 'onnx/decoder_model_merged_q4.onnx' })
    )

    const state = (await new LocalModelAssetStore({ indexPath }).readAll())[0]
    expect(state).toMatchObject({
      status: 'downloaded',
      progress: 1,
      bytesDownloaded: 30,
      totalBytes: 30,
    })
    expect(state?.files).toEqual([
      { path: 'config.json', sizeBytes: 10, downloadedBytes: 10 },
      { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 10, downloadedBytes: 10 },
      { path: 'onnx/decoder_model_merged_q4.onnx', sizeBytes: 10, downloadedBytes: 10 },
    ])
  })

  it('derives cross-group cached progress from file bytes instead of cached file count', async () => {
    const modelId = 'onnx-community/opus-mt-en-zh'
    const auxiliaryFiles = [
      ['config.json', 1520],
      ['generation_config.json', 288],
      ['source.spm', 806435],
      ['special_tokens_map.json', 74],
      ['target.spm', 804600],
      ['tokenizer_config.json', 849],
      ['tokenizer.json', 6380952],
      ['vocab.json', 1747795],
    ] as const
    const q4Files = [
      ...auxiliaryFiles,
      ['onnx/encoder_model_q4.onnx', 146255322],
      ['onnx/decoder_model_merged_q4.onnx', 151040867],
    ] as const
    const q4f16Files = [
      ...auxiliaryFiles,
      ['onnx/encoder_model_q4f16.onnx', 77910507],
      ['onnx/decoder_model_merged_q4f16.onnx', 161874559],
    ] as const
    const auxiliaryBytes = auxiliaryFiles.reduce((total, [, sizeBytes]) => total + sizeBytes, 0)
    const q4TotalBytes = q4Files.reduce((total, [, sizeBytes]) => total + sizeBytes, 0)
    const q4f16TotalBytes = q4f16Files.reduce((total, [, sizeBytes]) => total + sizeBytes, 0)

    hubMock.listFiles.mockImplementation(async function* (input?: {
      fetch?: typeof fetch
      hubUrl?: string
    }) {
      await input?.fetch?.(
        `${input.hubUrl ?? 'https://huggingface.co'}/api/models/${modelId}/tree/main?recursive=true&expand=true`
      )
      for (const [path, size] of q4Files) {
        yield { path, type: 'file', size }
      }
      yield { path: 'onnx/encoder_model_q4f16.onnx', type: 'file', size: 77910507 }
      yield { path: 'onnx/decoder_model_merged_q4f16.onnx', type: 'file', size: 161874559 }
    })

    const service = new LocalModelAssetService({
      projectDir: tempDir,
      configManager: {} as ConfigManager,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            local: {
              model: modelId,
              selectedGroupId: 'q4',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      cacheDir,
      fetchCachePath,
    }) as TestableLocalModelAssetService
    vi.spyOn(service, 'getTransformersModule').mockResolvedValue({
      env: {
        cacheDir: null,
        allowLocalModels: false,
        localModelPath: '',
      },
      ModelRegistry: {
        get_pipeline_files: vi.fn(async () => [
          'onnx/encoder_model_q4.onnx',
          'onnx/decoder_model_merged_q4.onnx',
        ]),
        is_pipeline_cached_files: vi.fn(async () => ({
          allCached: false,
          files: [
            { file: 'onnx/encoder_model_q4.onnx', cached: true },
            { file: 'onnx/decoder_model_merged_q4.onnx', cached: true },
          ],
        })),
        get_file_metadata: vi.fn(),
        clear_cache: vi.fn(),
      },
    })

    await new LocalModelAssetStore({ indexPath }).writeAll([
      {
        modelId,
        status: 'downloaded',
        selected: true,
        progress: 1,
        bytesDownloaded: q4TotalBytes,
        totalBytes: q4TotalBytes,
        resumable: false,
        plan: {
          modelId,
          estimatedTotalBytes: q4TotalBytes,
          selectedGroupId: 'q4',
          files: q4Files.map(([path, sizeBytes]) => ({ path, sizeBytes, required: true })),
          groups: [
            {
              id: 'q4',
              label: 'q4',
              description: '4-bit quantized ONNX profile.',
              profile: 'q4',
              dtype: 'q4',
              estimatedTotalBytes: q4TotalBytes,
              selectable: true,
              selected: true,
              files: q4Files.map(([path, sizeBytes]) => ({ path, sizeBytes, required: true })),
            },
          ],
        },
        files: q4Files.map(([path, sizeBytes]) => ({
          path,
          sizeBytes,
          downloadedBytes: sizeBytes,
        })),
        updatedAt: 90,
      },
    ])

    const crossGroupState = await service.readSelectedModelState(modelId, 'q4f16')

    expect(crossGroupState.status).toBe('paused')
    expect(crossGroupState.totalBytes).toBe(q4f16TotalBytes)
    expect(crossGroupState.bytesDownloaded).toBe(auxiliaryBytes)
    expect(crossGroupState.progress).toBeCloseTo(auxiliaryBytes / q4f16TotalBytes, 8)
    expect(crossGroupState.files).toEqual(
      q4f16Files.map(([path, sizeBytes]) => ({
        path,
        sizeBytes,
        downloadedBytes: auxiliaryFiles.some(([auxPath]) => auxPath === path) ? sizeBytes : 0,
      }))
    )
  })
})

async function waitForDownloadedState(indexPath: string): Promise<void> {
  await waitForState(indexPath, (states) => states.some((entry) => entry.status === 'downloaded'))
}

async function waitForState(
  indexPath: string,
  predicate: (
    states: Array<{
      status?: string
      files?: Array<{ path?: string; downloadedBytes?: number }>
    }>
  ) => boolean
): Promise<void> {
  const startedAt = Date.now()
  let lastParsed: Array<{
    status?: string
    files?: Array<{ path?: string; downloadedBytes?: number }>
  }> = []
  while (Date.now() - startedAt < 1000) {
    const content = await readFile(indexPath, 'utf8').catch(() => '[]')
    const parsed = JSON.parse(content) as Array<{
      status?: string
      files?: Array<{ path?: string; downloadedBytes?: number }>
    }>
    lastParsed = parsed
    if (predicate(parsed)) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Timed out waiting for NMT state. Last state: ${JSON.stringify(lastParsed)}`)
}

function createMockDownloadBlob(chunks: Uint8Array[]): Blob {
  return new MockDownloadBlob(chunks)
}

function createMockDownloadBlobWithFailure(input: {
  chunks: Uint8Array[]
  failAfterChunkCount: number
  error: Error
}): Blob {
  return new MockDownloadBlob(input.chunks, {
    failAfterChunkCount: input.failAfterChunkCount,
    error: input.error,
  })
}

class MockDownloadBlob extends Blob {
  constructor(
    private readonly chunks: Uint8Array[],
    private readonly options?: {
      failAfterChunkCount?: number
      error?: Error
    }
  ) {
    super([])
  }

  override get size(): number {
    return this.chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  }

  override slice(start = 0, end = this.size): Blob {
    return new MockDownloadBlob(sliceChunks(this.chunks, start, end))
  }

  override stream(): ReadableStream<Uint8Array> {
    const chunks = this.chunks.map((chunk) => chunk.slice())
    const failAfterChunkCount = this.options?.failAfterChunkCount
    const error = this.options?.error ?? new Error('Mock download failed.')
    let chunkIndex = 0
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (failAfterChunkCount !== undefined && chunkIndex >= failAfterChunkCount) {
          controller.error(error)
          return
        }
        const chunk = chunks[chunkIndex]
        if (!chunk) {
          controller.close()
          return
        }
        chunkIndex += 1
        if (chunkIndex > 1) {
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
        controller.enqueue(chunk)
      },
    })
  }
}

function sliceChunks(chunks: ReadonlyArray<Uint8Array>, start: number, end: number): Uint8Array[] {
  const next: Uint8Array[] = []
  let offset = 0
  for (const chunk of chunks) {
    const chunkStart = offset
    const chunkEnd = offset + chunk.byteLength
    offset = chunkEnd
    if (end <= chunkStart || start >= chunkEnd) continue
    const from = Math.max(0, start - chunkStart)
    const to = Math.min(chunk.byteLength, end - chunkStart)
    if (from >= to) continue
    next.push(chunk.slice(from, to))
  }
  return next
}

async function writeLocalModelCacheFile(input: {
  cacheDir: string
  modelId: string
  path: string
  content: string
}): Promise<void> {
  const localModelPath = join(
    getTransformersLocalModelPath(input.cacheDir, input.modelId),
    input.path
  )
  const fileCachePath = join(
    getTransformersFileCacheModelPath(input.cacheDir, input.modelId),
    input.path
  )
  await mkdir(dirname(localModelPath), { recursive: true })
  await mkdir(dirname(fileCachePath), { recursive: true })
  await writeFile(localModelPath, input.content, 'utf8')
  await writeFile(fileCachePath, input.content, 'utf8')
}
