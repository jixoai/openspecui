/**
 * Orthogonal intents (created 2026-09-03 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.12.0 `validate --report findings --json` contract
 *    against real fixture projects: the populated findings document, empty-scope
 *    documents, and the typed request-error envelope.
 * 2. Prove the merge-conflict INFO class stays verdict-neutral (`valid: true`, exit 0)
 *    and that the findings document never decodes as the full validation report.
 * 3. Prove the findings transport preserves the full-run exit rule: a failing fixture
 *    exits 1 while stdout stays one complete JSON document and `summary` keeps the
 *    full-run totals.
 *
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
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
import { CliDiagnosticFailureSchema } from './cli-contracts/common.js'
import {
  CliValidateFindingsResultSchema,
  CliValidateFindingsSchema,
  CliValidateReportSchema,
  isCliValidateFindings,
} from './cli-contracts/workflow.js'

/** One shared upstream `fix` string answers every invalid findings request. */
const REPORT_REQUEST_FIX =
  'Use --report full|findings with --all, --changes, --specs, or --archived, ' +
  'without an item name. Do not combine archived and active scopes.'

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

describe('pinned OpenSpec 1.12 validation findings fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V12_VERSIONS) {
    it(`returns a populated findings document whose merge-conflict INFO stays verdict-neutral on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-findings-populated`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)
      await createModifiedAgainstMissingSpecChange(version, project, env, 'test-change')

      const result = await runPinnedOpenspec(
        version,
        ['validate', '--all', '--report', 'findings', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(result)
      // The merge conflict is advisory: the item stays valid and the run exits 0.
      const findings = parsePinnedSuccessJson(result, (payload) =>
        CliValidateFindingsResultSchema.parse(payload)
      )
      expect(isCliValidateFindings(findings)).toBe(true)
      if (!isCliValidateFindings(findings)) return

      expect(findings.report).toEqual({
        kind: 'validation-findings',
        version: '1.0',
        scope: 'all',
        returnedItems: 1,
        totalItems: 1,
      })
      expect(findings.itemFindings).toHaveLength(1)
      const item = findings.itemFindings[0]
      expect(item.id).toBe('test-change')
      expect(item.type).toBe('change')
      expect(item.valid).toBe(true)
      expect(item.issues).toEqual([
        {
          level: 'INFO',
          path: 'missing-spec/spec.md',
          message: expect.stringContaining('Archive would refuse this delta'),
        },
      ])
      // summary/root are the full-run values the CLI computed over every item.
      expect(findings.summary.totals).toEqual({ items: 1, passed: 1, failed: 0 })
      expect(findings.root).toMatchObject({ source: 'nearest' })

      // The findings document is not the full report: no `items` collection decodes.
      const payload = JSON.parse(result.stdout)
      expect(CliValidateReportSchema.safeParse(payload).success).toBe(false)
    }, 60_000)

    it(`returns the empty-scope findings document for specs and archived scopes on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-findings-empty`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)

      // A zero-spec project yields the normal success document, not a failure sum type.
      const specs = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['validate', '--specs', '--report', 'findings', '--json'],
          project,
          env
        ),
        (payload) => CliValidateFindingsSchema.parse(payload)
      )
      expect(specs.report).toEqual({
        kind: 'validation-findings',
        version: '1.0',
        scope: 'specs',
        returnedItems: 0,
        totalItems: 0,
      })
      expect(specs.itemFindings).toEqual([])
      expect(specs.summary.totals).toEqual({ items: 0, passed: 0, failed: 0 })

      // Archived is a separate scope answering the same envelope.
      const archived = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['validate', '--archived', '--report', 'findings', '--json'],
          project,
          env
        ),
        (payload) => CliValidateFindingsSchema.parse(payload)
      )
      expect(archived.report).toMatchObject({ kind: 'validation-findings', scope: 'archived' })
      expect(archived.report.returnedItems).toBe(0)
      expect(archived.report.totalItems).toBe(0)
      expect(archived.itemFindings).toEqual([])
    }, 60_000)

    it(`rejects every invalid findings request through the typed status envelope on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-findings-request-error`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)
      await createModifiedAgainstMissingSpecChange(version, project, env, 'test-change')

      const invalidRequests: readonly [readonly string[], string][] = [
        // No explicit bulk scope.
        [['validate', '--report', 'findings', '--json'], 'requires an explicit bulk scope'],
        // An item name cannot ride a report.
        [
          ['validate', 'test-change', '--report', 'findings', '--json'],
          'cannot be combined with an item name',
        ],
        // Unknown report value.
        [['validate', '--all', '--report', 'bogus', '--json'], "Unknown validation report 'bogus'"],
        // Archived and active scopes cannot mix.
        [
          ['validate', '--all', '--archived', '--report', 'findings', '--json'],
          'cannot combine archived and active scopes',
        ],
      ]

      for (const [args, messagePart] of invalidRequests) {
        const result = await runPinnedOpenspec(version, args, project, env)
        expect(result.exitCode, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`).toBe(1)
        // The request error keeps the JSON stream discipline: one stdout document.
        expectPinnedJsonDiscipline(result)
        const failure = parsePinnedJson(result, (payload) =>
          CliDiagnosticFailureSchema.parse(payload)
        )
        expect(failure.status[0]).toMatchObject({
          severity: 'error',
          code: 'invalid_validation_report_request',
          message: expect.stringContaining(messagePart),
          fix: REPORT_REQUEST_FIX,
        })
        // The envelope is never mistaken for a findings document.
        const payload = JSON.parse(result.stdout)
        expect(isCliValidateFindings(payload)).toBe(false)
        expect(CliValidateFindingsSchema.safeParse(payload).success).toBe(false)
      }
    }, 60_000)

    it(`keeps the full-run exit rule while findings decoding stays exit-code-blind on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-findings-failing`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)
      await createModifiedAgainstMissingSpecChange(version, project, env, 'info-change')
      await createFailingChange(version, project, env, 'failing-change')

      const result = await runPinnedOpenspec(
        version,
        ['validate', '--changes', '--report', 'findings', '--json'],
        project,
        env
      )
      // Findings never re-labels verdicts: failed > 0 keeps the full-run exit rule.
      expect(result.exitCode).toBe(1)
      // Decoding consults stdout only, never the exit code.
      const findings = parsePinnedJson(result, (payload) =>
        CliValidateFindingsSchema.parse(payload)
      )
      expect(findings.report).toMatchObject({ scope: 'changes', returnedItems: 2, totalItems: 2 })
      // Both items carry issues, so both return; totals reflect the real failure.
      expect(findings.summary.totals).toEqual({ items: 2, passed: 1, failed: 1 })
      const failing = findings.itemFindings.find((item) => item.id === 'failing-change')
      expect(failing?.valid).toBe(false)
      expect(failing?.issues[0]).toMatchObject({ level: 'ERROR', path: 'billing/spec.md' })
      const advisory = findings.itemFindings.find((item) => item.id === 'info-change')
      expect(advisory?.valid).toBe(true)
      expect(advisory?.issues[0]?.level).toBe('INFO')
    }, 60_000)
  }
})
