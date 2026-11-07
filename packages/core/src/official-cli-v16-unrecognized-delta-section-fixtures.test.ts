/**
 * Orthogonal intents (created 2026-11-07 Asia/Shanghai):
 * 1. Prove the 1.16.1 verdict for a requirement authored under a header that reads as a delta
 *    operation but is not one: an ERROR that already fails plain validation, and an archive refusal
 *    through the typed `archive_validation_failed` status envelope our transport decodes.
 * 2. Prove the escalation is scoped: the same block under prose stays a WARNING and the change stays valid.
 * 3. Prove the retired 1.15.0 boundary keeps the pre-escalation verdict — the same orphan is reported as a
 *    WARNING and the change validates — so the ERROR is a 1.16-line fact and the boundary is not silent.
 *
 * Original request (2026-11-07): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
 *   — update-openspec-cli-1161 Slice 2 (upstream #2207 / #2195).
 * 2026-11-07 (update-openspec-cli-1161): in-window patch rotation of the pinned OpenSpec CLI to
 *   1.16.1; identity literals rotate, no projection change.
 */
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V16_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  expectPinnedVersion,
  parsePinnedJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV16Version,
} from './__tests__/official-cli-v16-fixtures.js'
import { CliArchiveSchema, CliValidateReportSchema } from './cli-contracts/workflow.js'

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

/**
 * A well-formed delta plus the near-miss block. The real `## ADDED Requirements` section matters:
 * without it the file has no delta at all, and validation fails for that unrelated reason — the
 * proof must be able to say the near-miss header is the only thing under test.
 */
function deltaWithSection(section: string): string {
  return [
    '## ADDED Requirements',
    '',
    '### Requirement: Real delta',
    'The system SHALL work.',
    '',
    '#### Scenario: works',
    '- **WHEN** something happens',
    '- **THEN** something is true',
    '',
    section,
    '',
    '### Requirement: Near-miss header',
    'The system SHALL behave.',
    '',
    '#### Scenario: behaves',
    '- **WHEN** something happens',
    '- **THEN** something is true',
    '',
  ].join('\n')
}

async function prepareChange(
  version: PinnedOpenspecV16Version,
  root: string,
  section: string
): Promise<{ project: string; env: NodeJS.ProcessEnv }> {
  const project = join(root, 'project')
  const env = pinnedFixtureEnv(root)
  await mkdir(project, { recursive: true })
  await expectPinnedVersion(version, project, env)
  const init = await runPinnedOpenspec(version, ['init', project, '--tools=none'], project, env)
  expect(init.exitCode, init.stdout + '\n' + init.stderr).toBe(0)
  const created = await runPinnedOpenspec(version, ['new', 'change', 'near-miss'], project, env)
  expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
  const changeDir = join(project, 'openspec', 'changes', 'near-miss')
  await writeFile(join(changeDir, 'proposal.md'), '# Proposal\n\nNear-miss section.\n')
  await writeFile(join(changeDir, 'tasks.md'), '## 1. Work\n\n- [x] 1.1 Done\n')
  await mkdir(join(changeDir, 'specs', 'cap-near-miss'), { recursive: true })
  await writeFile(join(changeDir, 'specs', 'cap-near-miss', 'spec.md'), deltaWithSection(section))
  return { project, env }
}

function nearMissIssues(
  report: ReturnType<typeof CliValidateReportSchema.parse>,
  changeId: string
): Array<{ level: string; path: string; line?: number; message: string }> {
  return report.items.find((entry) => entry.id === changeId)?.issues ?? []
}

