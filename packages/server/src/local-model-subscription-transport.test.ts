import { createTRPCClient, createWSClient, httpBatchLink, wsLink } from '@trpc/client'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'

const coreMockState = vi.hoisted(() => ({
  initWatcherPool: vi.fn<() => Promise<void>>(),
}))

const hubMock = vi.hoisted(() => ({
  downloadFile: vi.fn(),
  fileDownloadInfo: vi.fn(async (input: { path: string }) => ({
    size: input.path.includes('_q4') || input.path === 'config.json' ? 10 : 100,
    etag: `${input.path.replace(/[^a-zA-Z0-9]+/g, '-')}-etag`,
    url: `https://huggingface.co/test/resolve/main/${input.path}`,
  })),
  listFiles: vi.fn(async function* () {
    yield { path: 'config.json', type: 'file', size: 10 }
    yield { path: 'onnx/encoder_model_q4.onnx', type: 'file', size: 10 }
    yield { path: 'onnx/decoder_model_merged_q4.onnx', type: 'file', size: 10 }
  }),
}))

const transformersMock = vi.hoisted(() => ({
  env: {
    cacheDir: null as string | null,
    allowLocalModels: false,
    localModelPath: '',
    remoteHost: undefined as string | undefined,
  },
  ModelRegistry: {
    get_pipeline_files: vi.fn(),
    is_pipeline_cached_files: vi.fn(),
    get_file_metadata: vi.fn(),
    clear_cache: vi.fn(),
  },
}))

vi.mock('@openspecui/core', async () => {
  const actual = await vi.importActual<typeof import('@openspecui/core')>('@openspecui/core')
  return {
    ...actual,
    initWatcherPool: coreMockState.initWatcherPool,
    isWatcherPoolInitialized: vi.fn(() => false),
  }
})

vi.mock('@huggingface/hub', () => hubMock)
vi.mock('@huggingface/transformers', () => transformersMock)

import { findAvailablePort } from './port-utils.js'
import { startServer, type AppRouter, type RunningServer } from './server.js'

const runningServers: RunningServer[] = []
const tempDirs: string[] = []
const wsClients: Array<ReturnType<typeof createWSClient>> = []
const originalFetch = globalThis.fetch

beforeEach(() => {
  hubMock.downloadFile.mockReset()
  hubMock.fileDownloadInfo.mockClear()
  hubMock.listFiles.mockClear()
  transformersMock.env.cacheDir = null
  transformersMock.env.allowLocalModels = false
  transformersMock.env.localModelPath = ''
  transformersMock.env.remoteHost = undefined
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/api/models/') && url.includes('/tree/')) {
        return Response.json([
          { path: 'config.json', type: 'file', size: 10 },
          { path: 'onnx/encoder_model_q4.onnx', type: 'file', size: 10 },
          { path: 'onnx/decoder_model_merged_q4.onnx', type: 'file', size: 10 },
        ])
      }
      return originalFetch(input, init)
    })
  )
})

