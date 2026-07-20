/**
 * Orthogonal intents (created 2026-07-20 Asia/Shanghai):
 * 1. Prove public tool subscriptions observe only Launch-project artifacts and retain caller delivery/workflow input.
 *
 * Original request (2026-07-20): "Settings exposes 1.6 compatibility, workflow/tool delivery, root selection, environment, and data-scope diagnostics."
 * Derived requirement (2026-07-20): launch-owned tool projections re-emit after external artifact creation and removal.
 */
import {
  CliContextSchema,
  CliDoctorSchema,
  clearCache,
  closeAllWatchers,
  parseCliCommandResult,
  type AIToolOption,
  type CliCommandResult,
  type ToolInitState,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import { createServer } from './server.js'

function commandResult<T>(data: T, schema: ZodType<T>): CliCommandResult<T> {
  return parseCliCommandResult(
    {
      success: true,
      stdout: JSON.stringify(data),
      stderr: '',
      exitCode: 0,
    },
    schema
  )
}

async function writeArtifact(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, '# external fixture\n', 'utf8')
}

async function waitForEmission<T>(
  stage: string,
  emissions: readonly T[],
  errors: readonly unknown[],
  startIndex: number,
  predicate: (value: T) => boolean
): Promise<T> {
  await vi.waitFor(() => {
    if (errors.length > 0) {
      throw new Error(`Tool subscription failed during ${stage}.`, { cause: errors.at(0) })
    }
    expect(emissions.slice(startIndex).some(predicate), stage).toBe(true)
  })

  const match = emissions.slice(startIndex).find(predicate)
  if (match === undefined) {
    throw new Error(`Expected a matching tool subscription emission during ${stage}.`)
  }
  return match
}

function toolValues(tools: readonly AIToolOption[]): string[] {
  return tools.map((tool) => tool.value)
}

function findToolState(
  states: readonly ToolInitState[],
  toolId: string
): ToolInitState | undefined {
  return states.find((state) => state.toolId === toolId)
}

