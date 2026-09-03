/**
 * Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
 * 1. Prove one-shot Agent delivery uses authoritative Environment policy and the complete Core registry.
 * 2. Prove retained Agent delivery re-emits from physical file changes and Environment policy replacement.
 * 3. Prove explicit refresh and dispose own deterministic replacement and retirement boundaries.
 * 4. Prove version-selected inventories including unavailable-CLI sessions.
 * 5. Keep the initial real-registry reactive wait ahead of shared CI runners.
 * 6. Lock the admitted 1.12 series snapshot: every 1.11 physical fact carries forward, Zed stays
 *    skills-only, Antigravity keeps its `.agents` root plus `.agent` legacy-migration evidence,
 *    codeassistant joins with `.codeassistant`, and retired sessions (1.10/1.11/1.9) select none.
 *
 * Original request (2026-08-01): "新增 Agent delivery projection service 及 checked tests。"

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): shared ubuntu runners started timing the initial full-registry
 *   snapshot out ~1 in 2 full-suite runs (same class the opsx-kernel reactive budget was raised
 *   for on 2026-08-14); local quiet-machine runs stay green, so the wait budget is the defect.
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */

import {
  clearCache,
  closeAllWatchers,
  ReactiveObservationEnvironment,
  selectAgentDeliveryRegistry,
  type CliProjectionNotice,
  type EnvironmentGlobalProjectionData,
  type ToolInitState,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  AgentDeliveryProjectionService,
  type AgentDeliveryEnvironmentAuthority,
  type AgentDeliveryProjection,
  type AgentDeliveryProjectionEvent,
} from './agent-delivery-projection-service.js'
import type { ProjectionWorkSubscription } from './projection-work/index.js'

const REACTIVE_MISSING_PATH_FALLBACK_MS = 1_000
const cliExecutor = {
  checkAvailability: async () => ({ available: true, version: '1.12.0' }),
}
const cliCommandAuthority = {
  getCliCommand: async () => ['not-an-importable-openspec-runner'],
}

const SUCCESS_RESULT = {
  success: true,
  stdout: '',
  stderr: '',
  exitCode: 0,
}

const SUCCESS_CONFIG_RESULT = {
  ...SUCCESS_RESULT,
  data: {},
  payload: {},
  diagnostics: [],
}

function environmentProjection(input: {
  profile?: 'core' | 'custom' | null
  delivery?: 'both' | 'skills' | 'commands' | null
  workflows?: string[]
  available?: boolean
  error?: string
}): EnvironmentGlobalProjectionData {
  return {
    kind: 'environment-global',
    owner: {
      kind: 'runtime-environment',
      dataScope: {
        path: '/tmp/openspecui-agent-delivery-data',
        source: 'user-home-default',
        environmentVariable: null,
      },
    },
    configPath: '/tmp/openspecui-agent-delivery-config.json',
    config: {},
    defaultStore: { state: 'absent', id: null },
    profileState: {
      available: input.available ?? true,
      profile: input.profile === undefined ? 'custom' : input.profile,
      delivery: input.delivery === undefined ? 'skills' : input.delivery,
      workflows: input.workflows ?? ['update'],
      driftStatus: 'in-sync',
      warningText: null,
      ...(input.error ? { error: input.error } : {}),
    },
    evidence: {
      path: SUCCESS_RESULT,
      config: SUCCESS_CONFIG_RESULT,
      drift: SUCCESS_RESULT,
    },
  }
}

class EnvironmentAuthorityFixture implements AgentDeliveryEnvironmentAuthority {
  private readonly listeners = new Set<(notice: CliProjectionNotice) => void>()
  private generation = 0
  refreshCount = 0

  constructor(private current: EnvironmentGlobalProjectionData) {}

  get listenerCount(): number {
    return this.listeners.size
  }

  async getCurrent(): Promise<EnvironmentGlobalProjectionData> {
    return this.current
  }

  refresh(): void {
    this.refreshCount += 1
  }

  subscribe(listener: (notice: CliProjectionNotice) => void): ProjectionWorkSubscription {
    this.listeners.add(listener)
    return {
      unsubscribe: () => {
        this.listeners.delete(listener)
      },
    }
  }

  replace(current: EnvironmentGlobalProjectionData): void {
    this.current = current
    this.generation += 1
    const notice = {
      identity: 'environment-global-fixture',
      workGeneration: this.generation,
      snapshotGeneration: this.generation,
      state: 'ready',
      invalidationCause: 'dependency',
    } satisfies CliProjectionNotice
    for (const listener of this.listeners) listener(notice)
  }
}

