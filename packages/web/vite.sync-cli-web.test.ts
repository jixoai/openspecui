/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Prove Web build paths project into the sibling CLI package on the host platform.
 * 2. Prove CLI Web assets replace stale snapshots without retaining stale files.
 * 3. Exercise the shared bounded directory projection through the Web build adapter.
 *
 * Original request (2026-08-09): "Continue the Windows adaptation and handle similar issues together."
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveCliWebSyncPaths, syncCliWebAssets } from './vite.sync-cli-web'

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'openspecui-web-sync-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('resolveCliWebSyncPaths', () => {
  it('maps the web package root to dist and cli/web paths', () => {
    const packageRoot = join(createTempDir(), 'packages', 'web')

    expect(resolveCliWebSyncPaths(packageRoot)).toEqual({
      sourceDir: join(packageRoot, 'dist'),
      targetDir: join(packageRoot, '..', 'cli', 'web'),
    })
  })
})

describe('syncCliWebAssets', () => {
  it('replaces cli/web with the current dist snapshot', async () => {
    const rootDir = createTempDir()
    const sourceDir = join(rootDir, 'packages', 'web', 'dist')
    const targetDir = join(rootDir, 'packages', 'cli', 'web')

    mkdirSync(join(sourceDir, 'assets'), { recursive: true })
    writeFileSync(join(sourceDir, 'index.html'), 'new-index')
    writeFileSync(join(sourceDir, 'assets', 'main.js'), 'new-main')

    mkdirSync(join(targetDir, 'assets'), { recursive: true })
    writeFileSync(join(targetDir, 'index.html'), 'old-index')
    writeFileSync(join(targetDir, 'assets', 'stale.js'), 'old-stale')

    await syncCliWebAssets(sourceDir, targetDir)

    expect(readFileSync(join(targetDir, 'index.html'), 'utf8')).toBe('new-index')
    expect(readFileSync(join(targetDir, 'assets', 'main.js'), 'utf8')).toBe('new-main')
    expect(() => readFileSync(join(targetDir, 'assets', 'stale.js'), 'utf8')).toThrow()
  })
})
