/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Resolve user-isolated daemon runtime and log paths under the OpenSpecUI home.
 * 2. Derive a bounded Windows named pipe from the physical user home.
 *
 * Original request (2026-07-29): "start/stop/restart 针对 daemon 的语义。"
 */
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface DaemonPaths {
  homeDir: string
  runDir: string
  logsDir: string
  endpoint: string
  logFile: string
}

/** Resolve one user's daemon endpoint without using project or OpenSpec data-home state. */
export function resolveDaemonPaths(
  options: {
    platform?: NodeJS.Platform
    userHome?: string
    openspecuiHome?: string
  } = {}
): DaemonPaths {
  const platform = options.platform ?? process.platform
  const userHome = options.userHome ?? homedir()
  const homeDir =
    options.openspecuiHome ?? process.env.OPENSPECUI_HOME ?? join(userHome, '.openspecui')
  const runDir = join(homeDir, 'run')
  const logsDir = join(homeDir, 'logs')
  const homeDigest = createHash('sha256').update(userHome).digest('hex').slice(0, 16)
  return {
    homeDir,
    runDir,
    logsDir,
    endpoint:
      platform === 'win32' ? `\\\\.\\pipe\\openspecui-${homeDigest}` : join(runDir, 'daemon.sock'),
    logFile: join(logsDir, 'daemon.log'),
  }
}
