/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Bootstrap the HTTP/tRPC server and launch-project runtime services.
 * 2. Delegate OpenSpec filesystem ownership to the CLI-selected planning-root manager.
 * 3. Host Server-local terminal/Root Context notifications, sound, preview-resource, and translation HTTP boundaries.
 * 4. Host tRPC and PTY WebSocket transports with deterministic teardown.
 *    PTY planning-root creation and workflow input verify opaque Root generation provenance.
 * 5. Own the runtime observation environment and external Codex command lease while deferring expensive
 *    root-scoped projections until a foreground consumer requests them.
 *
 * Original request (2026-07-15): "你先负责后端（内核）的开发。"
 * Original request (2026-07-17): "Every Planning-root execution surface uses the same operation lifetime owner."
 * Derived requirement (2026-07-19): Checkpoint 6.11 binds Git operations to backend-owned repository epochs.
 * Derived requirement (2026-07-20): Environment-global Codex command observation is Server-owned and
 * released with the runtime environment.
 * Owner-reported defect (2026-07-21): Pre-created Agent terminals are absent from Compose Send.
 * Derived requirement (2026-07-22): Checkpoint 6.15 publishes Root Context health only through this Server instance.
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 *
 * @module server
 */

import { serve } from '@hono/node-server'
import {
  buildBackendHealthPayload,
  CliExecutor,
  computeEnvUri,
  ConfigManager,
  CustomSoundHashSchema,
  getExternalCodexCommandObservationRoot,
  GlobalSettingsManager,
  NotificationPublishInputSchema,
  OpenSpecAdapter,
  OpenSpecDataHomeObserver,
  OpenSpecWatcher,
  ReactiveObservationEnvironment,
  resolveOpenSpecDataScope,
  RuntimeInvalidationIndex,
  RuntimeRootInvalidationRegistry,
  type AccessGateCredential,
  type EnvUri,
  type RootContextState,
} from '@openspecui/core'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import type { Observable } from '@trpc/server/observable'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
const __dirname = dirname(fileURLToPath(import.meta.url))

function getServerPackageVersion(): string {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown }
    return typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

const SERVER_PACKAGE_VERSION = getServerPackageVersion()

import {
  createAccessGate,
  createAccessGateMiddleware,
  extractBearerCredential,
  type AccessGate,
} from './access-gate.js'
import { createChangesProjectionWorkOwner } from './changes-projection-service.js'
import { Ct2ModelAssetService } from './ct2-model-asset-service.js'
import {
  getDefaultLocalCt2ModelCacheDir,
  getDefaultLocalCt2ModelFetchCachePath,
  getDefaultLocalCt2ModelIndexPath,
  getDefaultLocalCt2ModelProfileManifestPath,
} from './ct2-model-cache-path.js'
import { CustomSoundService } from './custom-sound-service.js'
import { createDashboardProjectionWorkOwner } from './dashboard-projection-service.js'
import { GitRepositoryBindingService } from './git-repository-binding-service.js'
import { LaunchGitRepositoryBindingOwner } from './launch-git-repository-binding.js'
import { LlamaModelAssetService } from './llama-model-asset-service.js'
import {
  getDefaultLocalLlamaModelCacheDir,
  getDefaultLocalLlamaModelFetchCachePath,
  getDefaultLocalLlamaModelIndexPath,
  getDefaultLocalLlamaModelProfileManifestPath,
} from './local-llama-model-cache-path.js'
import { LocalModelAssetService } from './local-model-asset-service.js'
import {
  getDefaultLocalModelCacheDir,
  getDefaultLocalModelFetchCachePath,
  getDefaultLocalModelIndexPath,
  getDefaultLocalModelProfileManifestPath,
} from './local-model-cache-path.js'
import { NotificationService } from './notification-service.js'
import { PlanningRootServiceManager } from './planning-root-service.js'
import { findAvailablePort } from './port-utils.js'
import { ProjectRecoveryService } from './project-recovery-service.js'
import { createServerProjectionWorkRuntime } from './projection-work/runtime.js'
import { PtyManager } from './pty-manager.js'
import { createPtyWebSocketHandler } from './pty-websocket.js'
import { createRootContextNotificationBridge } from './root-context-notification-bridge.js'
import { createRootContextSubscription } from './root-context-service.js'
import { appRouter, type Context, type GitWorktreeHandoffService } from './router.js'
import { StoreObservationFallbackService } from './store-observation-fallback.js'
import { StoreObservationService } from './store-observation-service.js'
import { ToolCommandObservationService } from './tool-command-observation-service.js'
import { createRuntimeSqliteTranslationCacheAdapter } from './translation-cache-adapter.js'
import { getDefaultTranslationCacheDatabasePath } from './translation-cache-path.js'
import { TranslationCacheService } from './translation-cache-service.js'
import { TranslationEngineService } from './translation-engine-service.js'
import { createManagedLocalBatchTranslateWorkerExecutor } from './translation-engine-worker.js'

