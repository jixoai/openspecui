/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Control detached daemon start, stop, restart, bounded cold-start readiness, and immutable host/OpenSpec execution modes.
 * 2. Preserve external ownership while transferring only daemon-managed directory intent across restart.
 * 3. Keep daemon spawn arguments and logs free of credentials and private launch URLs.
 * 4. Retire failed Windows daemon launches and unresponsive owned endpoints through verified bounded process-tree settlement.
 * 5. Register physical project directories under one alias-independent Workspace identity.
 *
 * Windows correction (2026-08-04): source-mode daemon cold start receives a 30-second readiness window.
 *
 * Original request (2026-07-29): "参数变化时提醒用户把 start 改成 restart。"
 * Owner lifecycle decision (2026-07-30): daemon restart restores the managed running directory set.
 * Original request (2026-07-31): "通过 OPENSPEC_SPAWN_MODE=process|worker 来进行区分两种模式。"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import {
  OPENSPEC_SPAWN_MODE_ENV,
  resolveOpenSpecSpawnMode,
  terminateChildProcessTree,
  terminateWindowsProcessTreeByIdentity,
  type OpenSpecSpawnMode,
} from '@openspecui/core'
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import type { CliDaemonPort, DaemonStatusEvidence, WorkspaceRegistration } from './cli-execution.js'
import { resolveDaemonPaths, type DaemonPaths } from './daemon-paths.js'
import {
  DaemonLifecycleTimeoutError,
  isSameDaemonStatus,
  rethrowAfterSpawnCleanup,
  waitForDaemonStatus,
  waitForDaemonStop,
  withDaemonLifecycleTimeout,
  type DaemonStatusReader,
} from './daemon-process-lifecycle.js'
import {
  DAEMON_HOST_MODE_ENV,
  DAEMON_RESTORE_PROJECTS_ENV,
  DAEMON_RUN_ENV,
} from './daemon-process.js'
import type { DaemonHostMode, DaemonStatus } from './daemon-protocol.js'
import {
  createDaemonWorkspaceLease,
  DaemonUnavailableError,
  sendDaemonCommand,
} from './daemon-transport.js'
import { resolveWorkspaceIdentity } from './workspace-identity.js'

const DAEMON_START_TIMEOUT_MS = 30_000
const DAEMON_STOP_TIMEOUT_MS = 5_000
const DAEMON_CLEANUP_TIMEOUT_MS = 5_000

type DaemonProcessSpawner = (command: string, args: string[], options: SpawnOptions) => ChildProcess

interface DaemonControllerRuntime {
  cleanupTimeoutMs?: number
  readStatus?: DaemonStatusReader
  sendCommand?: typeof sendDaemonCommand
  spawnProcess?: DaemonProcessSpawner
  startTimeoutMs?: number
  stopTimeoutMs?: number
  terminateChildTree?: (child: ChildProcess, signal: NodeJS.Signals) => Promise<void>
  terminatePidTreeByIdentity?: (pid: number, expectedExecutablePath: string) => Promise<void>
}

function toStatusEvidence(status: DaemonStatus): DaemonStatusEvidence {
  return {
    version: status.version,
    hostMode: status.hostMode,
    openSpecSpawnMode: status.openSpecSpawnMode,
    appUrl: status.appUrl,
  }
}

async function readStatus(
  paths: DaemonPaths,
  sendCommand: typeof sendDaemonCommand
): Promise<DaemonStatus | null> {
  try {
    const result = await sendCommand({
      endpoint: paths.endpoint,
      command: { type: 'status' },
    })
    return result.kind === 'status' ? result.status : null
  } catch (error) {
    if (error instanceof DaemonUnavailableError) return null
    throw error
  }
}

function correctiveRestartCommand(mode: DaemonHostMode): string {
  return mode === 'web' ? 'openspecui restart --web' : 'openspecui restart'
}

function correctiveSpawnModeRestartCommand(
  spawnMode: OpenSpecSpawnMode,
  hostMode: DaemonHostMode,
  platform: NodeJS.Platform
): string {
  const command = correctiveRestartCommand(hostMode)
  if (spawnMode === 'worker') return command
  return platform === 'win32'
    ? `cmd.exe /d /s /c "set ${OPENSPEC_SPAWN_MODE_ENV}=process&& ${command}"`
    : `${OPENSPEC_SPAWN_MODE_ENV}=process ${command}`
}

