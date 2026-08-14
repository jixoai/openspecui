/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Prove failed daemon launches retain their exact child owner until bounded tree settlement.
 * 2. Prove Windows forced Stop targets only the unchanged authoritative daemon PID and executable.
 * 3. Prove Windows launch options and corrective command text remain native-shell compatible.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDaemonController } from './daemon-controller.js'
import { resolveDaemonPaths, type DaemonPaths } from './daemon-paths.js'
import type { DaemonStatus } from './daemon-protocol.js'
import { DaemonUnavailableError } from './daemon-transport.js'

type ControllerRuntime = NonNullable<Parameters<typeof createDaemonController>[0]['runtime']>
type SpawnProcess = NonNullable<ControllerRuntime['spawnProcess']>
type StatusReader = NonNullable<ControllerRuntime['readStatus']>
type SendCommand = NonNullable<ControllerRuntime['sendCommand']>
type TerminateChildTree = NonNullable<ControllerRuntime['terminateChildTree']>
type TerminatePidTree = NonNullable<ControllerRuntime['terminatePidTreeByIdentity']>

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function createPaths(): Promise<DaemonPaths> {
  const homeDir = await mkdtemp(join(tmpdir(), 'openspecui-daemon-lifecycle-'))
  tempDirs.push(homeDir)
  return resolveDaemonPaths({
    platform: 'win32',
    userHome: homeDir,
    openspecuiHome: homeDir,
  })
}

function daemonStatus(overrides: Partial<DaemonStatus> = {}): DaemonStatus {
  return {
    version: '6.1.0',
    pid: 41_001,
    hostMode: 'native',
    openSpecSpawnMode: 'worker',
    appUrl: 'http://127.0.0.1:14000',
    capabilities: { browser: true, nativeWindow: true },
    ...overrides,
  }
}

function createFakeChild(pid = 42_001): {
  child: ChildProcess
  unref: ReturnType<typeof vi.spyOn>
} {
  const child = new ChildProcess()
  Object.defineProperty(child, 'pid', { configurable: true, value: pid })
  Object.defineProperty(child, 'spawnfile', {
    configurable: true,
    value: process.execPath,
  })
  return {
    child,
    unref: vi.spyOn(child, 'unref').mockReturnValue(child),
  }
}

function markChildExited(child: ChildProcess): void {
  Object.defineProperty(child, 'exitCode', { configurable: true, value: 1 })
}