function buildEmbeddedUiUrlForPort(port: number): string {
  return `http://localhost:${port}`
}

function deferBackgroundTask(task: () => void): void {
  setTimeout(task, 0)
}

/**
 * Server configuration options.
 */
export interface ServerConfig {
  /** Path to the project directory containing openspec/ */
  projectDir: string
  /** Preferred HTTP server port (default: 3100). Will find next available if occupied. */
  port?: number
  /** Enable file watching for realtime updates (default: true) */
  enableWatcher?: boolean
  /** CORS origins (defaults to localhost dev servers) */
  corsOrigins?: string[]
  /**
   * Optional whole-backend Access Gate credential. When set, every HTTP, tRPC, PTY, file, terminal,
   * and notification transport requires the matching Bearer credential. Absent by default so the
   * unguarded dev workflow is unchanged.
   */
  accessGate?: AccessGateCredential | null
  /** Directory containing built preview entry assets */
  previewAssetsDir?: string
  /** Optional worktree handoff provider for runtimes that can spawn sibling instances */
  gitWorktreeHandoff?: GitWorktreeHandoffService
  /** Test-only typed Root Context source override for asserting Server-local notification ownership. */
  rootContextNotificationSource?: (
    planningRootServices: PlanningRootServiceManager,
    notificationService: NotificationService
  ) => Observable<RootContextState, unknown>
  /** Optional path overrides for isolated runtimes and tests */
  runtimePaths?: {
    globalSettingsPath?: string
    translationCacheDatabasePath?: string
    localModelCacheDir?: string
    localModelAssetIndexPath?: string
    localModelProfileManifestPath?: string
    localModelFetchCachePath?: string
    localCt2ModelCacheDir?: string
    localCt2ModelAssetIndexPath?: string
    localCt2ModelProfileManifestPath?: string
    localCt2ModelFetchCachePath?: string
    localLlamaModelCacheDir?: string
    localLlamaModelAssetIndexPath?: string
    localLlamaModelProfileManifestPath?: string
    localLlamaModelFetchCachePath?: string
  }
}

/**
 * Create an OpenSpecUI HTTP server with optional WebSocket support
 */