afterEach(async () => {
  await Promise.all(wsClients.splice(0).map((client) => client.close()))
  await Promise.all(runningServers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

async function createIsolatedProjectDir(): Promise<{
  projectDir: string
  runtimePaths: NonNullable<Parameters<typeof startServer>[0]['runtimePaths']>
}> {
  const runtimeDir = await mkdtemp(join(tmpdir(), 'openspecui-subscription-runtime-'))
  const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-subscription-project-'))
  tempDirs.push(runtimeDir, projectDir)
  const runtimePaths = {
    globalSettingsPath: join(runtimeDir, 'settings.json'),
    translationCacheDatabasePath: join(runtimeDir, 'translation-cache.sqlite'),
    localModelCacheDir: join(runtimeDir, 'translation-engines', 'local', 'hf-cache'),
    localModelAssetIndexPath: join(runtimeDir, 'translation-engines', 'local', 'models.json'),
    localModelFetchCachePath: join(runtimeDir, 'translation-engines', 'local', 'fetch-cache.json'),
  }
  await writeFile(
    runtimePaths.globalSettingsPath,
    JSON.stringify({
      translationEngines: {
        local: {
          model: 'onnx-community/opus-mt-en-zh',
          selectedGroupId: 'q4',
          hfEndpoint: 'https://hf-mirror.com/',
        },
      },
    }),
    'utf8'
  )
  return { projectDir, runtimePaths }
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 5_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}.`)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

describe('localModels.subscribeLogs transport', () => {
  it('streams sequential delete lifecycle events to a real tRPC WebSocket client', async () => {
    coreMockState.initWatcherPool.mockResolvedValue(undefined)
    const { projectDir, runtimePaths } = await createIsolatedProjectDir()
    const port = await findAvailablePort(34_600, 100)
    const server = await startServer({ projectDir, port, enableWatcher: false, runtimePaths })
    runningServers.push(server)

    const wsClient = createWSClient({
      url: `ws://localhost:${server.port}/trpc`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    })
    wsClients.push(wsClient)

    const subscriptionClient = createTRPCClient<AppRouter>({
      links: [wsLink({ client: wsClient })],
    })
    const mutationClient = createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: `${server.url}/trpc` })],
    })

    const started = new Promise<void>((resolve) => {
      let resolved = false
      const resolveOnce = () => {
        if (resolved) return
        resolved = true
        resolve()
      }
      subscriptionClient.localModels.subscribeLogs.subscribe(undefined, {
        onStarted: resolveOnce,
        onConnectionStateChange: (state) => {
          if (state.state === 'pending') return
          if (state.state === 'connecting') return
          if (state.state === 'idle') return
          resolveOnce()
        },
        onData: () => undefined,
        onError: () => undefined,
      })
    })

    const receivedLogs = new Promise<Array<{ status: string; message: string }>>(
      (resolve, reject) => {
        const events: Array<{ status: string; message: string }> = []
        const subscription = subscriptionClient.localModels.subscribeLogs.subscribe(undefined, {
          onData: (log) => {
            if (log.modelId !== 'Xenova/opus-mt-en-zh') return
            events.push({ status: log.status, message: log.message })
            if (
              events.length >= 2 &&
              events[events.length - 2]?.status === 'deleting' &&
              events[events.length - 1]?.status === 'not-downloaded'
            ) {
              subscription.unsubscribe()
              resolve(events)
            }
          },
          onError: (error) => {
            subscription.unsubscribe()
            reject(error)
          },
        })
      }
    )

    await withTimeout(started, 'subscription startup')
    await mutationClient.localModels.delete.mutate({ modelId: 'Xenova/opus-mt-en-zh' })

    await expect(withTimeout(receivedLogs, 'delete lifecycle logs')).resolves.toEqual([
      { status: 'deleting', message: 'Deleting local model files.' },
      { status: 'not-downloaded', message: 'Local model files were removed.' },
    ])
  })

  it('streams byte-level download progress events to a real tRPC WebSocket client', async () => {
    coreMockState.initWatcherPool.mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (url.includes('/api/models/') && url.includes('/tree/')) {
          return Response.json([
            { path: 'config.json', type: 'file', size: 10 },
            { path: 'onnx/encoder_model_q4.onnx', type: 'file', size: 10 },
            { path: 'onnx/decoder_model_merged_q4.onnx', type: 'file', size: 10 },
          ])
        }
        if (url.includes('/resolve/main/onnx/encoder_model_q4.onnx')) {
          return new Response(
            new ReadableStream<Uint8Array>({
              async start(controller) {
                controller.enqueue(new Uint8Array([1, 2, 3, 4]))
                await new Promise((resolve) => setTimeout(resolve, 20))
                controller.enqueue(new Uint8Array([5, 6, 7, 8, 9, 10]))
                controller.close()
              },
            }),
            {
              status: (init?.headers && new Headers(init.headers).get('Range') !== null
                ? 206
                : 200) as 200 | 206,
              headers: {
                'Content-Length': '10',
                'Content-Range': 'bytes 0-9/10',
              },
            }
          )
        }
        if (url.includes('/resolve/main/')) {
          return new Response(new Uint8Array(10), {
            status: 200,
            headers: {
              'Content-Length': '10',
            },
          })
        }
        return originalFetch(input, init)
      })
    )

    const { projectDir, runtimePaths } = await createIsolatedProjectDir()
    const port = await findAvailablePort(34_700, 100)
    const server = await startServer({ projectDir, port, enableWatcher: false, runtimePaths })
    runningServers.push(server)

    const wsClient = createWSClient({
      url: `ws://localhost:${server.port}/trpc`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    })
    wsClients.push(wsClient)

    const subscriptionClient = createTRPCClient<AppRouter>({
      links: [wsLink({ client: wsClient })],
    })
    const mutationClient = createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: `${server.url}/trpc` })],
    })

    const started = new Promise<void>((resolve) => {
      let resolved = false
      const resolveOnce = () => {
        if (resolved) return
        resolved = true
        resolve()
      }
      subscriptionClient.localModels.subscribeLogs.subscribe(undefined, {
        onStarted: resolveOnce,
        onConnectionStateChange: (state) => {
          if (state.state === 'pending') return
          if (state.state === 'connecting') return
          if (state.state === 'idle') return
          resolveOnce()
        },
        onData: () => undefined,
        onError: () => undefined,
      })
    })

    const receivedLogs = new Promise<
      Array<{
        status: string
        message: string
        bytesDownloaded: number | undefined
        progress: number | undefined
      }>
    >((resolve, reject) => {
      const events: Array<{
        status: string
        message: string
        bytesDownloaded: number | undefined
        progress: number | undefined
      }> = []
      const subscription = subscriptionClient.localModels.subscribeLogs.subscribe(undefined, {
        onData: (log) => {
          if (log.modelId !== 'onnx-community/opus-mt-en-zh') return
          events.push({
            status: log.status,
            message: log.message,
            bytesDownloaded: log.bytesDownloaded,
            progress: log.progress,
          })
          const sawMidStreamEncoderProgress = events.some(
            (event) =>
              event.message === 'Downloading onnx/encoder_model_q4.onnx.' &&
              typeof event.bytesDownloaded === 'number' &&
              event.bytesDownloaded > 10 &&
              event.bytesDownloaded < 20 &&
              typeof event.progress === 'number' &&
              event.progress > 0 &&
              event.progress < 1
          )
          const sawCompleted = events.some(
            (event) =>
              event.status === 'downloaded' &&
              event.message === 'Local model onnx-community/opus-mt-en-zh is ready.'
          )
          if (sawMidStreamEncoderProgress && sawCompleted) {
            subscription.unsubscribe()
            resolve(events)
          }
        },
        onError: (error) => {
          subscription.unsubscribe()
          reject(error)
        },
      })
    })

    await withTimeout(started, 'subscription startup')
    await mutationClient.localModels.download.mutate({
      modelId: 'onnx-community/opus-mt-en-zh',
      selectedGroupId: 'q4',
    })

    const events = await withTimeout(receivedLogs, 'download progress logs')
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'downloading',
          message: 'Downloading local model onnx-community/opus-mt-en-zh.',
          bytesDownloaded: 0,
          progress: 0,
        }),
        expect.objectContaining({
          status: 'downloading',
          message: 'Downloading onnx/encoder_model_q4.onnx.',
        }),
        expect.objectContaining({
          status: 'downloaded',
          message: 'Local model onnx-community/opus-mt-en-zh is ready.',
          bytesDownloaded: 30,
          progress: 1,
        }),
      ])
    )
    expect(
      events.some(
        (event) =>
          event.message === 'Downloading onnx/encoder_model_q4.onnx.' &&
          event.bytesDownloaded === 14 &&
          event.progress !== undefined &&
          event.progress > 0.4 &&
          event.progress < 0.5
      )
    ).toBe(true)
  })

  it('auto-resumes a retryable stream failure and keeps streaming progress events to the client', async () => {
    coreMockState.initWatcherPool.mockResolvedValue(undefined)
    let encoderAttempts = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (url.includes('/api/models/') && url.includes('/tree/')) {
          return Response.json([
            { path: 'config.json', type: 'file', size: 10 },
            { path: 'onnx/encoder_model_q4.onnx', type: 'file', size: 10 },
            { path: 'onnx/decoder_model_merged_q4.onnx', type: 'file', size: 10 },
          ])
        }
        if (url.includes('/resolve/main/onnx/encoder_model_q4.onnx')) {
          encoderAttempts += 1
          const range = init?.headers ? new Headers(init.headers).get('Range') : null
          if (encoderAttempts === 1) {
            return new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.enqueue(new Uint8Array([1, 2, 3, 4]))
                  controller.error(new TypeError('fetch failed'))
                },
              }),
              {
                status: 200,
                headers: {
                  'Content-Length': '10',
                },
              }
            )
          }
          return new Response(new Uint8Array([5, 6, 7, 8, 9, 10]), {
            status: range ? 206 : 200,
            headers: {
              'Content-Length': '6',
              'Content-Range': 'bytes 4-9/10',
            },
          })
        }
        if (url.includes('/resolve/main/')) {
          return new Response(new Uint8Array(10), {
            status: 200,
            headers: {
              'Content-Length': '10',
            },
          })
        }
        return originalFetch(input, init)
      })
    )

    const { projectDir, runtimePaths } = await createIsolatedProjectDir()
    const port = await findAvailablePort(34_710, 100)
    const server = await startServer({ projectDir, port, enableWatcher: false, runtimePaths })
    runningServers.push(server)

    const wsClient = createWSClient({
      url: `ws://localhost:${server.port}/trpc`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    })
    wsClients.push(wsClient)

    const subscriptionClient = createTRPCClient<AppRouter>({
      links: [wsLink({ client: wsClient })],
    })
    const mutationClient = createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: `${server.url}/trpc` })],
    })

    const started = new Promise<void>((resolve) => {
      let resolved = false
      const resolveOnce = () => {
        if (resolved) return
        resolved = true
        resolve()
      }
      subscriptionClient.localModels.subscribeLogs.subscribe(undefined, {
        onStarted: resolveOnce,
        onConnectionStateChange: (state) => {
          if (state.state === 'pending') return
          if (state.state === 'connecting') return
          if (state.state === 'idle') return
          resolveOnce()
        },
        onData: () => undefined,
        onError: () => undefined,
      })
    })

    const receivedLogs = new Promise<
      Array<{
        status: string
        message: string
        bytesDownloaded: number | undefined
        progress: number | undefined
      }>
    >((resolve, reject) => {
      const events: Array<{
        status: string
        message: string
        bytesDownloaded: number | undefined
        progress: number | undefined
      }> = []
      const subscription = subscriptionClient.localModels.subscribeLogs.subscribe(undefined, {
        onData: (log) => {
          if (log.modelId !== 'onnx-community/opus-mt-en-zh') return
          events.push({
            status: log.status,
            message: log.message,
            bytesDownloaded: log.bytesDownloaded,
            progress: log.progress,
          })
          const sawRetryNotice = events.some(
            (event) =>
              event.message ===
              'Connection interrupted while downloading onnx/encoder_model_q4.onnx. Retrying automatically in 500 ms.'
          )
          const sawResumedMidStreamEvent = events.some(
            (event) =>
              event.message === 'Downloading onnx/encoder_model_q4.onnx.' &&
              typeof event.bytesDownloaded === 'number' &&
              event.bytesDownloaded > 10 &&
              event.bytesDownloaded < 20 &&
              typeof event.progress === 'number' &&
              event.progress > 0.33 &&
              event.progress < 0.67
          )
          const sawCompleted = events.some(
            (event) =>
              event.status === 'downloaded' &&
              event.message === 'Local model onnx-community/opus-mt-en-zh is ready.'
          )
          if (sawRetryNotice && sawResumedMidStreamEvent && sawCompleted) {
            subscription.unsubscribe()
            resolve(events)
          }
        },
        onError: (error) => {
          subscription.unsubscribe()
          reject(error)
        },
      })
    })

    await withTimeout(started, 'subscription startup')
    await mutationClient.localModels.download.mutate({
      modelId: 'onnx-community/opus-mt-en-zh',
      selectedGroupId: 'q4',
    })

    const events = await withTimeout(receivedLogs, 'resumed download progress logs')
    expect(encoderAttempts).toBe(2)
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'downloading',
          message:
            'Connection interrupted while downloading onnx/encoder_model_q4.onnx. Retrying automatically in 500 ms.',
        }),
      ])
    )
    expect(
      events.some(
        (event) =>
          event.message === 'Downloading onnx/encoder_model_q4.onnx.' &&
          event.bytesDownloaded !== undefined &&
          event.bytesDownloaded > 10 &&
          event.bytesDownloaded < 20 &&
          event.progress !== undefined &&
          event.progress > 0.33 &&
          event.progress < 0.67
      )
    ).toBe(true)
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'downloaded',
          message: 'Local model onnx-community/opus-mt-en-zh is ready.',
          bytesDownloaded: 30,
          progress: 1,
        }),
      ])
    )
  })
})
