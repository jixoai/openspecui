/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Preserve Tool initialization projection semantics across delivery modes and physical scopes.
 * 2. Bound Tool artifact observation fanout at directory-inventory scale across recomputes.
 *
 * Original request (2026-07-25): "格式问题？md文件有什么格式问题，直接快速处理掉，然后继续工作"
 * Repeated fixed point (2026-07-26): clean CI runs 30163937799 and 30165778790 missed the same Launch update creation emission.
 * Repeated fixed point (2026-07-28): PR Quality run 30296656775 missed Launch Codex skill creation below an initially absent tool root.
 */
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import {
  clearCache,
  getCacheSize,
  ReactiveContext,
  ReactiveObservationEnvironment,
  settleReactivePathMutation,
} from './reactive-fs/index.js'
import { closeAllWatchers, getActiveWatcherCount } from './reactive-fs/watcher-pool.js'
import { createToolInitStateProjection, getToolInitStates } from './tool-init-state.js'

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
    await closeAllWatchers()
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

  it('treats OpenCode 1.2 command directory as legacy-compatible', async () => {
    await writeArtifact(join(tempDir, '.opencode', 'command', 'opsx-explore.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'commands',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'opencode')

    expect(state?.status).toBe('initialized')
    expect(state?.expectedCommandCount).toBe(1)
    expect(state?.presentExpectedCommandCount).toBe(1)
    expect(state?.missingCommandWorkflows).toEqual([])
    expect(state?.legacyCommandWorkflows).toEqual(['explore'])
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

  it('bounds empty-installation observation fanout by physical inventory across recomputes', async () => {
    process.env.CODEX_HOME = join(tempDir, 'codex-home')
    const environment = new ReactiveObservationEnvironment()
    const releaseRoot = await environment.acquireRoot(tempDir)
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const context = new ReactiveContext()
    const projection = context.stream(
      createToolInitStateProjection(tempDir, {
        delivery: 'commands',
        workflows: ['update'],
      })
    )

    try {
      const initial = await projection.next()
      expect(initial.done).toBe(false)
      const beforeUnexpectedArtifact = {
        cacheStates: getCacheSize(),
        watcherSubscriptions: getActiveWatcherCount(),
        missingPathPolls: setIntervalSpy.mock.calls.length,
      }

      const unexpectedArtifact = join(tempDir, '.claude', 'commands', 'opsx', 'explore.md')
      await writeArtifact(unexpectedArtifact)
      await settleReactivePathMutation(unexpectedArtifact)
      const replacement = await projection.next()
      expect(replacement.done).toBe(false)
      expect(
        replacement.value.find((entry) => entry.toolId === 'claude')?.unexpectedCommandWorkflows
      ).toEqual(['explore'])
      const afterUnexpectedArtifact = {
        cacheStates: getCacheSize(),
        watcherSubscriptions: getActiveWatcherCount(),
        missingPathPolls: setIntervalSpy.mock.calls.length,
      }
      expect(beforeUnexpectedArtifact.cacheStates).toBeLessThanOrEqual(64)
      expect(beforeUnexpectedArtifact.watcherSubscriptions).toBeLessThanOrEqual(64)
      expect(beforeUnexpectedArtifact.missingPathPolls).toBe(0)
      expect(afterUnexpectedArtifact.cacheStates).toBeLessThanOrEqual(65)
      expect(afterUnexpectedArtifact.watcherSubscriptions).toBeLessThanOrEqual(65)
      expect(afterUnexpectedArtifact.missingPathPolls).toBe(0)
    } finally {
      await projection.return(undefined)
      setIntervalSpy.mockRestore()
      await releaseRoot()
      await environment.dispose()
    }
  })

  it('rebinds staged Launch skill creation through existing parent inventories', async () => {
    process.env.CODEX_HOME = join(tempDir, 'codex-home')
    const environment = new ReactiveObservationEnvironment()
    const releaseRoot = await environment.acquireRoot(tempDir)
    const context = new ReactiveContext()
    const controller = new AbortController()
    const emissions: Awaited<ReturnType<typeof getToolInitStates>>[] = []
    const consume = (async () => {
      try {
        for await (const value of context.stream(
          createToolInitStateProjection(tempDir, {
            delivery: 'skills',
            workflows: ['update'],
          }),
          controller.signal
        )) {
          emissions.push(value)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          throw error
        }
      }
    })()

    const waitForNextEmission = async (stage: string, startIndex: number): Promise<void> => {
      await vi.waitFor(() => expect(emissions.length, stage).toBeGreaterThan(startIndex), {
        timeout: 2_000,
      })
    }

    try {
      await waitForNextEmission('initial projection', 0)
      expect(emissions.at(-1)?.find((entry) => entry.toolId === 'codex')?.status).toBe(
        'uninitialized'
      )

      const toolRootStart = emissions.length
      await mkdir(join(tempDir, '.codex'))
      await waitForNextEmission('tool root creation', toolRootStart)

      const skillsRootStart = emissions.length
      await mkdir(join(tempDir, '.codex', 'skills'))
      await waitForNextEmission('skills root creation', skillsRootStart)

      const skillStart = emissions.length
      await writeArtifact(join(tempDir, '.codex', 'skills', 'openspec-update-change', 'SKILL.md'))
      await waitForNextEmission('skill artifact creation', skillStart)
      expect(emissions.at(-1)?.find((entry) => entry.toolId === 'codex')?.status).toBe(
        'initialized'
      )
    } finally {
      controller.abort()
      await consume
      await releaseRoot()
      await environment.dispose()
    }
  })

  it('detects OpenSpec 1.6 update skills and commands for Oh My Pi and Trae', async () => {
    await writeArtifact(join(tempDir, '.omp', 'skills', 'openspec-update-change', 'SKILL.md'))
    await writeArtifact(join(tempDir, '.omp', 'commands', 'opsx-update.md'))
    await writeArtifact(join(tempDir, '.trae', 'skills', 'openspec-update-change', 'SKILL.md'))
    await writeArtifact(join(tempDir, '.trae', 'commands', 'opsx-update.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['update'],
    })

    expect(states.find((entry) => entry.toolId === 'oh-my-pi')).toMatchObject({
      status: 'initialized',
      expectedSkillCount: 1,
      presentExpectedSkillCount: 1,
      expectedCommandCount: 1,
      presentExpectedCommandCount: 1,
    })
    expect(states.find((entry) => entry.toolId === 'trae')).toMatchObject({
      status: 'initialized',
      expectedSkillCount: 1,
      presentExpectedSkillCount: 1,
      expectedCommandCount: 1,
      presentExpectedCommandCount: 1,
    })
  })
})
