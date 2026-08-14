/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Resolve platform-correct daemon runtime and log paths under the OpenSpecUI home.
 * 2. Derive a bounded Windows named pipe from the default user scope or explicit OpenSpecUI home.
 * 3. Normalize equivalent Windows home spellings before deriving endpoint identity.
 *
 * Windows correction (2026-08-04): explicit OpenSpecUI homes require independent named pipes.
 * Original request (2026-07-29): "start/stop/restart 针对 daemon 的语义。"
 */
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { posix, win32 } from 'node:path'

export interface DaemonPaths {
  homeDir: string
  runDir: string
  logsDir: string
  endpoint: string
  logFile: string
}

function endpointScopeIdentity(scope: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? win32.resolve(scope).toLowerCase() : scope
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
  const pathApi = platform === 'win32' ? win32 : posix
  const explicitHomeDir = options.openspecuiHome ?? process.env.OPENSPECUI_HOME
  const homeDir = explicitHomeDir ?? pathApi.join(userHome, '.openspecui')
  const runDir = pathApi.join(homeDir, 'run')
  const logsDir = pathApi.join(homeDir, 'logs')
  const endpointScope = explicitHomeDir ?? userHome
  const homeDigest = createHash('sha256')
    .update(endpointScopeIdentity(endpointScope, platform))
    .digest('hex')
    .slice(0, 16)
  return {
    homeDir,
    runDir,
    logsDir,
    endpoint:
      platform === 'win32'
        ? `\\\\.\\pipe\\openspecui-${homeDigest}`
        : pathApi.join(runDir, 'daemon.sock'),
    logFile: pathApi.join(logsDir, 'daemon.log'),
  }
}
