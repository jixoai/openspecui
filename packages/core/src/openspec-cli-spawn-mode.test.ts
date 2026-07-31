/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove Worker is the default buffered OpenSpec CLI execution boundary and process remains explicit.
 * 2. Prove Worker execution receives the requested project cwd and CLI argv through CliExecutor.
 * 3. Permit process fallback only when the importable CLI JavaScript module cannot be located.
 *
 * Original request (2026-07-31): "在主线程，通过 OPENSPEC_SPAWN_MODE=process|worker 来进行区分两种模式。"
 * Owner acceptance (2026-07-31): "worker 效果很好，将worker作为默认标准，只有找不到js的时候，才回退到process模式。"
 */
import { chmod, mkdir, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir, exists, waitFor } from './__tests__/test-utils.js'
import { CliExecutor } from './cli-executor.js'
import { ConfigManager } from './config.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'

const SPAWN_MODE_ENV = 'OPENSPEC_SPAWN_MODE'
const TELEMETRY_ENV = 'OPENSPEC_TELEMETRY'
const require = createRequire(import.meta.url)

interface ExecutionProbe {
  argv: string[]
  cwd: string
  isMainThread: boolean
}

async function writeCliFixture(root: string): Promise<string> {
  const binDirectory = join(root, 'fixture-cli', 'bin')
  const distCliDirectory = join(root, 'fixture-cli', 'dist', 'cli')
  await mkdir(binDirectory, { recursive: true })
  await mkdir(distCliDirectory, { recursive: true })
  await writeFile(
    join(root, 'fixture-cli', 'package.json'),
    JSON.stringify({ name: '@fission-ai/openspec', type: 'module' })
  )
  await writeFile(
    join(binDirectory, 'openspec.js'),
    [
      '#!/usr/bin/env node',
      "import { runCli } from '../dist/cli/index.js'",
      'await runCli()',
      '',
    ].join('\n')
  )
  await writeFile(
    join(distCliDirectory, 'index.js'),
    [
      "import { isMainThread } from 'node:worker_threads'",
      "import { writeFileSync } from 'node:fs'",
      'export const program = {',
      '  async parseAsync(argv) {',
      "    if (argv[2] === 'hang') {",
      "      writeFileSync(argv[3], 'started')",
      '      await new Promise(() => setInterval(() => {}, 1_000))',
      '    }',
      '    process.stdout.write(JSON.stringify({',
      '      argv: argv.slice(2),',
      '      cwd: process.cwd(),',
      '      isMainThread,',
      '    }))',
      '  },',
      '}',
      'export function runCli(argv = process.argv) {',
      '  return program.parseAsync(argv)',
      '}',
      '',
    ].join('\n')
  )
  return join(binDirectory, 'openspec.js')
}

async function writeVitePlusFixture(root: string): Promise<string> {
  const vitePlusRoot = join(root, '.vite-plus')
  const runner = join(vitePlusRoot, 'bin', 'openspec')
  const modulePath = join(
    vitePlusRoot,
    'packages',
    '@fission-ai',
    'openspec',
    'lib',
    'node_modules',
    '@fission-ai',
    'openspec',
    'dist',
    'cli',
    'index.js'
  )
  await mkdir(join(vitePlusRoot, 'bin'), { recursive: true })
  await mkdir(join(modulePath, '..'), { recursive: true })
  await writeFile(
    runner,
    "#!/usr/bin/env node\nprocess.stdout.write(process.argv.includes('--version') ? '1.6.0' : '')\n"
  )
  await chmod(runner, 0o755)
  await writeFile(
    modulePath,
    [
      "import { isMainThread } from 'node:worker_threads'",
      'export const program = {',
      '  async parseAsync(argv) {',
      '    process.stdout.write(JSON.stringify({',
      '      argv: argv.slice(2),',
      '      cwd: process.cwd(),',
      '      isMainThread,',
      '    }))',
      '  },',
      '}',
      '',
    ].join('\n')
  )
  return runner
}

async function writeProcessOnlyFixture(root: string): Promise<string> {
  const runner = join(root, 'process-only-openspec.mjs')
  await writeFile(
    runner,
    [
      "import { isMainThread } from 'node:worker_threads'",
      'process.stdout.write(JSON.stringify({',
      '  argv: process.argv.slice(2),',
      '  cwd: process.cwd(),',
      '  isMainThread,',
      '}))',
      '',
    ].join('\n')
  )
  return runner
}

