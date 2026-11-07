/**
 * Orthogonal intents (created 2026-11-07 Asia/Shanghai):
 * 1. Prove 1.16.1 reads an ATX closing `#` run on section headings — `## Requirements ##` in a main
 *    spec and `## ADDED Requirements ##` in a delta — so the section is recognized and the delta
 *    actually applies to the main spec on archive.
 * 2. Prove the retired 1.15.0 boundary does not: the same documents lose their Requirements section
 *    and their delta, which is what makes this acceptance a 1.16-line fact.
 * 3. Prove the orphan scan masks HTML comments, so a commented-out draft is not reported as dropped —
 *    and prove the twin on the boundary, so silence cannot pass for the wrong reason.
 *
 * Original request (2026-11-07): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
 *   — update-openspec-cli-1161 Slice 2 (upstream #2205).
 * 2026-11-07 (update-openspec-cli-1161): in-window patch rotation of the pinned OpenSpec CLI to
 *   1.16.1; identity literals rotate, no projection change.
 */
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V16_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  expectPinnedVersion,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV16Version,
} from './__tests__/official-cli-v16-fixtures.js'
import {
  CliArchiveSchema,
  CliShowSpecSchema,
  CliValidateReportSchema,
} from './cli-contracts/workflow.js'

/** The retired below-admitted boundary executable kept through the openspec-cli-115 alias. */
const RETIRED_V15_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-115/bin/openspec.js'
)

async function runBoundary(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (done, fail) => {
      const child = execFile(
        process.execPath,
        [RETIRED_V15_BIN, ...args],
        { cwd, env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, windowsHide: true },
        (error: { code?: number } | null, stdout: string, stderr: string) => {
          done({ code: error ? (error.code ?? 1) : 0, stdout, stderr })
        }
      )
      child.on('error', fail)
    }
  )
  return { exitCode: result.code ?? 1, stdout: result.stdout, stderr: result.stderr }
}

const SPEC_WITH_CLOSING_RUNS = [
  '## Purpose',
  'Exercise closing heading runs with a sentence long enough to satisfy the brevity check.',
  '',
  '## Requirements ##',
  '',
  '### Requirement: Foo ###',
  'The system SHALL behave.',
  '',
  '#### Scenario: behaves',
  '- **WHEN** something happens',
  '- **THEN** something is true',
  '',
].join('\n')

const DELTA_WITH_CLOSING_RUN_HEADER = [
  '## ADDED Requirements ##',
  '',
  '### Requirement: Closing run delta',
  'The system SHALL work.',
  '',
  '#### Scenario: works',
  '- **WHEN** something happens',
  '- **THEN** something is true',
  '',
].join('\n')

const DELTA_WITH_COMMENTED_DRAFT = [
  '<!--',
  '### Requirement: Commented draft',
  'The system SHALL NOT be projected.',
  '',
  '#### Scenario: never runs',
  '- **WHEN** nothing happens',
  '- **THEN** nothing is true',
  '-->',
  '',
  '## ADDED Requirements',
  '',
  '### Requirement: Real delta',
  'The system SHALL work.',
  '',
  '#### Scenario: works',
  '- **WHEN** something happens',
  '- **THEN** something is true',
  '',
  '## Notes',
  '',
  '### Requirement: Uncommented twin',
  'The system SHALL be reported.',
  '',
  '#### Scenario: reported',
  '- **WHEN** something happens',
  '- **THEN** something is true',
  '',
].join('\n')

async function prepareProject(
  version: PinnedOpenspecV16Version,
  fixtureRoot: string
): Promise<{ project: string; env: NodeJS.ProcessEnv }> {
  const project = join(fixtureRoot, 'project')
  const env = pinnedFixtureEnv(fixtureRoot)
  await mkdir(project, { recursive: true })
  await expectPinnedVersion(version, project, env)
  const init = await runPinnedOpenspec(version, ['init', project, '--tools=none'], project, env)
  expect(init.exitCode, init.stdout + '\n' + init.stderr).toBe(0)
  return { project, env }
}

async function prepareDeltaChange(
  version: PinnedOpenspecV16Version,
  project: string,
  env: NodeJS.ProcessEnv,
  changeId: string,
  delta: string
): Promise<void> {
  const created = await runPinnedOpenspec(version, ['new', 'change', changeId], project, env)
  expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
  const changeDir = join(project, 'openspec', 'changes', changeId)
  await writeFile(
    join(changeDir, 'proposal.md'),
    '## Why\n\nProve the closing-run section header.\n\n## What Changes\n\n- Add the capability.\n'
  )
  await writeFile(join(changeDir, 'tasks.md'), '## 1. Work\n\n- [x] 1.1 Done\n')
  await mkdir(join(changeDir, 'specs', 'cap-closing'), { recursive: true })
  await writeFile(join(changeDir, 'specs', 'cap-closing', 'spec.md'), delta)
}

