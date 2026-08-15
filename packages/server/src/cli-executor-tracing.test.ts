/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Prove an eager JSON response can finish before its child process settles without writing to
 *    an ended response Span.
 * 2. Exercise the real OpenTelemetry SDK diagnostic boundary instead of a mocked Span facade.
 * 3. Preserve queue, cwd, runner, parent, and real child-concurrency evidence on exported Spans.
 * 4. Prove Worker execution exports mode, module, lifecycle, and concurrency evidence without a child PID.
 * 5. Bind eager-process trace export to observed child retirement instead of a fixed platform timer.
 *
 * Characterize honest unknown exit codes for eager-resolved commands.
 * Original request (2026-07-31): "终端大量报错，比如: Cannot execute the operation on ended Span"
 * Original request (2026-07-31): "我发现otel里面没有追踪这个信息。"

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"*/
import { CliExecutor, ConfigManager } from '@openspecui/core'
import { diag, DiagLogLevel, trace } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

class FixedCliConfigManager extends ConfigManager {
  constructor(private readonly command: readonly string[]) {
    super(process.cwd())
  }

  override async getCliCommand(): Promise<readonly string[]> {
    return this.command
  }
}

async function writeWorkerCliFixture(root: string): Promise<{
  cliBin: string
  cliModule: string
}> {
  const packageDir = join(root, 'fixture-cli')
  const binDir = join(packageDir, 'bin')
  const cliDir = join(packageDir, 'dist', 'cli')
  const cliBin = join(binDir, 'openspec.js')
  const cliModule = join(cliDir, 'index.js')
  await mkdir(binDir, { recursive: true })
  await mkdir(cliDir, { recursive: true })
  await writeFile(join(packageDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8')
  await writeFile(
    cliBin,
    "import { program } from '../dist/cli/index.js'\nawait program.parseAsync(process.argv)\n",
    'utf8'
  )
  await writeFile(
    cliModule,
    [
      "import { isMainThread } from 'node:worker_threads'",
      'export const program = {',
      '  async parseAsync(argv) {',
      '    process.stdout.write(JSON.stringify({ command: argv[2], isMainThread }))',
      '  },',
      '}',
      '',
    ].join('\n'),
    'utf8'
  )
  return { cliBin, cliModule }
}

async function writeProcessOnlyCliFixture(root: string): Promise<string> {
  const runner = join(root, 'process-only-openspec.mjs')
  await writeFile(
    runner,
    'process.stdout.write(JSON.stringify({ command: process.argv[2] }))\n',
    'utf8'
  )
  return runner
}

function diagnosticText(message: string, args: readonly unknown[]): string {
  return [message, ...args]
    .map((value) =>
      value instanceof Error ? `${value.message}\n${value.stack ?? ''}` : String(value)
    )
    .join(' ')
}

function readFixtureProcessId(stdout: string): number {
  const parsed: unknown = JSON.parse(stdout)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('CLI tracing fixture did not return an object.')
  }
  const record = parsed as Record<string, unknown>
  if (record.ok !== true || typeof record.pid !== 'number') {
    throw new Error('CLI tracing fixture did not return its process identity.')
  }
  return record.pid
}

async function waitForProcessExit(pid: number, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`CLI tracing fixture process ${pid} did not exit within ${timeoutMs}ms.`)
}

async function waitForExportedSpanEvents(
  readSpans: () => ReadonlyArray<{ name: string; events: readonly string[] }>,
  spanName: string,
  events: readonly string[],
  timeoutMs = 5_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const span = readSpans().find((candidate) => candidate.name === spanName)
    if (span && events.every((event) => span.events.includes(event))) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`${spanName} did not export ${events.join(', ')} within ${timeoutMs}ms.`)
}

