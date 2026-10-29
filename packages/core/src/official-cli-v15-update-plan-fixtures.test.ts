/**
 * Orthogonal intents (updated 2026-10-29 Asia/Shanghai):
 * 1. Prove the pinned 1.15.0 executable emits a real non-empty `update --dry-run --json`
 *    plan over a real Agent workspace: a corrupted managed skill plans `update` and a
 *    deleted command plans `add`, both under the configured tool id.
 * 2. Prove the plan is evidence, not a write: the corrupted disk bytes survive the
 *    dry run unchanged, `changes` stays sorted by `path.localeCompare`, and the
 *    `notes`/`failures` keys stay present arrays beside non-empty `changes`.
 * 3. Keep the positive matrix honest about the flagship 1.15 contract: synthetic
 *    payloads and the boundary contrast prove shapes, but only the real binary proves
 *    the actual emission a preview renders.
 *
 * Original request (2026-10-29): "检查一下上游openspec是否发布新版本，如果我们按照规范跟进更新"
 *   — flagship-contract positive proof for the v15 line (adversarial-review P2-2).
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v15-fixtures.js'
import { CliUpdatePlanSchema } from './cli-contracts/workflow.js'

describe('pinned OpenSpec 1.15 update dry-run plan fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  it('plans real add/update changes for a managed Agent workspace without writing', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-115-update-plan')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // A real init with one configured tool generates the managed skill and command
    // files the update command later reconciles.
    const initialized = await runPinnedOpenspec(
      '1.15.0',
      ['init', project, '--tools', 'claude'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    const managedSkill = join(project, '.claude', 'skills', 'openspec-propose', 'SKILL.md')
    const managedCommand = join(project, '.claude', 'commands', 'opsx', 'propose.md')
    const corruptedBefore = await readFile(managedSkill, 'utf8')
    await writeFile(managedSkill, corruptedBefore + '\nmanually corrupted\n', 'utf8')
    await rm(managedCommand)

    const planned = await runPinnedOpenspec(
      '1.15.0',
      ['update', '--dry-run', '--json'],
      project,
      env
    )
    expect(planned.exitCode, planned.stdout + '\n' + planned.stderr).toBe(0)
    expectPinnedJsonDiscipline(planned)
    const plan = CliUpdatePlanSchema.parse(JSON.parse(planned.stdout))

    // The corrupted managed skill plans an `update` and the deleted command plans an
    // `add`, both under the configured tool id; no rename action exists.
    const updateRow = plan.changes.find(
      (change) => change.action === 'update' && change.tool === 'claude'
    )
    expect(updateRow?.path).toBe('.claude/skills/openspec-propose/SKILL.md')
    const addRow = plan.changes.find(
      (change) => change.action === 'add' && change.tool === 'claude'
    )
    expect(addRow?.path).toBe('.claude/commands/opsx/propose.md')
    expect(plan.changes).toEqual(
      [...plan.changes].sort((left, right) => left.path.localeCompare(right.path))
    )
    expect(Array.isArray(plan.notes)).toBe(true)
    expect(Array.isArray(plan.failures)).toBe(true)
    expect(plan.failures).toEqual([])

    // The dry run is evidence, not a write: the corrupted bytes survive unchanged.
    expect(await readFile(managedSkill, 'utf8')).toBe(corruptedBefore + '\nmanually corrupted\n')

    // A settled real update makes the next plan empty again — plan and execution share
    // one upstream code path, so the preview converges with the mutation it describes.
    const settled = await runPinnedOpenspec('1.15.0', ['update'], project, env)
    expect(settled.exitCode, settled.stdout + '\n' + settled.stderr).toBe(0)
    const after = await runPinnedOpenspec('1.15.0', ['update', '--dry-run', '--json'], project, env)
    expect(after.exitCode, after.stdout + '\n' + after.stderr).toBe(0)
    const emptyPlan = CliUpdatePlanSchema.parse(JSON.parse(after.stdout))
    expect(emptyPlan.changes).toEqual([])
    expect(emptyPlan.notes).toEqual([])
    expect(emptyPlan.failures).toEqual([])
  }, 120_000)
})
