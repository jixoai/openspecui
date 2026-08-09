/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Project every completed App build into the CLI-owned runtime asset directory.
 * 2. Commit the projection through the shared bounded directory-swap owner.
 *
 * Original request (2026-07-30): "app项目自身的构建本身就要有这个copy行为。"
 * Owner correction (2026-07-31): PWA manifest generation is retired.
 */
import { resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { projectDirectoryAtomically } from '../../../scripts/lib/atomic-directory-projection'

/** Replace the CLI App projection only after the complete next build has been copied. */
export async function projectAppBuildToCli(sourceDir: string, targetDir: string): Promise<void> {
  await projectDirectoryAtomically(sourceDir, targetDir)
}

export function hostedAppPlugin(): Plugin {
  let config: ResolvedConfig | null = null

  return {
    name: 'openspecui-hosted-app',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    async writeBundle() {
      if (!config) {
        return
      }

      const outDir = resolve(config.root, config.build.outDir)
      await projectAppBuildToCli(outDir, resolve(config.root, '../cli/app'))
    },
  }
}
