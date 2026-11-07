/**
 * Orthogonal intents (created 2026-11-07 Asia/Shanghai):
 * 1. Prove the 1.16-line parser acceptance our projections surface as authored truth: an ATX closing
 *    run is not part of a section or requirement title.
 * 2. Prove HTML comments are masked, so a commented-out draft is not reported as an orphaned block —
 *    and prove the twin check, so silence cannot pass for the wrong reason.
 *
 * Original request (2026-11-07): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
 *   — update-openspec-cli-1161 Slice 2 (upstream #2205).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V16_VERSIONS,
  createPinnedFixtureRoot,
  parsePinnedJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV16Version,
} from './__tests__/official-cli-v16-fixtures.js'
import { CliValidateReportSchema } from './cli-contracts/workflow.js'

const SPEC_WITH_CLOSING_RUNS = [
  '## Purpose',
  'Exercise closing heading runs.',
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

async function initProject(
  version: PinnedOpenspecV16Version,
  project: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const init = await runPinnedOpenspec(version, ['init', project, '--tools=none'], project, env)
  expect(init.exitCode, init.stdout + '\n' + init.stderr).toBe(0)
}

describe('pinned OpenSpec 1.16 parser acceptance fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V16_VERSIONS) {
    it(`normalizes a closing heading run instead of keeping it in the name on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-closing-run`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })
      await initProject(version, project, env)
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
      const report = parsePinnedJson(validated, (payload) => CliValidateReportSchema.parse(payload))
      expect(report.items.find((entry) => entry.id === 'cap-closing')?.valid).toBe(true)

      const shown = await runPinnedOpenspec(
        version,
        ['show', 'cap-closing', '--type', 'spec', '--json'],
        project,
        env
      )
      const payload = JSON.parse(shown.stdout) as {
        requirements?: Array<{ name?: string }>
        deltas?: unknown
      }
      const names = (payload.requirements ?? []).map((entry) => entry.name)
      expect(names).toContain('Foo')
      expect(names?.some((name) => name?.includes('#'))).toBe(false)
    }, 60_000)

    it(`reports the uncommented twin but not the HTML-commented draft on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-comment-mask`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })
      await initProject(version, project, env)

      const created = await runPinnedOpenspec(version, ['new', 'change', 'masked'], project, env)
      expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
      const changeDir = join(project, 'openspec', 'changes', 'masked')
      await writeFile(join(changeDir, 'proposal.md'), '# Proposal\n\nComment masking.\n')
      await writeFile(join(changeDir, 'tasks.md'), '## 1. Work\n\n- [x] 1.1 Done\n')
      await mkdir(join(changeDir, 'specs', 'cap-masked'), { recursive: true })
      await writeFile(join(changeDir, 'specs', 'cap-masked', 'spec.md'), DELTA_WITH_COMMENTED_DRAFT)

      const validated = await runPinnedOpenspec(
        version,
        ['validate', 'masked', '--json'],
        project,
        env
      )
      const report = parsePinnedJson(validated, (payload) => CliValidateReportSchema.parse(payload))
      const issues = report.items.find((entry) => entry.id === 'masked')?.issues ?? []

      expect(issues.some((issue) => issue.message.includes('Commented draft'))).toBe(false)
      const twin = issues.find((issue) => issue.message.includes('Uncommented twin'))
      expect(twin).toMatchObject({ level: 'WARNING' })
    }, 60_000)
  }
})
