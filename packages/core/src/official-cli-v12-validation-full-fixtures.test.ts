/**
 * Orthogonal intents (created 2026-09-03 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.12.0 full bulk `validate --json` report: schema
 *    compatibility with the 1.11 envelope plus the new merge-conflict INFO issues.
 * 2. Prove `--report full` stays the explicit default and strict escalation plus the
 *    human next-steps footer behavior are unchanged.
 * 3. Carry over the admitted-line contracts the v11 validation matrix proved:
 *    schemas success/selected-Root failure envelopes and archived task validation.
 *
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V12_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  expectPinnedVersion,
  parsePinnedJson,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV12Version,
} from './__tests__/official-cli-v12-fixtures.js'
import {
  CliSchemasFailureSchema,
  CliSchemasSuccessSchema,
  isCliSchemasFailure,
} from './cli-contracts/schema-resolution.js'
import {
  CliValidateFindingsSchema,
  CliValidateReportSchema,
  type CliValidateReport,
} from './cli-contracts/workflow.js'

async function initProject(
  version: PinnedOpenspecV12Version,
  project: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const initialized = await runPinnedOpenspec(
    version,
    ['init', project, '--tools=none'],
    project,
    env
  )
  expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)
}

/** A change whose delta MODIFIES requirements of a spec that does not exist. */
async function createModifiedAgainstMissingSpecChange(
  version: PinnedOpenspecV12Version,
  project: string,
  env: NodeJS.ProcessEnv,
  changeId: string
): Promise<void> {
  const created = await runPinnedOpenspec(version, ['new', 'change', changeId], project, env)
  expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
  const changeDir = join(project, 'openspec', 'changes', changeId)
  await writeFile(
    join(changeDir, 'proposal.md'),
    [
      '## Why',
      `${changeId} needs a contract update.`,
      '',
      '## What Changes',
      `- Modify the missing spec for ${changeId}.`,
      '',
    ].join('\n')
  )
  await mkdir(join(changeDir, 'specs', 'missing-spec'), { recursive: true })
  await writeFile(
    join(changeDir, 'specs', 'missing-spec', 'spec.md'),
    [
      '## MODIFIED Requirements',
      '',
      '### Requirement: Missing behavior',
      'The system SHALL preserve missing-target evidence.',
      '',
      '#### Scenario: Existing behavior',
      '- **WHEN** the delta is validated',
      '- **THEN** the merge conflict is advisory',
      '',
    ].join('\n')
  )
}

/** A loadable change that fails validation through an ERROR issue. */
async function createFailingChange(
  version: PinnedOpenspecV12Version,
  project: string,
  env: NodeJS.ProcessEnv,
  changeId: string
): Promise<void> {
  const created = await runPinnedOpenspec(version, ['new', 'change', changeId], project, env)
  expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
  const changeDir = join(project, 'openspec', 'changes', changeId)
  await writeFile(
    join(changeDir, 'proposal.md'),
    [
      '## Why',
      `${changeId} fails validation.`,
      '',
      '## What Changes',
      '- Add a requirement without scenarios.',
      '',
    ].join('\n')
  )
  await mkdir(join(changeDir, 'specs', 'billing'), { recursive: true })
  await writeFile(
    join(changeDir, 'specs', 'billing', 'spec.md'),
    [
      '## ADDED Requirements',
      '',
      '### Requirement: Broken rule',
      'The system SHALL fail validation.',
      '',
    ].join('\n')
  )
}

