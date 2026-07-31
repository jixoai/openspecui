/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Control detached daemon start, stop, restart, readiness, and immutable host/OpenSpec execution modes.
 * 2. Preserve external ownership while transferring only daemon-managed directory intent across restart.
 * 3. Keep daemon spawn arguments and logs free of credentials and private launch URLs.
 *
 * Original request (2026-07-29): "参数变化时提醒用户把 start 改成 restart。"
 * Owner lifecycle decision (2026-07-30): daemon restart restores the managed running directory set.
 * Original request (2026-07-31): "通过 OPENSPEC_SPAWN_MODE=process|worker 来进行区分两种模式。"
 */
import {
  OPENSPEC_SPAWN_MODE_ENV,
  resolveOpenSpecSpawnMode,
  type OpenSpecSpawnMode,
} from '@openspecui/core'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import type { CliDaemonPort, DaemonStatusEvidence, WorkspaceRegistration } from './cli-execution.js'
import { resolveDaemonPaths, type DaemonPaths } from './daemon-paths.js'
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

const DAEMON_START_TIMEOUT_MS = 10_000
const DAEMON_STOP_TIMEOUT_MS = 5_000

function toStatusEvidence(status: DaemonStatus): DaemonStatusEvidence {
  return {
    version: status.version,
    hostMode: status.hostMode,
    openSpecSpawnMode: status.openSpecSpawnMode,
    appUrl: status.appUrl,
  }
}

function workspaceIdFor(projectDir: string): string {
  return `workspace-${createHash('sha256').update(projectDir).digest('hex').slice(0, 20)}`
}

async function readStatus(paths: DaemonPaths): Promise<DaemonStatus | null> {
  try {
    const result = await sendDaemonCommand({
      endpoint: paths.endpoint,
      command: { type: 'status' },
    })
    return result.kind === 'status' ? result.status : null
  } catch (error) {
    if (error instanceof DaemonUnavailableError) return null
    throw error
  }
}

async function waitForStatus(paths: DaemonPaths, timeoutMs: number): Promise<DaemonStatus> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const status = await readStatus(paths)
    if (status) return status
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`App daemon did not become ready within ${timeoutMs}ms. See ${paths.logFile}.`)
}

async function waitForStop(paths: DaemonPaths, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await readStatus(paths)) === null) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`App daemon endpoint did not stop within ${timeoutMs}ms.`)
}

function correctiveRestartCommand(mode: DaemonHostMode): string {
  return mode === 'web' ? 'openspecui restart --web' : 'openspecui restart'
}

function correctiveSpawnModeRestartCommand(
  spawnMode: OpenSpecSpawnMode,
  hostMode: DaemonHostMode
): string {
  const command = correctiveRestartCommand(hostMode)
  return spawnMode === 'worker' ? command : `${OPENSPEC_SPAWN_MODE_ENV}=process ${command}`
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
}): CliDaemonPort {
  const paths = options.paths ?? resolveDaemonPaths()
  const platform = options.platform ?? process.platform
  const controllerEnv = options.env ?? process.env
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
    try {
      const child = spawn(
        options.execPath ?? process.execPath,
        [...(options.execArgv ?? process.execArgv), options.entryPath],
        {
          detached: true,
          env,
          stdio: ['ignore', logFd, logFd],
        }
      )
      child.unref()
    } finally {
      closeSync(logFd)
    }
    const status = await waitForStatus(paths, DAEMON_START_TIMEOUT_MS)
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
    return status
  }

  return {
    async status() {
      const status = await readStatus(paths)
      return status ? toStatusEvidence(status) : null
    },
    async start(requestedHostMode) {
      const current = await readStatus(paths)
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
            `OpenSpecUI App daemon is running with OpenSpec ${current.openSpecSpawnMode} execution. Run ${correctiveSpawnModeRestartCommand(requestedOpenSpecSpawnMode, current.hostMode)} to change execution mode.`
          )
        }
        await sendDaemonCommand({ endpoint: paths.endpoint, command: { type: 'activate' } })
        return toStatusEvidence(current)
      }
      return toStatusEvidence(await spawnDaemon(requestedHostMode))
    },
    async stop() {
      if ((await readStatus(paths)) === null) return false
      await sendDaemonCommand({ endpoint: paths.endpoint, command: { type: 'stop' } })
      await waitForStop(paths, DAEMON_STOP_TIMEOUT_MS)
      return true
    },
    async restart(requestedHostMode) {
      let restoreProjectDirs: readonly string[] = []
      if ((await readStatus(paths)) !== null) {
        const prepared = await sendDaemonCommand({
          endpoint: paths.endpoint,
          command: { type: 'prepare-restart' },
        })
        if (prepared.kind !== 'restart-prepared') {
          throw new Error('App daemon did not return managed restart state.')
        }
        restoreProjectDirs = prepared.projectDirs
        await waitForStop(paths, DAEMON_STOP_TIMEOUT_MS)
      }
      return toStatusEvidence(await spawnDaemon(requestedHostMode, restoreProjectDirs))
    },
    async registerWorkspace(registration: WorkspaceRegistration) {
      return createDaemonWorkspaceLease({
        endpoint: paths.endpoint,
        workspace: { id: workspaceIdFor(registration.projectDir), ...registration },
      })
    },
    async activate() {
      await sendDaemonCommand({ endpoint: paths.endpoint, command: { type: 'activate' } })
    },
  }
}
