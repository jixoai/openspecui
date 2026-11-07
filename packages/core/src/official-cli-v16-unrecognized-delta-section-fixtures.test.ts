/**
 * Orthogonal intents (created 2026-11-07 Asia/Shanghai):
 * 1. Prove the 1.16-line verdict for a requirement authored under a header that reads as a delta
 *    operation but is not one: ERROR in validate, refusal in archive.
 * 2. Prove the escalation is scoped: the same block under prose stays a WARNING of the same shape.
 * 3. Prove the retired 1.15.0 boundary does not own this verdict — absence, not just presence.
 *
 * Original request (2026-11-07): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
 *   — update-openspec-cli-1161 Slice 2 (upstream #2207 / #2195).
 */
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V16_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedVersion,
  parsePinnedJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV16Version,
} from './__tests__/official-cli-v16-fixtures.js'
import { CliValidateReportSchema } from './cli-contracts/workflow.js'

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
        { cwd, env, encoding: 'utf8' },
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
): Promise<{ project: string; env: NodeJS.ProcessEnv; change: string }> {
  const project = join(root, 'project')
  const env = pinnedFixtureEnv(root)
  await mkdir(project, { recursive: true })
  const init = await runPinnedOpenspec(version, ['init', project, '--tools=none'], project, env)
  expect(init.exitCode, init.stdout + '\n' + init.stderr).toBe(0)
  const created = await runPinnedOpenspec(version, ['new', 'change', 'near-miss'], project, env)
  expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
  const changeDir = join(project, 'openspec', 'changes', 'near-miss')
  await writeFile(join(changeDir, 'proposal.md'), '# Proposal\n\nNear-miss section.\n')
  await writeFile(join(changeDir, 'tasks.md'), '## 1. Work\n\n- [x] 1.1 Done\n')
  await mkdir(join(changeDir, 'specs', 'cap-near-miss'), { recursive: true })
  await writeFile(join(changeDir, 'specs', 'cap-near-miss', 'spec.md'), deltaWithSection(section))
  return { project, env, change: 'near-miss' }
}

describe('pinned OpenSpec 1.16 unrecognized delta-section fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V16_VERSIONS) {
    it(`reports an error for a requirement under "## Add Requirements" on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-near-miss-error`
      )
      const projectDir = join(fixtureRoot, 'project')
      await mkdir(projectDir, { recursive: true })
      await expectPinnedVersion(version, projectDir, pinnedFixtureEnv(fixtureRoot))
      const { project, env } = await prepareChange(version, fixtureRoot, '## Add Requirements')

      const plain = await runPinnedOpenspec(
        version,
        ['validate', 'near-miss', '--json'],
        project,
        env
      )
      const report = parsePinnedJson(plain, (payload) => CliValidateReportSchema.parse(payload))
      const issues = report.items.find((entry) => entry.id === 'near-miss')?.issues ?? []
      const nearMiss = issues.find((issue) => issue.message.includes('Add Requirements'))
      expect(nearMiss).toMatchObject({ level: 'ERROR' })

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
      const { project, env } = await prepareChange(version, fixtureRoot, '## Notes')

      const plain = await runPinnedOpenspec(
        version,
        ['validate', 'near-miss', '--json'],
        project,
        env
      )
      const report = parsePinnedJson(plain, (payload) => CliValidateReportSchema.parse(payload))
      const issues = report.items.find((entry) => entry.id === 'near-miss')?.issues ?? []
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

      const archived = await runPinnedOpenspec(
        version,
        ['archive', 'near-miss', '--yes'],
        project,
        env
      )
      expect(archived.exitCode).not.toBe(0)
      const output = `${archived.stdout}\n${archived.stderr}`
      expect(output).toContain('Add Requirements')
      expect(output).toContain('Near-miss header')

      const stillActive = await runPinnedOpenspec(version, ['list', '--json'], project, env)
      expect(stillActive.stdout).toContain('near-miss')
    }, 60_000)
  }

  it('does not own this verdict on the retired 1.15.0 boundary', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-115-near-miss-absence')
    const root = rootOrThrow(fixtureRoot)
    const version = PINNED_OPENSPEC_V16_VERSIONS[0]
    const { project, env } = await prepareChange(version, root, '## Add Requirements')

    const boundary = await runBoundary(['validate', 'near-miss', '--json'], project, env)
    expect(boundary.exitCode, boundary.stdout + '\n' + boundary.stderr).toBe(0)
    const report = CliValidateReportSchema.parse(JSON.parse(boundary.stdout))
    const issues = report.items.find((entry) => entry.id === 'near-miss')?.issues ?? []
    expect(issues.filter((issue) => issue.level === 'ERROR')).toEqual([])
  }, 60_000)
})

function rootOrThrow(root: string | null): string {
  if (!root) throw new Error('fixture root was not created')
  return root
}
