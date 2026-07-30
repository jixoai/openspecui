/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Publish the hosted App manifest into every completed App build.
 * 2. Project every completed App build into the CLI-owned runtime asset directory.
 *
 * Original request (2026-07-30): "app项目自身的构建本身就要有这个copy行为。"
 */
import { randomUUID } from 'node:crypto'
import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { createHostedAppPwaManifest } from './lib/pwa-manifest'

function isMissingPath(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

/** Replace the CLI App projection only after the complete next build has been copied. */
export async function projectAppBuildToCli(sourceDir: string, targetDir: string): Promise<void> {
  const nextDir = `${targetDir}.next-${process.pid}-${randomUUID()}`
  const previousDir = `${targetDir}.previous-${process.pid}-${randomUUID()}`
  let previousMoved = false

  await rm(nextDir, { force: true, recursive: true })
  await cp(sourceDir, nextDir, { force: true, recursive: true })
  try {
    try {
      await rename(targetDir, previousDir)
      previousMoved = true
    } catch (error) {
      if (!isMissingPath(error)) throw error
    }
    await rename(nextDir, targetDir)
    await rm(previousDir, { force: true, recursive: true })
  } catch (error) {
    await rm(nextDir, { force: true, recursive: true })
    if (previousMoved) {
      await rename(previousDir, targetDir)
    }
    throw error
  }
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
      const pwaManifest = createHostedAppPwaManifest()
      await mkdir(outDir, { recursive: true })
      await writeFile(
        join(outDir, 'manifest.webmanifest'),
        `${JSON.stringify(pwaManifest, null, 2)}\n`,
        'utf8'
      )
      await projectAppBuildToCli(outDir, resolve(config.root, '../cli/app'))
    },
  }
}