export function createServer(config: ServerConfig) {
  // Whole-backend Access Gate. Default loopback; the live listener revises this once bound.
  const accessGate: AccessGate = createAccessGate({
    credential: config.accessGate ?? null,
    loopback: true,
  })
  // Opaque runtime-environment identity for the hosted protocol (host identity + effective data home).
  const envUri: EnvUri = computeEnvUri({
    hostIdentity: `host:${config.projectDir}`,
    dataHome: resolveOpenSpecDataScope().path,
  })
  const adapter = new OpenSpecAdapter(config.projectDir)
  const configManager = new ConfigManager(config.projectDir)
  const globalSettingsManager = new GlobalSettingsManager(config.runtimePaths?.globalSettingsPath)
  const cliExecutor = new CliExecutor(configManager, config.projectDir)
  const observationEnvironment = new ReactiveObservationEnvironment()
  const runtimeInvalidation = new RuntimeInvalidationIndex()
  const projectInvalidation = new RuntimeRootInvalidationRegistry(runtimeInvalidation, [
    'project',
    'context',
  ])
  projectInvalidation.acquireRoot(config.projectDir)
  const dataHomeObserver = new OpenSpecDataHomeObserver({
    dataHomePath: resolveOpenSpecDataScope().path,
    environment: observationEnvironment,
    invalidation: runtimeInvalidation,
  })
  const storeInvalidation = new RuntimeRootInvalidationRegistry(runtimeInvalidation, [
    'stores',
    'context',
  ])
  const storeObservation = new StoreObservationService(observationEnvironment, storeInvalidation)
  const storeObservationFallback = new StoreObservationFallbackService({
    invalidation: runtimeInvalidation,
    dataHomeObservation: dataHomeObserver,
    storeObservation,
    observationEnvironment,
  })
  const toolCommandObservation = new ToolCommandObservationService(
    observationEnvironment,
    getExternalCodexCommandObservationRoot()
  )
  const codeGitBinding = new LaunchGitRepositoryBindingOwner()
  const projectionWorkRuntime = createServerProjectionWorkRuntime()
  const dashboardProjectionWorkOwner = createDashboardProjectionWorkOwner(projectionWorkRuntime)
  const changesProjectionWorkOwner = createChangesProjectionWorkOwner(projectionWorkRuntime)
  const planningRootServices = new PlanningRootServiceManager({
    launchProjectDir: config.projectDir,
    previewAssetsDir: config.previewAssetsDir ?? join(__dirname, '..', '..', 'web', 'dist'),
    configManager,
    cliExecutor,
    observationEnvironment,
    projectInvalidation,
    runtimeInvalidation,
    codeBinding: codeGitBinding,
    dashboardProjectionWorkOwner,
    changesProjectionWorkOwner,
  })
  const gitRepositoryBindings = new GitRepositoryBindingService({
    launchProjectDir: config.projectDir,
    planningRootServices,
    codeBinding: codeGitBinding,
  })
  const notificationService = new NotificationService()
  const rootContextNotificationBridge = createRootContextNotificationBridge({
    notificationService,
    rootContext:
      config.rootContextNotificationSource?.(planningRootServices, notificationService) ??
      createRootContextSubscription(planningRootServices),
  })
  const customSoundService = new CustomSoundService()
  const translationCacheDatabasePath =
    config.runtimePaths?.translationCacheDatabasePath ?? getDefaultTranslationCacheDatabasePath()
  let translationCacheAdapterPromise: ReturnType<
    typeof createRuntimeSqliteTranslationCacheAdapter
  > | null = null
  const getTranslationCacheAdapter = () => {
    translationCacheAdapterPromise ??= createRuntimeSqliteTranslationCacheAdapter(
      translationCacheDatabasePath
    )
    return translationCacheAdapterPromise
  }
  const translationCacheService = new TranslationCacheService({
    configManager,
    globalSettingsManager,
    adapter: {
      databasePath: translationCacheDatabasePath,
      init: async () => (await getTranslationCacheAdapter()).init(),
      read: async (keyHash, now) => (await getTranslationCacheAdapter()).read(keyHash, now),
      write: async (input, now) => (await getTranslationCacheAdapter()).write(input, now),
      count: async () => (await getTranslationCacheAdapter()).count(),
      deleteLeastRecentlyUsed: async (targetEntryCount) =>
        (await getTranslationCacheAdapter()).deleteLeastRecentlyUsed(targetEntryCount),
      clean: async (entryLimit) => (await getTranslationCacheAdapter()).clean(entryLimit),
      clear: async () => (await getTranslationCacheAdapter()).clear(),
      close: () => {
        translationCacheAdapterPromise?.then((cacheAdapter) => cacheAdapter.close()).catch(() => {})
      },
    },
    onWriteError(error) {
      console.warn('Translation cache write failed:', error)
    },
  })
  const nmtModelCacheDir = config.runtimePaths?.localModelCacheDir ?? getDefaultLocalModelCacheDir()
  const nmtModelIndexPath =
    config.runtimePaths?.localModelAssetIndexPath ?? getDefaultLocalModelIndexPath()
  const nmtModelProfileManifestPath =
    config.runtimePaths?.localModelProfileManifestPath ?? getDefaultLocalModelProfileManifestPath()
  const nmtModelFetchCachePath =
    config.runtimePaths?.localModelFetchCachePath ?? getDefaultLocalModelFetchCachePath()
  const ct2ModelCacheDir =
    config.runtimePaths?.localCt2ModelCacheDir ?? getDefaultLocalCt2ModelCacheDir()
  const ct2ModelIndexPath =
    config.runtimePaths?.localCt2ModelAssetIndexPath ?? getDefaultLocalCt2ModelIndexPath()
  const ct2ModelProfileManifestPath =
    config.runtimePaths?.localCt2ModelProfileManifestPath ??
    getDefaultLocalCt2ModelProfileManifestPath()
  const ct2ModelFetchCachePath =
    config.runtimePaths?.localCt2ModelFetchCachePath ?? getDefaultLocalCt2ModelFetchCachePath()
  const llamaModelCacheDir =
    config.runtimePaths?.localLlamaModelCacheDir ?? getDefaultLocalLlamaModelCacheDir()
  const llamaModelIndexPath =
    config.runtimePaths?.localLlamaModelAssetIndexPath ?? getDefaultLocalLlamaModelIndexPath()
  const llamaModelProfileManifestPath =
    config.runtimePaths?.localLlamaModelProfileManifestPath ??
    getDefaultLocalLlamaModelProfileManifestPath()
  const llamaModelFetchCachePath =
    config.runtimePaths?.localLlamaModelFetchCachePath ?? getDefaultLocalLlamaModelFetchCachePath()
  const managedLocalWorkerExecutor = createManagedLocalBatchTranslateWorkerExecutor({
    resolveCacheDir(engineId) {
      return engineId === 'local-ct2'
        ? ct2ModelCacheDir
        : engineId === 'local-llama'
          ? llamaModelCacheDir
          : nmtModelCacheDir
    },
    resolveHost(input) {
      return input.engineId === 'local-llama' ? 'process' : 'thread'
    },
  })
  const translationEngineService = new TranslationEngineService({
    projectDir: config.projectDir,
    configManager,
    globalSettingsManager,
    localCacheDir: nmtModelCacheDir,
    localAssetIndexPath: nmtModelIndexPath,
    localFetchCachePath: nmtModelFetchCachePath,
    localCt2CacheDir: ct2ModelCacheDir,
    localCt2AssetIndexPath: ct2ModelIndexPath,
    localCt2FetchCachePath: ct2ModelFetchCachePath,
    localLlamaCacheDir: llamaModelCacheDir,
    localLlamaAssetIndexPath: llamaModelIndexPath,
    localLlamaFetchCachePath: llamaModelFetchCachePath,
    executeManagedLocalBatchTranslate: managedLocalWorkerExecutor,
  })
  const localModelAssetService = new LocalModelAssetService({
    projectDir: config.projectDir,
    configManager,
    globalSettingsManager,
    cacheDir: nmtModelCacheDir,
    indexPath: nmtModelIndexPath,
    profileManifestPath: nmtModelProfileManifestPath,
    fetchCachePath: nmtModelFetchCachePath,
  })
  const localCt2ModelAssetService = new Ct2ModelAssetService({
    projectDir: config.projectDir,
    globalSettingsManager,
    cacheDir: ct2ModelCacheDir,
    indexPath: ct2ModelIndexPath,
    profileManifestPath: ct2ModelProfileManifestPath,
    fetchCachePath: ct2ModelFetchCachePath,
  })
  const localLlamaModelAssetService = new LlamaModelAssetService({
    projectDir: config.projectDir,
    globalSettingsManager,
    cacheDir: llamaModelCacheDir,
    indexPath: llamaModelIndexPath,
    profileManifestPath: llamaModelProfileManifestPath,
    fetchCachePath: llamaModelFetchCachePath,
  })

  // Create file watcher if enabled
  const watcher =
    config.enableWatcher !== false ? new OpenSpecWatcher(config.projectDir) : undefined
  const projectRecoveryService = new ProjectRecoveryService({
    projectDir: config.projectDir,
    gitWorktreeHandoff: config.gitWorktreeHandoff,
  })

  const app = new Hono()

  const corsOrigins = config.corsOrigins ?? ['http://localhost:5173', 'http://localhost:3000']

  // CORS for development
  app.use(
    '*',
    cors({
      origin: corsOrigins,
      credentials: true,
    })
  )

  // Whole-backend Access Gate middleware (HTTP). Pass-through when no gate is configured.
  app.use('*', createAccessGateMiddleware(accessGate))

  // Health check
  app.get('/api/health', (c) => {
    return c.json(
      buildBackendHealthPayload({
        projectDir: config.projectDir,
        projectName: basename(config.projectDir) || config.projectDir,
        watcherEnabled: !!watcher,
        openspecuiVersion: SERVER_PACKAGE_VERSION,
        embeddedUiUrl: buildEmbeddedUiUrlForPort(config.port ?? 3100),
        // 1.6 hosted-protocol additions.
        apiBaseUrl: `http://localhost:${config.port ?? 3100}`,
        cliVersion: null,
        envUri: envUri as string,
        rootSummary: null,
        accessGateEnabled: accessGate !== null,
      })
    )
  })

  app.post('/api/notifications', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = NotificationPublishInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid notification payload',
          issues: parsed.error.issues,
        },
        400
      )
    }
    return c.json(notificationService.publish(parsed.data))
  })

  app.post('/api/sounds/custom', async (c) => {
    const formData = await c.req.formData().catch(() => null)
    const file = formData?.get('file')
    const nameValue = formData?.get('name')
    if (!(file instanceof File)) {
      return c.json({ error: 'Audio file is required.' }, 400)
    }
    const metadata = await customSoundService.upload({
      bytes: new Uint8Array(await file.arrayBuffer()),
      name: typeof nameValue === 'string' ? nameValue : file.name,
      mime: file.type || 'audio/mpeg',
    })
    return c.json(metadata)
  })

  app.get('/api/sounds/custom/:id', async (c) => {
    const id = c.req.param('id')
    const parsedId = CustomSoundHashSchema.safeParse(id)
    if (!parsedId.success) {
      return c.json({ error: 'Sound not found.' }, 404)
    }
    const file = await customSoundService.getFile(`custom:${parsedId.data}`)
    if (!file) {
      return c.json({ error: 'Sound not found.' }, 404)
    }
    return new Response(new Blob([file.data], { type: file.metadata.mime }), {
      headers: {
        'Content-Type': file.metadata.mime,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  })

  app.get('/api/file-preview/:hash/*', async (c) => {
    const hash = c.req.param('hash')
    const prefix = `/api/file-preview/${hash}/`
    const requestPath = c.req.path.startsWith(prefix) ? c.req.path.slice(prefix.length) : ''
    const asset = planningRootServices.readPreviewRequest(hash, requestPath)
    if (!asset) {
      return c.notFound()
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(asset.content))
        controller.close()
      },
    })
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': asset.contentType,
      },
    })
  })

  // tRPC HTTP handler (for queries and mutations)
  app.use('/trpc/*', async (c) => {
    const response = await fetchRequestHandler({
      endpoint: '/trpc',
      req: c.req.raw,
      router: appRouter,
      createContext: (): Context => ({
        launchProjectAdapter: adapter,
        planningRootServices,
        gitRepositoryBindings,
        runtimeInvalidation,
        storeObservation,
        toolCommandObservation,
        configManager,
        cliExecutor,
        projectRecoveryService,
        notificationService,
        customSoundService,
        globalSettingsManager,
        translationCacheService,
        translationEngineService,
        localModelAssetService,
        localCt2ModelAssetService,
        localLlamaModelAssetService,
        gitWorktreeHandoff: config.gitWorktreeHandoff,
        watcher,
        projectDir: config.projectDir,
      }),
    })
    return response
  })

  // Create context factory for WebSocket connections
  const createContext = (): Context => ({
    launchProjectAdapter: adapter,
    planningRootServices,
    gitRepositoryBindings,
    runtimeInvalidation,
    storeObservation,
    toolCommandObservation,
    configManager,
    cliExecutor,
    projectRecoveryService,
    notificationService,
    customSoundService,
    globalSettingsManager,
    translationCacheService,
    translationEngineService,
    localModelAssetService,
    localCt2ModelAssetService,
    localLlamaModelAssetService,
    gitWorktreeHandoff: config.gitWorktreeHandoff,
    watcher,
    projectDir: config.projectDir,
  })

  return {
    app,
    accessGate,
    envUri,
    planningRootServices,
    gitRepositoryBindings,
    observationEnvironment,
    runtimeInvalidation,
    projectInvalidation,
    dataHomeObserver,
    storeObservation,
    storeInvalidation,
    storeObservationFallback,
    toolCommandObservation,
    adapter,
    configManager,
    cliExecutor,
    projectRecoveryService,
    notificationService,
    rootContextNotificationBridge,
    customSoundService,
    globalSettingsManager,
    translationCacheService,
    translationEngineService,
    localModelAssetService,
    localCt2ModelAssetService,
    localLlamaModelAssetService,
    projectionWorkRuntime,
    watcher,
    createContext,
    port: config.port ?? 3100,
  }
}

