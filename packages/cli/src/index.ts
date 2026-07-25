/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Start the embedded Server with one resolved Project Web/preview asset root.
 * 2. Resolve one Access Gate credential and deliver it to Server, private browser, and worktree children.
 * 3. Keep inherited child credentials silent while coordinating deterministic runtime teardown.
 * 4. Bootstrap only worker-thread payloads owned by the worktree Server protocol.
 *
 * Original request (2026-07-15): "新增一个 --auth 或者 --password。"
 * Delivery correction (2026-07-24): one resolved credential must reach Server and Project Web.
 */
import {
  generateAccessGateCredential,
  normalizeAccessGatePassword,
  type AccessGateCredential,
} from '@openspecui/core'
import {
  startServer as serverStartServer,
  type GitWorktreeHandoffService,
} from '@openspecui/server'
import type { Hono } from 'hono'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { getWebAssetsDirCandidates } from './web-assets.js'
import {
  createWorktreeInstanceManager,
  type WorktreeInstanceManager,
} from './worktree-instance-manager.js'
import { createParentPortWorktreeHandoffService } from './worktree-server-worker-handoff.js'
import {
  buildWorktreeServerStartOptions,
  normalizeSourceBootstrapEntryUrl,
  readWorktreeServerWorkerData,
  toWorkerErrorMessage,
  type CreateWorktreeServerWorkerOptions,
  type WorktreeServerWorkerData,
} from './worktree-server-worker.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOURCE_BOOTSTRAP_ENTRY_URL_KEY = '__openspecuiEntryUrl'

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
  /** Physical Web asset root used by both the public shell and built file-preview entrypoints. */
  webAssetsDir?: string
  /**
   * Generate a high-entropy Bearer credential and protect the whole backend with it. Prints the
   * complete Authorization header once. Mutually exclusive with `password`.
   */
  auth?: boolean
  /**
   * Normalize an operator secret into the same Bearer Access Gate. Prefers a hidden prompt when no
   * inline value is given. Mutually exclusive with `auth`.
   */
  password?: string | true
  /** Private worktree bootstrap Gate. Child runtimes must not print or relay this credential. */
  accessGateCredential?: AccessGateCredential
  /** Receives the resolved secret for a private browser fragment; never persist or log it. */
  onBrowserLaunchCredential?: (credential: string) => void
  /** Optional handoff owner. Worker runtimes use this to delegate nested switches to their parent. */
  gitWorktreeHandoff?: GitWorktreeHandoffService
}

export interface RunningServer {
  url: string
  port: number
  /** The preferred port that was requested */
  preferredPort: number
  close: () => Promise<void>
}

interface SourceBootstrapWorkerData extends WorktreeServerWorkerData {
  [SOURCE_BOOTSTRAP_ENTRY_URL_KEY]: string
}

function isSourceEntryUrl(entryUrl: string): boolean {
  return new URL(entryUrl).pathname.endsWith('.ts')
}

function buildSourceBootstrapWorkerData(
  options: CreateWorktreeServerWorkerOptions
): SourceBootstrapWorkerData {
  return {
    ...options.workerData,
    [SOURCE_BOOTSTRAP_ENTRY_URL_KEY]: normalizeSourceBootstrapEntryUrl(import.meta.url),
  }
}

function buildSourceBootstrapWorkerSource(): string {
  return `
const { parentPort, workerData } = require('node:worker_threads')

;(async () => {
  const entryUrl = workerData.${SOURCE_BOOTSTRAP_ENTRY_URL_KEY}
  if (typeof entryUrl !== 'string') {
    throw new Error('Invalid worktree source bootstrap entry URL.')
  }
  const { tsImport } = await import('tsx/esm/api')
  await tsImport(entryUrl, { parentURL: entryUrl })
})().catch((error) => {
  parentPort?.postMessage(
    error instanceof Error
      ? { type: 'error', message: error.message, stack: error.stack }
      : { type: 'error', message: String(error) }
  )
  process.exit(1)
})
`
}

export function createWorktreeServerWorker(options: CreateWorktreeServerWorkerOptions): Worker {
  if (isSourceEntryUrl(import.meta.url)) {
    return new Worker(buildSourceBootstrapWorkerSource(), {
      eval: true,
      execArgv: options.execArgv,
      workerData: buildSourceBootstrapWorkerData(options),
    })
  }

  return new Worker(new URL(import.meta.url), {
    execArgv: options.execArgv,
    workerData: options.workerData,
  })
}

function getWebAssetsDir(configuredDir?: string): string {
  const candidates = configuredDir ? [resolve(configuredDir)] : getWebAssetsDirCandidates(__dirname)
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate
    }
  }

  throw new Error('Web assets not found. Make sure to build the web package first.')
}