async function createChangeWithTasks(
  version: PinnedOpenspecV12Version,
  project: string,
  env: NodeJS.ProcessEnv,
  changeId: string,
  tasks: string
): Promise<void> {
  const created = await runPinnedOpenspec(version, ['new', 'change', changeId], project, env)
  expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
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

describe('pinned OpenSpec 1.12 full validation report fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V12_VERSIONS) {
    it(`keeps the full bulk report schema-compatible and carries the merge-conflict INFO beside real errors on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-validate-full`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)
      await createModifiedAgainstMissingSpecChange(version, project, env, 'info-change')
      await createFailingChange(version, project, env, 'failing-change')

      const result = await runPinnedOpenspec(version, ['validate', '--all', '--json'], project, env)
      // A failing item keeps the full-run exit rule while stdout stays one document.
      expect(result.exitCode).toBe(1)
      expectPinnedJsonDiscipline(result)
      const report: CliValidateReport = parsePinnedJson(result, (payload) =>
        CliValidateReportSchema.parse(payload)
      )

      expect(report.version).toBe('1.0')
      expect(report.root).toMatchObject({ source: 'nearest' })
      expect(report.summary.totals).toEqual({ items: 2, passed: 1, failed: 1 })

      // The merge-conflict INFO appears in the FULL report too, not only in findings.
      const advisory = report.items.find((item) => item.id === 'info-change')
      expect(advisory?.valid).toBe(true)
      expect(advisory?.issues[0]).toMatchObject({
        level: 'INFO',
        path: 'missing-spec/spec.md',
        message: expect.stringContaining('Archive would refuse this delta'),
      })

      const failing = report.items.find((item) => item.id === 'failing-change')
      expect(failing?.valid).toBe(false)
      expect(failing?.issues[0]).toMatchObject({ level: 'ERROR', path: 'billing/spec.md' })
    }, 60_000)

    it(`keeps --report full the explicit default over the same items on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-validate-report-full`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)
      await createModifiedAgainstMissingSpecChange(version, project, env, 'info-change')

      const explicit = await runPinnedOpenspec(
        version,
        ['validate', '--all', '--report', 'full', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(explicit)
      const full = parsePinnedSuccessJson(explicit, (payload) =>
        CliValidateReportSchema.parse(payload)
      )
      expect(full.items).toHaveLength(1)
      expect(full.items[0]?.valid).toBe(true)
      expect(full.items[0]?.issues[0]?.level).toBe('INFO')
      // The explicit full report is not the findings transport.
      expect(CliValidateFindingsSchema.safeParse(JSON.parse(explicit.stdout)).success).toBe(false)

      const implicit = await runPinnedOpenspec(
        version,
        ['validate', '--all', '--json'],
        project,
        env
      )
      expect(implicit.exitCode, implicit.stdout + '\n' + implicit.stderr).toBe(0)
      const plain = parsePinnedSuccessJson(implicit, (payload) =>
        CliValidateReportSchema.parse(payload)
      )
      expect(plain.summary).toEqual(full.summary)
    }, 60_000)

    it(`prints the human next-steps footer only for an invalid item on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-validate-next-steps`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)
      await createModifiedAgainstMissingSpecChange(version, project, env, 'info-change')
      await createFailingChange(version, project, env, 'failing-change')

      // Human text splits streams (verdict and issues may land on either), so the
      // prose contract is asserted over the combined output.
      const valid = await runPinnedOpenspec(
        version,
        ['validate', 'info-change', '--type', 'change'],
        project,
        env
      )
      expect(valid.exitCode, valid.stdout + '\n' + valid.stderr).toBe(0)
      const validText = valid.stdout + '\n' + valid.stderr
      // A valid item prints its INFO line but never the next-steps footer.
      expect(validText).toContain('is valid')
      expect(validText).toContain('[INFO] missing-spec/spec.md')
      expect(validText).not.toContain('Next steps')

      // An invalid item keeps the gated footer with its ERROR line.
      const invalid = await runPinnedOpenspec(
        version,
        ['validate', 'failing-change', '--type', 'change'],
        project,
        env
      )
      expect(invalid.exitCode).toBe(1)
      const invalidText = invalid.stdout + '\n' + invalid.stderr
      expect(invalidText).toContain('has issues')
      expect(invalidText).toContain('[ERROR] billing/spec.md')
      expect(invalidText).toContain('Next steps')
    }, 60_000)

    it(`flags a TBD Purpose as an overview WARNING that only strict validation fails on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-purpose-placeholder`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)
      await writePlaceholderSpec(project)

      const nonStrict = await runPinnedOpenspec(
        version,
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
        version,
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

    it(`returns the successful schemas array on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-schemas`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      const result = await runPinnedOpenspec(version, ['schemas', '--json'], project, env)
      expectPinnedJsonDiscipline(result)
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

      // The admitted line resolves schemas through the selected Root, so the ghost
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

      await initProject(version, project, env)

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
      expect(archivedDone.exitCode, archivedDone.stdout + '\n' + archivedDone.stderr).toBe(0)

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
      expect(archivedPending.exitCode, archivedPending.stdout + '\n' + archivedPending.stderr).toBe(
        0
      )

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
})