/**
 * Create WebSocket server for tRPC subscriptions and PTY terminals
 */
export async function createWebSocketServer(
  server: ReturnType<typeof createServer>,
  httpServer: { on: (event: string, handler: (...args: unknown[]) => void) => void },
  config: { projectDir: string }
) {
  // tRPC WebSocket server
  const wss = new WebSocketServer({ noServer: true })

  const handler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: server.createContext,
    keepAlive: {
      enabled: true,
      pingMs: 30000,
      pongWaitMs: 5000,
    },
  })

  // PTY WebSocket server
  const ptyManager = new PtyManager()
  const ptyWss = new WebSocketServer({ noServer: true })
  const ptyHandler = createPtyWebSocketHandler(ptyManager, server.notificationService, {
    accessGate: server.accessGate,
    async withCwdTarget(cwdTarget, task, expectedRootGeneration) {
      if (cwdTarget === 'launch-project') {
        if (expectedRootGeneration) {
          throw new Error('Planning-root generation cannot target the launch project.')
        }
        return task({ cwdTarget, cwd: config.projectDir, rootGeneration: null })
      }
      return server.planningRootServices.runOperation(({ rootContext, gitBindingToken }) => {
        if (expectedRootGeneration && expectedRootGeneration !== gitBindingToken) {
          throw new Error(
            'Planning root changed before terminal operation. Prepare the workflow again.'
          )
        }
        const planningRoot = rootContext.planningRoot
        if (!planningRoot) {
          throw new Error('Planning root cwd is unavailable.')
        }
        return task({ cwdTarget, cwd: planningRoot.path, rootGeneration: gitBindingToken })
      })
    },
  })
  ptyWss.on('connection', ptyHandler)

  // Handle upgrade requests - route by URL path
  httpServer.on('upgrade', (...args: unknown[]) => {
    const [request, socket, head] = args as [
      { url?: string; headers?: Record<string, string | string[] | undefined> },
      { write: (data: string) => boolean; destroy: () => void },
      Buffer,
    ]
    // Whole-backend Access Gate on the WS upgrade. The Authorization header is honored when present
    // (app/non-browser clients). Browser WS clients cannot set headers, so tRPC connection params and
    // the PTY first-message auth handshake remain the authoritative post-upgrade checks below.
    if (server.accessGate) {
      const authHeader = request.headers?.['authorization']
      const headerValue = Array.isArray(authHeader) ? (authHeader[0] ?? null) : (authHeader ?? null)
      if (headerValue) {
        const presented = extractBearerCredential(headerValue)
        const outcome = server.accessGate.check(presented)
        if (!outcome.ok) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
          socket.destroy()
          return
        }
      }
    }
    if (request.url?.startsWith('/ws/pty')) {
      ptyWss.handleUpgrade(
        request as Parameters<typeof ptyWss.handleUpgrade>[0],
        socket as Parameters<typeof ptyWss.handleUpgrade>[1],
        head,
        (ws) => {
          ptyWss.emit('connection', ws, request)
        }
      )
    } else if (request.url?.startsWith('/trpc')) {
      wss.handleUpgrade(
        request as Parameters<typeof wss.handleUpgrade>[0],
        socket as Parameters<typeof ptyWss.handleUpgrade>[1],
        head,
        (ws) => {
          wss.emit('connection', ws, request)
        }
      )
    }
  })

  // Start legacy file watcher if available
  server.watcher?.start()

  let closePromise: Promise<void> | null = null

  const settleCleanupPhase = async (
    failures: unknown[],
    tasks: Array<() => void | Promise<void>>
  ): Promise<void> => {
    const results = await Promise.allSettled(tasks.map((task) => Promise.resolve().then(task)))
    for (const result of results) {
      if (result.status === 'rejected') failures.push(result.reason)
    }
  }

  return {
    wss,
    ptyWss,
    ptyManager,
    handler,
    close: () => {
      closePromise ??= (async () => {
        const failures: unknown[] = []
        await settleCleanupPhase(failures, [
          () => handler.broadcastReconnectNotification(),
          () => ptyManager.closeAll(),
          () => ptyWss.close(),
          () => wss.close(),
          () => server.watcher?.stop(),
        ])
        await settleCleanupPhase(failures, [() => server.storeObservationFallback.dispose()])
        await settleCleanupPhase(failures, [() => server.rootContextNotificationBridge.dispose()])
        await settleCleanupPhase(failures, [() => server.projectionWorkRuntime.clear()])
        await settleCleanupPhase(failures, [() => server.planningRootServices.dispose()])
        await settleCleanupPhase(failures, [() => server.storeObservation.dispose()])
        await settleCleanupPhase(failures, [() => server.dataHomeObserver.dispose()])
        await settleCleanupPhase(failures, [() => server.toolCommandObservation.dispose()])
        await settleCleanupPhase(failures, [
          () => server.storeInvalidation.dispose(),
          () => server.projectInvalidation.dispose(),
        ])
        await settleCleanupPhase(failures, [() => server.observationEnvironment.dispose()])
        await settleCleanupPhase(failures, [
          () => server.projectRecoveryService.dispose(),
          () => server.translationCacheService.close(),
        ])
        if (failures.length > 0) {
          throw new AggregateError(failures, 'Server runtime teardown failed.')
        }
      })()
      return closePromise
    },
  }
}

