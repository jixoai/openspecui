/**
 * Orthogonal intents (updated 2026-10-02 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.14.0 `show` family against a real fixture project:
 *    `show <change> --json --diff` (MODIFIED deltas carry the unified diff body) and
 *    `show <spec> --type spec --json` (1.14 requirement/scenario name members).
 * 2. Prove the diff stays CLI-owned evidence (`@@` hunks, `-`/`+` lines, no warning on
 *    a clean modification; the exact upstream near-miss header warning when names
 *    differ in case).
 * 3. Carry over the admitted-line requirement-diff contract proven for 1.11-1.13 onto
 *    the v14 single-series window.
 * 4. (2026-10-02, target-openspec-cli-114-line Slice 5) Prove the 1.14 show-Spec
 *    `name` members on the executed executable: every requirement and scenario carries
 *    its name (upstream normalizeRequirementName/scenarioNameFromHeaderText) beside
 *    the retained text/rawText bodies — the identity archive matches on, per
 *    `references/openspec-1.14.0-report.md` Protocol delta.
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V14_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  expectPinnedVersion,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV14Version,
} from './__tests__/official-cli-v14-fixtures.js'
import { CliShowChangeDiffSuccessSchema } from './cli-contracts/show-diff.js'
import { CliShowSpecDocumentSchema } from './cli-contracts/workflow.js'

const MAIN_SPEC = [
  '## Purpose',
  'Billing rules.',
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

async function initProject(
  version: PinnedOpenspecV14Version,
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

async function createChangeWithDelta(
  version: PinnedOpenspecV14Version,
  project: string,
  env: NodeJS.ProcessEnv,
  changeId: string,
  delta: string
): Promise<void> {
  const created = await runPinnedOpenspec(version, ['new', 'change', changeId], project, env)
  expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
  const changeDir = join(project, 'openspec', 'changes', changeId)
  await mkdir(join(changeDir, 'specs', 'billing'), { recursive: true })
  await writeFile(
    join(changeDir, 'proposal.md'),
    [
      '## Why',
      `${changeId} needs a contract update.`,
      '',
      '## What Changes',
      `- Update billing behavior for ${changeId}.`,
      '',
    ].join('\n')
  )
  await writeFile(join(changeDir, 'specs', 'billing', 'spec.md'), delta)
}

describe('pinned OpenSpec 1.14 show fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V14_VERSIONS) {
    it(`attaches a unified diff with hunks to a clean MODIFIED delta on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-show-diff`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(join(project, 'openspec', 'specs', 'billing'), { recursive: true })
      await writeFile(join(project, 'openspec', 'specs', 'billing', 'spec.md'), MAIN_SPEC)

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)

      await createChangeWithDelta(
        version,
        project,
        env,
        'modify-billing',
        [
          '## MODIFIED Requirements',
          '',
          '### Requirement: Billing rules',
          'The system SHALL apply billing rules with retry.',
          '',
          '#### Scenario: Existing behavior',
          '- **WHEN** billing runs',
          '- **THEN** billing succeeds with retry',
          '',
        ].join('\n')
      )

      const result = await runPinnedOpenspec(
        version,
        ['show', 'modify-billing', '--json', '--diff'],
        project,
        env
      )
      expectPinnedJsonDiscipline(result)
      const shown = parsePinnedSuccessJson(result, (payload) =>
        CliShowChangeDiffSuccessSchema.parse(payload)
      )

      expect(shown.id).toBe('modify-billing')
      expect(shown.deltaCount).toBe(1)
      // The payload carries the selected root; the diff is separately fetched CLI evidence.
      expect(shown.root.path).toContain('project')

      const delta = shown.deltas[0]
      expect(delta.spec).toBe('billing')
      expect(delta.operation).toBe('MODIFIED')
      // Unified-diff body: @@ hunk headers plus removed/added lines, no synthetic file
      // headers and no warning for an exactly matching requirement header.
      expect(delta.diff).toBeDefined()
      expect(delta.diff).toMatch(/^@@ -1,\d+ \+1,\d+ @@/)
      expect(delta.diff).toContain('-The system SHALL apply billing rules.')
      expect(delta.diff).toContain('+The system SHALL apply billing rules with retry.')
      expect(delta.diff).not.toContain('--- ')
      expect(delta.diff).not.toContain('+++ ')
      expect(delta.warning).toBeUndefined()
    }, 60_000)

    it(`carries the exact upstream near-miss header warning beside its diff on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-show-diff-warning`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(join(project, 'openspec', 'specs', 'billing'), { recursive: true })
      await writeFile(join(project, 'openspec', 'specs', 'billing', 'spec.md'), MAIN_SPEC)

      await initProject(version, project, env)

      // The header differs from the main spec's requirement only in case, so archive will
      // not merge it; the CLI still shows the diff the author meant plus the warning.
      await createChangeWithDelta(
        version,
        project,
        env,
        'near-miss',
        [
          '## MODIFIED Requirements',
          '',
          '### Requirement: Billing Rules',
          'The system SHALL apply billing rules with retry.',
          '',
        ].join('\n')
      )

      const result = await runPinnedOpenspec(
        version,
        ['show', 'near-miss', '--json', '--diff'],
        project,
        env
      )
      const shown = parsePinnedSuccessJson(result, (payload) =>
        CliShowChangeDiffSuccessSchema.parse(payload)
      )

      const delta = shown.deltas[0]
      expect(delta.operation).toBe('MODIFIED')
      // One of the exact upstream warning texts: near-miss header naming the main
      // spec's requirement and the archive merge consequence.
      expect(delta.warning).toBe(
        'Header differs from the main spec\'s "Billing rules" only in case or spacing; ' +
          'archive matches names exactly, so reconcile them before archiving'
      )
      expect(delta.diff).toBeDefined()
      expect(delta.diff).toMatch(/^@@ /)
    }, 60_000)

    it(`carries requirement and scenario names on show <spec> --type spec on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-show-spec`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })
      await mkdir(join(project, 'openspec', 'specs', 'billing'), { recursive: true })
      await writeFile(
        join(project, 'openspec', 'specs', 'billing', 'spec.md'),
        [
          '## Purpose',
          'Billing rules.',
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

      await expectPinnedVersion(version, project, env)
      const initialized = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

      const result = await runPinnedOpenspec(
        version,
        ['show', 'billing', '--type', 'spec', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(result)
      const shown = parsePinnedSuccessJson(result, (payload) =>
        CliShowSpecDocumentSchema.parse(payload)
      )

      expect(shown.id).toBe('billing')
      expect(shown.requirementCount).toBe(1)
      // 1.14 name members: the requirement and each scenario carry their header
      // name beside the retained text/rawText bodies. The requirement name is
      // the identity archive matches on — verbatim CLI value, never re-derived.
      expect(shown.requirements).toEqual([
        {
          name: 'Billing rules',
          text: 'The system SHALL apply billing rules.',
          scenarios: [
            {
              name: 'Existing behavior',
              rawText: '- **WHEN** billing runs\n- **THEN** billing succeeds',
            },
          ],
        },
      ])
    }, 60_000)
  }
})