describe.runIf(process.platform === 'win32')('Windows daemon lifecycle settlement', () => {
  it('spawns hidden and retires the exact child when readiness times out', async () => {
    const paths = await createPaths()
    const { child, unref } = createFakeChild()
    const spawnProcess = vi.fn<SpawnProcess>(() => child)
    const readStatus = vi.fn<StatusReader>(async () => null)
    const terminateChildTree = vi.fn<TerminateChildTree>(async (ownedChild) => {
      expect(ownedChild).toBe(child)
      markChildExited(ownedChild)
    })
    const controller = createDaemonController({
      version: '6.1.0',
      entryPath: 'E:\\fixture\\cli.mjs',
      paths,
      platform: 'win32',
      runtime: {
        cleanupTimeoutMs: 100,
        readStatus,
        spawnProcess,
        startTimeoutMs: 1,
        terminateChildTree,
      },
    })

    await expect(controller.start(undefined)).rejects.toThrow(
      'App daemon did not become ready within 1ms.'
    )
    expect(spawnProcess.mock.calls[0]?.[2]).toMatchObject({
      detached: true,
      windowsHide: true,
    })
    expect(terminateChildTree).toHaveBeenCalledWith(child, 'SIGKILL')
    expect(unref).not.toHaveBeenCalled()
  })

  it('retires its own child when another daemon PID wins the readiness endpoint', async () => {
    const paths = await createPaths()
    const observed = daemonStatus()
    const { child, unref } = createFakeChild(observed.pid + 1)
    let initialRead = true
    const readStatus = vi.fn<StatusReader>(async () => {
      if (initialRead) {
        initialRead = false
        return null
      }
      return observed
    })
    const terminateChildTree = vi.fn<TerminateChildTree>(async (ownedChild) => {
      markChildExited(ownedChild)
    })
    const controller = createDaemonController({
      version: '6.1.0',
      entryPath: 'E:\\fixture\\cli.mjs',
      paths,
      platform: 'win32',
      runtime: {
        cleanupTimeoutMs: 100,
        readStatus,
        spawnProcess: vi.fn<SpawnProcess>(() => child),
        terminateChildTree,
      },
    })

    await expect(controller.start(undefined)).rejects.toThrow(
      `Newly spawned App daemon PID ${child.pid} did not own the ready endpoint; observed PID ${observed.pid}.`
    )
    expect(terminateChildTree).toHaveBeenCalledWith(child, 'SIGKILL')
    expect(unref).not.toHaveBeenCalled()
  })

  it.each([
    {
      label: 'version mismatch',
      observed: daemonStatus({ version: '6.0.0' }),
      message: 'App daemon v6.0.0 does not match CLI v6.1.0.',
    },
    {
      label: 'spawn-mode mismatch',
      observed: daemonStatus({ openSpecSpawnMode: 'process' }),
      message: 'App daemon started with OpenSpec process execution instead of worker.',
    },
  ])('retires the new child after $label', async ({ observed, message }) => {
    const paths = await createPaths()
    const { child, unref } = createFakeChild(observed.pid)
    let initialRead = true
    const readStatus = vi.fn<StatusReader>(async () => {
      if (initialRead) {
        initialRead = false
        return null
      }
      return observed
    })
    const terminateChildTree = vi.fn<TerminateChildTree>(async (ownedChild) => {
      markChildExited(ownedChild)
    })
    const controller = createDaemonController({
      version: '6.1.0',
      entryPath: 'E:\\fixture\\cli.mjs',
      paths,
      platform: 'win32',
      runtime: {
        cleanupTimeoutMs: 100,
        readStatus,
        spawnProcess: vi.fn<SpawnProcess>(() => child),
        terminateChildTree,
      },
    })

    await expect(controller.start(undefined)).rejects.toThrow(message)
    expect(terminateChildTree).toHaveBeenCalledWith(child, 'SIGKILL')
    expect(unref).not.toHaveBeenCalled()
  })

  it('forces a timed-out Stop only while status still identifies the same daemon', async () => {
    const paths = await createPaths()
    const current = daemonStatus()
    let terminated = false
    const readStatus = vi.fn<StatusReader>(async () => (terminated ? null : current))
    const sendCommand = vi.fn<SendCommand>(async () => {
      throw new DaemonUnavailableError('Timed out contacting App daemon.')
    })
    const terminatePidTreeByIdentity = vi.fn<TerminatePidTree>(async () => {
      terminated = true
    })
    const controller = createDaemonController({
      version: '6.1.0',
      entryPath: 'E:\\fixture\\cli.mjs',
      execPath: process.execPath,
      paths,
      platform: 'win32',
      runtime: {
        cleanupTimeoutMs: 100,
        readStatus,
        sendCommand,
        stopTimeoutMs: 100,
        terminatePidTreeByIdentity,
      },
    })

    await expect(controller.stop()).resolves.toBe(true)
    expect(terminatePidTreeByIdentity).toHaveBeenCalledWith(current.pid, process.execPath)
  })

  it('refuses forced Stop when the endpoint changes daemon identity after the timeout', async () => {
    const paths = await createPaths()
    const current = daemonStatus()
    const replacement = daemonStatus({ pid: current.pid + 1 })
    let readCount = 0
    const readStatus = vi.fn<StatusReader>(async () => {
      readCount += 1
      return readCount === 1 ? current : replacement
    })
    const sendCommand = vi.fn<SendCommand>(async () => {
      throw new DaemonUnavailableError('Timed out contacting App daemon.')
    })
    const terminatePidTreeByIdentity = vi.fn<TerminatePidTree>(async () => undefined)
    const controller = createDaemonController({
      version: '6.1.0',
      entryPath: 'E:\\fixture\\cli.mjs',
      execPath: process.execPath,
      paths,
      platform: 'win32',
      runtime: {
        readStatus,
        sendCommand,
        terminatePidTreeByIdentity,
      },
    })

    await expect(controller.stop()).rejects.toThrow(
      `Refusing forced App daemon stop: expected PID ${current.pid}, endpoint now reports PID ${replacement.pid}.`
    )
    expect(terminatePidTreeByIdentity).not.toHaveBeenCalled()
  })

  it('renders process-mode correction through cmd.exe instead of POSIX assignment', async () => {
    const paths = await createPaths()
    const readStatus = vi.fn<StatusReader>(async () => daemonStatus())
    const controller = createDaemonController({
      version: '6.1.0',
      entryPath: 'E:\\fixture\\cli.mjs',
      env: { ...process.env, OPENSPEC_SPAWN_MODE: 'process' },
      paths,
      platform: 'win32',
      runtime: { readStatus },
    })

    await expect(controller.start(undefined)).rejects.toThrow(
      'Run cmd.exe /d /s /c "set OPENSPEC_SPAWN_MODE=process&& openspecui restart" to change execution mode.'
    )
  })
})
