import { serve } from '@hono/node-server'
import { ACPAgents, type ProviderRegistry } from '@openspecui/ai-provider'
import { createServer, createWebSocketServer } from '@openspecui/server'
import type { Context, Next } from 'hono'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer as createNetServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Check if a port is available by trying to listen on it
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createNetServer()
    server.once('error', () => {
      resolve(false)
    })
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    // Listen on 0.0.0.0 to detect ports in use on any interface
    server.listen(port, '0.0.0.0')
  })
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i
    if (await isPortAvailable(port)) {
      return port
    }
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`)
}

export interface CLIOptions {
  /** Project directory containing openspec/ */
  projectDir?: string
  /** Port to run the server on */
  port?: number
  /** Whether to automatically open the browser */
  open?: boolean
  /** AI provider registry */
  providers?: ProviderRegistry
  /** Enable realtime file watching (default: true) */
  enableWatcher?: boolean
}

export interface RunningServer {
  url: string
  port: number
  close: () => Promise<void>
}

/**
 * Get the path to the web assets directory
 */
function getWebAssetsDir(): string {
  // In development, web assets are in ../web/dist
  // In production (after build), they're in ./web
  const devPath = join(__dirname, '..', '..', 'web', 'dist')
  const prodPath = join(__dirname, '..', 'web')

  if (existsSync(prodPath)) {
    return prodPath
  }
  if (existsSync(devPath)) {
    return devPath
  }

  throw new Error('Web assets not found. Make sure to build the web package first.')
}

/**
 * Create default AI providers registry
 */
function createDefaultProviders(): ProviderRegistry {
  return {
    defaultAcp: 'claude-code',
    defaultApi: 'openai',
    providers: {
      // ACP providers (Agent Client Protocol)
      'claude-code': ACPAgents.claude,
      codex: ACPAgents.codex,
      iflow: ACPAgents.iflow,
      gemini: ACPAgents.gemini,
      // API providers (OpenAI-compatible)
      openai: {
        type: 'api',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'gpt-4o',
      },
      anthropic: {
        type: 'api',
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        model: 'claude-sonnet-4-20250514',
      },
    },
  }
}

/**
 * Start the OpenSpec UI server with WebSocket support for realtime updates
 */
export async function startServer(options: CLIOptions = {}): Promise<RunningServer> {
  const {
    projectDir = process.cwd(),
    port: preferredPort = 3100,
    providers = createDefaultProviders(),
    enableWatcher = true,
  } = options

  // Find an available port starting from the preferred port
  const port = await findAvailablePort(preferredPort)

  // Create the tRPC server with file watcher
  const server = createServer({
    projectDir,
    port,
    providers,
    enableWatcher,
  })

  // Get web assets directory
  const webDir = getWebAssetsDir()

  // Serve static web assets
  server.app.use('/*', async (c: Context, next: Next) => {
    const path = c.req.path === '/' ? '/index.html' : c.req.path

    // Skip API routes
    if (path.startsWith('/trpc')) {
      return next()
    }

    const filePath = join(webDir, path)

    // Check if file exists
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const content = readFileSync(filePath)
      const ext = path.split('.').pop()

      const mimeTypes: Record<string, string> = {
        html: 'text/html',
        js: 'application/javascript',
        css: 'text/css',
        json: 'application/json',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        woff: 'font/woff',
        woff2: 'font/woff2',
        ttf: 'font/ttf',
      }

      const contentType = mimeTypes[ext || ''] || 'application/octet-stream'
      return c.body(content, 200, { 'Content-Type': contentType })
    }

    // SPA fallback - serve index.html for non-file routes
    if (!path.includes('.')) {
      const indexPath = join(webDir, 'index.html')
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf-8')
        return c.html(content)
      }
    }

    return c.notFound()
  })

  // Start the HTTP server
  const httpServer = serve({
    fetch: server.app.fetch,
    port,
  })

  // Create WebSocket server for realtime subscriptions
  const wsServer = createWebSocketServer(server, httpServer)

  const url = `http://localhost:${port}`

  return {
    url,
    port,
    close: async () => {
      wsServer.close()
      httpServer.close()
    },
  }
}

export { ACPAgents, ProviderManager, type ProviderRegistry } from '@openspecui/ai-provider'
export { createServer } from '@openspecui/server'
