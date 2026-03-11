#!/usr/bin/env node

import { ConfigManager } from '@openspecui/core'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import type { ExportFormat } from './export.js'
import { exportStaticSite } from './export.js'
import { buildHostedAppLaunchUrl, resolveEffectiveHostedAppBaseUrl } from './hosted-app.js'
import { startServer } from './index.js'
import {
  resolveLocalHostedAppWorkspace,
  shouldUseLocalHostedAppDevMode,
  startLocalHostedAppDev,
  type LocalHostedAppDevSession,
} from './local-hosted-app-dev.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_HOSTED_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:3000']

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function buildHostedCorsOrigins(baseUrl: string): string[] {
  const origins = new Set(DEFAULT_HOSTED_CORS_ORIGINS)
  origins.add(new URL(baseUrl).origin)
  return [...origins]
}

async function main(): Promise<void> {
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
          .option('app', {
            describe:
              'Open the hosted app at the official or custom base URL. Supports --app and --app=<baseUrl>.',
            type: 'string',
          })
      },
      async (argv) => {
        const rawDir = (argv['project-dir'] as string | undefined) || argv.dir || '.'
        const projectDir = resolve(originalCwd, rawDir)
        const useHostedApp = argv.app !== undefined

        console.log(`
┌─────────────────────────────────────────────┐
│           OpenSpec UI                       │
│   Visual interface for spec-driven dev      │
└─────────────────────────────────────────────┘
`)

        console.log(`📁 Project: ${projectDir}`)
        console.log('')

        let server: Awaited<ReturnType<typeof startServer>> | null = null
        let localHostedApp: LocalHostedAppDevSession | null = null

        try {
          const localVersion = getVersion()
          let hostedBaseUrl: string | null = null

          if (useHostedApp) {
            const workspace = resolveLocalHostedAppWorkspace(__dirname)
            const localHostedAppMode = { appValue: argv.app, workspace }

            if (shouldUseLocalHostedAppDevMode(localHostedAppMode)) {
              localHostedApp = await startLocalHostedAppDev({
                workspace: localHostedAppMode.workspace,
                resolvedVersion: localVersion,
              })
              hostedBaseUrl = localHostedApp.baseUrl
            } else {
              const configManager = new ConfigManager(projectDir)
              const config = await configManager.readConfig()
              hostedBaseUrl = resolveEffectiveHostedAppBaseUrl({
                override: argv.app,
                configured: config.appBaseUrl,
              })
            }
          }

          server = await startServer({
            projectDir,
            port: argv.port,
            open: false,
            corsOrigins: hostedBaseUrl ? buildHostedCorsOrigins(hostedBaseUrl) : undefined,
          })

          if (server.port !== server.preferredPort) {
            console.log(`⚠️  Port ${server.preferredPort} is in use, using ${server.port} instead`)
          }
          console.log(`✅ Server running at ${server.url}`)

          let browserUrl = server.url
          if (useHostedApp && hostedBaseUrl) {
            browserUrl = buildHostedAppLaunchUrl({
              baseUrl: hostedBaseUrl,
              apiBaseUrl: server.url,
            })

            console.log(`🌐 Hosted app base: ${hostedBaseUrl}`)
            console.log(`🔗 Hosted URL: ${browserUrl}`)
          }

          console.log('')

          if (argv.open) {
            const open = await import('open')
            await open.default(browserUrl)
            console.log(useHostedApp ? '🌐 Hosted app opened' : '🌐 Browser opened')
          }

          console.log('')
          console.log('Press Ctrl+C to stop the server')

          process.on('SIGINT', async () => {
            console.log('\n\n👋 Shutting down...')
            await localHostedApp?.close()
            await server?.close()
            process.exit(0)
          })

          process.on('SIGTERM', async () => {
            await localHostedApp?.close()
            await server?.close()
            process.exit(0)
          })
        } catch (error) {
          await localHostedApp?.close()
          await server?.close()
          console.error('❌ Failed to start server:', error)
          process.exit(1)
        }
      }
    )
    .command(
      'export',
      'Export OpenSpec project as static website or JSON data',
      (yargs) => {
        return yargs
          .option('output', {
            alias: 'o',
            describe: 'Output directory for export',
            type: 'string',
            demandOption: true,
          })
          .option('format', {
            alias: 'f',
            describe: 'Export format',
            type: 'string',
            choices: ['html', 'json'] as const,
            default: 'html',
          })
          .option('dir', {
            alias: 'd',
            describe: 'Project directory containing openspec/',
            type: 'string',
          })
          .option('base-path', {
            alias: 'b',
            describe: 'Base path for deployment (e.g., /docs/ or ./)',
            type: 'string',
          })
          .option('clean', {
            alias: 'c',
            describe: 'Clean output directory before export',
            type: 'boolean',
          })
          .option('open', {
            describe: 'Start preview server and open in browser after export',
            type: 'boolean',
          })
          .option('preview-port', {
            describe: 'Port for the preview server (used with --open)',
            type: 'number',
          })
          .option('port', {
            alias: 'p',
            describe: 'Alias of --open --preview-port <port>',
            type: 'number',
          })
          .option('preview-host', {
            describe: 'Host for the preview server (used with --open)',
            type: 'string',
          })
      },
      async (argv) => {
        const projectDir = resolve(originalCwd, argv.dir || '.')
        const outputDir = resolve(originalCwd, argv.output)
        const previewPort = argv.port ?? argv['preview-port']
        const shouldOpen = argv.open || argv.port !== undefined

        try {
          await exportStaticSite({
            projectDir,
            outputDir,
            format: argv.format as ExportFormat,
            basePath: argv['base-path'],
            clean: argv.clean,
            open: shouldOpen,
            previewPort,
            previewHost: argv['preview-host'],
          })

          if (!shouldOpen) {
            process.exit(0)
          }
        } catch (error) {
          console.error('❌ Export failed:', error)
          process.exit(1)
        }
      }
    )
    .help()
    .alias('help', 'h')
    .version(getVersion())
    .alias('version', 'v')
    .strict()
    .parseAsync()
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