function setupStaticFiles(app: Hono, webDir: string): void {
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

/**
 * Resolve the whole-backend Access Gate credential from `--auth` / `--password`.
 *
 * `--auth` generates a high-entropy Bearer credential; `--password` (with an inline value) normalizes
 * an operator secret into the same Bearer form. The two flags are mutually exclusive. A `--password`
 * with no inline value reads a hidden prompt from stdin when the process is an interactive TTY, and
 * rejects in non-interactive (worker) runtimes where prompting is impossible.
 */
async function resolveAccessGateCredential(
  options: CLIOptions
): Promise<AccessGateCredential | null> {
  if (options.accessGateCredential && (options.auth || options.password !== undefined)) {
    throw new Error('An inherited Access Gate cannot be combined with --auth or --password.')
  }
  if (options.accessGateCredential) return options.accessGateCredential
  if (options.auth && options.password !== undefined) {
    throw new Error(
      '--auth and --password are mutually exclusive. Choose one Access Gate credential.'
    )
  }
  if (options.auth) {
    return generateAccessGateCredential()
  }
  if (options.password !== undefined) {
    if (options.password === true) {
      // No inline value: read a hidden prompt from an interactive TTY.
      const secret = await promptHiddenPassword()
      if (!secret) {
        throw new Error('--password requires a non-empty secret.')
      }
      return normalizeAccessGatePassword(secret)
    }
    console.warn(
      'Warning: an inline --password can leak through shell history and process inspection. ' +
        'Prefer --auth for a generated credential, or pass the secret through a secure mechanism.'
    )
    return normalizeAccessGatePassword(options.password)
  }
  return null
}

/** Read a hidden password from an interactive TTY via readline. Rejects in non-TTY runtimes. */
async function promptHiddenPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error(
      '--password without an inline value requires an interactive terminal. ' +
        'Pass --password=<secret> instead, or use --auth for a generated credential.'
    )
  }
  const { createInterface } = await import('node:readline')
  const rl = createInterface({ input: process.stdin, output: undefined })
  // Mute output so the typed secret is not echoed to the terminal.
  const writeToStdout = process.stdout.write.bind(process.stdout)
  process.stdout.write = (() => true) as never
  try {
    process.stderr.write('Enter Access Gate password: ')
    const secret = await new Promise<string>((resolve) => {
      rl.question('', (answer) => resolve(answer))
    })
    process.stderr.write('\n')
    return secret
  } finally {
    process.stdout.write = writeToStdout
    rl.close()
  }
}

/** Print the Access Gate credential once so the operator can distribute the Authorization header. */
function printAccessGateBanner(credential: AccessGateCredential): void {
  console.log('')
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  Backend Access Gate enabled                                ║')
  console.log('║  Every client must send this header on every transport:     ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  Authorization: ${credential.authorizationHeader}`.padEnd(63) + '║')
  console.log(
    '║  Credential fingerprint (safe to log): ' + credential.fingerprint + ''.padEnd(16) + '║'
  )
  console.log('║  Non-loopback deployments require HTTPS/WSS.                ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log('')
}

export async function startServer(options: CLIOptions = {}): Promise<RunningServer> {
  const { projectDir = process.cwd(), port = 3100, enableWatcher = true, corsOrigins } = options
  const webAssetsDir = getWebAssetsDir(options.webAssetsDir)
  let worktreeManager: WorktreeInstanceManager | null = null
  const gitWorktreeHandoff = options.gitWorktreeHandoff ?? {
    ensureWorktreeServer: async ({ targetPath }: { targetPath: string }) => {
      if (!worktreeManager) {
        throw new Error('Worktree handoff is not ready yet.')
      }
      return worktreeManager.ensureWorktreeServer({ targetPath })
    },
  }

  // Resolve the whole-backend Access Gate credential from --auth or --password (mutually exclusive).
  const accessGate = await resolveAccessGateCredential(options)

  const server = await serverStartServer(
    {
      projectDir,
      port,
      enableWatcher,
      corsOrigins,
      previewAssetsDir: webAssetsDir,
      gitWorktreeHandoff,
      accessGate,
    },
    (app) => setupStaticFiles(app, webAssetsDir)
  )

  if (accessGate && !options.accessGateCredential) {
    printAccessGateBanner(accessGate)
    options.onBrowserLaunchCredential?.(accessGate.credential)
  }

  if (!options.gitWorktreeHandoff) {
    worktreeManager = createWorktreeInstanceManager({
      currentProjectDir: projectDir,
      currentServerUrl: server.url,
      runtimeDir: __dirname,
      createWorker: createWorktreeServerWorker,
      accessGateCredential: accessGate,
    })
  }

  return {
    ...server,
    close: async () => {
      await worktreeManager?.close()
      await server.close()
    },
  }
}

async function runWorktreeServerWorker(
  data: WorktreeServerWorkerData,
  port: NonNullable<typeof parentPort>
): Promise<void> {
  const server = await startServer({
    ...buildWorktreeServerStartOptions(data),
    gitWorktreeHandoff: createParentPortWorktreeHandoffService(port),
  })
  port.postMessage({ type: 'ready', serverUrl: server.url })
  port.on('message', (message: unknown) => {
    if (message === 'close') {
      void server.close().finally(() => {
        process.exit(0)
      })
    }
  })
}

if (!isMainThread) {
  Promise.resolve()
    .then(async () => {
      const data = readWorktreeServerWorkerData(workerData)
      if (!data) return
      if (!parentPort) throw new Error('Worktree server worker has no parent port.')
      await runWorktreeServerWorker(data, parentPort)
    })
    .catch((error) => {
      parentPort?.postMessage(toWorkerErrorMessage(error))
      process.exit(1)
    })
}

export { createServer } from '@openspecui/server'
