import type { ConfigManager } from '@openspecui/core'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalModelAssetService } from './local-model-asset-service.js'
import { LocalModelAssetStore } from './local-model-asset-store.js'

const hubMock = vi.hoisted(() => ({
  downloadFileToCacheDir: vi.fn(),
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
        return createChunkedResponse([new Uint8Array(10)])
      })
    )
    hubMock.downloadFileToCacheDir.mockReset()
    hubMock.fileDownloadInfo.mockClear()
    hubMock.listFiles.mockClear()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(tempDir, { recursive: true, force: true })
  })

  it('downloads only selected NMT group files through the official Hugging Face hub primitives', async () => {
    hubMock.downloadFileToCacheDir.mockImplementation(
      async (input: { path: string; fetch?: typeof fetch; cacheDir?: string }) =>
        writeMockHubCacheFile(input, [new Uint8Array(10)])
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

    expect(hubMock.downloadFileToCacheDir).toHaveBeenCalledTimes(3)
    expect(hubMock.downloadFileToCacheDir).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        repo: { type: 'model', name: 'onnx-community/opus-mt-en-zh' },
        path: 'config.json',
        hubUrl: 'https://hf-mirror.com',
      })
    )
    expect(hubMock.downloadFileToCacheDir).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: 'onnx/encoder_model_q4.onnx',
      })
    )
    expect(hubMock.downloadFileToCacheDir).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        path: 'onnx/decoder_model_merged_q4.onnx',
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
    hubMock.downloadFileToCacheDir.mockImplementation(
      async (input: { path: string; fetch?: typeof fetch; cacheDir?: string }) =>
        writeMockHubCacheFile(
          input,
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
          (file) => file.path === 'onnx/encoder_model_q4.onnx' && file.downloadedBytes === 10
        )
      )
    )
    await waitForDownloadedState(indexPath)
  })

  it('retries retryable Hugging Face download failures before marking the model as failed', async () => {
    let encoderAttempts = 0
    hubMock.downloadFileToCacheDir.mockImplementation(
      async (input: { path: string; fetch?: typeof fetch; cacheDir?: string }) => {
        if (input.path === 'onnx/encoder_model_q4.onnx') {
          encoderAttempts += 1
          if (encoderAttempts === 1) {
            throw new TypeError('fetch failed')
          }
        }
        return writeMockHubCacheFile(input, [new Uint8Array(10)])
      }
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

    expect(encoderAttempts).toBe(2)
    const state = (await new LocalModelAssetStore({ indexPath }).readAll())[0]
    expect(state?.status).toBe('downloaded')
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
  while (Date.now() - startedAt < 1000) {
    const content = await readFile(indexPath, 'utf8').catch(() => '[]')
    const parsed = JSON.parse(content) as Array<{
      status?: string
      files?: Array<{ path?: string; downloadedBytes?: number }>
    }>
    if (predicate(parsed)) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for NMT state.')
}

async function consumeProgressFetch(
  customFetch: typeof fetch | undefined,
  path: string,
  _chunks: Uint8Array[]
): Promise<void> {
  if (!customFetch) return
  const response = await customFetch(`https://huggingface.co/test/resolve/main/${path}`, {
    headers: {},
  })
  const reader = response.body?.getReader()
  if (!reader) return
  while (!(await reader.read()).done) {
    // Consume the wrapped stream so progress callbacks fire.
  }
}

function createChunkedResponse(chunks: Uint8Array[]): Response {
  const totalBytes = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const [index, chunk] of chunks.entries()) {
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
          controller.enqueue(chunk)
        }
        controller.close()
      },
    }),
    { headers: { 'content-length': String(totalBytes) } }
  )
}

async function writeMockHubCacheFile(
  input: { path: string; fetch?: typeof fetch; cacheDir?: string },
  chunks: Uint8Array[]
): Promise<string> {
  await consumeProgressFetch(input.fetch, input.path, chunks)
  const cachedPath = join(input.cacheDir ?? '', 'hub-cache', input.path)
  await mkdir(dirname(cachedPath), { recursive: true })
  await writeFile(cachedPath, Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))))
  return cachedPath
}
