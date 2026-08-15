/**
 * Orthogonal intents (created 2026-08-15 Asia/Shanghai):
 * 1. Prove the schemas success array and the 1.9 selected-Root failure envelope on real executables.
 * 2. Prove OpenSpec 1.9 archived-task validation reports incomplete archived work, including
 *    indented and blank-description checkboxes, through the ordinary Validate envelope.
 * 3. Pin the 1.8 boundary: the schemas root selector and validate --archived do not exist there.
 *
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V9_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedVersion,
  parsePinnedJson,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV9Version,
} from './__tests__/official-cli-v9-fixtures.js'
import {
  CliSchemasFailureSchema,
  CliSchemasSuccessSchema,
  isCliSchemasFailure,
} from './cli-contracts/schema-resolution.js'
import { CliValidateReportSchema, type CliValidateReport } from './cli-contracts/workflow.js'

function outputOf(result: { stdout: string; stderr: string }): string {
  return result.stdout + '\n' + result.stderr
}

async function createChangeWithTasks(
  version: PinnedOpenspecV9Version,
  project: string,
  env: NodeJS.ProcessEnv,
  changeId: string,
  tasks: string
): Promise<void> {
  const created = await runPinnedOpenspec(version, ['new', 'change', changeId], project, env)
  expect(created.exitCode, outputOf(created)).toBe(0)
  const changeDir = join(project, 'openspec', 'changes', changeId)
  await writeFile(join(changeDir, 'proposal.md'), `# Proposal\n\n${changeId} work.\n`)
  await writeFile(join(changeDir, 'tasks.md'), tasks)
}

describe('pinned OpenSpec 1.8/1.9 schemas and archived validation fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V9_VERSIONS) {
    it(`returns the successful schemas array on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-schemas`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)

      const result = await runPinnedOpenspec(version, ['schemas', '--json'], project, env)
      const schemas = parsePinnedSuccessJson(result, (payload) =>
        CliSchemasSuccessSchema.parse(payload)
      )
      expect(isCliSchemasFailure(schemas)).toBe(false)
      expect(schemas.some((schema) => schema.name === 'spec-driven')).toBe(true)
      for (const schema of schemas) {
        expect(schema.source).toMatch(/^(project|user|package)$/)
        expect(Array.isArray(schema.artifacts)).toBe(true)
      }
    })
  }

  it('emits the canonical 1.9 selected-Root schemas failure envelope', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-190-schemas-failure')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    const result = await runPinnedOpenspec(
      '1.9.0',
      ['schemas', '--json', '--store', 'ghost'],
      project,
      env
    )
    expect(result.exitCode).toBe(1)
    const envelope = parsePinnedJson(result, (payload) => CliSchemasFailureSchema.parse(payload))
    expect(isCliSchemasFailure(envelope)).toBe(true)
    expect(envelope.root).toBeNull()
    expect(envelope.schemas).toEqual([])
    expect(envelope.status[0]).toMatchObject({
      severity: 'error',
      code: 'no_registered_stores',
    })
    // The failure envelope is never a successful schema array.
    expect(CliSchemasSuccessSchema.safeParse(JSON.parse(result.stdout)).success).toBe(false)
  })

  it('keeps the 1.8 schemas command without the 1.9 root-selector boundary', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-180-schemas-selector')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    const result = await runPinnedOpenspec(
      '1.8.0',
      ['schemas', '--json', '--store', 'ghost'],
      project,
      env
    )
    expect(result.exitCode).not.toBe(0)
    // 1.8 rejects the unknown option instead of emitting the 1.9 failure envelope.
    expect(result.stdout.trim()).toBe('')
  })

  it('reports incomplete archived tasks through the 1.9 Validate envelope', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-190-archived-validate')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    const initialized = await runPinnedOpenspec(
      '1.9.0',
      ['init', project, '--tools=none'],
      project,
      env
    )
    expect(initialized.exitCode, outputOf(initialized)).toBe(0)

    await createChangeWithTasks(
      '1.9.0',
      project,
      env,
      'done-change',
      '# Tasks\n\n- [x] Finish the work\n'
    )
    const archivedDone = await runPinnedOpenspec(
      '1.9.0',
      ['archive', 'done-change', '--json', '--yes'],
      project,
      env
    )
    expect(archivedDone.exitCode, outputOf(archivedDone)).toBe(0)

    // Indented and blank-description checkboxes all count as archived task progress.
    await createChangeWithTasks(
      '1.9.0',
      project,
      env,
      'pending-work',
      '# Tasks\n\n- [ ] Not finished\n- [x] Finished\n  - [ ] Nested pending\n- [ ]\n'
    )
    const archivedPending = await runPinnedOpenspec(
      '1.9.0',
      ['archive', 'pending-work', '--json', '--yes', '--no-validate'],
      project,
      env
    )
    expect(archivedPending.exitCode, outputOf(archivedPending)).toBe(0)

    const result = await runPinnedOpenspec(
      '1.9.0',
      ['validate', '--archived', '--json'],
      project,
      env
    )
    expect(result.exitCode).toBe(1)
    const report: CliValidateReport = parsePinnedJson(result, (payload) =>
      CliValidateReportSchema.parse(payload)
    )

    const failing = report.items.find((item) => item.id.includes('pending-work'))
    expect(failing).toMatchObject({
      type: 'change',
      valid: false,
      issues: [
        {
          level: 'ERROR',
          path: 'tasks.md',
          message: '3 incomplete tasks (1/4 completed)',
        },
      ],
    })
    expect(report.summary.totals).toMatchObject({ items: 2, passed: 1, failed: 1 })
  }, 60_000)

  it('keeps validate --archived a 1.9-only capability', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-180-archived-boundary')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    const result = await runPinnedOpenspec(
      '1.8.0',
      ['validate', '--archived', '--json'],
      project,
      env
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toLowerCase()).toContain('unknown option')
  })
})
