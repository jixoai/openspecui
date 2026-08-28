/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Prove the pinned 1.10/1.11 executables decode schemas success and selected-Root
 *    failure envelopes on both admitted lines.
 * 2. Report archived task failures through the ordinary Validate envelope on both lines.
 * 3. Prove the 1.11 Purpose-placeholder WARNING class and its strict escalation, and the
 *    1.10 boundary where that warning class does not exist.
 *
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V11_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedVersion,
  parsePinnedJson,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV11Version,
} from './__tests__/official-cli-v11-fixtures.js'
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
  version: PinnedOpenspecV11Version,
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

async function writePlaceholderSpec(project: string): Promise<void> {
  await mkdir(join(project, 'openspec', 'specs', 'billing'), { recursive: true })
  await writeFile(
    join(project, 'openspec', 'specs', 'billing', 'spec.md'),
    [
      '## Purpose',
      'TBD',
      '',
      '## Requirements',
      '',
      '### Requirement: Billing rules',
      'The system SHALL apply billing rules.',
      '',
      '#### Scenario: Existing behavior',
      '- **WHEN** billing runs',
      '- **THEN** billing succeeds',
      '',
    ].join('\n')
  )
}

describe('pinned OpenSpec 1.10/1.11 schemas and validation fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V11_VERSIONS) {
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
    }, 60_000)

    it(`emits the selected-Root schemas failure envelope on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-schemas-failure`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)

      // Both admitted lines resolve schemas through the selected Root, so the ghost
      // store surfaces as the shared JSON failure contract, never as a catalog.
      const result = await runPinnedOpenspec(
        version,
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
    }, 60_000)

    it(`reports incomplete archived tasks through the Validate envelope on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-archived-validate`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)

      const initialized = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(initialized.exitCode, outputOf(initialized)).toBe(0)

      await createChangeWithTasks(
        version,
        project,
        env,
        'done-change',
        '# Tasks\n\n- [x] Finish the work\n'
      )
      const archivedDone = await runPinnedOpenspec(
        version,
        ['archive', 'done-change', '--json', '--yes'],
        project,
        env
      )
      expect(archivedDone.exitCode, outputOf(archivedDone)).toBe(0)

      // Indented and blank-description checkboxes all count as archived task progress.
      await createChangeWithTasks(
        version,
        project,
        env,
        'pending-work',
        '# Tasks\n\n- [ ] Not finished\n- [x] Finished\n  - [ ] Nested pending\n- [ ]\n'
      )
      const archivedPending = await runPinnedOpenspec(
        version,
        ['archive', 'pending-work', '--json', '--yes', '--no-validate'],
        project,
        env
      )
      expect(archivedPending.exitCode, outputOf(archivedPending)).toBe(0)

      const result = await runPinnedOpenspec(
        version,
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
    }, 120_000)
  }

  it('flags a TBD Purpose as an overview WARNING that only strict validation fails', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1110-purpose-placeholder')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    await expectPinnedVersion('1.11.0', project, env)

    const initialized = await runPinnedOpenspec(
      '1.11.0',
      ['init', project, '--tools=none'],
      project,
      env
    )
    expect(initialized.exitCode, outputOf(initialized)).toBe(0)
    await writePlaceholderSpec(project)

    const nonStrict = await runPinnedOpenspec(
      '1.11.0',
      ['validate', '--specs', '--json'],
      project,
      env
    )
    expect(nonStrict.exitCode).toBe(0)
    const nonStrictReport: CliValidateReport = parsePinnedJson(nonStrict, (payload) =>
      CliValidateReportSchema.parse(payload)
    )
    const placeholderIssue = nonStrictReport.items[0]?.issues.find((issue) =>
      issue.message.includes('still a placeholder')
    )
    expect(placeholderIssue).toMatchObject({
      level: 'WARNING',
      path: 'overview',
    })
    expect(typeof placeholderIssue?.line).toBe('number')
    expect(nonStrictReport.items[0]?.valid).toBe(true)

    const strict = await runPinnedOpenspec(
      '1.11.0',
      ['validate', '--specs', '--json', '--strict'],
      project,
      env
    )
    expect(strict.exitCode).toBe(1)
    const strictReport: CliValidateReport = parsePinnedJson(strict, (payload) =>
      CliValidateReportSchema.parse(payload)
    )
    expect(strictReport.items[0]?.valid).toBe(false)
    expect(strictReport.summary.totals).toMatchObject({ items: 1, passed: 0, failed: 1 })
  }, 60_000)

  it('keeps the Purpose-placeholder warning class absent on the pinned 1.10.0 executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1100-purpose-placeholder')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    await expectPinnedVersion('1.10.0', project, env)

    const initialized = await runPinnedOpenspec(
      '1.10.0',
      ['init', project, '--tools=none'],
      project,
      env
    )
    expect(initialized.exitCode, outputOf(initialized)).toBe(0)
    await writePlaceholderSpec(project)

    const result = await runPinnedOpenspec(
      '1.10.0',
      ['validate', '--specs', '--json'],
      project,
      env
    )
    expect(result.exitCode).toBe(0)
    const report: CliValidateReport = parsePinnedJson(result, (payload) =>
      CliValidateReportSchema.parse(payload)
    )
    // 1.10 has no placeholder finding; only its generic purpose hygiene may appear.
    for (const issue of report.items[0]?.issues ?? []) {
      expect(issue.message).not.toContain('still a placeholder')
    }
    expect(report.items[0]?.valid).toBe(true)
  }, 60_000)
})
