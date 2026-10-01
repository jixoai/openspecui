/**
 * Orthogonal intents (created 2026-10-02 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.14.0 `openspec version --json` command (new in
 *    1.14) against the isolated fixture environment: the typed envelope decodes with
 *    `schemaVersion: 1`, the running `version`, and the resolved `install` facts.
 * 2. Prove the no-probe default: without `--check` the `update` member stays absent
 *    (never null, never a synthesized offline status) — the registry probe is opt-in
 *    and this suite never performs network access, per
 *    `references/openspec-1.14.0-report.md` section 1.
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
 */
import { mkdir } from 'node:fs/promises'
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
} from './__tests__/official-cli-v14-fixtures.js'
import { CliVersionSchema } from './cli-contracts/workflow.js'

describe('pinned OpenSpec 1.14 version report fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V14_VERSIONS) {
    it(`reports the install envelope without the check-gated update member on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-version-report`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)

      const result = await runPinnedOpenspec(version, ['version', '--json'], project, env)
      expectPinnedJsonDiscipline(result)
      const report = parsePinnedSuccessJson(result, (payload) => CliVersionSchema.parse(payload))

      // The envelope names its schema version and the running executable line.
      expect(report.schemaVersion).toBe(1)
      expect(report.version).toBe(version)
      // The resolved install location is a real absolute path of the running
      // executable's package; packageManager/scope stay nullable install facts
      // (an unresolvable install reports all-null upstream, never a guess).
      expect(report.install.location).toBeTruthy()
      expect(report.install.location).toMatch(/@fission-ai[/\\]openspec/)
      // The registry probe is opt-in: without `--check` the update member is
      // absent (conditionally spread upstream), never null or synthesized.
      expect(report.update).toBeUndefined()
      expect('update' in report).toBe(false)
    }, 60_000)
  }
})
