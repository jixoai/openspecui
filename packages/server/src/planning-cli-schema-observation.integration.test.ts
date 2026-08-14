/**
 * Orthogonal intents (updated 2026-08-05 Asia/Shanghai):
 * 1. Prove project Schema metadata changes rerun the typed Planning CLI Config Work through real watcher events.
 * 2. Prove newly declared Schema templates rerun the typed Planning CLI Template Work through real watcher events.
 * 3. Prove an added data-home Schema wakes failed selector Work through the real data-home observer.
 * 4. Keep CLI truth authoritative and settle watcher owners before Windows fixture cleanup.
 * 5. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-26): "真正基于文件、甚至是文件内容结构的变更去拉取更新。"
 * Owner architecture clarification (2026-07-26): "最终计算结果本质是来自于 openspec.CLI 所提供的内容。"
 */
import {
  CliExecutor,
  ConfigManager,
  OpenSpecCliContractExecutor,
  OpenSpecDataHomeObserver,
  OpsxKernel,
  ReactiveObservationEnvironment,
  RuntimeInvalidationIndex,
  type CliResult,
  type PlanningCliProjectionData,
  type PlanningCliProjectionSelector,
  type RootContext,
} from '@openspecui/core'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  createPlanningCliProjectionWorkOwner,
  PlanningCliProjectionService,
} from './planning-cli-projection-service.js'
import { createServerProjectionWorkRuntime } from './projection-work/runtime.js'
import { removeServerTestDirectories } from './server-test-cleanup.js'

const CLI_BIN = resolve(import.meta.dirname, '../node_modules/openspec-cli-16/bin/openspec.js')
const CONFIG_SELECTOR = { kind: 'opsx-config-bundle' } satisfies PlanningCliProjectionSelector
const TEMPLATES_SELECTOR = {
  kind: 'opsx-templates',
  schema: 'reactive-schema',
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
      { cwd, env, maxBuffer: 4 * 1024 * 1024, timeout: 30_000, windowsHide: true },
      (error, stdout, stderr) => {
        const exitCode = typeof error?.code === 'number' ? error.code : error ? 1 : 0
        complete({ success: exitCode === 0, stdout, stderr, exitCode })
      }
    )
  })
}

