#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { startServer } from './index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Read version from package.json
 */
function getVersion(): string {
  try {
    // In production, package.json is at ../package.json relative to dist/
    const pkgPath = join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

interface Args {
  port: number
  dir?: string
  open: boolean
  _: (string | number)[]
}

async function main(): Promise<void> {
  // pnpm sets INIT_CWD to the original working directory
  const originalCwd = process.env.INIT_CWD || process.cwd()

  const argv = (await yargs(hideBin(process.argv))
    .scriptName('openspecui')
    .usage('$0 [project-dir]', 'Visual interface for spec-driven development', (yargs) => {
      return yargs.positional('project-dir', {
        describe: 'Project directory containing openspec/',
        type: 'string',
      })
    })
    .option('port', {
      alias: 'p',
      describe: 'Port to run the server on',
      type: 'number',
      default: 3100,
    })
    .option('dir', {
      alias: 'd',
      describe: 'Project directory containing openspec/',
      type: 'string',
    })
    .option('open', {
      describe: 'Automatically open the browser',
      type: 'boolean',
      default: true,
    })
    .example('$0', 'Start in current directory')
    .example('$0 ./my-project', 'Start with specific project')
    .example('$0 -p 8080', 'Start on custom port')
    .example('$0 --dir=./my-project', 'Start with specific project')
    .example('$0 --no-open', 'Start without opening browser')
    .version(getVersion())
    .alias('v', 'version')
    .help()
    .alias('h', 'help')
    .parse()) as Args & { 'project-dir'?: string }

  // Priority: positional argument > --dir option > current directory
  // All paths are resolved relative to originalCwd (where pnpm was invoked)
  const rawDir = argv['project-dir'] || argv.dir || '.'
  const projectDir = resolve(originalCwd, rawDir)

  console.log(`
┌─────────────────────────────────────────────┐
│           OpenSpec UI                       │
│   Visual interface for spec-driven dev      │
└─────────────────────────────────────────────┘
`)

  console.log(`📁 Project: ${projectDir}`)
  console.log('')

  try {
    const server = await startServer({
      projectDir,
      port: argv.port,
      open: argv.open,
    })

    // 显示实际端口，如果和请求的不同则提示
    if (server.port !== server.preferredPort) {
      console.log(`⚠️  Port ${server.preferredPort} is in use, using ${server.port} instead`)
    }
    console.log(`✅ Server running at ${server.url}`)
    console.log('')

    if (argv.open) {
      const open = await import('open')
      await open.default(server.url)
      console.log('🌐 Browser opened')
    }

    console.log('')
    console.log('Press Ctrl+C to stop the server')

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n👋 Shutting down...')
      await server.close()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      await server.close()
      process.exit(0)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

main()
