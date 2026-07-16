/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Execute pinned official OpenSpec 1.4, 1.5, and 1.6 npm packages.
 * 2. Prove root, Store, Reference, workflow-delivery, and failure contracts on real roots.
 * 3. Prove tracked-glob and archive safety behavior without source-string assertions.
 *
 * Original request (2026-07-15): "1.4、1.5、1.6 第一方合同回归测试。"
 */
import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  CliArchiveSchema,
  CliChangeListSchema,
  CliContextSchema,
  CliDiagnosticFailureSchema,
  CliDoctorSchema,
  CliStoreDoctorSchema,
  CliStoreMutationSchema,
} from './cli-contracts/index.js'

type CliVersion = '1.4.0' | '1.5.0' | '1.6.0'

const CLI_BINS = {
  '1.4.0': resolve(import.meta.dirname, '../node_modules/openspec-cli-14/bin/openspec.js'),
  '1.5.0': resolve(import.meta.dirname, '../node_modules/openspec-cli-15/bin/openspec.js'),
  '1.6.0': resolve(import.meta.dirname, '../node_modules/openspec-cli-16/bin/openspec.js'),
} satisfies Record<CliVersion, string>

interface CliRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

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

function runCli(
  version: CliVersion,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<CliRunResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [CLI_BINS[version], ...args],
      { cwd, env, maxBuffer: 4 * 1024 * 1024, timeout: 30_000 },
      (error, stdout, stderr) => {
        complete({
          exitCode: typeof error?.code === 'number' ? error.code : error ? 1 : 0,
          stdout,
          stderr,
        })
      }
    )
  })
}

function expectExit(result: CliRunResult, exitCode: number): void {
  expect(result.exitCode, result.stdout + '\n' + result.stderr).toBe(exitCode)
}