async function createRouterFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-tool-subscription-router-'))
  const launchRoot = join(tempDir, 'launch')
  const planningRoot = join(tempDir, 'planning')
  const previousCodexHome = process.env.CODEX_HOME
  process.env.CODEX_HOME = join(tempDir, 'codex-home')
  await Promise.all(
    [launchRoot, planningRoot].map((root) => mkdir(join(root, 'openspec'), { recursive: true }))
  )
  clearCache()

  const server = createServer({ projectDir: launchRoot, enableWatcher: false })
  const releaseLaunchObservation = await server.observationEnvironment.acquireRoot(launchRoot)
  vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.6.0',
  })
  vi.spyOn(server.cliExecutor.contracts, 'doctorRoot').mockResolvedValue(
    commandResult(
      {
        root: {
          path: planningRoot,
          source: 'declared',
          store_id: 'planning-store',
          healthy: true,
          status: [],
        },
        store: {
          id: 'planning-store',
          metadata: { present: true, valid: true },
          status: [],
        },
        references: [],
        status: [],
      },
      CliDoctorSchema
    )
  )
  vi.spyOn(server.cliExecutor.contracts, 'context').mockResolvedValue(
    commandResult(
      {
        root: {
          path: planningRoot,
          source: 'declared',
          store_id: 'planning-store',
          role: 'openspec_root',
        },
        members: [],
        status: [],
      },
      CliContextSchema
    )
  )

  return {
    launchRoot,
    planningRoot,
    server,
    async dispose() {
      vi.restoreAllMocks()
      await server.storeObservationFallback.dispose()
      await server.planningRootServices.dispose()
      await server.storeObservation.dispose()
      await server.dataHomeObserver.dispose()
      server.storeInvalidation.dispose()
      server.projectInvalidation.dispose()
      await releaseLaunchObservation()
      await server.observationEnvironment.dispose()
      server.projectRecoveryService.dispose()
      server.translationCacheService.close()
      clearCache()
      await closeAllWatchers()
      if (previousCodexHome === undefined) {
        delete process.env.CODEX_HOME
      } else {
        process.env.CODEX_HOME = previousCodexHome
      }
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}

describe('public Launch-project tool subscriptions', () => {
  it('detects external Launch tool-directory creation and removal without observing Planning', async () => {
    const fixture = await createRouterFixture()
    const emissions: AIToolOption[][] = []
    const errors: unknown[] = []
    let subscription: { unsubscribe(): void } | null = null

    try {
      await mkdir(join(fixture.planningRoot, '.cursor'), { recursive: true })
      const caller = appRouter.createCaller(fixture.server.createContext())
      const observable = await caller.cli.subscribeDetectedProjectTools()
      subscription = observable.subscribe({
        next: (value) => emissions.push(value),
        error: (error) => errors.push(error),
      })

      const initial = await waitForEmission(
        'initial detected-tool projection',
        emissions,
        errors,
        0,
        (value) => value.length === 0
      )
      expect(initial).toEqual([])

      const createStart = emissions.length
      await mkdir(join(fixture.launchRoot, '.claude'), { recursive: true })
      const afterCreate = await waitForEmission(
        'Launch .claude creation',
        emissions,
        errors,
        createStart,
        (value) => toolValues(value).includes('claude')
      )
      expect(toolValues(afterCreate)).toEqual(['claude'])

      const removeStart = emissions.length
      await rm(join(fixture.launchRoot, '.claude'), { recursive: true, force: true })
      const afterRemove = await waitForEmission(
        'Launch .claude removal',
        emissions,
        errors,
        removeStart,
        (value) => value.length === 0
      )
      expect(afterRemove).toEqual([])
      expect(emissions.flatMap(toolValues)).not.toContain('cursor')
    } finally {
      subscription?.unsubscribe()
      await fixture.dispose()
    }
  })

  it('preserves commands/update input and re-emits init state after external file changes', async () => {
    const fixture = await createRouterFixture()
    const emissions: ToolInitState[][] = []
    const errors: unknown[] = []
    let subscription: { unsubscribe(): void } | null = null
    const planningUpdate = join(fixture.planningRoot, '.claude', 'commands', 'opsx', 'update.md')
    const launchExplore = join(fixture.launchRoot, '.claude', 'commands', 'opsx', 'explore.md')
    const launchUpdate = join(fixture.launchRoot, '.claude', 'commands', 'opsx', 'update.md')

    try {
      await writeArtifact(planningUpdate)
      const caller = appRouter.createCaller(fixture.server.createContext())
      const observable = await caller.cli.subscribeToolInitStates({
        delivery: 'commands',
        workflows: ['update'],
      })
      subscription = observable.subscribe({
        next: (value) => emissions.push(value),
        error: (error) => errors.push(error),
      })

      const initial = await waitForEmission(
        'initial commands/update projection',
        emissions,
        errors,
        0,
        (value) => {
          const claude = findToolState(value, 'claude')
          return claude?.status === 'uninitialized'
        }
      )
      expect(findToolState(initial, 'claude')).toMatchObject({
        status: 'uninitialized',
        expectedSkillCount: 0,
        expectedCommandCount: 1,
        missingSkillWorkflows: [],
        missingCommandWorkflows: ['update'],
      })

      const unexpectedStart = emissions.length
      await writeArtifact(launchExplore)
      const withUnexpected = await waitForEmission(
        'unexpected Launch explore command creation',
        emissions,
        errors,
        unexpectedStart,
        (value) => {
          const claude = findToolState(value, 'claude')
          return (
            claude?.status === 'partial' && claude.unexpectedCommandWorkflows.includes('explore')
          )
        }
      )
      expect(findToolState(withUnexpected, 'claude')).toMatchObject({
        status: 'partial',
        missingCommandWorkflows: ['update'],
        unexpectedCommandWorkflows: ['explore'],
      })

      const expectedStart = emissions.length
      await writeArtifact(launchUpdate)
      const withExpectedAndUnexpected = await waitForEmission(
        'expected Launch update command creation',
        emissions,
        errors,
        expectedStart,
        (value) => {
          const claude = findToolState(value, 'claude')
          return (
            claude?.status === 'partial' &&
            claude.missingCommandWorkflows.length === 0 &&
            claude.unexpectedCommandWorkflows.includes('explore')
          )
        }
      )
      expect(findToolState(withExpectedAndUnexpected, 'claude')).toMatchObject({
        presentExpectedCommandCount: 1,
        missingCommandWorkflows: [],
        unexpectedCommandWorkflows: ['explore'],
      })

      const initializedStart = emissions.length
      await rm(launchExplore)
      const initialized = await waitForEmission(
        'unexpected Launch explore command removal',
        emissions,
        errors,
        initializedStart,
        (value) => findToolState(value, 'claude')?.status === 'initialized'
      )
      expect(findToolState(initialized, 'claude')).toMatchObject({
        status: 'initialized',
        expectedSkillCount: 0,
        expectedCommandCount: 1,
        presentExpectedCommandCount: 1,
        unexpectedCommandWorkflows: [],
      })

      const uninitializedStart = emissions.length
      await rm(launchUpdate)
      const uninitialized = await waitForEmission(
        'expected Launch update command removal',
        emissions,
        errors,
        uninitializedStart,
        (value) => findToolState(value, 'claude')?.status === 'uninitialized'
      )
      expect(findToolState(uninitialized, 'claude')).toMatchObject({
        status: 'uninitialized',
        missingCommandWorkflows: ['update'],
        detectedCommandCount: 0,
      })
    } finally {
      subscription?.unsubscribe()
      await fixture.dispose()
    }
  })
})