function findToolState(
  projection: AgentDeliveryProjection,
  toolId: string
): ToolInitState | undefined {
  return projection.states.find((state) => state.toolId === toolId)
}

async function writeGeneratedSkill(
  projectDir: string,
  workflow: 'apply' | 'update'
): Promise<string> {
  const skillDirectory = workflow === 'apply' ? 'openspec-apply-change' : 'openspec-update-change'
  const path = join(projectDir, '.claude', 'skills', skillDirectory, 'SKILL.md')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(
    path,
    `---\nname: ${skillDirectory}\nmetadata:\n  generatedBy: 1.12.0\n---\n`,
    'utf8'
  )
  return path
}

async function waitForProjection(
  stage: string,
  events: readonly AgentDeliveryProjectionEvent[],
  startIndex: number,
  predicate: (projection: AgentDeliveryProjection) => boolean
): Promise<AgentDeliveryProjection> {
  await vi.waitFor(
    () => {
      const failure = events.slice(startIndex).find((event) => event.type === 'failed')
      if (failure?.type === 'failed') throw failure.error
      expect(
        events
          .slice(startIndex)
          .some((event) => event.type === 'snapshot' && predicate(event.projection)),
        stage
      ).toBe(true)
    },
    {
      timeout: REACTIVE_MISSING_PATH_FALLBACK_MS * 15,
      interval: REACTIVE_MISSING_PATH_FALLBACK_MS / 5,
    }
  )
  const event = events
    .slice(startIndex)
    .find((candidate) => candidate.type === 'snapshot' && predicate(candidate.projection))
  if (!event || event.type !== 'snapshot') {
    throw new Error(`Expected Agent delivery projection during ${stage}.`)
  }
  return event.projection
}