function parseJson<T>(result: CliRunResult, schema: z.ZodType<T>): T {
  expect(result.stdout.trim().startsWith('{'), result.stdout + '\n' + result.stderr).toBe(true)
  return schema.parse(JSON.parse(result.stdout))
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function setupStore(
  version: '1.5.0' | '1.6.0',
  id: string,
  root: string,
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<string> {
  const result = await runCli(
    version,
    ['store', 'setup', id, '--path', root, '--no-init-git', '--json'],
    cwd,
    env
  )
  expectExit(result, 0)
  expect(parseJson(result, CliStoreMutationSchema).store?.id).toBe(id)
  return realpath(root)
}

async function writeChange(
  root: string,
  name: string,
  deltaSpec: string,
  schema?: string
): Promise<string> {
  const changeDir = join(root, 'openspec', 'changes', name)
  await mkdir(join(changeDir, 'specs', 'billing'), { recursive: true })
  await writeFile(
    join(changeDir, 'proposal.md'),
    [
      '## Why',
      'Billing behavior needs a contract update.',
      '',
      '## What Changes',
      '- Update billing behavior.',
      '',
    ].join('\n')
  )
  await writeFile(join(changeDir, 'tasks.md'), '- [x] Implement the billing change\n')
  await writeFile(join(changeDir, 'specs', 'billing', 'spec.md'), deltaSpec)
  if (schema) {
    await writeFile(join(changeDir, '.openspec.yaml'), 'schema: ' + schema + '\n')
  }
  return changeDir
}

const VALID_SCENARIO = [
  '### Requirement: Billing rules',
  'The system SHALL apply billing rules.',
  '',
  '#### Scenario: Existing behavior',
  '- **WHEN** billing runs',
  '- **THEN** billing succeeds',
  '',
].join('\n')

describe('official executable OpenSpec CLI fixtures', () => {
  it('executes 1.4 core initialization with Sync but without Update delivery', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openspecui-cli-14-'))
    const project = join(base, 'project')
    const env = fixtureEnv(base)
    await mkdir(project, { recursive: true })

    try {
      const version = await runCli('1.4.0', ['--version'], project, env)
      expectExit(version, 0)
      expect(version.stdout.trim()).toBe('1.4.0')

      const initialized = await runCli(
        '1.4.0',
        ['init', project, '--tools', 'claude', '--profile', 'core'],
        project,
        env
      )
      expectExit(initialized, 0)
      expect(await pathExists(join(project, '.claude', 'commands', 'opsx', 'sync.md'))).toBe(true)
      expect(await pathExists(join(project, '.claude', 'commands', 'opsx', 'update.md'))).toBe(
        false
      )
      expect(
        await pathExists(join(project, '.claude', 'skills', 'openspec-sync-specs', 'SKILL.md'))
      ).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  }, 60_000)

  it('executes 1.5 Store setup plus declared and explicit root selection', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openspecui-cli-15-'))
    const launch = join(base, 'launch')
    const env = fixtureEnv(base)
    await mkdir(join(launch, 'openspec'), { recursive: true })

    try {
      const store = await setupStore('1.5.0', 'shared', join(base, 'shared'), base, env)
      await writeFile(join(launch, 'openspec', 'config.yaml'), 'store: shared\n')

      const declaredResult = await runCli('1.5.0', ['doctor', '--json'], launch, env)
      expectExit(declaredResult, 0)
      const declared = parseJson(declaredResult, CliDoctorSchema)
      expect(declared.root).toMatchObject({ path: store, source: 'declared', store_id: 'shared' })

      const explicitResult = await runCli(
        '1.5.0',
        ['doctor', '--store', 'shared', '--json'],
        base,
        env
      )
      expectExit(explicitResult, 0)
      const explicit = parseJson(explicitResult, CliDoctorSchema)
      expect(explicit.root).toMatchObject({ path: store, source: 'store', store_id: 'shared' })

      const emptyResult = await runCli('1.5.0', ['store', 'doctor', 'shared', '--json'], base, env)
      expectExit(emptyResult, 0)
      const empty = parseJson(emptyResult, CliStoreDoctorSchema)
      expect(empty.stores[0]).toMatchObject({
        id: 'shared',
        openspec_root: { healthy: true },
        status: [],
      })
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  }, 60_000)

  it('executes the complete 1.6 root, Reference, task, archive, and failure matrix', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openspecui-cli-16-'))
    const nearest = join(base, 'nearest')
    const launch = join(base, 'launch')
    const env = fixtureEnv(base)
    await Promise.all([
      mkdir(nearest, { recursive: true }),
      mkdir(join(launch, 'openspec'), { recursive: true }),
    ])

    try {
      const initialized = await runCli(
        '1.6.0',
        ['init', nearest, '--tools', 'claude', '--profile', 'core'],
        nearest,
        env
      )
      expectExit(initialized, 0)
      expect(await pathExists(join(nearest, '.claude', 'commands', 'opsx', 'sync.md'))).toBe(true)
      expect(await pathExists(join(nearest, '.claude', 'commands', 'opsx', 'update.md'))).toBe(true)

      const nearestResult = await runCli('1.6.0', ['doctor', '--json'], nearest, env)
      expectExit(nearestResult, 0)
      expect(parseJson(nearestResult, CliDoctorSchema).root).toMatchObject({
        path: await realpath(nearest),
        source: 'nearest',
      })

      const team = await setupStore('1.6.0', 'team', join(base, 'team'), base, env)
      const platform = await setupStore('1.6.0', 'platform', join(base, 'platform'), base, env)
      await mkdir(join(platform, 'openspec', 'specs', 'identity'), { recursive: true })
      await writeFile(
        join(platform, 'openspec', 'specs', 'identity', 'spec.md'),
        [
          '# identity Specification',
          '',
          '## Purpose',
          'Shared identity facts.',
          '',
          '## Requirements',
          '',
          '### Requirement: Identity',
          'The system SHALL expose identity.',
          '',
          '#### Scenario: Visible',
          '- **WHEN** identity is read',
          '- **THEN** it is visible',
          '',
        ].join('\n')
      )
      await writeFile(
        join(team, 'openspec', 'config.yaml'),
        ['schema: spec-driven', 'references:', '  - platform', ''].join('\n')
      )
      await writeFile(join(launch, 'openspec', 'config.yaml'), 'store: team\n')

      const declaredResult = await runCli('1.6.0', ['doctor', '--json'], launch, env)
      expectExit(declaredResult, 0)
      expect(parseJson(declaredResult, CliDoctorSchema).root).toMatchObject({
        path: team,
        source: 'declared',
        store_id: 'team',
      })

      const explicitResult = await runCli(
        '1.6.0',
        ['doctor', '--store', 'team', '--json'],
        nearest,
        env
      )
      expectExit(explicitResult, 0)
      expect(parseJson(explicitResult, CliDoctorSchema).root).toMatchObject({
        path: team,
        source: 'store',
        store_id: 'team',
      })

      const contextResult = await runCli(
        '1.6.0',
        ['context', '--store', 'team', '--json'],
        nearest,
        env
      )
      expectExit(contextResult, 0)
      const context = parseJson(contextResult, CliContextSchema)
      expect(context.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'referenced_store', id: 'platform', path: platform }),
        ])
      )

      const emptyResult = await runCli('1.6.0', ['store', 'doctor', 'team', '--json'], nearest, env)
      expectExit(emptyResult, 0)
      expect(parseJson(emptyResult, CliStoreDoctorSchema).stores[0]).toMatchObject({
        id: 'team',
        openspec_root: { healthy: true },
        status: [],
      })

      const schemaDir = join(team, 'openspec', 'schemas', 'glob-tasks')
      const globChange = join(team, 'openspec', 'changes', 'glob-change')
      await Promise.all([
        mkdir(schemaDir, { recursive: true }),
        mkdir(join(globChange, 'backend'), { recursive: true }),
        mkdir(join(globChange, 'frontend'), { recursive: true }),
      ])
      await writeFile(
        join(schemaDir, 'schema.yaml'),
        [
          'name: glob-tasks',
          'version: 1',
          'description: nested tracked tasks',
          'artifacts:',
          '  - id: proposal',
          '    generates: proposal.md',
          '    description: Proposal',
          '    template: proposal.md',
          '    requires: []',
          '  - id: tasks',
          '    generates: "**/tasks.md"',
          '    description: Nested tasks',
          '    template: tasks.md',
          '    requires: [proposal]',
          'apply:',
          '  requires: [tasks]',
          '  tracks: "**/tasks.md"',
          '',
        ].join('\n')
      )
      await writeFile(join(globChange, '.openspec.yaml'), 'schema: glob-tasks\n')
      await writeFile(join(globChange, 'backend', 'tasks.md'), '- [x] a\n- [x] b\n')
      await writeFile(join(globChange, 'frontend', 'tasks.md'), '- [x] c\n- [ ] d\n- [ ] e\n')

      const listResult = await runCli('1.6.0', ['list', '--json', '--store', 'team'], nearest, env)
      expectExit(listResult, 0)
      const globEntry = parseJson(listResult, CliChangeListSchema).changes.find(
        (change) => change.name === 'glob-change'
      )
      expect(globEntry).toMatchObject({
        completedTasks: 3,
        totalTasks: 5,
        status: 'in-progress',
      })

      const invalidDelta = [
        '## ADDED Requirements',
        '',
        '### Requirement: Billing rules',
        'The system SHALL apply billing rules.',
        '',
      ].join('\n')
      const invalidChange = await writeChange(team, 'invalid-change', invalidDelta)
      const strictArchiveResult = await runCli(
        '1.6.0',
        ['archive', 'invalid-change', '--store', 'team', '--yes', '--json'],
        nearest,
        env
      )
      expectExit(strictArchiveResult, 1)
      const strictArchive = parseJson(strictArchiveResult, CliArchiveSchema)
      expect(strictArchive.archive).toBeNull()
      expect(strictArchive.status?.[0]?.code).toBe('archive_validation_failed')
      expect(await pathExists(invalidChange)).toBe(true)

      const mainSpec = join(team, 'openspec', 'specs', 'billing', 'spec.md')
      await mkdir(join(team, 'openspec', 'specs', 'billing'), { recursive: true })
      const mainContent = [
        '# billing Specification',
        '',
        '## Purpose',
        'Billing rules.',
        '',
        '## Requirements',
        '',
        VALID_SCENARIO,
        '#### Scenario: Later behavior',
        '- **WHEN** later billing runs',
        '- **THEN** later billing succeeds',
        '',
      ].join('\n')
      await writeFile(mainSpec, mainContent)
      const staleDelta = ['## MODIFIED Requirements', '', VALID_SCENARIO].join('\n')
      const staleChange = await writeChange(team, 'stale-change', staleDelta)
      const scenarioLossResult = await runCli(
        '1.6.0',
        ['archive', 'stale-change', '--store', 'team', '--yes', '--json', '--no-validate'],
        nearest,
        env
      )
      expectExit(scenarioLossResult, 1)
      const scenarioLoss = parseJson(scenarioLossResult, CliArchiveSchema)
      expect(scenarioLoss.archive).toBeNull()
      expect(scenarioLoss.status?.[0]).toMatchObject({ code: 'archive_spec_update_failed' })
      expect(scenarioLoss.status?.[0]?.message).toContain('scenario(s) not present')
      expect(await readFile(mainSpec, 'utf8')).toBe(mainContent)
      expect(await pathExists(staleChange)).toBe(true)

      const emptySelectorResult = await runCli(
        '1.6.0',
        ['doctor', '--store', '', '--json'],
        nearest,
        env
      )
      expectExit(emptySelectorResult, 1)
      expect(parseJson(emptySelectorResult, CliDiagnosticFailureSchema).status[0]?.code).toBe(
        'invalid_store_id'
      )

      const unknownStoreResult = await runCli(
        '1.6.0',
        ['doctor', '--store', 'missing-store', '--json'],
        nearest,
        env
      )
      expectExit(unknownStoreResult, 1)
      expect(parseJson(unknownStoreResult, CliDiagnosticFailureSchema).status[0]?.code).toBe(
        'unknown_store'
      )
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  }, 120_000)
})
