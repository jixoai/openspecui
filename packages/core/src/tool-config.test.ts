/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Prove project Agent detection follows the complete OpenSpec 1.7 registry and path-kind semantics.
 * 2. Preserve special file-or-directory detection paths without treating default Tool roots as files.
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 */

import { mkdir, writeFile } from 'node:fs/promises'
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
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('returns an empty list when no tool directories exist', async () => {
    await expect(getDetectedProjectTools(tempDir)).resolves.toEqual([])
  })

  it('exposes the unavailable AGENTS.md pseudo-tool in the complete registry', () => {
    expect(getAllToolIds()).toContain('agents')
  })

  it('includes OpenSpec CLI 1.4 tool ids', () => {
    expect(getAllToolIds()).toEqual(
      expect.arrayContaining(['bob', 'forgecode', 'junie', 'lingma', 'kimi', 'vibe'])
    )
  })

  it('includes the OpenSpec CLI 1.6 Oh My Pi tool id', () => {
    expect(getAllToolIds()).toContain('oh-my-pi')
  })

  it('detects project-local tool directories only', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true })
    await mkdir(join(tempDir, '.cursor'), { recursive: true })

    const detected = await getDetectedProjectTools(tempDir)

    expect(detected.map((tool) => tool.value)).toEqual(['claude', 'cursor'])
  })

  it('does not detect a default Tool root when the path is a file', async () => {
    await writeFile(join(tempDir, '.claude'), 'not a directory', 'utf8')

    const detected = await getDetectedProjectTools(tempDir)

    expect(detected.map((tool) => tool.value)).not.toContain('claude')
  })

  it('does not detect GitHub Copilot from a bare .github directory', async () => {
    await mkdir(join(tempDir, '.github'), { recursive: true })

    const detected = await getDetectedProjectTools(tempDir)

    expect(detected.map((tool) => tool.value)).not.toContain('github-copilot')
  })

  it('detects GitHub Copilot from official Copilot paths', async () => {
    await mkdir(join(tempDir, '.github', 'prompts'), { recursive: true })

    const detected = await getDetectedProjectTools(tempDir)

    expect(detected.map((tool) => tool.value)).toContain('github-copilot')
  })

  it('detects Hermes from its official file marker', async () => {
    await writeFile(join(tempDir, 'HERMES.md'), '# Hermes', 'utf8')

    const detected = await getDetectedProjectTools(tempDir)

    expect(detected.map((tool) => tool.value)).toContain('hermes')
  })
})
