#!/usr/bin/env tsx
import { spawn, spawnSync } from 'node:child_process'
import { findAvailablePort } from '../packages/server/src/port-utils.js'

type CliOptions = {
  dir?: string
  port?: number
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dir' || arg === '-d') {
      opts.dir = argv[++i]
    } else if (arg === '--port' || arg === '-p') {
      const val = argv[++i]
      if (val) opts.port = Number(val)
    }
  }
  return opts
}

function runBootstrap(command: string[], env: NodeJS.ProcessEnv, label: string): void {
  const result = spawnSync('pnpm', command, {
    stdio: 'inherit',
    env,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
  console.log(`Bootstrapped ${label}`)
}

const userArgs = parseArgs(process.argv.slice(2))

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

const core = spawn('pnpm', ['--filter', '@openspecui/core', 'dev'], {
  stdio: 'inherit',
  env: process.env,
})
const search = spawn('pnpm', ['--filter', '@openspecui/search', 'dev'], {
  stdio: 'inherit',
  env: process.env,
})
const server = spawn('pnpm', serverArgs, { stdio: 'inherit', env: serverEnv })
const webDist = spawn('pnpm', ['--filter', '@openspecui/web', 'dev:dist'], {
  stdio: 'inherit',
  env: webEnv,
})
const web = spawn('pnpm', ['--filter', '@openspecui/web', 'dev'], { stdio: 'inherit', env: webEnv })

let isShuttingDown = false
const shutdown = (code?: number) => {
  if (isShuttingDown) return
  isShuttingDown = true
  core.kill('SIGINT')
  search.kill('SIGINT')
  server.kill('SIGINT')
  webDist.kill('SIGINT')
  web.kill('SIGINT')
  if (code !== undefined) process.exit(code)
}

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())

core.on('exit', (code) => {
  console.log(`core exited with code ${code}`)
  shutdown(code ?? undefined)
})

search.on('exit', (code) => {
  console.log(`search exited with code ${code}`)
  shutdown(code ?? undefined)
})

server.on('exit', (code) => {
  console.log(`server exited with code ${code}`)
  shutdown(code ?? undefined)
})

webDist.on('exit', (code) => {
  console.log(`web dist exited with code ${code}`)
  shutdown(code ?? undefined)
})

web.on('exit', (code) => {
  console.log(`web exited with code ${code}`)
  shutdown(code ?? undefined)
})
