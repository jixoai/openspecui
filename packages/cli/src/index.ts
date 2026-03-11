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
  /** Enable realtime file watching (default: true) */
  enableWatcher?: boolean
  /** Extra CORS origins to allow for hosted app mode */
  corsOrigins?: string[]
}

export interface RunningServer {
  url: string
  port: number
  /** The preferred port that was requested */
  preferredPort: number
  close: () => Promise<void>
}

function getWebAssetsDir(): string {
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

    if (path.startsWith('/trpc')) {
      return next()
    }

    const filePath = join(webDir, path)
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const content = readFileSync(filePath)
      const ext = path.split('.').pop()
      const contentType = mimeTypes[ext || ''] || 'application/octet-stream'
      return c.body(content, 200, { 'Content-Type': contentType })
    }

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

export async function startServer(options: CLIOptions = {}): Promise<RunningServer> {
  const { projectDir = process.cwd(), port = 3100, enableWatcher = true, corsOrigins } = options

  const server = await serverStartServer(
    {
      projectDir,
      port,
      enableWatcher,
      corsOrigins,
    },
    setupStaticFiles
  )

  return server
}

export { createServer } from '@openspecui/server'
