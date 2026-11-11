/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Prove the OpenSpec 1.17.0 scenario step-coverage class as an executable fact: a counted
 *    scenario with a body but no WHEN/GIVEN or no THEN step is a WARNING inside the existing
 *    finding shape, plain validation stays green, and `--strict` fails.
 * 2. Prove the same class fires in main-spec scope, and that a `#### Notes` child (prose on
 *    purpose) stays silent.
 *
 * Original request (2026-11-04): "后每隔 3 天检查一下有没有需要更新的，然后更近更新。按照标准工作流推进上线。"
 *   — update-openspec-cli-16-line Slice 4.
 * 2026-11-07 (update-openspec-cli-1161): in-window patch rotation of the pinned OpenSpec CLI to
 *   1.16.1; identity literals rotate, no projection change.
 * 2026-11-11 (update-openspec-cli-17): window rotation of the pinned OpenSpec CLI to 1.17.0; identity literals rotate, no projection change.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V17_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedVersion,
  parsePinnedJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV17Version,
} from './__tests__/official-cli-v17-fixtures.js'
import { CliValidateReportSchema } from './cli-contracts/workflow.js'

const INCOMPLETE_DELTA = [
  '## ADDED Requirements',
  '',
  '### Requirement: Step coverage',
  'The system SHALL behave.',
  '',
  '#### Scenario: asserts nothing',
  '- a plain note with no trigger and no outcome',
  '',
  '#### Scenario: trigger only',
  '- **WHEN** something happens',
  '',
  '#### Scenario: outcome only',
  '- **THEN** something is true',
  '',
  '#### Scenario: complete',
  '- **WHEN** something happens',
  '- **THEN** something is true',
  '',
  '#### Notes',
  'Prose on purpose: no steps, and no finding.',
  '',
].join('\n')

const INCOMPLETE_MAIN_SPEC = [
  '## Purpose',
  'Exercise main-spec step coverage.',
  '',
  '## Requirements',
  '',
  '### Requirement: Main spec rule',
  'The system SHALL behave.',
  '',
  '#### Scenario: trigger only',
  '- **WHEN** something happens',
  '',
].join('\n')

async function initProject(
  version: PinnedOpenspecV17Version,
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

describe('pinned OpenSpec 1.17 scenario step-coverage fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V17_VERSIONS) {
    it(`warns about missing steps in change scope and only --strict fails on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-step-coverage-change`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)

      const created = await runPinnedOpenspec(version, ['new', 'change', 'steps'], project, env)
      expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
      const changeDir = join(project, 'openspec', 'changes', 'steps')
      await writeFile(join(changeDir, 'proposal.md'), '# Proposal\n\nStep coverage.\n')
      await mkdir(join(changeDir, 'specs', 'cap-steps'), { recursive: true })
      await writeFile(join(changeDir, 'specs', 'cap-steps', 'spec.md'), INCOMPLETE_DELTA)

      const plain = await runPinnedOpenspec(version, ['validate', 'steps', '--json'], project, env)
      expect(plain.exitCode, plain.stdout + '\n' + plain.stderr).toBe(0)
      const report = parsePinnedJson(plain, (payload) => CliValidateReportSchema.parse(payload))
      const item = report.items.find((entry) => entry.id === 'steps')
      expect(item?.valid).toBe(true)

      const stepIssues = (item?.issues ?? []).filter((issue) =>
        issue.message.includes('is missing')
      )
      // Exactly the three incomplete scenarios — the complete one and `#### Notes` stay silent.
      expect(stepIssues).toHaveLength(3)
      expect(stepIssues.every((issue) => issue.level === 'WARNING')).toBe(true)
      expect(stepIssues.some((issue) => issue.message.includes('asserts nothing'))).toBe(true)
      expect(stepIssues.some((issue) => issue.message.includes('trigger only'))).toBe(true)
      expect(stepIssues.some((issue) => issue.message.includes('outcome only'))).toBe(true)
      expect(stepIssues.some((issue) => issue.message.includes('complete'))).toBe(false)
      expect(stepIssues.some((issue) => issue.message.includes('Notes'))).toBe(false)

      const strict = await runPinnedOpenspec(
        version,
        ['validate', 'steps', '--json', '--strict'],
        project,
        env
      )
      expect(strict.exitCode).toBe(1)
      const strictReport = parsePinnedJson(strict, (payload) =>
        CliValidateReportSchema.parse(payload)
      )
      expect(strictReport.items.find((entry) => entry.id === 'steps')?.valid).toBe(false)
      expect(strictReport.summary.totals).toMatchObject({ items: 1, passed: 0, failed: 1 })
    }, 60_000)

    it(`warns about missing steps in main-spec scope on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-step-coverage-spec`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)
      await mkdir(join(project, 'openspec', 'specs', 'cap-main'), { recursive: true })
      await writeFile(
        join(project, 'openspec', 'specs', 'cap-main', 'spec.md'),
        INCOMPLETE_MAIN_SPEC
      )

      const plain = await runPinnedOpenspec(
        version,
        ['validate', '--specs', '--json'],
        project,
        env
      )
      const report = parsePinnedJson(plain, (payload) => CliValidateReportSchema.parse(payload))
      const issue = report.items[0]?.issues.find((entry) => entry.message.includes('is missing'))
      expect(issue).toMatchObject({ level: 'WARNING' })
      expect(issue?.message).toContain('THEN step')

      const strict = await runPinnedOpenspec(
        version,
        ['validate', '--specs', '--json', '--strict'],
        project,
        env
      )
      expect(strict.exitCode).toBe(1)
    }, 60_000)
  }
})
