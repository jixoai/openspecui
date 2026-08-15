/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Preserve Tool initialization projection semantics across delivery modes and physical scopes.
 * 2. Bound Tool artifact observation fanout at directory-inventory scale across recomputes.
 * 3. Project OpenSpec 1.9 capability, generated-version, migration, cleanup, global-root, and unavailable states.
 * 4. Require exact official command contents before a commands-only install can be current.
 *
 * Original request (2026-07-25): "格式问题？md文件有什么格式问题，直接快速处理掉，然后继续工作"
 * Repeated fixed point (2026-07-26): clean CI runs 30163937799 and 30165778790 missed the same Launch update creation emission.
 * Repeated fixed point (2026-07-28): PR Quality run 30296656775 missed Launch Codex skill creation below an initially absent tool root.
 * Review correction (2026-08-02): Agent delivery fixtures remain in an explicit checked TypeScript lane.
 
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"*/
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import {
  loadOpenSpecAgentCommandContents,
  type AgentCommandContentCatalog,
} from './agent-command-content.js'
import { selectAgentDeliveryRegistry } from './agent-delivery-registry.js'
import {
  clearCache,
  getCacheSize,
  ReactiveContext,
  ReactiveObservationEnvironment,
  settleReactivePathMutation,
} from './reactive-fs/index.js'
import { closeAllWatchers, getActiveWatcherCount } from './reactive-fs/watcher-pool.js'
import {
  createToolInitStateProjection,
  getToolInitStates,
  type ToolInitState,
} from './tool-init-state.js'

const OPENSPEC_19_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-19/bin/openspec.js'
)
let officialCommandContents: AgentCommandContentCatalog = {}

async function writeArtifact(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, '# test\n', 'utf8')
}

async function writeGeneratedSkill(filePath: string, generatedBy: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `---\nmetadata:\n  generatedBy: "${generatedBy}"\n---\n`, 'utf8')
}

async function writeOfficialCommand(
  filePath: string,
  toolId: string,
  workflow: 'explore'
): Promise<void> {
  const content = officialCommandContents[toolId]?.[workflow]
  if (!content) throw new Error(`Missing official ${toolId}/${workflow} command fixture.`)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content, 'utf8')
}

