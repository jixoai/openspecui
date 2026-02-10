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
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { WebSocketServer } from 'ws'
import {
  OpenSpecAdapter,
  OpenSpecWatcher,
  ConfigManager,
  CliExecutor,
  OpsxKernel,
  initWatcherPool,
  isWatcherPoolInitialized,
} from '@openspecui/core'
import { appRouter, type Context } from './router.js'
import { findAvailablePort } from './port-utils.js'
import { PtyManager } from './pty-manager.js'
import { createPtyWebSocketHandler } from './pty-websocket.js'

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
}

/**
 * Create an OpenSpecUI HTTP server with optional WebSocket support
 */
export function createServer(config: ServerConfig & { kernel: OpsxKernel }) {
  const adapter = new OpenSpecAdapter(config.projectDir)
  const configManager = new ConfigManager(config.projectDir)
  const cliExecutor = new CliExecutor(configManager, config.projectDir)
  const kernel = config.kernel

  // Create file watcher if enabled
  const watcher = config.enableWatcher !== false ? new OpenSpecWatcher(config.projectDir) : undefined

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
    return c.json({
      status: 'ok',
      projectDir: config.projectDir,
      watcherEnabled: !!watcher,
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
        cliExecutor,
        kernel,
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
    cliExecutor,
    kernel,
    watcher,
    projectDir: config.projectDir,
  })

  return {
    app,
    adapter,
    configManager,
    cliExecutor,
    kernel,
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
  // Initialize reactive file system watcher for the project directory
  // This enables real-time updates when files are created/modified/deleted
  if (!isWatcherPoolInitialized()) {
    await initWatcherPool(config.projectDir)
  }

  // tRPC WebSocket server
  const wss = new WebSocketServer({ noServer: true })

  const handler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: server.createContext,
  })

  // PTY WebSocket server
  const ptyManager = new PtyManager(config.projectDir)
  const ptyWss = new WebSocketServer({ noServer: true })
  const ptyHandler = createPtyWebSocketHandler(ptyManager)
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

  // Initialize reactive file system watcher (needed for subscriptions)
  await initWatcherPool(config.projectDir)

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

  // Create WebSocket server (watcher pool already initialized above)
  const wsServer = await createWebSocketServer(server, httpServer, {
    projectDir: config.projectDir,
  })

  const url = `http://localhost:${port}`

  // Warmup kernel in background — subscriptions will push data as it arrives
  kernel.warmup().catch((err) => {
    console.error('Kernel warmup failed:', err)
  })

  return {
    url,
    port,
    preferredPort,
    close: async () => {
      kernel.dispose()
      wsServer.close()
      httpServer.close()
    },
  }
}

export { appRouter, type AppRouter, type Context } from './router.js'
