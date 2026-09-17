/**
 * Orthogonal intents (created 2026-09-17 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.13.1 change-list nested-directory contract on a real
 *    repository: a namespace-folder entry carries `nested` with 0/0 task fields, a
 *    coexisting flat change carries none, and the top-level `warnings` array reports
 *    code `nested_change_directory` with the upstream message preserved verbatim.
 * 2. Execute the validate side of the same fixture: the namespace folder yields the
 *    dedicated ERROR finding (single item and bulk `--all`) instead of the generic
 *    delta-authoring error, while the flat change keeps its ordinary error and the
 *    buried change stays invisible to bulk enumeration.
 *
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — executable nested/warnings change-list and validate-finding evidence (update-openspec-cli-1131 Slice 4).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V13_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  expectPinnedVersion,
  parsePinnedJson,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV13Version,
} from './__tests__/official-cli-v13-fixtures.js'
import { CliChangeListSchema, CliValidateReportSchema } from './cli-contracts/workflow.js'

async function initProject(
  version: PinnedOpenspecV13Version,
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

/**
 * Fixture topology (verified against the v1.13.1 pin, 634c557):
 *
 * - `changes/area/` is a namespace folder: its root must hold ONLY directories. A root
 *   marker (`.openspec.yaml`, `proposal.md`, `tasks.md`, `design.md`) or any own
 *   non-dot file would make upstream `findNestedChangesIn` classify it as a change, so
 *   this fixture deliberately places nothing there (Round-A N3 constraint).
 * - `changes/area/alpha/` is a real change buried one level down, recognized through
 *   the `.openspec.yaml` root marker.
 * - `changes/plain-change/` is an ordinary flat change with one done and one open task.
 */
async function writeNestedFixtureProject(project: string): Promise<void> {
  const changesDir = join(project, 'openspec', 'changes')

  await mkdir(join(changesDir, 'area', 'alpha'), { recursive: true })
  await writeFile(join(changesDir, 'area', 'alpha', '.openspec.yaml'), 'schema: spec-driven\n')
  await writeFile(
    join(changesDir, 'area', 'alpha', 'proposal.md'),
    '# Proposal\n\nA change buried inside a namespace folder.\n'
  )

  const plainDir = join(changesDir, 'plain-change')
  await mkdir(plainDir, { recursive: true })
  await writeFile(join(plainDir, '.openspec.yaml'), 'schema: spec-driven\n')
  await writeFile(join(plainDir, 'proposal.md'), '# Proposal\n\nFlat, actionable change.\n')
  await writeFile(
    join(plainDir, 'tasks.md'),
    ['# Tasks', '', '- [x] first done', '- [ ] second open', ''].join('\n')
  )
}

describe('pinned OpenSpec 1.13 nested change directory fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V13_VERSIONS) {
    it(`projects namespace entries and hygiene warnings from list --json on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-nested-list`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)
      await writeNestedFixtureProject(project)

      const result = await runPinnedOpenspec(version, ['list', '--json'], project, env)
      expectPinnedJsonDiscipline(result)
      const parsed = parsePinnedSuccessJson(result, (payload) => CliChangeListSchema.parse(payload))

      // The namespace folder stays listed (hiding it would hide a real change when the
      // probe is wrong) but is listed as what it is: an entry carrying `nested`.
      const area = parsed.changes.find((entry) => entry.name === 'area')
      if (area === undefined) throw new Error('expected the namespace directory to stay listed')
      expect(area.nested).toEqual(['area/alpha'])
      // Task fields are computed through the ordinary code path; with no tasks.md at the
      // namespace root the shape is 0/0 'no-tasks' (typical, not guaranteed — Round-A N3).
      expect(area.totalTasks).toBe(0)
      expect(area.completedTasks).toBe(0)
      expect(area.status).toBe('no-tasks')

      // A normal change coexists without the nested member — absent, never null.
      const plain = parsed.changes.find((entry) => entry.name === 'plain-change')
      if (plain === undefined) throw new Error('expected the flat change to stay listed')
      expect('nested' in plain).toBe(false)
      expect(plain.nested).toBeUndefined()
      expect(plain.totalTasks).toBe(2)
      expect(plain.completedTasks).toBe(1)
      expect(plain.status).toBe('in-progress')
      // The buried change itself is not enumerated as a top-level entry.
      expect(parsed.changes.some((entry) => entry.name === 'area/alpha')).toBe(false)

      // One top-level hygiene warning; absent-when-empty is covered by the contract
      // tests, so here the array is present with exactly the namespace finding.
      expect(parsed.warnings).toHaveLength(1)
      const warning = parsed.warnings?.[0]
      if (warning === undefined) throw new Error('missing nested_change_directory warning')
      expect(warning.code).toBe('nested_change_directory')
      expect(warning.name).toBe('area')
      expect(warning.nested).toEqual(['area/alpha'])
      // Display evidence only (Round-B N2): the message stays verbatim upstream text and
      // no projection may parse it.
      expect(warning.message).toContain('is not a change')
      expect(warning.message).toContain('openspec/changes/area/alpha/')
    }, 60_000)

    it(`reports the namespace folder as an ERROR validate finding on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-nested-validate`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)
      await writeNestedFixtureProject(project)

      // Single item: the namespace folder gets the dedicated nested-change ERROR finding
      // (upstream nestedChangeReport) rather than the no-delta error that would point at
      // a directory that is not the change. The process exits 1 with the report on stdout.
      const single = await runPinnedOpenspec(version, ['validate', 'area', '--json'], project, env)
      expect(single.exitCode, single.stdout + '\n' + single.stderr).toBe(1)
      expectPinnedJsonDiscipline(single)
      const singleReport = parsePinnedJson(single, (payload) =>
        CliValidateReportSchema.parse(payload)
      )
      expect(singleReport.summary.totals).toEqual({ items: 1, passed: 0, failed: 1 })
      const singleItem = singleReport.items[0]
      if (singleItem === undefined) throw new Error('missing single-item report entry')
      expect(singleItem).toMatchObject({ id: 'area', type: 'change', valid: false })
      expect(singleItem.issues).toHaveLength(1)
      expect(singleItem.issues[0]).toMatchObject({ level: 'ERROR', path: 'file' })
      expect(singleItem.issues[0]?.message).toContain('is not a change')

      // Bulk: the same finding composes with other items; the flat change keeps its
      // ordinary delta-authoring error and the buried change stays out of the scope.
      const bulk = await runPinnedOpenspec(version, ['validate', '--all', '--json'], project, env)
      expect(bulk.exitCode, bulk.stdout + '\n' + bulk.stderr).toBe(1)
      expectPinnedJsonDiscipline(bulk)
      const bulkReport = parsePinnedJson(bulk, (payload) => CliValidateReportSchema.parse(payload))

      const areaInBulk = bulkReport.items.find((item) => item.id === 'area')
      if (areaInBulk === undefined) throw new Error('missing namespace item in bulk report')
      expect(areaInBulk.valid).toBe(false)
      expect(areaInBulk.issues[0]).toMatchObject({ level: 'ERROR', path: 'file' })
      expect(areaInBulk.issues[0]?.message).toContain('is not a change')

      const plainInBulk = bulkReport.items.find((item) => item.id === 'plain-change')
      if (plainInBulk === undefined) throw new Error('missing flat change in bulk report')
      expect(plainInBulk.valid).toBe(false)
      expect(plainInBulk.issues[0]?.message ?? '').not.toContain('is not a change')

      expect(bulkReport.items.some((item) => item.id === 'area/alpha')).toBe(false)
      expect(bulkReport.summary.totals.items).toBe(2)
    }, 60_000)
  }
})