/**
 * Running server instance
 */
export interface RunningServer {
  /** The URL where the server is running */
  url: string
  /** The actual port the server is running on */
  port: number
  /** The preferred port that was requested */
  preferredPort: number
  /** Close the server */
  close: () => Promise<void>
}

/**
 * Start the OpenSpec UI server with WebSocket support.
 * Automatically finds an available port if the preferred port is occupied.
 *
 * @param config - Server configuration
 * @param setupApp - Optional callback to configure the Hono app before starting (e.g., add static file middleware)
 * @returns Running server instance with actual port and close function
 */
export async function startServer(
  config: ServerConfig,
  setupApp?: (app: Hono) => void
): Promise<RunningServer> {
  const preferredPort = config.port ?? 3100

  // Find an available port
  const port = await findAvailablePort(preferredPort)

  // Create the server (HTTP app ready to accept requests)
  const server = createServer({ ...config, port })
  server.rootContextNotificationBridge.start()
  let runtimeClosing = false

  deferBackgroundTask(() => {
    if (runtimeClosing) return
    void server.observationEnvironment.acquireRoot(config.projectDir).catch((error: unknown) => {
      console.error('Launch-project observation failed:', error)
    })
    void server.dataHomeObserver.start().catch((error: unknown) => {
      console.error('OpenSpec data-home observation failed:', error)
    })
    server.storeObservationFallback.start()
  })

  // Allow caller to configure app (e.g., add static file middleware)
  if (setupApp) {
    setupApp(server.app)
  }

  // Start HTTP server immediately so proxy connections don't get ECONNREFUSED
  const httpServer = serve({
    fetch: server.app.fetch,
    port,
  })

  // Create WebSocket server.
  const wsServer = await createWebSocketServer(server, httpServer, {
    projectDir: config.projectDir,
  })
  let closePromise: Promise<void> | null = null

  const url = `http://localhost:${port}`

  return {
    url,
    port,
    preferredPort,
    close: () => {
      closePromise ??= (async () => {
        runtimeClosing = true
        const context = server.createContext()
        const modelResults = await Promise.allSettled([
          Promise.resolve().then(() => context.localModelAssetService.close()),
          Promise.resolve().then(() => context.localCt2ModelAssetService.close()),
          Promise.resolve().then(() => context.localLlamaModelAssetService.close()),
        ])
        const websocketResults = await Promise.allSettled([
          Promise.resolve().then(() => wsServer.close()),
        ])
        const httpResults = await Promise.allSettled([
          Promise.resolve().then(() => httpServer.close()),
        ])
        const failures = [...modelResults, ...websocketResults, ...httpResults].flatMap((result) =>
          result.status === 'rejected' ? [result.reason] : []
        )
        if (failures.length > 0) {
          throw new AggregateError(failures, 'Server shutdown failed.')
        }
      })()
      return closePromise
    },
  }
}

export { appRouter, type AppRouter, type Context } from './router.js'
