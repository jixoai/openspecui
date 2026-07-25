/**
 * Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
 * 1. Prove public tool subscriptions preserve launch-local skills and physically scoped commands.
 * 2. Prove fixed global CLI installation retires runner authority and invalidates Root Context before public terminal settlement.
 *
 * Original request (2026-07-20): "Settings exposes 1.6 compatibility, workflow/tool delivery, root selection, environment, and data-scope diagnostics."
 * Derived requirement (2026-07-20): physically owned tool projections re-emit after external artifact creation and removal.
 * Derived requirement (2026-07-20): global CLI installation settlement refreshes Root Context availability.
 * Derived requirement (2026-07-26): environment-owned command observation survives root removal and recreation.
 */
import {
  CliContextSchema,
  CliDoctorSchema,
  clearCache,
  closeAllWatchers,
  parseCliCommandResult,
  type AIToolOption,
  type CliCommandResult,
  type CliStreamEvent,
  type CliStreamSettlement,
  type ToolInitState,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import { createServer } from './server.js'

// Core reactive-fs retries missing paths every 1,000ms; bound this fixture to four fallback cycles.
const REACTIVE_MISSING_PATH_FALLBACK_MS = 1_000
const PUBLIC_TOOL_SETTLEMENT_BUDGET_MS = REACTIVE_MISSING_PATH_FALLBACK_MS * 4

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

async function prepareCachedRunnerReplacement(
  fixture: Awaited<ReturnType<typeof createRouterFixture>>
) {
  const probePath = join(fixture.launchRoot, 'version-probe.cjs')
  const versionPath = join(fixture.launchRoot, 'version.txt')
  await writeFile(
    probePath,
    `const { readFileSync } = require('node:fs')
process.stdout.write(readFileSync(process.argv[2], 'utf8').trim())
`,
    'utf8'
  )
  await fixture.server.configManager.writeConfig({
    cli: { command: process.execPath, args: [probePath, versionPath] },
  })
  await writeFile(versionPath, 'runner-a', 'utf8')
  await expect(fixture.server.configManager.getResolvedCliRunner()).resolves.toMatchObject({
    version: 'runner-a',
  })
  await writeFile(versionPath, 'runner-b', 'utf8')
}

async function waitForEmission<T>(
  stage: string,
  emissions: readonly T[],
  errors: readonly unknown[],
  startIndex: number,
  predicate: (value: T) => boolean
): Promise<T> {
  await vi.waitFor(
    () => {
      if (errors.length > 0) {
        throw new Error(`Tool subscription failed during ${stage}.`, { cause: errors.at(0) })
      }
      expect(emissions.slice(startIndex).some(predicate), stage).toBe(true)
    },
    {
      timeout: PUBLIC_TOOL_SETTLEMENT_BUDGET_MS,
      interval: REACTIVE_MISSING_PATH_FALLBACK_MS / 5,
    }
  )

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

async function createRouterFixture(options: { createCodexPrompts?: boolean } = {}) {
  const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-tool-subscription-router-'))
  const launchRoot = join(tempDir, 'launch')
  const planningRoot = join(tempDir, 'planning')
  const previousCodexHome = process.env.CODEX_HOME
  const codexHome = join(tempDir, 'codex-home')
  process.env.CODEX_HOME = codexHome
  await Promise.all(
    [launchRoot, planningRoot].map((root) => mkdir(join(root, 'openspec'), { recursive: true }))
  )
  await mkdir(codexHome, { recursive: true })
  if (options.createCodexPrompts ?? true) {
    await mkdir(join(codexHome, 'prompts'), { recursive: true })
  }
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
    codexHome,
    server,
    async dispose() {
      vi.restoreAllMocks()
      await server.storeObservationFallback.dispose()
      await server.planningRootServices.dispose()
      await server.storeObservation.dispose()
      await server.dataHomeObserver.dispose()
      await server.toolCommandObservation.dispose()
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

describe('public tool subscriptions', () => {
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
      await mkdir(join(fixture.launchRoot, '.claude', 'commands', 'opsx'), { recursive: true })
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
  }, 30_000)

  it('observes environment-global Codex commands while keeping skills launch-local', async () => {
    const fixture = await createRouterFixture({ createCodexPrompts: false })
    const emissions: ToolInitState[][] = []
    const errors: unknown[] = []
    let subscription: { unsubscribe(): void } | null = null
    const planningSkill = join(
      fixture.planningRoot,
      '.codex',
      'skills',
      'openspec-update-change',
      'SKILL.md'
    )
    const launchSkill = join(
      fixture.launchRoot,
      '.codex',
      'skills',
      'openspec-update-change',
      'SKILL.md'
    )
    const externalCommand = join(fixture.codexHome, 'prompts', 'opsx-update.md')
    const externalCommandRoot = dirname(externalCommand)

    try {
      await writeArtifact(planningSkill)
      const observable = await appRouter
        .createCaller(fixture.server.createContext())
        .cli.subscribeToolInitStates({ delivery: 'both', workflows: ['update'] })
      subscription = observable.subscribe({
        next: (value) => emissions.push(value),
        error: (error) => errors.push(error),
      })

      const initial = await waitForEmission(
        'Planning Codex skill exclusion',
        emissions,
        errors,
        0,
        (value) => findToolState(value, 'codex')?.status === 'uninitialized'
      )
      expect(findToolState(initial, 'codex')).toMatchObject({
        missingSkillWorkflows: ['update'],
        missingCommandWorkflows: ['update'],
        presentExpectedSkillCount: 0,
        presentExpectedCommandCount: 0,
      })

      const commandCreateStart = emissions.length
      await writeArtifact(externalCommand)
      const afterCommandCreate = await waitForEmission(
        'environment-global Codex command creation',
        emissions,
        errors,
        commandCreateStart,
        (value) => {
          const codex = findToolState(value, 'codex')
          return codex?.presentExpectedCommandCount === 1
        }
      )
      expect(findToolState(afterCommandCreate, 'codex')).toMatchObject({
        status: 'partial',
        missingSkillWorkflows: ['update'],
        missingCommandWorkflows: [],
        presentExpectedSkillCount: 0,
        presentExpectedCommandCount: 1,
      })

      const skillCreateStart = emissions.length
      await writeArtifact(launchSkill)
      const initialized = await waitForEmission(
        'Launch Codex skill creation',
        emissions,
        errors,
        skillCreateStart,
        (value) => findToolState(value, 'codex')?.status === 'initialized'
      )
      expect(findToolState(initialized, 'codex')).toMatchObject({
        presentExpectedSkillCount: 1,
        presentExpectedCommandCount: 1,
      })

      const commandRemoveStart = emissions.length
      await rm(externalCommandRoot, { recursive: true, force: true })
      const afterCommandRemove = await waitForEmission(
        'environment-global Codex command-root removal',
        emissions,
        errors,
        commandRemoveStart,
        (value) =>
          findToolState(value, 'codex')?.missingCommandWorkflows.includes('update') === true
      )
      expect(findToolState(afterCommandRemove, 'codex')).toMatchObject({
        status: 'partial',
        missingSkillWorkflows: [],
        missingCommandWorkflows: ['update'],
        presentExpectedSkillCount: 1,
        presentExpectedCommandCount: 0,
      })

      const commandRecreateStart = emissions.length
      await writeArtifact(externalCommand)
      const afterCommandRecreate = await waitForEmission(
        'environment-global Codex command-root recreation',
        emissions,
        errors,
        commandRecreateStart,
        (value) => findToolState(value, 'codex')?.status === 'initialized'
      )
      expect(findToolState(afterCommandRecreate, 'codex')).toMatchObject({
        status: 'initialized',
        missingSkillWorkflows: [],
        missingCommandWorkflows: [],
        presentExpectedSkillCount: 1,
        presentExpectedCommandCount: 1,
      })
    } finally {
      subscription?.unsubscribe()
      await fixture.dispose()
    }
  }, 30_000)
})

describe('public fixed global CLI installation stream', () => {
  it('invalidates Root Context before a successful terminal event completes', async () => {
    const fixture = await createRouterFixture()

    try {
      await prepareCachedRunnerReplacement(fixture)
      const settlement: CliStreamSettlement = { reason: 'exited', exitCode: 0 }
      const executeCommandStream = vi
        .spyOn(fixture.server.cliExecutor, 'executeCommandStream')
        .mockImplementation((_command, onEvent) => {
          onEvent({ type: 'exit', exitCode: 0 })
          return {
            settled: Promise.resolve(settlement),
            cancel: () => Promise.resolve(settlement),
          }
        })
      const stream = await appRouter
        .createCaller(fixture.server.createContext())
        .cli.installGlobalCliStream()
      const events: CliStreamEvent[] = []
      const invalidationAtExit: number[] = []
      const invalidationAtComplete: number[] = []
      const runnerAtExit: ReturnType<typeof fixture.server.configManager.getResolvedCliRunner>[] =
        []

      // Capture the baseline context invalidation generation. Async filesystem invalidation from the
      // observation environment's watcher pool may advance it during setup; the assertion below proves
      // the CLI installation invalidates exactly one additional generation before terminal settlement.
      const baselineContext = fixture.server.runtimeInvalidation.current('context')
      await new Promise<void>((resolve, reject) => {
        stream.subscribe({
          next: (event) => {
            if (event.type === 'exit') {
              invalidationAtExit.push(fixture.server.runtimeInvalidation.current('context'))
              runnerAtExit.push(fixture.server.configManager.getResolvedCliRunner())
            }
            events.push(event)
          },
          complete: () => {
            invalidationAtComplete.push(fixture.server.runtimeInvalidation.current('context'))
            resolve()
          },
          error: reject,
        })
      })

      expect(invalidationAtExit).toEqual([baselineContext + 1])
      expect(invalidationAtComplete).toEqual([baselineContext + 1])
      expect(fixture.server.runtimeInvalidation.current('context')).toBe(baselineContext + 1)
      await expect(Promise.all(runnerAtExit)).resolves.toMatchObject([{ version: 'runner-b' }])
      expect(events).toEqual([{ type: 'exit', exitCode: 0 }])
      expect(executeCommandStream).toHaveBeenCalledWith(
        ['npm', 'install', '-g', '@fission-ai/openspec'],
        expect.any(Function)
      )
    } finally {
      await fixture.dispose()
    }
  })

  it('invalidates Root Context before a rejected settlement reaches the public error', async () => {
    const fixture = await createRouterFixture()

    try {
      await prepareCachedRunnerReplacement(fixture)
      let rejectTerminal: ((reason?: unknown) => void) | undefined
      const terminal = new Promise<CliStreamSettlement>((_resolve, reject) => {
        rejectTerminal = reject
      })
      void terminal.catch(() => {})
      const cancel = vi.fn(() => terminal)
      vi.spyOn(fixture.server.cliExecutor, 'executeCommandStream').mockReturnValue({
        settled: terminal,
        cancel,
      })
      const stream = await appRouter
        .createCaller(fixture.server.createContext())
        .cli.installGlobalCliStream()
      const errors: unknown[] = []
      const invalidationAtError: number[] = []
      const runnerAtError: ReturnType<typeof fixture.server.configManager.getResolvedCliRunner>[] =
        []
      const completes = vi.fn()
      // Capture the baseline context generation (async watcher-pool invalidation may advance it).
      const baselineContext = fixture.server.runtimeInvalidation.current('context')
      stream.subscribe({
        complete: completes,
        error: (error) => {
          invalidationAtError.push(fixture.server.runtimeInvalidation.current('context'))
          runnerAtError.push(fixture.server.configManager.getResolvedCliRunner())
          errors.push(error)
        },
      })
      const failure = new Error('forced termination did not confirm child close')

      if (rejectTerminal === undefined)
        throw new Error('Terminal rejection fixture was not created.')
      rejectTerminal(failure)

      await vi.waitFor(() => expect(errors).toEqual([failure]), { timeout: 200 })
      expect(invalidationAtError).toEqual([baselineContext + 1])
      expect(fixture.server.runtimeInvalidation.current('context')).toBe(baselineContext + 1)
      await expect(Promise.all(runnerAtError)).resolves.toMatchObject([{ version: 'runner-b' }])
      expect(completes).not.toHaveBeenCalled()
    } finally {
      await fixture.dispose()
    }
  })
})
