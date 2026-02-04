#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { exportStaticSite } from './export.js'
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

async function main(): Promise<void> {
  // pnpm sets INIT_CWD to the original working directory
  const originalCwd = process.env.INIT_CWD || process.cwd()

  await yargs(hideBin(process.argv))
    .scriptName('openspecui')
    .command(
      ['$0 [project-dir]', 'start [project-dir]'],
      'Start the OpenSpec UI server',
      (yargs) => {
        return yargs
          .positional('project-dir', {
            describe: 'Project directory containing openspec/',
            type: 'string',
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
      },
      async (argv) => {
        const rawDir = (argv['project-dir'] as string | undefined) || argv.dir || '.'
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
    )
    .command(
      'export',
      'Export OpenSpec UI as a static website',
      (yargs) => {
        return yargs
          .option('output', {
            alias: 'o',
            describe: 'Output directory for static export',
            type: 'string',
            demandOption: true,
          })
          .option('dir', {
            alias: 'd',
            describe: 'Project directory containing openspec/',
            type: 'string',
          })
          .option('base-path', {
            describe: 'Base path for deployment (e.g., /docs/)',
            type: 'string',
            default: '/',
          })
          .option('clean', {
            describe: 'Clean output directory before export',
            type: 'boolean',
            default: false,
          })
          .option('open', {
            describe: 'Open exported site in browser after export',
            type: 'boolean',
            default: false,
          })
      },
      async (argv) => {
        const projectDir = resolve(originalCwd, argv.dir || '.')
        const outputDir = argv.output

        // Normalize base path: ensure it starts and ends with /
        let basePath = argv['base-path'] || '/'
        if (basePath !== '/') {
          // Ensure starts with /
          if (!basePath.startsWith('/')) {
            basePath = '/' + basePath
          }
          // Ensure ends with /
          if (!basePath.endsWith('/')) {
            basePath = basePath + '/'
          }
        }

        try {
          await exportStaticSite({
            projectDir,
            outputDir,
            basePath,
            clean: argv.clean,
          })

          if (argv.open) {
            const open = await import('open')
            const indexPath = resolve(outputDir, 'index.html')
            await open.default(indexPath)
            console.log('🌐 Browser opened')
          }

          process.exit(0)
        } catch (error) {
          console.error('❌ Export failed:', error)
          process.exit(1)
        }
      }
    )
    .example('$0', 'Start server in current directory')
    .example('$0 ./my-project', 'Start server with specific project')
    .example('$0 -p 8080', 'Start server on custom port')
    .example('$0 export -o ./dist', 'Export to ./dist directory')
    .example('$0 export --output ./public', 'Export to ./public directory')
    .example('$0 export -o ./dist --base-path=/docs/', 'Export for subdirectory deployment')
    .example('$0 export -o ./dist --clean', 'Clean output directory before export')
    .version(getVersion())
    .alias('v', 'version')
    .help()
    .alias('h', 'help')
    .parse()
}

main()
