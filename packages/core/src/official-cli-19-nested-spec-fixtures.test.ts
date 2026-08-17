/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.8.0 and 1.9.0 CLIs against a recursive owned Spec identity.
 * 2. Prove list and show preserve every identity segment and requirement content on both lines.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-01): adapt OpenSpec 1.7 nested Spec ids such as `platform/auth`.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V9_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedVersion,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v9-fixtures.js'
import { CliShowSpecSchema, CliSpecListSchema } from './cli-contracts/workflow.js'

describe('pinned OpenSpec 1.8/1.9 nested Spec fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V9_VERSIONS) {
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

      const listed = parsePinnedSuccessJson(
        await runPinnedOpenspec(version, ['list', '--specs', '--json'], project, env),
        (payload) => CliSpecListSchema.parse(payload)
      )
      expect(listed.specs).toContainEqual({ id: 'platform/auth', requirementCount: 1 })

      const shown = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['show', 'platform/auth', '--type', 'spec', '--json'],
          project,
          env
        ),
        (payload) => CliShowSpecSchema.parse(payload)
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
    })
  }
})
