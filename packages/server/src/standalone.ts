import { resolve } from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { startServer } from './server.js'

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

const { projectDir, port: preferredPort } = await parseArgs()

console.log(`OpenSpecUI server starting...`)
console.log(`Project directory: ${projectDir}`)

const server = await startServer({
  projectDir,
  port: preferredPort,
  enableWatcher: true,
})

if (server.port !== server.preferredPort) {
  console.log(`⚠️  Port ${server.preferredPort} is in use, using ${server.port} instead`)
}
console.log(`Server: ${server.url}`)
console.log(`WebSocket: ws://localhost:${server.port}/trpc`)
console.log(`File watcher: enabled`)
