/**
 * Orthogonal intents (created 2026-09-03 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.12.0 CLI against a recursive owned Spec identity.
 * 2. Prove list and show preserve every identity segment and requirement content on
 *    the v12 single-series window.
 * 3. Carry over the admitted-line nested Spec contract proven for 1.10/1.11.
 *
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 * Original request (2026-08-01): adapt OpenSpec 1.7 nested Spec ids such as `platform/auth`.
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
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v12-fixtures.js'
import { CliShowSpecSchema, CliSpecListSchema } from './cli-contracts/workflow.js'

describe('pinned OpenSpec 1.12 nested Spec fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V12_VERSIONS) {
    it(`lists and shows platform/auth as one complete Spec identity on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-nested-spec`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(join(project, 'openspec', 'specs', 'platform', 'auth'), { recursive: true })
      await writeFile(
        join(project, 'openspec', 'specs', 'platform', 'auth', 'spec.md'),
        [
          '## Purpose',
          'Define nested platform authentication behavior.',
          '',
          '## Requirements',
          '',
          '### Requirement: Nested authentication',
          'The platform SHALL preserve recursive Spec identity.',
          '',
          '#### Scenario: Show nested Spec',
          '- **WHEN** the nested Spec is listed and shown',
          '- **THEN** every identity segment is preserved',
          '',
        ].join('\n')
      )

      await expectPinnedVersion(version, project, env)

      // 1.12 init tolerates the pre-existing specs tree; the non-empty directory gains
      // no anchor and the nested identity stays exactly one Spec.
      const initialized = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

      const listResult = await runPinnedOpenspec(
        version,
        ['list', '--specs', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(listResult)
      const listed = parsePinnedSuccessJson(listResult, (payload) =>
        CliSpecListSchema.parse(payload)
      )
      expect(listed.specs).toEqual([{ id: 'platform/auth', requirementCount: 1 }])

      const showResult = await runPinnedOpenspec(
        version,
        ['show', 'platform/auth', '--type', 'spec', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(showResult)
      const shown = parsePinnedSuccessJson(showResult, (payload) =>
        CliShowSpecSchema.parse(payload)
      )
      expect(shown).toMatchObject({
        id: 'platform/auth',
        requirementCount: 1,
        requirements: [
          {
            text: 'The platform SHALL preserve recursive Spec identity.',
          },
        ],
      })
    }, 60_000)
  }
})
