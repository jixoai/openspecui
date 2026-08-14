#!/usr/bin/env tsx
/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Parse the legacy multi-process development command through yargs.
 * 2. Bootstrap and supervise workspace processes through one Node-safe pnpm invocation.
 * 3. Preserve one shared project, port, and API environment across all development owners.
 * 4. Hide subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { spawn, spawnSync } from 'node:child_process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { findAvailablePort } from '../packages/server/src/port-utils.js'
import { terminateDevProcessTree } from './lib/dev-process-supervisor.js'
import { resolvePnpmInvocation } from './lib/pnpm-invocation.mjs'

function runBootstrap(command: string[], env: NodeJS.ProcessEnv, label: string): void {
  const invocation = resolvePnpmInvocation(command)
  const result = spawnSync(invocation.command, invocation.args, {
    stdio: 'inherit',
    env,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
  console.log(`Bootstrapped ${label}`)
}

function spawnPnpm(command: string[], env: NodeJS.ProcessEnv) {
  const invocation = resolvePnpmInvocation(command)
  return spawn(invocation.command, invocation.args, {
    stdio: 'inherit',
    env,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    windowsHide: true,
  })
}

const userArgs = await yargs(hideBin(process.argv).filter((argument) => argument !== '--'))
  .option('dir', {
    alias: 'd',
    type: 'string',
  })
  .option('port', {
    alias: 'p',
    type: 'number',
  })
  .strict()
  .help()
  .parse()

const preferred =
  userArgs.port ?? Number(process.env.OPENSPEC_SERVER_PORT || process.env.PORT || 3100)
const port = await findAvailablePort(preferred, 10)

const serverArgs = ['--filter', '@openspecui/server', 'dev', '--', '--port', String(port)]
if (userArgs.dir) {
  serverArgs.push('--dir', userArgs.dir)
}

const serverEnv = {
  ...process.env,
  PORT: String(port),
  OPENSPEC_SERVER_PORT: String(port),
  ...(userArgs.dir ? { OPENSPEC_PROJECT_DIR: userArgs.dir } : {}),
}

const apiUrl = process.env.VITE_API_URL || `http://localhost:${port}`
const webEnv = {
  ...process.env,
  VITE_API_URL: apiUrl,
  OPENSPEC_SERVER_PORT: String(port),
}

console.log(`Starting dev server on port ${port} (preferred ${preferred})`)
console.log(`VITE_API_URL=${apiUrl}`)
if (userArgs.dir) {
  console.log(`Project dir: ${userArgs.dir}`)
}

console.log('Bootstrapping workspace builds before starting dev processes...')
runBootstrap(['--filter', '@openspecui/core', 'build'], process.env, '@openspecui/core')
runBootstrap(['--filter', '@openspecui/search', 'build'], process.env, '@openspecui/search')
runBootstrap(
  ['--filter', '@openspecui/web', 'build:dist'],
  webEnv,
  '@openspecui/web dist -> openspecui/web'
)

const core = spawnPnpm(['--filter', '@openspecui/core', 'dev'], process.env)
const search = spawnPnpm(['--filter', '@openspecui/search', 'dev'], process.env)
const server = spawnPnpm(serverArgs, serverEnv)
const webDist = spawnPnpm(['--filter', '@openspecui/web', 'dev:dist'], webEnv)
const web = spawnPnpm(['--filter', '@openspecui/web', 'dev'], webEnv)

let isShuttingDown = false
const children = [core, search, server, webDist, web]
const shutdown = async (code?: number) => {
  if (isShuttingDown) return
  isShuttingDown = true
  const results = await Promise.allSettled(children.map(terminateDevProcessTree))
  for (const result of results) {
    if (result.status === 'rejected') console.error(result.reason)
  }
  if (code !== undefined) process.exitCode = code
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

core.on('exit', (code) => {
  console.log(`core exited with code ${code}`)
  void shutdown(code ?? undefined)
})

search.on('exit', (code) => {
  console.log(`search exited with code ${code}`)
  void shutdown(code ?? undefined)
})

server.on('exit', (code) => {
  console.log(`server exited with code ${code}`)
  void shutdown(code ?? undefined)
})

webDist.on('exit', (code) => {
  console.log(`web dist exited with code ${code}`)
  void shutdown(code ?? undefined)
})

web.on('exit', (code) => {
  console.log(`web exited with code ${code}`)
  void shutdown(code ?? undefined)
})