describe('pinned OpenSpec 1.16 unrecognized delta-section fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V16_VERSIONS) {
    it(`fails plain validation with an error under "## Add Requirements" on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-near-miss-error`
      )
      const root = rootOrThrow(fixtureRoot)
      const { project, env } = await prepareChange(version, root, '## Add Requirements')

      const plain = await runPinnedOpenspec(
        version,
        ['validate', 'near-miss', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(plain)
      // An ERROR is a plain-mode failure: the 1.16.1 escalation is not a strict-only verdict.
      expect(plain.exitCode, plain.stdout + '\n' + plain.stderr).toBe(1)
      const report = parsePinnedJson(plain, (payload) => CliValidateReportSchema.parse(payload))
      expect(report.items.find((entry) => entry.id === 'near-miss')?.valid).toBe(false)
      const nearMiss = nearMissIssues(report, 'near-miss').find((issue) =>
        issue.message.includes('Add Requirements')
      )
      expect(nearMiss).toMatchObject({ level: 'ERROR' })
      expect(nearMiss?.message).toContain('Near-miss header')

      const strict = await runPinnedOpenspec(
        version,
        ['validate', 'near-miss', '--json', '--strict'],
        project,
        env
      )
      expect(strict.exitCode).toBe(1)
      const strictReport = parsePinnedJson(strict, (payload) =>
        CliValidateReportSchema.parse(payload)
      )
      expect(strictReport.items.find((entry) => entry.id === 'near-miss')?.valid).toBe(false)
    }, 60_000)

    it(`keeps a prose section at warning level on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-near-miss-warning`
      )
      const { project, env } = await prepareChange(version, rootOrThrow(fixtureRoot), '## Notes')

      const plain = await runPinnedOpenspec(
        version,
        ['validate', 'near-miss', '--json'],
        project,
        env
      )
      expect(plain.exitCode, plain.stdout + '\n' + plain.stderr).toBe(0)
      const report = parsePinnedJson(plain, (payload) => CliValidateReportSchema.parse(payload))
      const issues = nearMissIssues(report, 'near-miss')
      const orphan = issues.find((issue) => issue.message.includes('Notes'))
      expect(orphan).toMatchObject({ level: 'WARNING' })
      expect(report.items.find((entry) => entry.id === 'near-miss')?.valid).toBe(true)
    }, 60_000)

    it(`refuses to archive the near-miss section instead of dropping it on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-near-miss-archive`
      )
      const { project, env } = await prepareChange(
        version,
        rootOrThrow(fixtureRoot),
        '## Add Requirements'
      )

      // Production archive travels `archive <id> --json --yes`, so the refusal must be the typed
      // status envelope. Upstream keeps the requirement/section detail out of it by design: the
      // `fix` string points at `validate`, which is where the detail lives.
      const archived = await runPinnedOpenspec(
        version,
        ['archive', 'near-miss', '--json', '--yes'],
        project,
        env
      )
      expect(archived.exitCode).not.toBe(0)
      expectPinnedJsonDiscipline(archived)
      const failure = parsePinnedJson(archived, (payload) => CliArchiveSchema.parse(payload))
      expect(failure.archive).toBeNull()
      const status = failure.status ?? []
      const refusal = status.find((entry) => entry.code === 'archive_validation_failed')
      expect(refusal).toMatchObject({ severity: 'error' })
      expect(refusal?.fix ?? '').toContain('openspec validate near-miss')

      const stillActive = await runPinnedOpenspec(version, ['list', '--json'], project, env)
      expect(stillActive.stdout).toContain('near-miss')
    }, 60_000)
  }

  it('reports the same orphan as a warning on the retired 1.15.0 boundary', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-115-near-miss-absence')
    const version = PINNED_OPENSPEC_V16_VERSIONS[0]
    const { project, env } = await prepareChange(
      version,
      rootOrThrow(fixtureRoot),
      '## Add Requirements'
    )

    const boundary = await runBoundary(['validate', 'near-miss', '--json'], project, env)
    expect(boundary.exitCode, boundary.stdout + '\n' + boundary.stderr).toBe(0)
    const report = CliValidateReportSchema.parse(JSON.parse(boundary.stdout))
    const issues = nearMissIssues(report, 'near-miss')
    // Both halves matter: no ERROR (the escalation is new) AND the orphan is still reported (the
    // boundary detects the shape, it just does not fail on it). `[]` would prove neither.
    expect(issues.filter((issue) => issue.level === 'ERROR')).toEqual([])
    expect(issues.find((issue) => issue.message.includes('Add Requirements'))).toMatchObject({
      level: 'WARNING',
    })
    expect(report.items.find((entry) => entry.id === 'near-miss')?.valid).toBe(true)
  }, 60_000)
})

function rootOrThrow(root: string | null): string {
  if (!root) throw new Error('fixture root was not created')
  return root
}