function rootContext(projectDir: string, dataScopePath: string): RootContext {
  return {
    launchProject: { path: projectDir },
    planningRoot: { path: projectDir, source: 'nearest', healthy: true, status: [] },
    storeId: null,
    generation: 'schema-observation-fixture',
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: dataScopePath,
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

function schemaYaml(description: string): string {
  return [
    'name: reactive-schema',
    'version: 1',
    `description: ${description}`,
    'artifacts:',
    '  - id: proposal',
    '    generates: proposal.md',
    '    description: Proposal artifact',
    '    template: proposal.md',
    '    requires: []',
    '  - id: design',
    '    generates: design.md',
    '    description: Design artifact',
    '    template: design.md',
    '    requires: []',
    '',
  ].join('\n')
}

function configBundle(
  service: PlanningCliProjectionService
): Extract<PlanningCliProjectionData, { kind: 'opsx-config-bundle' }>['value'] | null {
  const state = service.read(CONFIG_SELECTOR)
  return state.state === 'ready' && state.data?.kind === 'opsx-config-bundle'
    ? state.data.value
    : null
}

function templateIds(service: PlanningCliProjectionService): string[] | null {
  const state = service.read(TEMPLATES_SELECTOR)
  return state.state === 'ready' && state.data?.kind === 'opsx-templates'
    ? Object.keys(state.data.value).sort()
    : null
}

describe('Planning CLI Schema observation', () => {
  it('replaces Config and Template CLI truth after a physical project Schema change', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openspecui-schema-observation-'))
    const project = join(base, 'project')
    const env = fixtureEnv(base)
    const schemaRoot = join(project, 'openspec', 'schemas', 'reactive-schema')
    const schemaPath = join(schemaRoot, 'schema.yaml')
    const designTemplatePath = join(schemaRoot, 'templates', 'design.md')
    await mkdir(project, { recursive: true })

    try {
      const initialized = await runCli(
        [
          'schema',
          'init',
          'reactive-schema',
          '--description',
          'First CLI schema',
          '--artifacts',
          'proposal',
          '--no-default',
          '--json',
        ],
        project,
        env
      )
      expect(initialized.success, initialized.stdout + '\n' + initialized.stderr).toBe(true)

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
      const configManager = new ConfigManager(project)
      await configManager.writeConfig({
        cli: { command: process.execPath, args: [cliWrapper] },
      })
      const cliExecutor = new CliExecutor(configManager, project)
      const execute = vi.spyOn(cliExecutor, 'execute')
      const observationEnvironment = new ReactiveObservationEnvironment()
      const releaseProjectRoot = await observationEnvironment.acquireRoot(project)
      const invalidation = new RuntimeInvalidationIndex()
      const runtime = createServerProjectionWorkRuntime()
      const kernel = new OpsxKernel(project, cliExecutor, invalidation, {})
      const service = new PlanningCliProjectionService({
        rootContext: rootContext(project, join(env.XDG_DATA_HOME ?? base, 'openspec')),
        gitBindingToken: 'schema-observation-fixture',
        kernel,
        documentService: {
          readSpec: async () => null,
          readSpecRaw: async () => null,
        },
        contracts: new OpenSpecCliContractExecutor((args) => runCli(args, project, env)),
        invalidation,
        storeObservation: { subscribe: () => () => {} },
        workOwner: createPlanningCliProjectionWorkOwner(runtime),
      })
      const configSubscription = service.subscribe(CONFIG_SELECTOR, () => {})
      const templatesSubscription = service.subscribe(TEMPLATES_SELECTOR, () => {})

      try {
        await vi.waitFor(
          () => {
            expect(
              configBundle(service)?.schemas.find((schema) => schema.name === 'reactive-schema')
                ?.description
            ).toBe('First CLI schema')
            expect(templateIds(service)).toEqual(['proposal'])
          },
          { timeout: 15_000, interval: 50 }
        )
        const configGeneration = service.read(CONFIG_SELECTOR).workGeneration
        const templatesGeneration = service.read(TEMPLATES_SELECTOR).workGeneration
        const initialSchemasCalls = execute.mock.calls.filter(
          ([args]) => args[0] === 'schemas' && args[1] === '--json'
        ).length
        const initialWhichCalls = execute.mock.calls.filter(
          ([args]) => args[0] === 'schema' && args[1] === 'which'
        ).length
        const initialTemplatesCalls = execute.mock.calls.filter(
          ([args]) => args[0] === 'templates' && args[1] === '--json'
        ).length

        await Promise.all([
          writeFile(schemaPath, schemaYaml('Second CLI schema'), 'utf8'),
          writeFile(designTemplatePath, '# Design template\n', 'utf8'),
        ])

        await vi.waitFor(
          () => {
            expect(service.read(CONFIG_SELECTOR)).toMatchObject({
              state: 'ready',
            })
            expect(service.read(CONFIG_SELECTOR).workGeneration).toBeGreaterThan(configGeneration)
            expect(
              configBundle(service)?.schemas.find((schema) => schema.name === 'reactive-schema')
                ?.description
            ).toBe('Second CLI schema')
            expect(
              configBundle(service)?.schemaDetails['reactive-schema']?.artifacts.map(
                (artifact) => artifact.id
              )
            ).toEqual(['proposal', 'design'])
            expect(service.read(TEMPLATES_SELECTOR)).toMatchObject({
              state: 'ready',
            })
            expect(service.read(TEMPLATES_SELECTOR).workGeneration).toBeGreaterThan(
              templatesGeneration
            )
            expect(templateIds(service)).toEqual(['design', 'proposal'])
          },
          { timeout: 15_000, interval: 50 }
        )
        expect(
          execute.mock.calls.filter(([args]) => args[0] === 'schemas' && args[1] === '--json')
            .length
        ).toBeGreaterThan(initialSchemasCalls)
        expect(
          execute.mock.calls.filter(([args]) => args[0] === 'schema' && args[1] === 'which').length
        ).toBeGreaterThan(initialWhichCalls)
        expect(
          execute.mock.calls.filter(([args]) => args[0] === 'templates' && args[1] === '--json')
            .length
        ).toBeGreaterThan(initialTemplatesCalls)
      } finally {
        configSubscription.unsubscribe()
        templatesSubscription.unsubscribe()
        service.dispose()
        kernel.dispose()
        runtime.clear()
        await releaseProjectRoot()
        await observationEnvironment.dispose()
      }
    } finally {
      await removeServerTestDirectories([base])
    }
  }, 60_000)

  it('discovers a newly added data-home Schema through the runtime observer', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openspecui-data-home-schema-observation-'))
    const project = join(base, 'project')
    const env = fixtureEnv(base)
    const dataScopePath = join(env.XDG_DATA_HOME ?? base, 'openspec')
    const schemaRoot = join(dataScopePath, 'schemas', 'reactive-schema')
    await mkdir(project, { recursive: true })

    try {
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
      const configManager = new ConfigManager(project)
      await configManager.writeConfig({
        cli: { command: process.execPath, args: [cliWrapper] },
      })
      const cliExecutor = new CliExecutor(configManager, project)
      const execute = vi.spyOn(cliExecutor, 'execute')
      const observationEnvironment = new ReactiveObservationEnvironment()
      const invalidation = new RuntimeInvalidationIndex()
      const dataHomeObserver = new OpenSpecDataHomeObserver({
        dataHomePath: dataScopePath,
        environment: observationEnvironment,
        invalidation,
      })
      await dataHomeObserver.start()
      const runtime = createServerProjectionWorkRuntime()
      const kernel = new OpsxKernel(project, cliExecutor, invalidation, {})
      const service = new PlanningCliProjectionService({
        rootContext: rootContext(project, dataScopePath),
        gitBindingToken: 'data-home-schema-observation-fixture',
        kernel,
        documentService: {
          readSpec: async () => null,
          readSpecRaw: async () => null,
        },
        contracts: new OpenSpecCliContractExecutor((args) => runCli(args, project, env)),
        invalidation,
        storeObservation: { subscribe: () => () => {} },
        workOwner: createPlanningCliProjectionWorkOwner(runtime),
      })
      const configSubscription = service.subscribe(CONFIG_SELECTOR, () => {})
      const templatesSubscription = service.subscribe(TEMPLATES_SELECTOR, () => {})

      try {
        await vi.waitFor(
          () => {
            expect(
              configBundle(service)?.schemas.some((schema) => schema.name === 'reactive-schema')
            ).toBe(false)
            expect(service.read(TEMPLATES_SELECTOR)).toMatchObject({ state: 'error', data: null })
          },
          { timeout: 15_000, interval: 50 }
        )
        const configGeneration = service.read(CONFIG_SELECTOR).workGeneration
        const templatesGeneration = service.read(TEMPLATES_SELECTOR).workGeneration
        const initialSchemasCalls = execute.mock.calls.filter(
          ([args]) => args[0] === 'schemas' && args[1] === '--json'
        ).length
        const initialWhichCalls = execute.mock.calls.filter(
          ([args]) => args[0] === 'schema' && args[1] === 'which'
        ).length
        const initialTemplatesCalls = execute.mock.calls.filter(
          ([args]) => args[0] === 'templates' && args[1] === '--json'
        ).length

        await mkdir(join(schemaRoot, 'templates'), { recursive: true })
        await Promise.all([
          writeFile(join(schemaRoot, 'schema.yaml'), schemaYaml('Data-home CLI schema'), 'utf8'),
          writeFile(join(schemaRoot, 'templates', 'proposal.md'), '# Proposal template\n', 'utf8'),
          writeFile(join(schemaRoot, 'templates', 'design.md'), '# Design template\n', 'utf8'),
        ])

        await vi.waitFor(
          () => {
            expect(service.read(CONFIG_SELECTOR)).toMatchObject({ state: 'ready' })
            expect(service.read(CONFIG_SELECTOR).workGeneration).toBeGreaterThan(configGeneration)
            expect(
              configBundle(service)?.schemas.find((schema) => schema.name === 'reactive-schema')
            ).toMatchObject({ description: 'Data-home CLI schema', source: 'user' })
            expect(service.read(TEMPLATES_SELECTOR)).toMatchObject({ state: 'ready' })
            expect(service.read(TEMPLATES_SELECTOR).workGeneration).toBeGreaterThan(
              templatesGeneration
            )
            expect(templateIds(service)).toEqual(['design', 'proposal'])
          },
          { timeout: 15_000, interval: 50 }
        )
        expect(
          execute.mock.calls.filter(([args]) => args[0] === 'schemas' && args[1] === '--json')
            .length
        ).toBeGreaterThan(initialSchemasCalls)
        expect(
          execute.mock.calls.filter(([args]) => args[0] === 'schema' && args[1] === 'which').length
        ).toBeGreaterThan(initialWhichCalls)
        expect(
          execute.mock.calls.filter(([args]) => args[0] === 'templates' && args[1] === '--json')
            .length
        ).toBeGreaterThan(initialTemplatesCalls)
      } finally {
        configSubscription.unsubscribe()
        templatesSubscription.unsubscribe()
        service.dispose()
        kernel.dispose()
        runtime.clear()
        await dataHomeObserver.dispose()
        await observationEnvironment.dispose()
      }
    } finally {
      await removeServerTestDirectories([base])
    }
  }, 60_000)
})
