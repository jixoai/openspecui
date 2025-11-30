import { resolve } from 'node:path'
import { serve } from '@hono/node-server'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createServer, createWebSocketServer } from './server.js'

interface Args {
  dir: string
  port: number
}

/**
 * Parse CLI arguments using yargs
 * Paths are resolved relative to INIT_CWD (original working directory)
 */
async function parseArgs(): Promise<{ projectDir: string; port: number }> {
  // pnpm sets INIT_CWD to the original working directory
  const originalCwd = process.env.INIT_CWD || process.cwd()

  // Filter out '--' separator that pnpm/tsx adds
  const args = hideBin(process.argv).filter((arg) => arg !== '--')

  const argv = (await yargs(args)
    .option('dir', {
      alias: 'd',
      describe: 'Project directory containing openspec/',
      type: 'string',
      default: process.env.OPENSPEC_PROJECT_DIR ?? '.',
    })
    .option('port', {
      alias: 'p',
      describe: 'Port to run the server on',
      type: 'number',
      default: parseInt(process.env.PORT ?? '3100', 10),
    })
    .help()
    .parse()) as Args

  return {
    projectDir: resolve(originalCwd, argv.dir),
    port: argv.port,
  }
}

const { projectDir, port } = await parseArgs()

const server = createServer({ projectDir, port, enableWatcher: true })

console.log(`OpenSpecUI server starting...`)
console.log(`Project directory: ${projectDir}`)
console.log(`Server: http://localhost:${port}`)
console.log(`WebSocket: ws://localhost:${port}/trpc`)
console.log(`File watcher: enabled`)

const httpServer = serve({
  fetch: server.app.fetch,
  port,
})

// Enable WebSocket for realtime subscriptions
// This also initializes the reactive file watcher for the project directory
await createWebSocketServer(server, httpServer, { projectDir })
