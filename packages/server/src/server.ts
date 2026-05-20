/**
 * OpenSpecUI HTTP/WebSocket server.
 *
 * Provides tRPC endpoints for:
 * - Dashboard data and project status
 * - Spec CRUD operations
 * - Change proposal management
 * - AI-assisted operations (review, translate, suggest)
 * - Realtime file change subscriptions via WebSocket
 *
 * @module server
 */

import { serve } from '@hono/node-server'
import {
  buildBackendHealthPayload,
  CliExecutor,
  ConfigManager,
  CustomSoundHashSchema,
  GlobalSettingsManager,
  initWatcherPool,
  isWatcherPoolInitialized,
  NotificationPublishInputSchema,
  OpenSpecAdapter,
  OpenSpecWatcher,
  OpsxKernel,
} from '@openspecui/core'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
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

import { CustomSoundService } from './custom-sound-service.js'
import { DashboardOverviewService } from './dashboard-overview-service.js'
import { loadDashboardOverview } from './dashboard-overview.js'
import { DocumentService } from './document-service.js'
import { buildEntityReadOptions } from './entity-read-options.js'
import { FilePreviewService } from './file-preview-service.js'
import { createHookRuntime } from './hook-runtime.js'
import { NotificationService } from './notification-service.js'
import { findAvailablePort } from './port-utils.js'
import { ProjectRecoveryService } from './project-recovery-service.js'
import { PtyManager } from './pty-manager.js'
import { createPtyWebSocketHandler } from './pty-websocket.js'
import { appRouter, type Context, type GitWorktreeHandoffService } from './router.js'
import { SearchService } from './search-service.js'
import { createRuntimeSqliteTranslationCacheAdapter } from './translation-cache-adapter.js'
import { getDefaultTranslationCacheDatabasePath } from './translation-cache-path.js'
import { TranslationCacheService } from './translation-cache-service.js'
import { WorkflowInvocationService } from './workflow-invocation-service.js'

function buildEmbeddedUiUrlForPort(port: number): string {
  return `http://localhost:${port}`
}

function initializeWatcherPoolInBackground(projectDir: string): void {
  void initWatcherPool(projectDir).catch((err) => {
    console.error('Watcher pool initialization failed:', err)
  })
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
  /** Directory containing built preview entry assets */
  previewAssetsDir?: string
  /** Optional worktree handoff provider for runtimes that can spawn sibling instances */
  gitWorktreeHandoff?: GitWorktreeHandoffService
}

/**
 * Create an OpenSpecUI HTTP server with optional WebSocket support
 */
