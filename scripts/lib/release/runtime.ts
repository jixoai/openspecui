import process from 'node:process'

import type { ReleasePlan } from './types'

type CommandSpec = {
  args: string[]
  cmd: string
  cwd: string
  env?: Record<string, string>
}

type LogFn = (line: string) => void

const DEFAULT_WAIT_TIMEOUT_MS = 5 * 60 * 1000
const DEFAULT_WAIT_INTERVAL_MS = 5000

function commandFor(bin: 'git' | 'npm' | 'pnpm'): string {
  if (process.platform === 'win32' && bin !== 'git') {
    return `${bin}.cmd`
  }
  return bin
}

function toCommandLine(spec: CommandSpec): string {
  return [spec.cmd, ...spec.args].join(' ')
}

function cleanEnv(overrides?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  return {
    ...env,
    CI: '1',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    ...overrides,
  }
}

async function streamLines(
  stream: ReadableStream<Uint8Array> | null,
  onLine: LogFn,
  prefix?: string
): Promise<void> {
  if (!stream) return

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex < 0) break
      const rawLine = buffer.slice(0, newlineIndex).replace(/\r/g, '')
      onLine(prefix ? `${prefix}${rawLine}` : rawLine)
      buffer = buffer.slice(newlineIndex + 1)
    }
  }

  buffer += decoder.decode()
  const finalLine = buffer.replace(/\r/g, '')
  if (finalLine.length > 0) {
    onLine(prefix ? `${prefix}${finalLine}` : finalLine)
  }
}

async function runAndCapture(spec: CommandSpec): Promise<{ exitCode: number; stdout: string }> {
  const child = Bun.spawn({
    cmd: [spec.cmd, ...spec.args],
    cwd: spec.cwd,
    env: cleanEnv(spec.env),
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdoutPromise = new Response(child.stdout).text()
  const stderrPromise = new Response(child.stderr).text()
  const exitCode = await child.exited
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise])

  if (exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim() || `${toCommandLine(spec)} failed`
    throw new Error(detail)
  }

  return { exitCode, stdout: stdout.trim() }
}

export async function runLoggedCommand(spec: CommandSpec, onLine: LogFn): Promise<void> {
  onLine(`$ ${toCommandLine(spec)}`)

  const child = Bun.spawn({
    cmd: [spec.cmd, ...spec.args],
    cwd: spec.cwd,
    env: cleanEnv(spec.env),
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })

  await Promise.all([
    streamLines(child.stdout, onLine),
    streamLines(child.stderr, onLine, '[stderr] '),
  ])

  const exitCode = await child.exited
  if (exitCode !== 0) {
    throw new Error(`${toCommandLine(spec)} failed with exit code ${exitCode}`)
  }

  onLine(`✓ exit ${exitCode}`)
}

export async function runReleasePreflight(
  cwd: string,
  plan: ReleasePlan,
  onLine: LogFn
): Promise<void> {
  const gitBranch = await runAndCapture({
    cmd: commandFor('git'),
    args: ['branch', '--show-current'],
    cwd,
  })
  if (gitBranch.stdout !== 'main') {
    throw new Error(`Release must run on main. Current branch: ${gitBranch.stdout || '(detached)'}`)
  }
  onLine(`git branch: ${gitBranch.stdout}`)

  const gitStatus = await runAndCapture({
    cmd: commandFor('git'),
    args: ['status', '--short'],
    cwd,
  })
  if (gitStatus.stdout.length > 0) {
    throw new Error(`Worktree must be clean before release.\n${gitStatus.stdout}`)
  }
  onLine('git status: clean')

  const npmWhoAmI = await runAndCapture({
    cmd: commandFor('npm'),
    args: ['whoami'],
    cwd,
  })
  onLine(`npm auth: ${npmWhoAmI.stdout}`)

  if (!plan.website.required && !plan.app.required) {
    onLine('cloudflare auth: skipped (no deploy steps required)')
    return
  }

  const wranglerFilter = plan.website.required ? '@openspecui/website' : '@openspecui/app'
  const wranglerWhoAmI = await runAndCapture({
    cmd: commandFor('pnpm'),
    args: ['--filter', wranglerFilter, 'exec', 'wrangler', 'whoami'],
    cwd,
  })
  onLine(wranglerWhoAmI.stdout || 'cloudflare auth: ok')
}

export async function waitForNpmVersion(
  packageName: string,
  version: string,
  onLine: LogFn,
  options?: { intervalMs?: number; timeoutMs?: number }
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS
  const intervalMs = options?.intervalMs ?? DEFAULT_WAIT_INTERVAL_MS
  const deadline = Date.now() + timeoutMs
  const url = `https://registry.npmjs.org/${packageName}/${version}`
  let attempt = 1

  while (Date.now() <= deadline) {
    onLine(`poll ${attempt}: GET ${url}`)
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })
    if (response.ok) {
      onLine(`npm registry: ${packageName}@${version} is available`)
      return
    }
    onLine(`npm registry: status ${response.status}, retrying in ${intervalMs}ms`)
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    attempt += 1
  }

  throw new Error(`Timed out waiting for ${packageName}@${version} to appear on npm.`)
}

export function createReleaseCommands(cwd: string) {
  return {
    buildApp: {
      cmd: commandFor('pnpm'),
      args: ['--filter', '@openspecui/app', 'build'],
      cwd,
    },
    deployApp: {
      cmd: commandFor('pnpm'),
      args: [
        '--filter',
        '@openspecui/app',
        'exec',
        'wrangler',
        'pages',
        'deploy',
        'dist',
        '--project-name',
        'openspecui-app',
      ],
      cwd,
    },
    deployWebsite: {
      cmd: commandFor('pnpm'),
      args: ['--filter', '@openspecui/website', 'cf:deploy'],
      cwd,
    },
    publishPackages: {
      cmd: commandFor('pnpm'),
      args: ['release:packages'],
      cwd,
    },
  } as const
}
