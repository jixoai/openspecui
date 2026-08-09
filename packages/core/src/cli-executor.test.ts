/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Verify buffered and streaming CLI execution, including exact Windows command-shim argv, bounded
 *    runner probes, disposal, and error behavior.
 * 2. Preserve the launch process environment without loading project-owned environment files.
 * 3. Verify OpenSpec lifecycle commands, fixed project bootstrap, and cross-platform tree cancellation.
 * 4. Prove cancellation ownership and forced-timeout settlement remain immutable through late close.
 * 5. Prove late close clears the Core-owned direct-child slot exactly once.
 *
 * Original request (2026-07-15): "OpenSpecUI inherits the launch environment's XDG_DATA_HOME."
 * Original request (2026-07-17): "Cancellation during command resolution cannot spawn after cancellation."
 * Original request (2026-07-17): "Cover repeated cancel/dispose and a late close after forced-timeout rejection."
 * Original request (2026-07-17): "Make late-child-close bookkeeping proof resistant to the exact missing-cleanup mutation."
 * Built-runtime correction (2026-07-30): foreground Server shutdown must retire buffered projection children and settled probe timers.
 * Owner diagnosis (2026-07-31): explicit process-mode lifecycle evidence must tolerate the observed Node startup tail.
 * Original request (2026-08-02): lock `openspec init <launch-project> --tools=none` before the Alert can execute it.
 * Review correction (2026-08-02): command evidence must preserve argv boundaries for paths containing spaces.
 * Original request (2026-08-05): Continue the Windows adaptation and fix equivalent failures together.
 * Original request (2026-08-06): "continue"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { mkdir, readFile, writeFile } from 'fs/promises'
import { ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import {
  readWindowsProcessTable,
  resolveWindowsProcessTreePids,
  terminateChildProcessTree,
} from './child-process-tree.js'
import {
  CliExecutor,
  type CliResult,
  type CliStreamEvent,
  type CliStreamHandle,
} from './cli-executor.js'
import { inspectCliStreamChildOwnership } from './cli-stream-child-owner.js'
import { ConfigManager } from './config.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'
import { spawnSafe } from './spawn-safe.js'

vi.mock('./spawn-safe.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./spawn-safe.js')>()
  return {
    ...actual,
    spawnSafe: vi.fn(actual.spawnSafe),
  }
})

const ECHO_SCRIPT = 'process.stdout.write(process.argv.slice(1).join(" "))'
const TSX_WINDOWS_SHIM = fileURLToPath(
  new URL('../../../node_modules/.bin/tsx.cmd', import.meta.url)
)
const WINDOWS_SPECIAL_ARGUMENTS = [
  '',
  'space separated',
  'a&b',
  '%PATH%',
  'a^b',
  'a"b',
  'C:\\space path\\',
  '(x)|y<z>',
]

async function createWindowsNodeCommandShim(root: string): Promise<string> {
  const commandShim = join(root, 'openspec.cmd')
  const entry = join(root, 'node_modules', 'openspec', 'bin', 'openspec.js')
  await mkdir(join(root, 'node_modules', 'openspec', 'bin'), { recursive: true })
  await writeFile(
    commandShim,
    [
      '@ECHO off',
      'IF EXIST "%~dp0\\node.exe" (',
      '  "%~dp0\\node.exe" "%~dp0\\node_modules\\openspec\\bin\\openspec.js" %*',
      ') ELSE (',
      '  node "%~dp0\\node_modules\\openspec\\bin\\openspec.js" %*',
      ')',
      '',
    ].join('\r\n')
  )
  await writeFile(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n')
  return commandShim
}

async function waitForWindowsProcessTree(rootPid: number): Promise<number[]> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const pids = resolveWindowsProcessTreePids(rootPid, await readWindowsProcessTable())
    if (pids.length > 1) return pids
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  return [rootPid]
}