export function createServer(config: ServerConfig & { kernel: OpsxKernel }) {
  const adapter = new OpenSpecAdapter(config.projectDir)
  const configManager = new ConfigManager(config.projectDir)
  const globalSettingsManager = new GlobalSettingsManager()
  const cliExecutor = new CliExecutor(configManager, config.projectDir)
  const kernel = config.kernel
  const hookRuntime = createHookRuntime(config.projectDir)
  const documentService = new DocumentService(config.projectDir, adapter, hookRuntime)
  const filePreviewService = new FilePreviewService(
    config.projectDir,
    config.previewAssetsDir ?? join(__dirname, '..', '..', 'web', 'dist')
  )
  const workflowInvocationService = new WorkflowInvocationService({
    projectDir: config.projectDir,
    hookRuntime,
    executeCli: (args) => cliExecutor.execute(args),
  })
  const notificationService = new NotificationService()
  const customSoundService = new CustomSoundService()
  let translationCacheAdapterPromise: ReturnType<
    typeof createRuntimeSqliteTranslationCacheAdapter
  > | null = null
  const getTranslationCacheAdapter = () => {
    translationCacheAdapterPromise ??= createRuntimeSqliteTranslationCacheAdapter(
      getDefaultTranslationCacheDatabasePath()
    )
    return translationCacheAdapterPromise
  }
  const translationCacheService = new TranslationCacheService({
    configManager,
    globalSettingsManager,
    adapter: {
      databasePath: getDefaultTranslationCacheDatabasePath(),
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

  // Create file watcher if enabled
  const watcher =
    config.enableWatcher !== false ? new OpenSpecWatcher(config.projectDir) : undefined
  const entityReadOptionsContext = { adapter, kernel }
  const searchService = new SearchService(
    adapter,
    watcher,
    undefined,
    documentService,
    (stage, id) => buildEntityReadOptions(entityReadOptionsContext, stage, id)
  )
  const dashboardOverviewService = new DashboardOverviewService(
    (reason) =>
      loadDashboardOverview(
        {
          adapter,
          configManager,
          projectDir: config.projectDir,
        },
        reason
      ),
    watcher
  )
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

  // Health check
  app.get('/api/health', (c) => {
    return c.json(
      buildBackendHealthPayload({
        projectDir: config.projectDir,
        projectName: basename(config.projectDir) || config.projectDir,
        watcherEnabled: !!watcher,
        openspecuiVersion: SERVER_PACKAGE_VERSION,
        embeddedUiUrl: buildEmbeddedUiUrlForPort(config.port ?? 3100),
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
    const asset = filePreviewService.readPreviewRequest(hash, requestPath)
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
        adapter,
        configManager,
        documentService,
        cliExecutor,
        kernel,
        workflowInvocationService,
        searchService,
        dashboardOverviewService,
        projectRecoveryService,
        notificationService,
        customSoundService,
        globalSettingsManager,
        translationCacheService,
        filePreviewService,
        gitWorktreeHandoff: config.gitWorktreeHandoff,
        watcher,
        projectDir: config.projectDir,
      }),
    })
    return response
  })

  // Create context factory for WebSocket connections
  const createContext = (): Context => ({
    adapter,
    configManager,
    documentService,
    cliExecutor,
    kernel,
    workflowInvocationService,
    searchService,
    dashboardOverviewService,
    projectRecoveryService,
    notificationService,
    customSoundService,
    globalSettingsManager,
    translationCacheService,
    filePreviewService,
    gitWorktreeHandoff: config.gitWorktreeHandoff,
    watcher,
    projectDir: config.projectDir,
  })

  return {
    app,
    adapter,
    configManager,
    documentService,
    cliExecutor,
    kernel,
    workflowInvocationService,
    searchService,
    dashboardOverviewService,
    projectRecoveryService,
    notificationService,
    customSoundService,
    globalSettingsManager,
    translationCacheService,
    filePreviewService,
    hookRuntime,
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
  if (!isWatcherPoolInitialized()) {
    deferBackgroundTask(() => initializeWatcherPoolInBackground(config.projectDir))
  }

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
  const ptyManager = new PtyManager(config.projectDir)
  const ptyWss = new WebSocketServer({ noServer: true })
  const ptyHandler = createPtyWebSocketHandler(ptyManager, server.notificationService)
  ptyWss.on('connection', ptyHandler)

  // Handle upgrade requests - route by URL path
  httpServer.on('upgrade', (...args: unknown[]) => {
    const [request, socket, head] = args as [{ url?: string }, unknown, Buffer]
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
        socket as Parameters<typeof wss.handleUpgrade>[1],
        head,
        (ws) => {
          wss.emit('connection', ws, request)
        }
      )
    }
  })

  // Start legacy file watcher if available
  server.watcher?.start()

  return {
    wss,
    ptyWss,
    ptyManager,
    handler,
    close: () => {
      handler.broadcastReconnectNotification()
      ptyManager.closeAll()
      ptyWss.close()
      wss.close()
      server.watcher?.stop()
      server.searchService.dispose().catch(() => {})
      server.dashboardOverviewService.dispose()
      server.projectRecoveryService.dispose()
      server.translationCacheService.close()
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

  // Create kernel (warmup deferred until after server is listening)
  const configManager = new ConfigManager(config.projectDir)
  const cliExecutor = new CliExecutor(configManager, config.projectDir)
  const kernel = new OpsxKernel(config.projectDir, cliExecutor)

  deferBackgroundTask(() => initializeWatcherPoolInBackground(config.projectDir))

  // Create the server (HTTP app ready to accept requests)
  const server = createServer({ ...config, port, kernel })

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

  const url = `http://localhost:${port}`

  // Warmup kernel in background — subscriptions will push data as it arrives
  deferBackgroundTask(() => {
    kernel.warmup().catch((err) => {
      console.error('Kernel warmup failed:', err)
    })
    server.searchService.init().catch((err) => {
      console.error('Search service warmup failed:', err)
    })
    server.dashboardOverviewService.init().catch((err) => {
      console.error('Dashboard overview warmup failed:', err)
    })
  })

  return {
    url,
    port,
    preferredPort,
    close: async () => {
      kernel.dispose()
      await server.hookRuntime.dispose()
      server.translationCacheService.close()
      wsServer.close()
      httpServer.close()
    },
  }
}

export { appRouter, type AppRouter, type Context } from './router.js'
