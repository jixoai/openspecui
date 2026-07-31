/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove one CliExecutor never fans buffered OpenSpec work out into concurrent child processes.
 * 2. Keep the regression at the real buffered-process boundary used by Root and Projection reads.
 *
 * Original request (2026-07-31): "系统性地进行修复，因为List页面也有类似的问题。所有可能其它页面都有类似的问题。"
 * Owner evidence (2026-07-31): `openspec doctor --json` spawned in under 1ms but emitted its first
 *   stdout only after 12.95s while Dashboard-originated projection work was active.
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import { CliExecutor } from './cli-executor.js'
import { ConfigManager } from './config.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'

const CONCURRENCY_PROBE = `
  const { readdirSync, unlinkSync, writeFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const markerDirectory = process.argv.at(-1)
  if (!markerDirectory) throw new Error('marker directory is required')
  const marker = join(markerDirectory, String(process.pid))
  writeFileSync(marker, '')
  let observedActive = 0
  setTimeout(() => {
    observedActive = readdirSync(markerDirectory).length
  }, 100)
  setTimeout(() => {
    unlinkSync(marker)
    process.stdout.write(JSON.stringify({ active: observedActive }))
  }, 200)
`

class FixedCliConfigManager extends ConfigManager {
  override getCliCommand(): Promise<readonly string[]> {
    return Promise.resolve([process.execPath])
  }
}

describe('CliExecutor buffered admission', () => {
  let tempDir: string
  let markerDirectory: string
  let cliExecutor: CliExecutor
  let originalSpawnMode: string | undefined

  beforeEach(async () => {
    originalSpawnMode = process.env.OPENSPEC_SPAWN_MODE
    process.env.OPENSPEC_SPAWN_MODE = 'process'
    tempDir = await createTempDir()
    markerDirectory = join(tempDir, 'active-cli-processes')
    await mkdir(join(tempDir, 'openspec'), { recursive: true })
    await mkdir(markerDirectory, { recursive: true })
    clearCache()
    cliExecutor = new CliExecutor(new FixedCliConfigManager(tempDir), tempDir)
  })

  afterEach(async () => {
    if (originalSpawnMode === undefined) {
      delete process.env.OPENSPEC_SPAWN_MODE
    } else {
      process.env.OPENSPEC_SPAWN_MODE = originalSpawnMode
    }
    await cliExecutor.dispose()
    clearCache()
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('admits buffered child processes one at a time across concurrent callers', async () => {
    const results = await Promise.all([
      cliExecutor.execute(['--input-type=module', '-e', CONCURRENCY_PROBE, markerDirectory]),
      cliExecutor.execute(['--input-type=module', '-e', CONCURRENCY_PROBE, markerDirectory]),
    ])

    expect(results.every((result) => result.success)).toBe(true)
    expect(results.map((result) => result.stdout.trim())).toEqual(['{"active":1}', '{"active":1}'])
  })
})