describe('CLI executor tracing lifecycle', () => {
  let sdk: NodeSDK | null = null
  let originalSpawnMode: string | undefined
  let diagnostics: string[] = []
  let tempDirs: string[] = []
  let exportedSpans: Array<{
    name: string
    events: string[]
    attributes: Readonly<Record<string, unknown>>
  }> = []

  beforeEach(() => {
    originalSpawnMode = process.env.OPENSPEC_SPAWN_MODE
    process.env.OPENSPEC_SPAWN_MODE = 'process'
    diagnostics = []
    tempDirs = []
    exportedSpans = []
    diag.setLogger(
      {
        error: (message, ...args) => diagnostics.push(diagnosticText(message, args)),
        warn: (message, ...args) => diagnostics.push(diagnosticText(message, args)),
        info: () => {},
        debug: () => {},
        verbose: () => {},
      },
      { logLevel: DiagLogLevel.ALL, suppressOverrideMessage: true }
    )
    sdk = new NodeSDK({
      serviceName: 'cli-executor-tracing-test',
      traceExporter: {
        export: (spans, resultCallback) => {
          exportedSpans.push(
            ...spans.map((span) => ({
              name: span.name,
              events: span.events.map((event) => event.name),
              attributes: span.attributes,
            }))
          )
          resultCallback({ code: 0 })
        },
        shutdown: () => Promise.resolve(),
      },
    })
    sdk.start()
    diagnostics.length = 0
  })

  afterEach(async () => {
    if (originalSpawnMode === undefined) {
      delete process.env.OPENSPEC_SPAWN_MODE
    } else {
      process.env.OPENSPEC_SPAWN_MODE = originalSpawnMode
    }
    if (sdk) await sdk.shutdown()
    await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
    sdk = null
    trace.disable()
    diag.disable()
  })

  it('does not record late child-process events on an ended eager-response span', async () => {
    const executor = new CliExecutor(new FixedCliConfigManager([process.execPath]), process.cwd())
    const result = await executor.execute([
      '-e',
      [
        "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 50))",
        'process.stdout.write(JSON.stringify({ ok: true, pid: process.pid }))',
        'setInterval(() => {}, 1_000)',
      ].join(';'),
      '--',
      '--json',
    ])

    // Eager-JSON resolution settles before the terminated child's natural exit, so the
    // honest result reports the exit code as unknown instead of a fabricated 0.
    expect(result).toMatchObject({ success: true, exitCode: null })
    await waitForProcessExit(readFixtureProcessId(result.stdout))
    await waitForExportedSpanEvents(() => exportedSpans, 'cli.process -e', [
      'cli.process.exit.observed',
      'cli.process.close.observed',
    ])

    expect(
      diagnostics.filter((message) => message.includes('Operation attempted on ended Span'))
    ).toEqual([])

    const activeSdk = sdk
    if (!activeSdk) throw new Error('OpenTelemetry SDK was not initialized.')
    await activeSdk.shutdown()
    sdk = null
    expect(exportedSpans.find((span) => span.name === 'cli.execute -e')?.events).toContain(
      'cli.process.result.resolved'
    )
    expect(exportedSpans.find((span) => span.name === 'cli.execute -e')?.events).toEqual(
      expect.arrayContaining(['cli.admission.queued', 'cli.admission.acquired'])
    )
    expect(exportedSpans.find((span) => span.name === 'cli.execute -e')?.events).not.toContain(
      'cli.process.close.observed'
    )
    expect(exportedSpans.find((span) => span.name === 'cli.process -e')?.events).toEqual(
      expect.arrayContaining(['cli.process.exit.observed', 'cli.process.close.observed'])
    )
    expect(exportedSpans.find((span) => span.name === 'cli.execute -e')?.attributes).toMatchObject({
      'cli.concurrent.limit': 1,
      'cli.concurrent.active_at_enqueue': 0,
      'cli.cwd': process.cwd(),
      'cli.processes.active_at_spawn': 1,
      'cli.processes.active_at_first_stdout': 1,
      'cli.runner.realpath': process.execPath,
      'process.parent.pid': process.pid,
    })
  }, 20_000)

  it('exports explicit Worker execution evidence without child-process identity', async () => {
    process.env.OPENSPEC_SPAWN_MODE = 'worker'
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'openspecui-worker-trace-'))
    tempDirs.push(fixtureRoot)
    const fixture = await writeWorkerCliFixture(fixtureRoot)
    const physicalCliModule = await realpath(fixture.cliModule)
    const executor = new CliExecutor(
      new FixedCliConfigManager([process.execPath, fixture.cliBin]),
      process.cwd()
    )

    const result = await executor.execute(['doctor', '--json'])
    // The Worker fixture exits naturally with code 0, so its exit code is observed truthfully.
    expect(result).toMatchObject({ success: true, exitCode: 0 })
    expect(JSON.parse(result.stdout)).toEqual({ command: 'doctor', isMainThread: false })

    expect(
      diagnostics.filter((message) => message.includes('Operation attempted on ended Span'))
    ).toEqual([])

    const activeSdk = sdk
    if (!activeSdk) throw new Error('OpenTelemetry SDK was not initialized.')
    await activeSdk.shutdown()
    sdk = null

    const workerSpan = exportedSpans.find((span) => span.name === 'cli.worker doctor')
    expect(workerSpan?.attributes).toMatchObject({
      'cli.spawn_mode': 'worker',
      'cli.worker.module': physicalCliModule,
      'cli.workers.active_at_spawn': 1,
      'process.parent.pid': process.pid,
    })
    expect(workerSpan?.events).toEqual(
      expect.arrayContaining([
        'cli.worker.spawn.called',
        'cli.worker.spawn.returned',
        'cli.worker.spawn.observed',
        'cli.worker.stdout.first.observed',
        'cli.worker.result.resolved',
      ])
    )
    expect(Object.hasOwn(workerSpan?.attributes ?? {}, 'process.pid')).toBe(false)
    expect(exportedSpans.find((span) => span.name === 'cli.process doctor')).toBeUndefined()
    expect(
      exportedSpans.find((span) => span.name === 'cli.execute doctor')?.attributes
    ).toMatchObject({
      'cli.spawn_mode': 'worker',
      'cli.worker.module': physicalCliModule,
      'cli.workers.active_at_spawn': 1,
    })
  })

  it('traces the default Worker request falling back only when its CLI module is absent', async () => {
    delete process.env.OPENSPEC_SPAWN_MODE
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'openspecui-process-fallback-trace-'))
    tempDirs.push(fixtureRoot)
    const processOnlyRunner = await writeProcessOnlyCliFixture(fixtureRoot)
    const executor = new CliExecutor(
      new FixedCliConfigManager([process.execPath, processOnlyRunner]),
      process.cwd()
    )

    const result = await executor.execute(['doctor', '--json'])
    // This runner exits naturally with code 0, so its exit code is observed truthfully.
    expect(result).toMatchObject({ success: true, exitCode: 0 })
    expect(JSON.parse(result.stdout)).toEqual({ command: 'doctor' })
    await new Promise((resolve) => setTimeout(resolve, 150))

    const activeSdk = sdk
    if (!activeSdk) throw new Error('OpenTelemetry SDK was not initialized.')
    await activeSdk.shutdown()
    sdk = null

    const processSpan = exportedSpans.find((span) => span.name === 'cli.process doctor')
    expect(processSpan?.attributes).toMatchObject({
      'cli.spawn_mode': 'process',
      'cli.spawn_mode.requested': 'worker',
      'cli.worker.fallback.reason': 'module-not-found',
    })
    expect(exportedSpans.find((span) => span.name === 'cli.worker doctor')).toBeUndefined()
    expect(exportedSpans.find((span) => span.name === 'cli.execute doctor')).toMatchObject({
      events: expect.arrayContaining(['cli.worker.fallback']),
      attributes: {
        'cli.spawn_mode': 'process',
        'cli.spawn_mode.requested': 'worker',
        'cli.worker.fallback.reason': 'module-not-found',
      },
    })
  }, 20_000)

  it('does not end the process span before an asynchronously failed spawn closes', async () => {
    const missingExecutable = `${process.cwd()}/missing-openspecui-cli-for-tracing-test`
    const executor = new CliExecutor(new FixedCliConfigManager([missingExecutable]), process.cwd())

    const result = await executor.execute(['status', '--json'])
    expect(result).toMatchObject({ success: false, exitCode: null })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(
      diagnostics.filter((message) => message.includes('Operation attempted on ended Span'))
    ).toEqual([])
  })
})
