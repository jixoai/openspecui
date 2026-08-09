/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Resolve and project the completed Web build into the CLI runtime asset tree.
 * 2. Commit the projection through the shared bounded directory-swap owner.
 *
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { projectDirectoryAtomically } from '../../scripts/lib/atomic-directory-projection'

export function resolveCliWebSyncPaths(rootDir: string): {
  sourceDir: string
  targetDir: string
} {
  return {
    sourceDir: resolve(rootDir, 'dist'),
    targetDir: resolve(rootDir, '..', 'cli', 'web'),
  }
}

export async function syncCliWebAssets(sourceDir: string, targetDir: string): Promise<void> {
  if (!existsSync(sourceDir)) {
    return
  }
  await projectDirectoryAtomically(sourceDir, targetDir)
}

export function createCliWebSyncPlugin(rootDir: string): Plugin {
  const { sourceDir, targetDir } = resolveCliWebSyncPaths(rootDir)

  return {
    name: 'openspecui-sync-cli-web',
    apply: 'build',
    async writeBundle() {
      await syncCliWebAssets(sourceDir, targetDir)
    },
  }
}
