/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Resolve bundled and monorepo App asset candidates without public URL configuration.
 * 2. Select only a physically present App entry document.
 *
 * Original request (2026-07-29): "放弃 app-url 的支持。"
 */
import { access } from 'node:fs/promises'
import { join } from 'node:path'

export function getAppAssetsDirCandidates(runtimeDir: string): string[] {
  const bundledPath = join(runtimeDir, '..', 'app')
  const workspacePath = join(runtimeDir, '..', '..', 'app', 'dist')
  return [workspacePath, bundledPath]
}

/** Resolve the first built App entry from repository development or the packed CLI. */
export async function resolveAppAssetsDir(runtimeDir: string): Promise<string> {
  for (const candidate of getAppAssetsDirCandidates(runtimeDir)) {
    try {
      await access(join(candidate, 'index.html'))
      return candidate
    } catch {
      // Continue to the packaged candidate.
    }
  }
  throw new Error(
    'Bundled OpenSpecUI App assets are missing. Reinstall or rebuild the CLI package.'
  )
}
