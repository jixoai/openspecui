/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Project the inherited OpenSpec user-data root without introducing project overrides.
 * 2. Match OpenSpec 1.6 XDG and platform fallback rules exactly.
 * 3. Preserve the environment source as read-only diagnostic evidence.
 *
 * Original request (2026-07-15): "OpenSpecUI inherits the launch environment's XDG_DATA_HOME."
 */
import { homedir as getHomeDirectory, platform as getPlatform } from 'node:os'
import { posix, win32 } from 'node:path'

/** Directory name appended to the selected platform user-data root. */
export const OPEN_SPEC_DATA_DIRECTORY_NAME = 'openspec'

/** Provenance categories for the effective OpenSpec user-data root. */
export type OpenSpecDataScopeSource = 'xdg-data-home' | 'local-app-data' | 'user-home-default'

/** Effective OpenSpec user-data root and its selection provenance. */
export interface OpenSpecDataScope {
  /** Effective OpenSpec user-data root used by the inherited process environment. */
  path: string
  /** Objective provenance for the selected path. */
  source: OpenSpecDataScopeSource
  /** Environment variable that selected the path, or null for the home-directory fallback. */
  environmentVariable: 'XDG_DATA_HOME' | 'LOCALAPPDATA' | null
}

/** Optional process/platform inputs used to resolve OpenSpec data scope deterministically. */
export interface ResolveOpenSpecDataScopeOptions {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  homedir?: string
}

function joinPlatformPath(platform: NodeJS.Platform, ...segments: string[]): string {
  return platform === 'win32' ? win32.join(...segments) : posix.join(...segments)
}

/** Resolve the read-only data-scope diagnostic using OpenSpec 1.6's platform rules. */
export function resolveOpenSpecDataScope(
  options: ResolveOpenSpecDataScopeOptions = {}
): OpenSpecDataScope {
  const env = options.env ?? process.env
  const platform = options.platform ?? getPlatform()
  const homedir = options.homedir ?? getHomeDirectory()

  if (env.XDG_DATA_HOME) {
    return {
      path: joinPlatformPath(platform, env.XDG_DATA_HOME, OPEN_SPEC_DATA_DIRECTORY_NAME),
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    }
  }

  if (platform === 'win32' && env.LOCALAPPDATA) {
    return {
      path: joinPlatformPath(platform, env.LOCALAPPDATA, OPEN_SPEC_DATA_DIRECTORY_NAME),
      source: 'local-app-data',
      environmentVariable: 'LOCALAPPDATA',
    }
  }

  return {
    path:
      platform === 'win32'
        ? joinPlatformPath(platform, homedir, 'AppData', 'Local', OPEN_SPEC_DATA_DIRECTORY_NAME)
        : joinPlatformPath(platform, homedir, '.local', 'share', OPEN_SPEC_DATA_DIRECTORY_NAME),
    source: 'user-home-default',
    environmentVariable: null,
  }
}