/** Create the production daemon controller for this CLI entry and user. */
export function createDaemonController(options: {
  version: string
  entryPath: string
  execPath?: string
  execArgv?: readonly string[]
  env?: NodeJS.ProcessEnv
  paths?: DaemonPaths
  platform?: NodeJS.Platform
  runtime?: DaemonControllerRuntime
}): CliDaemonPort {
  const paths = options.paths ?? resolveDaemonPaths()
  const platform = options.platform ?? process.platform
  const controllerEnv = options.env ?? process.env
  const runtime = options.runtime ?? {}
  const sendCommand = runtime.sendCommand ?? sendDaemonCommand
  const readDaemonStatus = runtime.readStatus ?? (() => readStatus(paths, sendCommand))
  const spawnProcess: DaemonProcessSpawner =
    runtime.spawnProcess ?? ((command, args, spawnOptions) => spawn(command, args, spawnOptions))
  const terminateSpawnedTree = runtime.terminateChildTree ?? terminateChildProcessTree
  const terminatePidTree =
    runtime.terminatePidTreeByIdentity ?? terminateWindowsProcessTreeByIdentity
  const startTimeoutMs = runtime.startTimeoutMs ?? DAEMON_START_TIMEOUT_MS
  const stopTimeoutMs = runtime.stopTimeoutMs ?? DAEMON_STOP_TIMEOUT_MS
  const cleanupTimeoutMs = runtime.cleanupTimeoutMs ?? DAEMON_CLEANUP_TIMEOUT_MS
  const expectedExecutablePath = options.execPath ?? process.execPath
  const requestedOpenSpecSpawnMode = resolveOpenSpecSpawnMode(
    controllerEnv[OPENSPEC_SPAWN_MODE_ENV]
  )

  const spawnDaemon = async (
    requestedHostMode: 'web' | undefined,
    restoreProjectDirs: readonly string[] = []
  ): Promise<DaemonStatus> => {
    const hostMode: DaemonHostMode = requestedHostMode ?? (platform === 'linux' ? 'web' : 'native')
    mkdirSync(paths.logsDir, { recursive: true, mode: 0o700 })
    const logFd = openSync(paths.logFile, 'a', 0o600)
    const env = { ...controllerEnv }
    env[OPENSPEC_SPAWN_MODE_ENV] = requestedOpenSpecSpawnMode
    env[DAEMON_RUN_ENV] = '1'
    env[DAEMON_HOST_MODE_ENV] = hostMode
    if (restoreProjectDirs.length > 0) {
      env[DAEMON_RESTORE_PROJECTS_ENV] = JSON.stringify(restoreProjectDirs)
    }
    let child: ChildProcess
    try {
      child = spawnProcess(
        expectedExecutablePath,
        [...(options.execArgv ?? process.execArgv), options.entryPath],
        {
          detached: true,
          env,
          stdio: ['ignore', logFd, logFd],
          windowsHide: true,
        }
      )
    } finally {
      closeSync(logFd)
    }

    let rejectSpawnFailure: (error: Error) => void = () => undefined
    const spawnFailure = new Promise<never>((_resolve, reject) => {
      rejectSpawnFailure = reject
    })
    const onSpawnError = (error: Error) => rejectSpawnFailure(error)
    child.once('error', onSpawnError)
    try {
      const status = await Promise.race([
        waitForDaemonStatus(readDaemonStatus, startTimeoutMs, paths.logFile),
        spawnFailure,
      ])
      if (child.pid !== undefined && status.pid !== child.pid) {
        throw new Error(
          `Newly spawned App daemon PID ${child.pid} did not own the ready endpoint; observed PID ${status.pid}.`
        )
      }
      if (status.version !== options.version) {
        throw new Error(
          `App daemon v${status.version} does not match CLI v${options.version}. Run ${correctiveRestartCommand(status.hostMode)}.`
        )
      }
      if (status.openSpecSpawnMode !== requestedOpenSpecSpawnMode) {
        throw new Error(
          `App daemon started with OpenSpec ${status.openSpecSpawnMode} execution instead of ${requestedOpenSpecSpawnMode}.`
        )
      }
      child.off('error', onSpawnError)
      child.unref()
      return status
    } catch (error) {
      child.off('error', onSpawnError)
      return rethrowAfterSpawnCleanup(child, error, terminateSpawnedTree, cleanupTimeoutMs)
    }
  }

  const forceStopObservedDaemon = async (
    expectedStatus: DaemonStatus,
    lifecycleFailure: unknown
  ): Promise<void> => {
    const observedStatus = await readDaemonStatus()
    if (!observedStatus) return
    if (!isSameDaemonStatus(expectedStatus, observedStatus)) {
      throw new Error(
        `Refusing forced App daemon stop: expected PID ${expectedStatus.pid}, endpoint now reports PID ${observedStatus.pid}.`,
        { cause: lifecycleFailure }
      )
    }
    if (platform !== 'win32') throw lifecycleFailure
    await withDaemonLifecycleTimeout(
      terminatePidTree(observedStatus.pid, expectedExecutablePath),
      cleanupTimeoutMs,
      `Timed out terminating App daemon PID ${observedStatus.pid}.`
    )
    await waitForDaemonStop(readDaemonStatus, stopTimeoutMs)
  }

  const waitForStopWithFallback = async (expectedStatus: DaemonStatus): Promise<void> => {
    try {
      await waitForDaemonStop(readDaemonStatus, stopTimeoutMs)
    } catch (error) {
      if (!(error instanceof DaemonLifecycleTimeoutError)) throw error
      await forceStopObservedDaemon(expectedStatus, error)
    }
  }

  return {
    async status() {
      const status = await readDaemonStatus()
      return status ? toStatusEvidence(status) : null
    },
    async start(requestedHostMode) {
      const current = await readDaemonStatus()
      if (current) {
        if (current.version !== options.version) {
          throw new Error(
            `OpenSpecUI App daemon v${current.version} is running, but this CLI is v${options.version}. Run ${correctiveRestartCommand(current.hostMode)}.`
          )
        }
        if (requestedHostMode && current.hostMode !== requestedHostMode) {
          throw new Error(
            `OpenSpecUI App daemon is running in ${current.hostMode} mode. Run ${correctiveRestartCommand(requestedHostMode)} to change startup mode.`
          )
        }
        if (current.openSpecSpawnMode !== requestedOpenSpecSpawnMode) {
          throw new Error(
            `OpenSpecUI App daemon is running with OpenSpec ${current.openSpecSpawnMode} execution. Run ${correctiveSpawnModeRestartCommand(requestedOpenSpecSpawnMode, current.hostMode, platform)} to change execution mode.`
          )
        }
        await sendCommand({ endpoint: paths.endpoint, command: { type: 'activate' } })
        return toStatusEvidence(current)
      }
      return toStatusEvidence(await spawnDaemon(requestedHostMode))
    },
    async stop() {
      const current = await readDaemonStatus()
      if (!current) return false
      try {
        await sendCommand({ endpoint: paths.endpoint, command: { type: 'stop' } })
      } catch (error) {
        if (!(error instanceof DaemonUnavailableError)) throw error
        await forceStopObservedDaemon(current, error)
        return true
      }
      await waitForStopWithFallback(current)
      return true
    },
    async restart(requestedHostMode) {
      let restoreProjectDirs: readonly string[] = []
      const current = await readDaemonStatus()
      if (current) {
        const prepared = await sendCommand({
          endpoint: paths.endpoint,
          command: { type: 'prepare-restart' },
        })
        if (prepared.kind !== 'restart-prepared') {
          throw new Error('App daemon did not return managed restart state.')
        }
        restoreProjectDirs = prepared.projectDirs
        await waitForStopWithFallback(current)
      }
      return toStatusEvidence(await spawnDaemon(requestedHostMode, restoreProjectDirs))
    },
    async registerWorkspace(registration: WorkspaceRegistration) {
      const identity = await resolveWorkspaceIdentity(registration.projectDir, platform)
      return createDaemonWorkspaceLease({
        endpoint: paths.endpoint,
        workspace: {
          id: identity.id,
          projectDir: identity.projectDir,
          backendUrl: registration.backendUrl,
          credential: registration.credential,
        },
      })
    },
    async activate() {
      await sendCommand({ endpoint: paths.endpoint, command: { type: 'activate' } })
    },
  }
}
