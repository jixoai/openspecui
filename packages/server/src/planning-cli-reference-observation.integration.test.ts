/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Prove pinned OpenSpec 1.6 Store-list truth installs Reference Store observation.
 * 2. Prove a physical referenced Spec edit invalidates the production Planning Catalog Work.
 * 3. Prove replacement Catalog and Instructions truth comes from real selector-exact OpenSpec CLI results.
 * 4. Prove Spec-content invalidation does not wake the independent Store Doctor Work.
 *
 * Original request (2026-07-26): "真正基于文件、甚至是文件内容结构的变更去拉取更新。"
 * Owner architecture clarification (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。"
 */
import {
  CliExecutor,
  closeAllWatchers,
  ConfigManager,
  OpenSpecCliContractExecutor,
  OpsxKernel,
  ReactiveObservationEnvironment,
  resolveRootContext,
  RuntimeInvalidationIndex,
  type CliResult,
  type PlanningCliProjectionSelector,
} from '@openspecui/core'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  createPlanningCliProjectionWorkOwner,
  PlanningCliProjectionService,
} from './planning-cli-projection-service.js'
import { createServerProjectionWorkRuntime } from './projection-work/runtime.js'
import { StoreObservationService } from './store-observation-service.js'
import {
  createStoreProjectionWorkOwner,
  StoreProjectionService,
} from './store-projection-service.js'

const CLI_BIN = resolve(import.meta.dirname, '../node_modules/openspec-cli-16/bin/openspec.js')
const CATALOG_SELECTOR = { kind: 'spec-catalog' } satisfies PlanningCliProjectionSelector
const INSTRUCTIONS_SELECTOR = {
  kind: 'opsx-instructions',
  change: 'observe-reference',
  artifact: 'proposal',
} satisfies PlanningCliProjectionSelector
const APPLY_SELECTOR = {
  kind: 'opsx-apply-instructions',
  change: 'observe-reference',
} satisfies PlanningCliProjectionSelector

function fixtureEnv(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: join(root, 'home'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_DATA_HOME: join(root, 'data'),
    XDG_STATE_HOME: join(root, 'state'),
    XDG_CACHE_HOME: join(root, 'cache'),
    OPEN_SPEC_INTERACTIVE: '0',
    OPENSPEC_TELEMETRY: '0',
    NO_COLOR: '1',
  }
}

function runCli(args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): Promise<CliResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [CLI_BIN, ...args],
      { cwd, env, maxBuffer: 4 * 1024 * 1024, timeout: 30_000 },
      (error, stdout, stderr) => {
        const exitCode = typeof error?.code === 'number' ? error.code : error ? 1 : 0
        complete({ success: exitCode === 0, stdout, stderr, exitCode })
      }
    )
  })
}

