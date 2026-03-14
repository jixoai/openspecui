import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'
import { getAllToolIds, getDetectedProjectTools } from './tool-config.js'

describe('getDetectedProjectTools', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('returns an empty list when no tool directories exist', async () => {
    await expect(getDetectedProjectTools(tempDir)).resolves.toEqual([])
  })

  it('does not expose the removed AGENTS.md pseudo-tool', () => {
    expect(getAllToolIds()).not.toContain('agents')
  })

  it('detects project-local tool directories only', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true })
    await mkdir(join(tempDir, '.cursor'), { recursive: true })

    const detected = await getDetectedProjectTools(tempDir)

    expect(detected.map((tool) => tool.value)).toEqual(['claude', 'cursor'])
  })
})
