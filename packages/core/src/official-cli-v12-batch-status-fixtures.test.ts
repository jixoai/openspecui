/**
 * Orthogonal intents (created 2026-09-03 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.12.0 `status --all --json` batch envelope against a
 *    real fixture project: healthy-entry field parity, in-place failure entries, and
 *    the empty-set message shape.
 * 2. Prove partial failure keeps stdout one complete valid JSON document while the
 *    process exits 1 (decoding must never consult the exit code).
 * 3. Carry over the admitted-line batch status contract proven for 1.11 onto the v12
 *    single-series window; the 1.11 boundary executable stays in the boundary suite.
 *
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
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
  parsePinnedJson,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV12Version,
} from './__tests__/official-cli-v12-fixtures.js'
import {
  CliBatchStatusSchema,
  isCliBatchStatusEntryFailure,
  isCliBatchStatusRootSelectionFailure,
} from './cli-contracts/batch-status.js'
import { CliWorkflowStatusSuccessSchema } from './cli-contracts/workflow.js'

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

describe('pinned OpenSpec 1.12 batch status fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V12_VERSIONS) {
    it(`returns healthy entries with single-change Status fields and one envelope root on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-batch-healthy`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)

      const created = await runPinnedOpenspec(
        version,
        ['new', 'change', 'batch-healthy'],
        project,
        env
      )
      expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)

      const batchResult = await runPinnedOpenspec(
        version,
        ['status', '--all', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(batchResult)
      const batch = parsePinnedSuccessJson(batchResult, (payload) =>
        CliBatchStatusSchema.parse(payload)
      )

      const singleResult = await runPinnedOpenspec(
        version,
        ['status', '--change', 'batch-healthy', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(singleResult)
      const single = parsePinnedSuccessJson(singleResult, (payload) =>
        CliWorkflowStatusSuccessSchema.parse(payload)
      )

      expect(batch.changes).toHaveLength(1)
      const entry = batch.changes[0]
      expect(isCliBatchStatusEntryFailure(entry)).toBe(false)
      if (isCliBatchStatusEntryFailure(entry)) return
      expect(entry.changeName).toBe('batch-healthy')
      // A healthy entry is exactly the single-change Status payload minus its own root;
      // the envelope owns the single root fact for the whole batch.
      const { root: singleRoot, ...singleFields } = single
      expect(entry).toEqual(singleFields)
      expect(batch.root).toEqual(singleRoot)
      expect(isCliBatchStatusRootSelectionFailure(batch)).toBe(false)
      expect(batch.message).toBeUndefined()
    }, 60_000)

    it(`keeps a failed change as an in-place entry while stdout stays one valid document on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-batch-failure`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)

      for (const changeName of ['broken-one', 'healthy-one']) {
        const created = await runPinnedOpenspec(
          version,
          ['new', 'change', changeName],
          project,
          env
        )
        expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
      }
      // An unloadable change (unknown schema) produces the failure sum type; an empty or
      // incomplete change directory would still load as a healthy entry and is not this case.
      await writeFile(
        join(project, 'openspec', 'changes', 'broken-one', '.openspec.yaml'),
        'schema: no-such-schema\n'
      )

      const result = await runPinnedOpenspec(version, ['status', '--all', '--json'], project, env)
      // Partial failure exits 1 while stdout remains one complete JSON document.
      expect(result.exitCode).toBe(1)
      const batch = parsePinnedJson(result, (payload) => CliBatchStatusSchema.parse(payload))

      const broken = batch.changes.find((entry) => entry.changeName === 'broken-one')
      expect(broken).toBeDefined()
      expect(broken && isCliBatchStatusEntryFailure(broken)).toBe(true)
      if (broken && isCliBatchStatusEntryFailure(broken)) {
        expect(broken.status[0]).toMatchObject({
          severity: 'error',
          code: 'change_error',
        })
        expect(broken.status[0].message).toContain("Unknown schema 'no-such-schema'")
      }
      // The healthy change stays a complete healthy entry in the same envelope.
      const healthy = batch.changes.find((entry) => entry.changeName === 'healthy-one')
      expect(healthy).toBeDefined()
      expect(healthy && isCliBatchStatusEntryFailure(healthy)).toBe(false)
      expect(batch.root).not.toBeNull()
    }, 60_000)

    it(`reports the empty active set through the message key with exit 0 on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-batch-empty`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)

      const result = await runPinnedOpenspec(version, ['status', '--all', '--json'], project, env)
      expectPinnedJsonDiscipline(result)
      const batch = parsePinnedSuccessJson(result, (payload) => CliBatchStatusSchema.parse(payload))
      expect(batch.changes).toEqual([])
      expect(batch.message).toBe('No active changes.')
      expect(batch.root).not.toBeNull()
      expect(isCliBatchStatusRootSelectionFailure(batch)).toBe(false)
    }, 60_000)
  }
})
