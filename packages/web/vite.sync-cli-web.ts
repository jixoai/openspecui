import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { Plugin } from 'vite'

export function resolveCliWebSyncPaths(rootDir: string): {
  sourceDir: string
  targetDir: string
} {
  return {
    sourceDir: resolve(rootDir, 'dist'),
    targetDir: resolve(rootDir, '..', 'cli', 'web'),
  }
}

export function syncCliWebAssets(sourceDir: string, targetDir: string): void {
  if (!existsSync(sourceDir)) {
    return
  }

  const targetParentDir = dirname(targetDir)
  const stagingDir = join(targetParentDir, `.web-sync-${process.pid}`)

  mkdirSync(targetParentDir, { recursive: true })
  rmSync(stagingDir, { recursive: true, force: true })
  cpSync(sourceDir, stagingDir, { recursive: true })
  rmSync(targetDir, { recursive: true, force: true })
  renameSync(stagingDir, targetDir)
}

export function createCliWebSyncPlugin(rootDir: string): Plugin {
  const { sourceDir, targetDir } = resolveCliWebSyncPaths(rootDir)

  return {
    name: 'openspecui-sync-cli-web',
    apply: 'build',
    writeBundle() {
      syncCliWebAssets(sourceDir, targetDir)
    },
  }
}