async function waitForWindowsProcessesToExit(pids: readonly number[]): Promise<number[]> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const rows = await readWindowsProcessTable()
    const remaining = pids.filter((pid) => rows.some((row) => row.ProcessId === pid))
    if (remaining.length === 0) return []
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  const rows = await readWindowsProcessTable()
  return pids.filter((pid) => rows.some((row) => row.ProcessId === pid))
}

describe('CliExecutor', () => {
  let tempDir: string
  let configManager: ConfigManager
  let cliExecutor: CliExecutor

  beforeEach(async () => {
    tempDir = await createTempDir()
    await mkdir(join(tempDir, 'openspec'), { recursive: true })
    configManager = new ConfigManager(tempDir)
    cliExecutor = new CliExecutor(configManager, tempDir)
    clearCache()
  })

  afterEach(async () => {
    await cliExecutor.dispose()
    clearCache()
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  describe('execute()', () => {
    it('should execute command and return result', async () => {
      // 使用 echo 命令测试基本执行
      await configManager.writeConfig({
        cli: { command: process.execPath, args: ['-e', ECHO_SCRIPT] },
      })
      clearCache()

      const result = await cliExecutor.execute(['hello', 'world'])

      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe('hello world')
      expect(result.exitCode).toBe(0)
    })

    it('should handle command with multiple parts', async () => {
      // 测试带参数的命令
      await configManager.writeConfig({
        cli: { command: process.execPath, args: ['-e', ECHO_SCRIPT, 'test'] },
      })
      clearCache()

      const result = await cliExecutor.execute(['arg1'])

      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe('test arg1')
    })

    it('should capture stderr', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.execute(['-e', "process.stderr.write('error')"])

      expect(result.stderr.trim()).toBe('error')
    })

    it('should return failure for non-zero exit code', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.execute(['-e', 'process.exit(1)'])

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
    })

    it('should handle command not found', async () => {
      await configManager.writeConfig({ cli: { command: 'nonexistent_command_12345' } })
      clearCache()

      const result = await cliExecutor.execute(['arg'])

      expect(result.success).toBe(false)
    })

    it('should return a failure result for synchronous spawn errors', async () => {
      await configManager.writeConfig({ cli: { command: 'node\u0000broken' } })
      clearCache()

      const result = await cliExecutor.execute(['arg'])

      expect(result.success).toBe(false)
      expect(result.exitCode).toBeNull()
      expect(result.stderr).toContain('without null bytes')
    })

    it('should use project directory as cwd', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.execute(['-e', 'process.stdout.write(process.cwd())'])

      expect(result.success).toBe(true)
      // macOS 上 /var 是 /private/var 的符号链接
      const normalizedOutput = result.stdout.trim().replace('/private', '')
      const normalizedTempDir = tempDir.replace('/private', '')
      expect(normalizedOutput).toBe(normalizedTempDir)
    })

    it('preserves the launch environment XDG_DATA_HOME', async () => {
      const previousDataHome = process.env.XDG_DATA_HOME
      process.env.XDG_DATA_HOME = join(tempDir, 'xdg-data')
      try {
        await configManager.writeConfig({ cli: { command: 'node' } })
        clearCache()

        const result = await cliExecutor.execute([
          '-e',
          "process.stdout.write(process.env.XDG_DATA_HOME ?? '')",
        ])

        expect(result.success).toBe(true)
        expect(result.stdout).toBe(join(tempDir, 'xdg-data'))
      } finally {
        if (previousDataHome === undefined) {
          delete process.env.XDG_DATA_HOME
        } else {
          process.env.XDG_DATA_HOME = previousDataHome
        }
      }
    })

    it('does not load project-owned openspec/.env into CLI children', async () => {
      const previousDataHome = process.env.XDG_DATA_HOME
      const inheritedDataHome = join(tempDir, 'inherited-data')
      const projectDataHome = join(tempDir, 'project-data')
      process.env.XDG_DATA_HOME = inheritedDataHome
      try {
        await writeFile(
          join(tempDir, 'openspec', '.env'),
          `XDG_DATA_HOME=${projectDataHome}\n`,
          'utf8'
        )
        await configManager.writeConfig({ cli: { command: 'node' } })
        clearCache()

        const result = await cliExecutor.execute([
          '-e',
          "process.stdout.write(process.env.XDG_DATA_HOME ?? '')",
        ])

        expect(result.success).toBe(true)
        expect(result.stdout).toBe(inheritedDataHome)
        expect(result.stdout).not.toBe(projectDataHome)
      } finally {
        if (previousDataHome === undefined) {
          delete process.env.XDG_DATA_HOME
        } else {
          process.env.XDG_DATA_HOME = previousDataHome
        }
      }
    })

    it.skipIf(process.platform === 'win32')(
      'disposes an active buffered child with bounded force escalation',
      async () => {
        const readyPath = join(tempDir, 'buffered-child-ready')
        vi.spyOn(configManager, 'getCliCommand').mockResolvedValue([process.execPath])
        const execution = cliExecutor.execute([
          '-e',
          `require('node:fs').writeFileSync(${JSON.stringify(readyPath)}, 'ready'); process.on('SIGTERM', () => {}); setInterval(() => {}, 1_000)`,
        ])

        await vi.waitFor(async () => expect(await readFile(readyPath, 'utf8')).toBe('ready'), {
          timeout: 20_000,
        })
        const disposeStartedAt = Date.now()
        await cliExecutor.dispose()

        await expect(execution).resolves.toMatchObject({
          success: false,
          exitCode: null,
        })
        expect(Date.now() - disposeStartedAt).toBeGreaterThanOrEqual(900)
      },
      20_000
    )
  })

  describe('init()', () => {
    it('streams the fixed Launch Project bootstrap command with no Agent tools', () => {
      const executeStream = vi.spyOn(cliExecutor, 'executeStream').mockReturnValue({
        settled: Promise.resolve({ reason: 'exited', exitCode: 0 }),
        cancel: () => Promise.resolve({ reason: 'cancelled', exitCode: null }),
      })
      const onEvent = vi.fn()

      cliExecutor.initProjectStream('/repo/demo', onEvent)

      expect(executeStream).toHaveBeenCalledWith(['init', '/repo/demo', '--tools=none'], onEvent)
    })

    it('should call execute with init args and no tools (auto-detect)', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Initialized',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.init()

      expect(executeSpy).toHaveBeenCalledWith(['init'])
    })

    it('should call execute with specific tools', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Initialized',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.init({ tools: ['claude', 'cursor'] })

      expect(executeSpy).toHaveBeenCalledWith(['init', '--tools', 'claude,cursor'])
    })

    it('should call execute with tools=none', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Initialized',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.init({ tools: 'none' })

      expect(executeSpy).toHaveBeenCalledWith(['init', '--tools', 'none'])
    })

    it('should call execute with profile override', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Initialized',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.init({ profile: 'core' })

      expect(executeSpy).toHaveBeenCalledWith(['init', '--profile', 'core'])
    })

    it('should call execute with force flag', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Initialized',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.init({ force: true })

      expect(executeSpy).toHaveBeenCalledWith(['init', '--force'])
    })
  })

  describe('archive()', () => {
    it('should call execute with archive args and -y flag', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Archived',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.archive('change-123')

      expect(executeSpy).toHaveBeenCalledWith(['archive', '-y', 'change-123'])
    })

    it('should include --skip-specs when option is set', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Archived',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.archive('change-123', { skipSpecs: true })

      expect(executeSpy).toHaveBeenCalledWith(['archive', '-y', 'change-123', '--skip-specs'])
    })

    it('should include --no-validate when option is set', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Archived',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.archive('change-123', { noValidate: true })

      expect(executeSpy).toHaveBeenCalledWith(['archive', '-y', 'change-123', '--no-validate'])
    })
  })

  describe('validate()', () => {
    it('should call execute with validate args (no params)', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Valid',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.validate()

      expect(executeSpy).toHaveBeenCalledWith(['validate'])
    })

    it('should call execute with validate args (type only)', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Valid',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.validate('spec')

      expect(executeSpy).toHaveBeenCalledWith(['validate', '--type', 'spec'])
    })

    it('should call execute with validate args (type and id)', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Valid',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.validate('change', 'change-123')

      expect(executeSpy).toHaveBeenCalledWith(['validate', 'change-123', '--type', 'change'])
    })
  })

  describe('streaming root selectors', () => {
    it('preserves an explicitly empty Store selector for validate and archive', async () => {
      const executeStreamSpy = vi.spyOn(cliExecutor, 'executeStream').mockReturnValue({
        settled: Promise.resolve({ reason: 'exited', exitCode: 0 }),
        cancel: async () => ({ reason: 'exited', exitCode: 0 }),
      } satisfies CliStreamHandle)
      const onEvent = vi.fn()

      await cliExecutor.validateStream({ store: '' }, onEvent)
      await cliExecutor.archiveStream('change-123', { store: '' }, onEvent)

      expect(executeStreamSpy).toHaveBeenNthCalledWith(1, ['validate', '--store', ''], onEvent)
      expect(executeStreamSpy).toHaveBeenNthCalledWith(
        2,
        ['archive', '-y', 'change-123', '--store', ''],
        onEvent
      )
    })
  })

  describe('stream settlement ownership', () => {
    it.runIf(process.platform === 'win32')(
      'preserves shell-sensitive argv through a real npm-style .cmd stream',
      async () => {
        const command = await createWindowsNodeCommandShim(tempDir)
        await configManager.writeConfig({ cli: { command } })
        clearCache()
        const events: CliStreamEvent[] = []
        const handle = cliExecutor.executeStream(WINDOWS_SPECIAL_ARGUMENTS, (event) =>
          events.push(event)
        )

        await expect(handle.settled).resolves.toEqual({ reason: 'exited', exitCode: 0 })
        const stdout = events
          .filter((event) => event.type === 'stdout')
          .map((event) => event.data ?? '')
          .join('')
        expect(JSON.parse(stdout)).toEqual(WINDOWS_SPECIAL_ARGUMENTS)
      }
    )

    it('serializes command evidence without shell interpretation or argv loss', async () => {
      await configManager.writeConfig({ cli: { command: process.execPath } })
      clearCache()
      const events: CliStreamEvent[] = []
      const handle = cliExecutor.executeStream(
        ['-e', 'process.exit(0)', '/repo/$HOME/a&b;*.md'],
        (event) => events.push(event)
      )

      await handle.settled
      expect(events[0]).toEqual({
        type: 'command',
        data: JSON.stringify([process.execPath, '-e', 'process.exit(0)', '/repo/$HOME/a&b;*.md']),
      })
    })

    it('makes cancellation available before delayed CLI runner resolution completes', async () => {
      const runnerResolution = Promise.withResolvers<string[]>()
      vi.spyOn(configManager, 'getCliCommand').mockReturnValue(runnerResolution.promise)
      const onEvent = vi.fn()
      const handle = cliExecutor.executeStream(['-e', 'setInterval(() => {}, 1_000)'], onEvent)
      const cancellation = handle.cancel()
      runnerResolution.resolve([process.execPath])

      await expect(cancellation).resolves.toEqual({ reason: 'cancelled', exitCode: null })
      await expect(handle.settled).resolves.toEqual({ reason: 'cancelled', exitCode: null })
      expect(onEvent).toHaveBeenCalledOnce()
      expect(onEvent).toHaveBeenCalledWith({ type: 'exit', exitCode: null })
    })

    it.each([0, 7] as const)('settles a natural child exit %i exactly once', async (exitCode) => {
      await configManager.writeConfig({ cli: { command: process.execPath } })
      clearCache()
      const events: CliStreamEvent[] = []
      const handle = cliExecutor.executeStream(['-e', `process.exit(${exitCode})`], (event) =>
        events.push(event)
      )

      await expect(handle.settled).resolves.toEqual({ reason: 'exited', exitCode })
      await expect(handle.cancel()).resolves.toEqual({ reason: 'exited', exitCode })
      expect(events.filter((event) => event.type === 'exit')).toEqual([{ type: 'exit', exitCode }])
    })

    it.runIf(process.platform === 'win32')(
      'cancels a real tsx.cmd stream and retires every recorded descendant',
      async () => {
        await configManager.writeConfig({ cli: { command: TSX_WINDOWS_SHIM } })
        clearCache()
        const spawn = vi.mocked(spawnSafe)
        spawn.mockClear()
        const ready = Promise.withResolvers<void>()
        const handle = cliExecutor.executeStream(
          ['-e', "process.stdout.write('ready\\n'); setInterval(() => {}, 1_000)"],
          (event) => {
            if (event.type === 'stdout' && event.data?.includes('ready')) ready.resolve()
          }
        )

        let child: ChildProcess | undefined
        try {
          await ready.promise
          const started = spawn.mock.results.at(-1)?.value
          expect(started?.ok).toBe(true)
          if (!started?.ok) return
          child = started.child
          const trackedPids = await waitForWindowsProcessTree(child.pid ?? -1)
          expect(trackedPids.length).toBeGreaterThan(1)

          await expect(handle.cancel()).resolves.toMatchObject({ reason: 'cancelled' })

          await expect(waitForWindowsProcessesToExit(trackedPids)).resolves.toEqual([])
        } finally {
          await handle.cancel().catch(() => undefined)
          if (child) await terminateChildProcessTree(child, 'SIGKILL').catch(() => undefined)
        }
      },
      20_000
    )

    it.skipIf(process.platform === 'win32')(
      'settles a natural signal exit with a null exit code',
      async () => {
        await configManager.writeConfig({ cli: { command: process.execPath } })
        clearCache()
        const handle = cliExecutor.executeStream(
          ['-e', "process.kill(process.pid, 'SIGTERM')"],
          vi.fn()
        )

        await expect(handle.settled).resolves.toEqual({ reason: 'exited', exitCode: null })
      }
    )

    it.skipIf(process.platform === 'win32')(
      'escalates an ignored SIGTERM to SIGKILL and waits for confirmed close',
      async () => {
        await configManager.writeConfig({ cli: { command: process.execPath } })
        clearCache()
        const ready = Promise.withResolvers<void>()
        const handle = cliExecutor.executeStream(
          [
            '-e',
            "process.on('SIGTERM', () => {}); process.stdout.write('ready\\n'); setInterval(() => {}, 1_000)",
          ],
          (event) => {
            if (event.type === 'stdout' && event.data?.includes('ready')) ready.resolve()
          }
        )
        await ready.promise

        const cancelStartedAt = Date.now()
        const firstCancellation = handle.cancel()
        expect(handle.cancel()).toBe(firstCancellation)
        await expect(firstCancellation).resolves.toEqual({ reason: 'cancelled', exitCode: null })
        expect(Date.now() - cancelStartedAt).toBeGreaterThanOrEqual(900)
      }
    )

    it('keeps forced-timeout rejection immutable when the child closes late', async () => {
      vi.useFakeTimers()
      const child = new ChildProcess()
      const kill = vi.spyOn(child, 'kill').mockReturnValue(true)
      const spawn = vi.mocked(spawnSafe)
      spawn.mockReset()
      spawn.mockReturnValueOnce({ ok: true, child })
      vi.spyOn(configManager, 'getCliCommand').mockResolvedValue(['openspec'])
      const events: CliStreamEvent[] = []

      try {
        const handle = cliExecutor.executeStream(['validate'], (event) => events.push(event))
        await vi.advanceTimersByTimeAsync(0)
        expect(spawn).toHaveBeenCalledOnce()
        child.emit('spawn')

        const firstCancellation = handle.cancel()
        expect(handle.cancel()).toBe(firstCancellation)
        await vi.advanceTimersByTimeAsync(2_000)

        const firstFailure = await firstCancellation.catch((error: unknown) => error)
        expect(firstFailure).toBeInstanceOf(Error)
        expect(firstFailure).toMatchObject({ name: 'CliStreamTerminationError' })
        await expect(handle.settled).rejects.toBe(firstFailure)
        expect(kill).toHaveBeenNthCalledWith(1, 'SIGTERM')
        expect(kill).toHaveBeenNthCalledWith(2, 'SIGKILL')
        expect(events.filter((event) => event.type === 'exit')).toEqual([])
        expect(inspectCliStreamChildOwnership(child)).toMatchObject({
          currentChild: child,
          releaseCount: 0,
        })

        child.emit('close', 0)
        child.emit('close', 0)
        await vi.advanceTimersByTimeAsync(0)

        expect(inspectCliStreamChildOwnership(child)).toEqual({
          currentChild: null,
          releaseCount: 1,
        })
        await expect(handle.cancel()).rejects.toBe(firstFailure)
        expect(kill).toHaveBeenCalledTimes(2)
        expect(events.filter((event) => event.type === 'exit')).toEqual([])
      } finally {
        vi.useRealTimers()
      }
    })

    it('settles retry failure once and never retries after cancellation', async () => {
      await configManager.writeConfig({ cli: { command: 'nonexistent_command_12345' } })
      clearCache()
      const events: CliStreamEvent[] = []
      const handle = cliExecutor.executeStream(['validate'], (event) => events.push(event))

      await expect(handle.settled).resolves.toEqual({
        reason: 'startup-failed',
        exitCode: null,
      })
      expect(events.filter((event) => event.type === 'exit')).toHaveLength(1)
      await expect(handle.cancel()).resolves.toEqual({
        reason: 'startup-failed',
        exitCode: null,
      })
    })
  })

  describe('executeCommandStream()', () => {
    it('should resolve bare openspec through the configured runner', async () => {
      await configManager.writeConfig({
        cli: { command: process.execPath, args: ['-e', ECHO_SCRIPT] },
      })
      clearCache()

      const events: CliStreamEvent[] = []
      const done = new Promise<void>((resolve) => {
        cliExecutor.executeCommandStream(['openspec', 'hello', 'world'], (event) => {
          events.push(event)
          if (event.type === 'exit') {
            resolve()
          }
        })
      })

      await done

      expect(events[0]).toMatchObject({
        type: 'command',
        data: JSON.stringify([process.execPath, '-e', ECHO_SCRIPT, 'hello', 'world']),
      })
      expect(
        events.some((event) => event.type === 'stdout' && event.data?.includes('hello world'))
      ).toBe(true)
      expect(events.at(-1)).toMatchObject({ type: 'exit', exitCode: 0 })
    })

    it('should keep raw commands independent from the configured openspec runner', async () => {
      await configManager.writeConfig({ cli: { command: 'nonexistent_command_12345' } })
      clearCache()

      const events: CliStreamEvent[] = []
      const done = new Promise<void>((resolve) => {
        cliExecutor.executeCommandStream(
          ['node', '-e', "process.stdout.write('raw-ok')"],
          (event) => {
            events.push(event)
            if (event.type === 'exit') {
              resolve()
            }
          }
        )
      })

      await done

      expect(events[0]).toMatchObject({
        type: 'command',
        data: JSON.stringify(['node', '-e', "process.stdout.write('raw-ok')"]),
      })
      expect(
        events.some((event) => event.type === 'stdout' && event.data?.includes('raw-ok'))
      ).toBe(true)
      expect(events.at(-1)).toMatchObject({ type: 'exit', exitCode: 0 })
    })

    it('should emit stderr and exit for synchronous spawn errors', async () => {
      await configManager.writeConfig({ cli: { command: 'node\u0000broken' } })
      clearCache()

      const events: CliStreamEvent[] = []
      const done = new Promise<void>((resolve) => {
        void cliExecutor.executeStream(['arg'], (event) => {
          events.push(event)
          if (event.type === 'exit') {
            resolve()
          }
        })
      })

      await done

      expect(
        events.some(
          (event) => event.type === 'stderr' && event.data?.includes('without null bytes')
        )
      ).toBe(true)
      expect(events.at(-1)).toMatchObject({ type: 'exit', exitCode: null })
    })
  })

  describe('checkAvailability()', () => {
    it('retires both successful probe timeout handles', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      try {
        const result = await cliExecutor.checkAvailability(12_345)
        const probeTimers = setTimeoutSpy.mock.results.flatMap((entry, index) =>
          setTimeoutSpy.mock.calls[index]?.[1] === 12_345 && entry.type === 'return'
            ? [entry.value]
            : []
        )

        expect(result.available).toBe(true)
        expect(probeTimers).toHaveLength(2)
        for (const timer of probeTimers) {
          expect(clearTimeoutSpy).toHaveBeenCalledWith(timer)
        }
      } finally {
        clearTimeoutSpy.mockRestore()
        setTimeoutSpy.mockRestore()
      }
    })

    it('should return available when command succeeds', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.checkAvailability()

      expect(result.available).toBe(true)
      expect(result.version).toBeDefined()
      expect(result.effectiveCommand).toBe('node')
    })

    it('should return not available when runner resolve fails', async () => {
      vi.spyOn(configManager, 'getResolvedCliRunner').mockRejectedValue(new Error('resolve failed'))
      const result = await cliExecutor.checkAvailability()
      expect(result.available).toBe(false)
      expect(result.error).toBe('resolve failed')
    })

    it('should report unavailable for invalid configured execute path', async () => {
      await configManager.writeConfig({ cli: { command: 'nonexistent_command_12345' } })
      clearCache()
      const result = await cliExecutor.checkAvailability()
      expect(result.available).toBe(false)
      expect(result.error).toContain('nonexistent_command_12345')
    })
  })

  describe('integration with real CLI', () => {
    // 这些测试使用真实的 CLI 命令
    // 根据用户要求：在临时文件中使用真实的 CLI

    it('should execute a portable output command', async () => {
      await configManager.writeConfig({
        cli: { command: process.execPath, args: ['-e', ECHO_SCRIPT] },
      })
      clearCache()

      const result = await cliExecutor.execute(['test', 'message'])

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('test message')
    })

    it('should execute command in project directory', async () => {
      // 创建一些文件
      await writeFile(join(tempDir, 'file1.txt'), 'content')
      await writeFile(join(tempDir, 'file2.txt'), 'content')

      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.execute([
        '-e',
        "const fs=require('fs');process.stdout.write(fs.readdirSync('.').join('\\n'))",
      ])

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('file1.txt')
      expect(result.stdout).toContain('file2.txt')
    })

    it('should handle command with environment variables', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()
      const homeEnvironmentVariable = process.platform === 'win32' ? 'USERPROFILE' : 'HOME'
      const expectedHome = process.env[homeEnvironmentVariable]

      expect(expectedHome).toBeTypeOf('string')

      const result = await cliExecutor.execute([
        '-e',
        `process.stdout.write(process.env.${homeEnvironmentVariable} || '')`,
      ])

      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe(expectedHome)
    })
  })
})

describe('CliResult', () => {
  it('should have correct structure', () => {
    const result: CliResult = {
      success: true,
      stdout: 'output',
      stderr: '',
      exitCode: 0,
    }

    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('stdout')
    expect(result).toHaveProperty('stderr')
    expect(result).toHaveProperty('exitCode')
  })
})