describe('CliExecutor OpenSpec spawn mode', () => {
  let cliExecutor: CliExecutor
  let originalSpawnMode: string | undefined
  let originalTelemetry: string | undefined
  let tempDir: string

  beforeEach(async () => {
    originalSpawnMode = process.env[SPAWN_MODE_ENV]
    originalTelemetry = process.env[TELEMETRY_ENV]
    tempDir = await createTempDir()
    const cliBin = await writeCliFixture(tempDir)
    const configManager = new ConfigManager(tempDir)
    await configManager.writeConfig({ cli: { command: `${process.execPath} ${cliBin}` } })
    clearCache()
    cliExecutor = new CliExecutor(configManager, tempDir)
  })

  afterEach(async () => {
    if (originalSpawnMode === undefined) {
      delete process.env[SPAWN_MODE_ENV]
    } else {
      process.env[SPAWN_MODE_ENV] = originalSpawnMode
    }
    if (originalTelemetry === undefined) {
      delete process.env[TELEMETRY_ENV]
    } else {
      process.env[TELEMETRY_ENV] = originalTelemetry
    }
    await cliExecutor.dispose()
    clearCache()
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('executes the configured OpenSpec CLI inside a Worker by default', async () => {
    delete process.env[SPAWN_MODE_ENV]

    const result = await cliExecutor.execute(['doctor', '--json'])

    expect(result.success).toBe(true)
    expect(JSON.parse(result.stdout) as ExecutionProbe).toEqual({
      argv: ['doctor', '--json'],
      cwd: await realpath(tempDir),
      isMainThread: false,
    })
  })

  it('keeps buffered OpenSpec execution in a child process when process mode is selected', async () => {
    process.env[SPAWN_MODE_ENV] = 'process'

    const result = await cliExecutor.execute(['doctor', '--json'])

    expect(result.success).toBe(true)
    expect(JSON.parse(result.stdout) as ExecutionProbe).toEqual({
      argv: ['doctor', '--json'],
      cwd: await realpath(tempDir),
      isMainThread: true,
    })
  }, 20_000)

  it('falls back to process only when no importable OpenSpec CLI module can be located', async () => {
    delete process.env[SPAWN_MODE_ENV]
    const processOnlyRunner = await writeProcessOnlyFixture(tempDir)
    const configManager = new ConfigManager(tempDir)
    await configManager.writeConfig({
      cli: { command: `${process.execPath} ${processOnlyRunner}` },
    })
    await cliExecutor.dispose()
    cliExecutor = new CliExecutor(configManager, tempDir)

    const result = await cliExecutor.execute(['doctor', '--json'])

    expect(result.success).toBe(true)
    expect(JSON.parse(result.stdout) as ExecutionProbe).toEqual({
      argv: ['doctor', '--json'],
      cwd: await realpath(tempDir),
      isMainThread: true,
    })
  }, 20_000)

  it('does not fall back after an importable Worker module starts and fails', async () => {
    delete process.env[SPAWN_MODE_ENV]
    await writeFile(
      join(tempDir, 'fixture-cli', 'dist', 'cli', 'index.js'),
      [
        'export const program = {',
        '  async parseAsync() {',
        "    throw new Error('worker-execution-failure')",
        '  },',
        '}',
        'export async function runCli() {',
        "  process.stdout.write(JSON.stringify({ fallback: 'process' }))",
        '}',
        '',
      ].join('\n')
    )

    const result = await cliExecutor.execute(['doctor', '--json'])

    expect(result.success).toBe(false)
    expect(result.stdout).not.toContain('"fallback":"process"')
    expect(result.stderr).toContain('worker-execution-failure')
  })

  it('returns the same doctor JSON from the installed OpenSpec CLI in both modes', async () => {
    process.env[TELEMETRY_ENV] = '0'
    await mkdir(join(tempDir, 'openspec', 'changes'), { recursive: true })
    await mkdir(join(tempDir, 'openspec', 'specs'), { recursive: true })
    await writeFile(join(tempDir, 'openspec', 'config.yaml'), 'schema: spec-driven\n')
    const openspecEntry = require.resolve('openspec-cli-16')
    const openspecBin = join(openspecEntry, '..', '..', 'bin', 'openspec.js')
    const configManager = new ConfigManager(tempDir)
    await configManager.writeConfig({ cli: { command: `${process.execPath} ${openspecBin}` } })
    await cliExecutor.dispose()
    cliExecutor = new CliExecutor(configManager, tempDir)

    process.env[SPAWN_MODE_ENV] = 'process'
    const processResult = await cliExecutor.execute(['doctor', '--json'])
    process.env[SPAWN_MODE_ENV] = 'worker'
    const workerResult = await cliExecutor.execute(['doctor', '--json'])

    expect(processResult.success).toBe(true)
    expect(workerResult.success).toBe(true)
    expect(JSON.parse(workerResult.stdout)).toEqual(JSON.parse(processResult.stdout))
  })

  it('supports the OpenSpec version early-exit path used by checkAvailability', async () => {
    process.env[SPAWN_MODE_ENV] = 'worker'
    process.env[TELEMETRY_ENV] = '0'
    const openspecEntry = require.resolve('openspec-cli-16')
    const openspecBin = join(openspecEntry, '..', '..', 'bin', 'openspec.js')
    const configManager = new ConfigManager(tempDir)
    await configManager.writeConfig({ cli: { command: `${process.execPath} ${openspecBin}` } })
    await cliExecutor.dispose()
    cliExecutor = new CliExecutor(configManager, tempDir)

    const availability = await cliExecutor.checkAvailability()

    expect(availability.available).toBe(true)
    expect(availability.version).toBe('1.6.0')
  })

  it('resolves the importable CLI module behind a Vite+ openspec shim', async () => {
    process.env[SPAWN_MODE_ENV] = 'worker'
    const vitePlusRunner = await writeVitePlusFixture(tempDir)
    const configManager = new ConfigManager(tempDir)
    await configManager.writeConfig({ cli: { command: vitePlusRunner } })
    await cliExecutor.dispose()
    cliExecutor = new CliExecutor(configManager, tempDir)

    const result = await cliExecutor.execute(['doctor', '--json'])

    expect(result.success).toBe(true)
    expect(JSON.parse(result.stdout) as ExecutionProbe).toEqual({
      argv: ['doctor', '--json'],
      cwd: await realpath(tempDir),
      isMainThread: false,
    })
  })

  it('terminates and settles an active Worker when CliExecutor is disposed', async () => {
    process.env[SPAWN_MODE_ENV] = 'worker'
    const markerPath = join(tempDir, 'worker-started')
    const execution = cliExecutor.execute(['hang', markerPath])
    await waitFor(() => exists(markerPath), { timeout: 20_000 })

    await cliExecutor.dispose()
    const result = await execution

    expect(result).toMatchObject({ success: false, exitCode: null })
  }, 20_000)
})
