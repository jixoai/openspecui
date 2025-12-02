#!/usr/bin/env tsx
import { findAvailablePort } from '../packages/server/src/port-utils.js'
import { spawn } from 'node:child_process'

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

const userArgs = parseArgs(process.argv.slice(2))

const preferred = userArgs.port ?? Number(process.env.OPENSPEC_SERVER_PORT || process.env.PORT || 3100)
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

const server = spawn('pnpm', serverArgs, { stdio: 'inherit', env: serverEnv })
const web = spawn('pnpm', ['--filter', '@openspecui/web', 'dev'], { stdio: 'inherit', env: webEnv })

const shutdown = (code?: number) => {
  server.kill('SIGINT')
  web.kill('SIGINT')
  if (code !== undefined) process.exit(code)
}

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())

server.on('exit', (code) => {
  console.log(`server exited with code ${code}`)
  shutdown(code ?? undefined)
})

web.on('exit', (code) => {
  console.log(`web exited with code ${code}`)
  shutdown(code ?? undefined)
})