describe('AgentDeliveryProjectionService', () => {
  it('combines authoritative Environment policy, complete registry, and fresh one-shot state', async () => {
    clearCache()
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-agent-delivery-current-'))
    const environment = new EnvironmentAuthorityFixture(
      environmentProjection({ delivery: 'skills', workflows: ['update'] })
    )
    const observationEnvironment = new ReactiveObservationEnvironment()
    const service = new AgentDeliveryProjectionService({
      projectDir,
      environmentGlobalProjectionService: environment,
      observationEnvironment,
      cliExecutor,
      cliCommandAuthority,
    })

    try {
      await writeGeneratedSkill(projectDir, 'update')
      const current = await service.getCurrent()

      expect(current.policy).toEqual({
        profile: 'custom',
        delivery: 'skills',
        workflows: ['update'],
      })
      expect(current.registry).toHaveLength(40)
      expect(current.registry.find((tool) => tool.value === 'agents')).toMatchObject({
        available: true,
        skillsDir: '.agents',
        capability: 'skills-invocable',
      })
      expect(current.registry.find((tool) => tool.value === 'codex')).toMatchObject({
        skillsDir: '.agents',
        legacySkillsDirs: ['.codex'],
        migrations: [{ from: '.codex', to: '.agents', needsConsent: false }],
      })
      expect(current.registry.find((tool) => tool.value === 'minimax-code')).toMatchObject({
        skillsDir: null,
        globalSkillsDir: '.minimax',
      })
      expect(current.registry.find((tool) => tool.value === 'command-code')).toMatchObject({
        skillsDir: '.commandcode',
        command: { pathTemplate: '.commandcode/commands/opsx-{workflow}.md' },
      })
      expect(current.registry.find((tool) => tool.value === 'rovodev')).toMatchObject({
        skillsDir: '.rovodev',
        detectionPaths: ['.rovodev/skills', '.rovodev'],
      })
      expect(current.registry.find((tool) => tool.value === 'cursor')).toMatchObject({
        requiresIdeRestart: true,
      })
      expect(current.registry.find((tool) => tool.value === 'devin')).toMatchObject({
        aliases: ['windsurf'],
        migrations: [{ from: '.windsurf', to: '.devin', needsConsent: true }],
      })
      // The admitted 1.12 line projects Zed beside the shared root and Antigravity's
      // migrated `.agents` root with its legacy `.agent` evidence; codeassistant joins
      // as the 1.12-only SourceCraft Code Assistant target.
      expect(current.registry.find((tool) => tool.value === 'zed')).toMatchObject({
        skillsDir: '.agents',
        detectionPaths: ['.zed', '.agents/skills'],
        capability: 'none',
        command: null,
      })
      expect(current.registry.find((tool) => tool.value === 'antigravity')).toMatchObject({
        skillsDir: '.agents',
        legacySkillsDirs: ['.agent'],
        detectionPaths: ['.agent', '.agents/workflows'],
        migrations: [{ from: '.agent', to: '.agents', needsConsent: false }],
        command: { pathTemplate: '.agents/workflows/opsx-{workflow}.md' },
      })
      // codeassistant is the 1.12-only inventory entry: SourceCraft roots, adapter-backed
      // capability, and no IDE-restart fact.
      expect(current.registry.find((tool) => tool.value === 'codeassistant')).toMatchObject({
        available: true,
        skillsDir: '.codeassistant',
        capability: 'adapter-backed',
        command: { pathTemplate: '.codeassistant/commands/opsx-{workflow}.md' },
      })
      expect(
        current.registry.find((tool) => tool.value === 'codeassistant')?.requiresIdeRestart
      ).toBeUndefined()
      expect(findToolState(current, 'claude')).toMatchObject({
        status: 'initialized',
        generatedByVersion: '1.12.0',
        installedSkillWorkflows: ['update'],
      })

      await rm(join(projectDir, '.claude'), { recursive: true, force: true })
      const refreshed = await service.refresh()
      expect(environment.refreshCount).toBe(1)
      expect(findToolState(refreshed, 'claude')).toMatchObject({
        status: 'uninitialized',
        missingSkillWorkflows: ['update'],
      })
    } finally {
      await service.dispose()
      await observationEnvironment.dispose()
      clearCache()
      await closeAllWatchers()
      await rm(projectDir, { recursive: true, force: true })
    }

    await expect(service.getCurrent()).rejects.toThrow(
      'Agent delivery projection service is disposed.'
    )
  })

  it('does not load command-generation evidence for a skills-only projection', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-agent-delivery-skills-only-'))
    const environment = new EnvironmentAuthorityFixture(
      environmentProjection({ delivery: 'skills', workflows: ['update'] })
    )
    const observationEnvironment = new ReactiveObservationEnvironment()
    const getCliCommand = vi.fn(async () => ['not-an-importable-openspec-runner'])
    const service = new AgentDeliveryProjectionService({
      projectDir,
      environmentGlobalProjectionService: environment,
      observationEnvironment,
      cliExecutor,
      cliCommandAuthority: { getCliCommand },
    })

    try {
      const current = await service.getCurrent()

      expect(current.registry).toHaveLength(40)
      expect(findToolState(current, 'claude')?.status).toBe('uninitialized')
      expect(getCliCommand).not.toHaveBeenCalled()
    } finally {
      await service.dispose()
      await observationEnvironment.dispose()
      clearCache()
      await closeAllWatchers()
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it('selects no inventory when the CLI runner is unavailable', async () => {
    clearCache()
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-agent-delivery-nocli-'))
    const environment = new EnvironmentAuthorityFixture(
      environmentProjection({ delivery: 'skills', workflows: ['update'] })
    )
    const observationEnvironment = new ReactiveObservationEnvironment()
    const service = new AgentDeliveryProjectionService({
      projectDir,
      environmentGlobalProjectionService: environment,
      observationEnvironment,
      cliExecutor: {
        ...cliExecutor,
        checkAvailability: async () => ({ available: false }),
      },
      cliCommandAuthority,
    })

    try {
      const current = await service.getCurrent()
      // No live CLI means no admitted inventory: the pinned 1.12.0 generator version must not
      // fabricate one.
      expect(current.registry).toEqual([])
      expect(current.states).toEqual([])
    } finally {
      await service.dispose()
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it('selects an empty inventory for a retired 1.10 session and matches the Core selector', async () => {
    clearCache()
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-agent-delivery-110-'))
    const environment = new EnvironmentAuthorityFixture(
      environmentProjection({ delivery: 'skills', workflows: ['update'] })
    )
    const observationEnvironment = new ReactiveObservationEnvironment()
    const service = new AgentDeliveryProjectionService({
      projectDir,
      environmentGlobalProjectionService: environment,
      observationEnvironment,
      cliExecutor: {
        ...cliExecutor,
        checkAvailability: async () => ({ available: true, version: '1.10.0' }),
      },
      cliCommandAuthority,
    })

    try {
      await writeGeneratedSkill(projectDir, 'update')
      const current = await service.getCurrent()

      // The v11 window retired with the v12 single-series admission: a bypassed 1.10
      // session must not inherit an admitted inventory, and the service projection
      // agrees exactly with the Core series selector over the same detected version.
      expect(selectAgentDeliveryRegistry('1.10.0')).toEqual([])
      expect(current.registry).toEqual([])
      expect(current.states).toEqual([])
    } finally {
      await service.dispose()
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it('selects an empty inventory for a retired 1.9 session and matches the Core selector', async () => {
    clearCache()
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-agent-delivery-19-'))
    const environment = new EnvironmentAuthorityFixture(
      environmentProjection({ delivery: 'skills', workflows: ['update'] })
    )
    const observationEnvironment = new ReactiveObservationEnvironment()
    const service = new AgentDeliveryProjectionService({
      projectDir,
      environmentGlobalProjectionService: environment,
      observationEnvironment,
      cliExecutor: {
        ...cliExecutor,
        checkAvailability: async () => ({ available: true, version: '1.9.3' }),
      },
      cliCommandAuthority,
    })

    try {
      const current = await service.getCurrent()

      // A bypassed 1.9 session must not inherit an admitted inventory; the service projection
      // agrees exactly with the Core series selector over the same detected version.
      expect(selectAgentDeliveryRegistry('1.9.3')).toEqual([])
      expect(current.registry).toEqual([])
      expect(current.states).toEqual([])
    } finally {
      await service.dispose()
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it(
    'retains physical observation, rebinds policy, and retires authority on dispose',
    async () => {
      clearCache()
      const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-agent-delivery-retained-'))
      const previousCodexHome = process.env.CODEX_HOME
      process.env.CODEX_HOME = join(projectDir, 'codex-home')
      const environment = new EnvironmentAuthorityFixture(
        environmentProjection({ delivery: 'skills', workflows: ['update'] })
      )
      const observationEnvironment = new ReactiveObservationEnvironment()
      const service = new AgentDeliveryProjectionService({
        projectDir,
        environmentGlobalProjectionService: environment,
        observationEnvironment,
        cliExecutor,
        cliCommandAuthority,
      })
      const events: AgentDeliveryProjectionEvent[] = []
      service.subscribe((event) => events.push(event))

      try {
        expect(environment.listenerCount).toBe(1)
        const initial = await waitForProjection(
          'initial Environment policy',
          events,
          0,
          (projection) => findToolState(projection, 'claude')?.status === 'uninitialized'
        )
        expect(initial.policy.workflows).toEqual(['update'])

        const initializedStart = events.length
        await writeGeneratedSkill(projectDir, 'update')
        const initialized = await waitForProjection(
          'physical update skill creation',
          events,
          initializedStart,
          (projection) => findToolState(projection, 'claude')?.status === 'initialized'
        )
        expect(findToolState(initialized, 'claude')).toMatchObject({
          missingSkillWorkflows: [],
          installedSkillWorkflows: ['update'],
        })

        const replacementStart = events.length
        environment.replace(environmentProjection({ delivery: 'skills', workflows: ['apply'] }))
        const replacement = await waitForProjection(
          'Environment policy replacement',
          events,
          replacementStart,
          (projection) =>
            projection.policy.workflows.includes('apply') &&
            findToolState(projection, 'claude')?.missingSkillWorkflows.includes('apply') === true
        )
        expect(replacement.policy).toEqual({
          profile: 'custom',
          delivery: 'skills',
          workflows: ['apply'],
        })
        expect(findToolState(replacement, 'claude')).toMatchObject({
          status: 'partial',
          missingSkillWorkflows: ['apply'],
          unexpectedSkillWorkflows: ['update'],
        })

        await service.dispose()
        expect(environment.listenerCount).toBe(0)
        expect(() => service.subscribe(() => {})).toThrow(
          'Agent delivery projection service is disposed.'
        )
      } finally {
        await service.dispose()
        await observationEnvironment.dispose()
        if (previousCodexHome === undefined) delete process.env.CODEX_HOME
        else process.env.CODEX_HOME = previousCodexHome
        clearCache()
        await closeAllWatchers()
        await rm(projectDir, { recursive: true, force: true })
      }
    },
    REACTIVE_MISSING_PATH_FALLBACK_MS * 25
  )

  it('fails closed when Environment cannot provide an authoritative delivery mode', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-agent-delivery-policy-'))
    const environment = new EnvironmentAuthorityFixture(
      environmentProjection({ delivery: null, workflows: [] })
    )
    const observationEnvironment = new ReactiveObservationEnvironment()
    const service = new AgentDeliveryProjectionService({
      projectDir,
      environmentGlobalProjectionService: environment,
      observationEnvironment,
      cliExecutor,
      cliCommandAuthority,
    })

    try {
      await expect(service.getCurrent()).rejects.toThrow(
        'Environment Agent delivery mode is unavailable.'
      )
    } finally {
      await service.dispose()
      await observationEnvironment.dispose()
      await rm(projectDir, { recursive: true, force: true })
    }
  })
})