async function setupStore(
  id: string,
  root: string,
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<string> {
  const result = await runCli(
    ['store', 'setup', id, '--path', root, '--no-init-git', '--json'],
    cwd,
    env
  )
  expect(result.success, result.stdout + '\n' + result.stderr).toBe(true)
  return realpath(root)
}

function specMarkdown(requirementCount: number): string {
  const requirements = Array.from({ length: requirementCount }, (_, index) => [
    `### Requirement: Identity ${index + 1}`,
    `The system SHALL expose identity ${index + 1}.`,
    '',
    `#### Scenario: Visible ${index + 1}`,
    '- **WHEN** identity is read',
    '- **THEN** it is visible',
    '',
  ]).flat()
  return [
    '# identity Specification',
    '',
    '## Purpose',
    `Shared identity facts ${requirementCount}.`,
    '',
    '## Requirements',
    '',
    ...requirements,
  ].join('\n')
}

function referencedRequirementCount(service: PlanningCliProjectionService): number | null {
  const state = service.read(CATALOG_SELECTOR)
  if (state.state !== 'ready' || state.data?.kind !== 'spec-catalog') return null
  const entry = state.data.value.entries.find(
    (candidate) =>
      candidate.identity.kind === 'referenced' &&
      candidate.identity.storeId === 'platform' &&
      candidate.identity.specId === 'identity'
  )
  return entry?.requirementCount ?? null
}

function referencedSummary(
  service: PlanningCliProjectionService,
  selector: typeof INSTRUCTIONS_SELECTOR | typeof APPLY_SELECTOR
): string | null {
  const state = service.read(selector)
  if (state.state !== 'ready') return null
  const references =
    state.data.kind === 'opsx-instructions' || state.data.kind === 'opsx-apply-instructions'
      ? state.data.value.references
      : undefined
  return (
    references
      ?.find((reference) => reference.store_id === 'platform')
      ?.specs?.find((spec) => spec.id === 'identity')?.summary ?? null
  )
}

describe('Planning CLI Reference Store observation', () => {
  it('refreshes Catalog from real CLI truth without waking Doctor on Spec content', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openspecui-reference-observation-'))
    const launch = join(base, 'launch')
    const env = fixtureEnv(base)
    await mkdir(join(launch, 'openspec'), { recursive: true })

    try {
      const team = await setupStore('team', join(base, 'team'), base, env)
      const platform = await setupStore('platform', join(base, 'platform'), base, env)
      const specPath = join(platform, 'openspec', 'specs', 'identity', 'spec.md')
      await mkdir(join(platform, 'openspec', 'specs', 'identity'), { recursive: true })
      await writeFile(specPath, specMarkdown(1), 'utf8')
      await writeFile(
        join(team, 'openspec', 'config.yaml'),
        ['schema: spec-driven', 'references:', '  - platform', ''].join('\n'),
        'utf8'
      )
      await writeFile(join(launch, 'openspec', 'config.yaml'), 'store: team\n', 'utf8')
      const newChange = await runCli(
        ['new', 'change', 'observe-reference', '--store', 'team', '--json'],
        launch,
        env
      )
      expect(newChange.success, newChange.stdout + '\n' + newChange.stderr).toBe(true)

      const cliWrapper = join(base, 'openspec-cli-16-wrapper.mjs')
      const cliEnvironment = {
        HOME: env.HOME,
        XDG_CONFIG_HOME: env.XDG_CONFIG_HOME,
        XDG_DATA_HOME: env.XDG_DATA_HOME,
        XDG_STATE_HOME: env.XDG_STATE_HOME,
        XDG_CACHE_HOME: env.XDG_CACHE_HOME,
        OPEN_SPEC_INTERACTIVE: env.OPEN_SPEC_INTERACTIVE,
        OPENSPEC_TELEMETRY: env.OPENSPEC_TELEMETRY,
        NO_COLOR: env.NO_COLOR,
      }
      await writeFile(
        cliWrapper,
        `Object.assign(process.env, ${JSON.stringify(cliEnvironment)})\nawait import(${JSON.stringify(pathToFileURL(CLI_BIN).href)})\n`,
        'utf8'
      )
      const configManager = new ConfigManager(launch)
      await configManager.writeConfig({
        cli: { command: process.execPath, args: [cliWrapper] },
      })
      const cliExecutor = new CliExecutor(configManager, launch)

      const calls: string[][] = []
      const contracts = new OpenSpecCliContractExecutor((args) => {
        calls.push([...args])
        return runCli(args, launch, env)
      })
      const rootState = await resolveRootContext({
        launchProjectDir: launch,
        cliExecutor: {
          checkAvailability: async () => ({ available: true, version: '1.6.0' }),
          contracts,
        },
        env,
      })
      expect(rootState.state).toBe('ready')
      if (rootState.state !== 'ready') throw new Error(rootState.error.message)

      const observationEnvironment = new ReactiveObservationEnvironment()
      const invalidation = new RuntimeInvalidationIndex()
      const storeObservation = new StoreObservationService(observationEnvironment, invalidation)
      const runtime = createServerProjectionWorkRuntime()
      const kernel = new OpsxKernel(team, cliExecutor, invalidation, { store: 'team' })
      const storeProjection = new StoreProjectionService({
        dataScopePath: join(env.XDG_DATA_HOME ?? join(base, 'data'), 'openspec'),
        cliExecutor: {
          checkAvailability: async () => ({ available: true, version: '1.6.0' }),
          contracts,
        },
        invalidation,
        storeObservation,
        workOwner: createStoreProjectionWorkOwner(runtime),
      })
      const planningProjection = new PlanningCliProjectionService({
        rootContext: rootState.data,
        gitBindingToken: 'planning-reference-fixture',
        kernel,
        documentService: {
          readSpec: async () => null,
          readSpecRaw: async () => null,
        },
        contracts,
        invalidation,
        storeObservation,
        workOwner: createPlanningCliProjectionWorkOwner(runtime),
      })
      const listSubscription = storeProjection.subscribeList(() => {})
      const doctorSubscription = storeProjection.subscribeDoctor('platform', () => {})
      const catalogSubscription = planningProjection.subscribe(CATALOG_SELECTOR, () => {})
      let instructionsSubscription: ReturnType<PlanningCliProjectionService['subscribe']> | null =
        null
      let applySubscription: ReturnType<PlanningCliProjectionService['subscribe']> | null = null

      try {
        await vi.waitFor(
          () => {
            expect(storeObservation.getObservedStores()).toEqual([
              { storeId: 'platform', rootPath: platform },
              { storeId: 'team', rootPath: team },
            ])
            expect(storeProjection.readDoctor('platform')).toMatchObject({ state: 'ready' })
            expect(referencedRequirementCount(planningProjection)).toBe(1)
          },
          { timeout: 15_000, interval: 50 }
        )
        instructionsSubscription = planningProjection.subscribe(INSTRUCTIONS_SELECTOR, () => {})
        applySubscription = planningProjection.subscribe(APPLY_SELECTOR, () => {})
        await vi.waitFor(
          () => {
            expect(referencedSummary(planningProjection, INSTRUCTIONS_SELECTOR)).toBe(
              'Shared identity facts 1.'
            )
            expect(referencedSummary(planningProjection, APPLY_SELECTOR)).toBe(
              'Shared identity facts 1.'
            )
          },
          { timeout: 15_000, interval: 50 }
        )
        const catalogGeneration = planningProjection.read(CATALOG_SELECTOR).workGeneration
        const instructionsGeneration = planningProjection.read(INSTRUCTIONS_SELECTOR).workGeneration
        const applyGeneration = planningProjection.read(APPLY_SELECTOR).workGeneration
        const doctorCalls = calls.filter(
          (args) => args[0] === 'store' && args[1] === 'doctor'
        ).length
        const contextGeneration = invalidation.current('context')

        await writeFile(specPath, specMarkdown(2), 'utf8')
        await vi.waitFor(
          () => {
            expect(planningProjection.read(CATALOG_SELECTOR)).toMatchObject({
              state: 'ready',
              workGeneration: catalogGeneration + 1,
            })
            expect(referencedRequirementCount(planningProjection)).toBe(2)
            expect(planningProjection.read(INSTRUCTIONS_SELECTOR)).toMatchObject({
              state: 'ready',
              workGeneration: instructionsGeneration + 1,
            })
            expect(planningProjection.read(APPLY_SELECTOR)).toMatchObject({
              state: 'ready',
              workGeneration: applyGeneration + 1,
            })
            expect(referencedSummary(planningProjection, INSTRUCTIONS_SELECTOR)).toBe(
              'Shared identity facts 2.'
            )
            expect(referencedSummary(planningProjection, APPLY_SELECTOR)).toBe(
              'Shared identity facts 2.'
            )
          },
          { timeout: 15_000, interval: 50 }
        )
        expect(calls.filter((args) => args[0] === 'store' && args[1] === 'doctor')).toHaveLength(
          doctorCalls
        )
        expect(invalidation.current('context')).toBe(contextGeneration)
        expect(calls).toContainEqual(['list', '--specs', '--json', '--store', 'platform'])
      } finally {
        applySubscription?.unsubscribe()
        instructionsSubscription?.unsubscribe()
        catalogSubscription.unsubscribe()
        doctorSubscription.unsubscribe()
        listSubscription.unsubscribe()
        planningProjection.dispose()
        kernel.dispose()
        await storeProjection.dispose()
        runtime.clear()
        await storeObservation.dispose()
        await observationEnvironment.dispose()
      }
    } finally {
      await closeAllWatchers()
      await rm(base, { recursive: true, force: true })
    }
  }, 60_000)
})