describe('pinned OpenSpec 1.16 parser acceptance fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V16_VERSIONS) {
    it(`reads ## Requirements ## as the requirements section on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-closing-run`)
      const { project, env } = await prepareProject(version, rootOrThrow(fixtureRoot))
      await mkdir(join(project, 'openspec', 'specs', 'cap-closing'), { recursive: true })
      await writeFile(
        join(project, 'openspec', 'specs', 'cap-closing', 'spec.md'),
        SPEC_WITH_CLOSING_RUNS
      )

      const validated = await runPinnedOpenspec(
        version,
        ['validate', '--specs', '--json'],
        project,
        env
      )
      const report = parsePinnedSuccessJson(validated, (payload) =>
        CliValidateReportSchema.parse(payload)
      )
      expect(report.items.find((entry) => entry.id === 'cap-closing')?.valid).toBe(true)

      const shown = await runPinnedOpenspec(
        version,
        ['show', 'cap-closing', '--type', 'spec', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(shown)
      const document = parsePinnedSuccessJson(shown, (payload) => CliShowSpecSchema.parse(payload))
      if (!('requirements' in document)) {
        expect.fail(`show answered the diagnostic envelope: ${shown.stdout}`)
      }
      const names = document.requirements.map((entry) => entry.name)
      expect(names).toContain('Foo')
      expect(names.some((name) => name.includes('#'))).toBe(false)

      // Negative control: without the section-header acceptance, the same document has no
      // requirements section at all on the retired line.
      const boundary = await runBoundary(
        ['show', 'cap-closing', '--type', 'spec', '--json'],
        project,
        env
      )
      expect(boundary.exitCode).not.toBe(0)
      const boundaryAnswer = CliShowSpecSchema.parse(JSON.parse(boundary.stdout))
      if (!('status' in boundaryAnswer)) {
        expect.fail(`expected the 1.15 boundary to reject the section header: ${boundary.stdout}`)
      }
      expect(boundaryAnswer.status).toMatchObject([
        { severity: 'error', code: 'show_error', message: 'Spec must have a Requirements section' },
      ])
    }, 60_000)

    it(`applies a ## ADDED Requirements ## delta on archive on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-closing-delta`)
      const { project, env } = await prepareProject(version, rootOrThrow(fixtureRoot))
      await prepareDeltaChange(version, project, env, 'closing', DELTA_WITH_CLOSING_RUN_HEADER)

      // Negative control first: the retirement line does not read this header, so the change has
      // no delta at all. That is the falsifier for "the header is what makes this apply".
      const boundary = await runBoundary(['validate', 'closing', '--json'], project, env)
      expect(boundary.exitCode, boundary.stdout + '\n' + boundary.stderr).not.toBe(0)
      const boundaryReport = CliValidateReportSchema.parse(JSON.parse(boundary.stdout))
      const boundaryIssues =
        boundaryReport.items.find((entry) => entry.id === 'closing')?.issues ?? []
      expect(boundaryIssues.map((issue) => issue.message)).toContain(
        'No delta sections found. Add headers such as "## ADDED Requirements" or move non-delta notes outside specs/.'
      )

      const validated = await runPinnedOpenspec(
        version,
        ['validate', 'closing', '--json'],
        project,
        env
      )
      const report = parsePinnedSuccessJson(validated, (payload) =>
        CliValidateReportSchema.parse(payload)
      )
      expect(report.items.find((entry) => entry.id === 'closing')).toMatchObject({
        valid: true,
        issues: [],
      })

      const archived = await runPinnedOpenspec(
        version,
        ['archive', 'closing', '--json', '--yes'],
        project,
        env
      )
      const result = parsePinnedSuccessJson(archived, (payload) => CliArchiveSchema.parse(payload))
      expect(result.archive).toMatchObject({ change: 'closing', specsUpdated: true })
      expect(result.archive?.totals).toMatchObject({
        added: 1,
        modified: 0,
        removed: 0,
        renamed: 0,
      })

      // The delta landed on disk: the archived main spec carries the requirement that sat under
      // the closing-run delta header.
      const mainSpec = await readFile(
        join(project, 'openspec', 'specs', 'cap-closing', 'spec.md'),
        'utf8'
      )
      expect(mainSpec).toContain('### Requirement: Closing run delta')
    }, 60_000)

    it(`masks an HTML-commented draft instead of reporting it as an orphan on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-comment-mask`)
      const { project, env } = await prepareProject(version, rootOrThrow(fixtureRoot))
      await prepareDeltaChange(version, project, env, 'masked', DELTA_WITH_COMMENTED_DRAFT)

      const validated = await runPinnedOpenspec(
        version,
        ['validate', 'masked', '--json'],
        project,
        env
      )
      const report = parsePinnedSuccessJson(validated, (payload) =>
        CliValidateReportSchema.parse(payload)
      )
      const issues = report.items.find((entry) => entry.id === 'masked')?.issues ?? []
      expect(issues.some((issue) => issue.message.includes('Commented draft'))).toBe(false)
      // The twin keeps the assertion honest: masking silence must not be the same as "report
      // nothing at all", so an uncommented requirement outside every delta section is still found.
      const twin = issues.find((issue) => issue.message.includes('Uncommented twin'))
      expect(twin).toMatchObject({ level: 'WARNING' })

      // And the retired line reports the commented draft, so the masking is a 1.16-line fact.
      const boundary = await runBoundary(['validate', 'masked', '--json'], project, env)
      const boundaryReport = CliValidateReportSchema.parse(JSON.parse(boundary.stdout))
      const boundaryIssues =
        boundaryReport.items.find((entry) => entry.id === 'masked')?.issues ?? []
      expect(
        boundaryIssues.find((issue) => issue.message.includes('Commented draft'))
      ).toMatchObject({ level: 'WARNING' })
    }, 60_000)
  }
})

function rootOrThrow(root: string | null): string {
  if (!root) throw new Error('fixture root was not created')
  return root
}
