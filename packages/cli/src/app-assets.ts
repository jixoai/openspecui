/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Resolve the App build projected into the CLI package without public URL configuration.
 * 2. Reject missing CLI-owned App assets instead of consuming an unprojected workspace build.
 *
 * Original request (2026-07-29): "放弃 app-url 的支持。"
 * Owner correction (2026-07-30): the App build itself copies its output into the CLI project.
 */
import { access } from 'node:fs/promises'
import { join } from 'node:path'

export function getAppAssetsDir(runtimeDir: string): string {
  return join(runtimeDir, '..', 'app')
}

/** Resolve the App entry physically owned by the CLI package. */
export async function resolveAppAssetsDir(runtimeDir: string): Promise<string> {
  const assetsDir = getAppAssetsDir(runtimeDir)
  try {
    await access(join(assetsDir, 'index.html'))
    return assetsDir
  } catch {
    throw new Error(
      'Bundled OpenSpecUI App assets are missing. Reinstall or rebuild the App package.'
    )
  }
}