describe('getToolInitStates', () => {
  let tempDir: string
  let previousCodexHome: string | undefined

  beforeAll(async () => {
    const loaded = await loadOpenSpecAgentCommandContents(
      [process.execPath, OPENSPEC_19_BIN],
      ['explore']
    )
    if (!loaded) throw new Error('Pinned OpenSpec 1.9 command generator is unavailable.')
    officialCommandContents = loaded.catalog
  })

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
    await writeGeneratedSkill(
      join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.0'
    )
    await writeGeneratedSkill(
      join(tempDir, '.claude', 'skills', 'openspec-apply-change', 'SKILL.md'),
      '1.9.0'
    )
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
    await writeGeneratedSkill(
      join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.0'
    )

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
    await writeGeneratedSkill(
      join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.0'
    )

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
    await writeGeneratedSkill(
      join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.0'
    )
    await writeGeneratedSkill(
      join(tempDir, '.claude', 'skills', 'openspec-apply-change', 'SKILL.md'),
      '1.9.0'
    )

    const states = await getToolInitStates(tempDir, {
      delivery: 'skills',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'claude')

    expect(state?.status).toBe('partial')
    expect(state?.unexpectedSkillWorkflows).toEqual(['apply'])
  })

  it('projects Codex skills at the shared .agents root with .codex as legacy migration evidence', async () => {
    await writeGeneratedSkill(
      join(tempDir, '.agents', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.0'
    )

    const states = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'codex')

    expect(state).toBeDefined()
    expect(state?.status).toBe('initialized')
    expect(state?.expectedSkillCount).toBe(1)
    expect(state?.presentExpectedSkillCount).toBe(1)
    expect(state?.expectedCommandCount).toBe(0)
    expect(state?.skillsScope).toEqual({ kind: 'project', skillsDir: '.agents' })
    expect(state?.legacySkillRoots).toEqual(['.codex'])
  })

  it('reports Codex .codex skills as migration evidence without treating .codex as current', async () => {
    await writeGeneratedSkill(
      join(tempDir, '.codex', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.0'
    )

    const states = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'codex')

    expect(state?.status).toBe('migration-required')
    expect(state?.readiness).toBe('partial')
    expect(state?.missingSkillWorkflows).toEqual(['explore'])
    expect(state).toHaveProperty('migration.from', '.codex')
    expect(state).toHaveProperty('migration.to', '.agents')
    expect(state).toHaveProperty('migration.needsConsent', false)
    expect(state).toHaveProperty('migration.skillFiles', 1)
  })

  it('reports allowlisted legacy Codex prompts as cleanup-needed beside shared-root skills', async () => {
    const codexHome = join(tempDir, 'custom-codex-home')
    process.env.CODEX_HOME = codexHome
    await writeGeneratedSkill(
      join(tempDir, '.agents', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.0'
    )
    await writeArtifact(join(codexHome, 'prompts', 'opsx-explore.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'codex')

    expect(state?.status).toBe('cleanup-needed')
    expect(state?.expectedSkillCount).toBe(1)
    expect(state?.expectedCommandCount).toBe(0)
    expect(state).toHaveProperty('generatedByVersion', '1.9.0')
    expect(state).toHaveProperty('cleanup.required', true)
    expect(state).toHaveProperty('cleanup.workflows', ['explore'])
  })

  it('observes MiniMax Code skills at the user-global root without project-local artifacts', async () => {
    const previousHome = process.env.HOME
    process.env.HOME = tempDir
    try {
      await writeGeneratedSkill(
        join(tempDir, '.minimax', 'skills', 'openspec-explore', 'SKILL.md'),
        '1.9.0'
      )

      const states = await getToolInitStates(tempDir, {
        delivery: 'both',
        workflows: ['explore'],
      })
      const state = states.find((entry) => entry.toolId === 'minimax-code')

      expect(state).toBeDefined()
      expect(state?.status).toBe('initialized')
      expect(state?.readiness).toBe('initialized')
      expect(state?.skillsScope).toEqual({ kind: 'user-global', globalSkillsDir: '.minimax' })
      expect(state?.expectedSkillCount).toBe(1)
      expect(state?.presentExpectedSkillCount).toBe(1)
      expect(state?.expectedCommandCount).toBe(0)
      expect(state?.cleanup).toBeUndefined()
      expect(state?.migration).toBeUndefined()
      expect(states.find((entry) => entry.toolId === 'rovodev')?.skillsScope).toEqual({
        kind: 'project',
        skillsDir: '.rovodev',
      })
    } finally {
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
    }
  })

  it('reports stale generated versions independently from artifact completeness', async () => {
    await writeGeneratedSkill(
      join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.6.4'
    )
    await writeArtifact(join(tempDir, '.claude', 'commands', 'opsx', 'explore.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'claude')

    expect(state?.status).toBe('stale-version')
    expect(state?.readiness).toBe('initialized')
    expect(state?.issues).toEqual(['stale-version'])
    expect(state).toHaveProperty('generatedByVersion', '1.6.4')
  })

  it('requires exact generatedBy evidence and accepts the Server-selected runtime version', async () => {
    await writeArtifact(join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'))

    const missingVersion = await getToolInitStates(tempDir, {
      delivery: 'skills',
      workflows: ['explore'],
    })
    expect(missingVersion.find((entry) => entry.toolId === 'claude')).toMatchObject({
      readiness: 'initialized',
      status: 'stale-version',
      generatedByVersion: null,
      issues: ['stale-version'],
    })

    await writeGeneratedSkill(
      join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.1'
    )
    const runtimeMatched = await getToolInitStates(tempDir, {
      delivery: 'skills',
      workflows: ['explore'],
      generatorVersion: '1.9.1',
    })
    expect(runtimeMatched.find((entry) => entry.toolId === 'claude')).toMatchObject({
      readiness: 'initialized',
      status: 'initialized',
      generatedByVersion: '1.9.1',
      issues: [],
    })
  })

  it('preserves partial, stale-version, and cleanup-needed as independent physical facts', async () => {
    await writeGeneratedSkill(
      join(tempDir, '.qwen', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.6.4'
    )
    await writeArtifact(join(tempDir, '.qwen', 'commands', 'opsx-explore.toml'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })
    const state = states.find((entry) => entry.toolId === 'qwen')

    expect(state).toMatchObject({
      readiness: 'partial',
      status: 'cleanup-needed',
      missingCommandWorkflows: ['explore'],
      issues: ['stale-version', 'cleanup-needed'],
    })
    expect(state?.cleanup?.paths).toEqual([join(tempDir, '.qwen', 'commands', 'opsx-explore.toml')])
    expect(state?.cleanup?.workflows).toEqual(['explore'])
  })

  it('reports Windsurf artifacts as a consent-gated Devin migration without deleting them', async () => {
    await writeGeneratedSkill(
      join(tempDir, '.windsurf', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.0'
    )
    await writeArtifact(join(tempDir, '.windsurf', 'workflows', 'opsx-explore.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })

    expect(states.find((entry) => entry.toolId === 'windsurf')).toBeUndefined()
    const state = states.find((entry) => entry.toolId === 'devin')
    expect(state?.status).toBe('migration-required')
    expect(state?.readiness).toBe('partial')
    expect(state?.issues).toContain('migration-required')
    expect(state).toHaveProperty('migration.from', '.windsurf')
    expect(state).toHaveProperty('migration.to', '.devin')
    expect(state).toHaveProperty('migration.needsConsent', true)
    expect(state).toHaveProperty('migration.skillFiles', 1)
    expect(state).toHaveProperty('migration.commandFiles', 1)
  })

  it('uses Qwen Markdown command artifacts and projects the shared .agents target physically', async () => {
    await writeGeneratedSkill(
      join(tempDir, '.qwen', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.0'
    )
    await writeArtifact(join(tempDir, '.qwen', 'commands', 'opsx-explore.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })

    expect(states.find((entry) => entry.toolId === 'qwen')?.status).toBe('initialized')
    expect(states.find((entry) => entry.toolId === 'agents')).toMatchObject({
      status: 'uninitialized',
      readiness: 'uninitialized',
      skillsScope: { kind: 'project', skillsDir: '.agents' },
    })
  })

  it('treats OpenCode 1.2 command directory as legacy-compatible', async () => {
    await writeOfficialCommand(
      join(tempDir, '.opencode', 'command', 'opsx-explore.md'),
      'opencode',
      'explore'
    )

    const states = await getToolInitStates(tempDir, {
      delivery: 'commands',
      workflows: ['explore'],
      commandContents: officialCommandContents,
    })
    const state = states.find((entry) => entry.toolId === 'opencode')

    expect(state?.status).toBe('initialized')
    expect(state?.expectedCommandCount).toBe(1)
    expect(state?.presentExpectedCommandCount).toBe(1)
    expect(state?.missingCommandWorkflows).toEqual([])
    expect(state?.legacyCommandWorkflows).toEqual(['explore'])
  })

  it('marks arbitrary commands-only artifacts stale when their contents do not match OpenSpec 1.9', async () => {
    await writeArtifact(join(tempDir, '.qwen', 'commands', 'opsx-explore.md'))

    const states = await getToolInitStates(tempDir, {
      delivery: 'commands',
      workflows: ['explore'],
      generatorVersion: '1.9.0',
      commandContents: officialCommandContents,
    })
    const state = states.find((entry) => entry.toolId === 'qwen')

    expect(state).toMatchObject({
      status: 'stale-version',
      readiness: 'initialized',
      generatedByVersion: null,
      issues: ['stale-version'],
    })
  })

  it('refreshes stale cached file existence after init artifacts are created later', async () => {
    const before = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })

    expect(before.find((entry) => entry.toolId === 'claude')?.status).toBe('uninitialized')

    await writeGeneratedSkill(
      join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'),
      '1.9.0'
    )
    await writeArtifact(join(tempDir, '.claude', 'commands', 'opsx', 'explore.md'))

    const after = await getToolInitStates(tempDir, {
      delivery: 'both',
      workflows: ['explore'],
    })

    expect(after.find((entry) => entry.toolId === 'claude')?.status).toBe('initialized')
  })

  it('retains the selected registry across replacement emissions', async () => {
    const registry18 = selectAgentDeliveryRegistry('1.8.0')
    expect(registry18).toHaveLength(37)
    const environment = new ReactiveObservationEnvironment()
    const releaseRoot = await environment.acquireRoot(tempDir)
    const context = new ReactiveContext()
    const projection = context.stream(
      createToolInitStateProjection(tempDir, {
        delivery: 'skills',
        workflows: ['update'],
        registry: registry18,
      })
    )

    try {
      const initial = await projection.next()
      expect(initial.done).toBe(false)
      expect(initial.value).toHaveLength(37)
      expect(initial.value.some((entry: ToolInitState) => entry.toolId === 'command-code')).toBe(
        false
      )
      expect(
        initial.value.every((entry: ToolInitState) => entry.requiresIdeRestart === false)
      ).toBe(true)

      // A filesystem mutation forces a replacement emission through the rebuilt options; the
      // 1.8 selection must survive it rather than reverting to the global newest inventory.
      const mutatedArtifact = join(tempDir, '.claude', 'skills', 'openspec-update', 'SKILL.md')
      await mkdir(dirname(mutatedArtifact), { recursive: true })
      await writeFile(mutatedArtifact, 'probe', 'utf8')
      await settleReactivePathMutation(mutatedArtifact)
      const replacement = await projection.next()
      expect(replacement.done).toBe(false)
      expect(replacement.value).toHaveLength(37)
      expect(
        replacement.value.some((entry: ToolInitState) => entry.toolId === 'command-code')
      ).toBe(false)
      expect(
        replacement.value.every((entry: ToolInitState) => entry.requiresIdeRestart === false)
      ).toBe(true)
    } finally {
      await projection.return(undefined)
      await releaseRoot()
      await environment.dispose()
    }
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
        replacement.value.find((entry: ToolInitState) => entry.toolId === 'claude')
          ?.unexpectedCommandWorkflows
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
      await mkdir(join(tempDir, '.agents'))
      await waitForNextEmission('tool root creation', toolRootStart)

      const skillsRootStart = emissions.length
      await mkdir(join(tempDir, '.agents', 'skills'))
      await waitForNextEmission('skills root creation', skillsRootStart)

      const skillStart = emissions.length
      await writeGeneratedSkill(
        join(tempDir, '.agents', 'skills', 'openspec-update-change', 'SKILL.md'),
        '1.9.0'
      )
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
    await writeGeneratedSkill(
      join(tempDir, '.omp', 'skills', 'openspec-update-change', 'SKILL.md'),
      '1.9.0'
    )
    await writeArtifact(join(tempDir, '.omp', 'commands', 'opsx-update.md'))
    await writeGeneratedSkill(
      join(tempDir, '.trae', 'skills', 'openspec-update-change', 'SKILL.md'),
      '1.9.0'
    )
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
