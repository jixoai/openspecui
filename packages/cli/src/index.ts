import { ACPAgents, type ProviderRegistry } from '@openspecui/ai-provider'
import { startServer as serverStartServer } from '@openspecui/server'
import type { Hono } from 'hono'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
  /** The preferred port that was requested */
  preferredPort: number
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
 * Setup static file serving middleware for the Hono app
 */
function setupStaticFiles(app: Hono): void {
  const webDir = getWebAssetsDir()

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

  app.use('/*', async (c, next) => {
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
}

/**
 * Start the OpenSpec UI server with WebSocket support for realtime updates.
 * Includes static file serving for the web UI.
 */
export async function startServer(options: CLIOptions = {}): Promise<RunningServer> {
  const {
    projectDir = process.cwd(),
    port = 3100,
    providers = createDefaultProviders(),
    enableWatcher = true,
  } = options

  const server = await serverStartServer(
    {
      projectDir,
      port,
      providers,
      enableWatcher,
    },
    setupStaticFiles
  )

  return server
}

export { ACPAgents, ProviderManager, type ProviderRegistry } from '@openspecui/ai-provider'
export { createServer } from '@openspecui/server'
