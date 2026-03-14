import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'
import { getToolInitStates } from './tool-init-state.js'

async function writeArtifact(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, '# test\n', 'utf8')
}

describe('getToolInitStates', () => {
  let tempDir: string
  let previousCodexHome: string | undefined

  beforeEach(async () => {
    tempDir = await createTempDir()
    previousCodexHome = process.env.CODEX_HOME
    clearCache()
  })

  afterEach(async () => {
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME
    } else {
      process.env.CODEX_HOME = previousCodexHome
    }
    clearCache()
    closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('reports initialized when expected skills and commands exist for delivery=both', async () => {
    await writeArtifact(join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'))
    await writeArtifact(join(tempDir, '.claude', 'skills', 'openspec-apply-change', 'SKILL.md'))
    await writeArtifact(join(tempDir, '.claude', 'commands', 'opsx', 'explore.md'))
    await writeArtifact(join(tempDir, '.claude', 'commands', 'opsx', 'apply.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore', 'apply'],
    })
    const state = states.find((entry) => entry.toolId === 'claude')

    expect(state).toBeDefined()
    expect(state?.status).toBe('initialized')
    expect(state?.expectedSkillCount).toBe(2)
    expect(state?.presentExpectedSkillCount).toBe(2)
    expect(state?.expectedCommandCount).toBe(2)
    expect(state?.presentExpectedCommandCount).toBe(2)
    expect(state?.missingSkillWorkflows).toEqual([])
    expect(state?.missingCommandWorkflows).toEqual([])
  })

  it('treats skills-only delivery as initialized without command files', async () => {
    await writeArtifact(join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'skills',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'claude')

    expect(state?.status).toBe('initialized')
    expect(state?.expectedSkillCount).toBe(1)
    expect(state?.expectedCommandCount).toBe(0)
    expect(state?.detectedCommandCount).toBe(0)
  })

  it('reports partial when expected command artifacts are missing', async () => {
    await writeArtifact(join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'claude')

    expect(state?.status).toBe('partial')
    expect(state?.missingCommandWorkflows).toEqual(['explore'])
    expect(state?.presentExpectedCommandCount).toBe(0)
  })

  it('reports partial when stale workflows are still present', async () => {
    await writeArtifact(join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'))
    await writeArtifact(join(tempDir, '.claude', 'skills', 'openspec-apply-change', 'SKILL.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'skills',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'claude')

    expect(state?.status).toBe('partial')
    expect(state?.unexpectedSkillWorkflows).toEqual(['apply'])
  })

  it('detects codex commands from an absolute CODEX_HOME path', async () => {
    const codexHome = join(tempDir, 'custom-codex-home')
    process.env.CODEX_HOME = codexHome
    await writeArtifact(join(codexHome, 'prompts', 'opsx-explore.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'commands',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'codex')

    expect(state?.status).toBe('initialized')
    expect(state?.expectedSkillCount).toBe(0)
    expect(state?.expectedCommandCount).toBe(1)
    expect(state?.presentExpectedCommandCount).toBe(1)
  })

  it('refreshes stale cached file existence after init artifacts are created later', async () => {
    const before = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })

    expect(before.find((entry) => entry.toolId === 'claude')?.status).toBe('uninitialized')

    await writeArtifact(join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'))
    await writeArtifact(join(tempDir, '.claude', 'commands', 'opsx', 'explore.md'))

    const after = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })

    expect(after.find((entry) => entry.toolId === 'claude')?.status).toBe('initialized')
  })
})
