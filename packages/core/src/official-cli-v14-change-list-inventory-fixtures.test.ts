/**
 * Orthogonal intents (created 2026-10-02 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.14.0 change-list archive inventory (`list --archived`
 *    and `list --all`, new in 1.14) against a real fixture project holding one active
 *    and one archived change.
 * 2. Prove the per-entry `archived` flag discipline: `--archived` returns only archive
 *    inventory with `archived: true`; `--all` mixes both with explicit `false` beside
 *    the active entries; the default `list --json` never emits the member, so absence
 *    carries no information and is never synthesized.
 * 3. Prove the archived entry keeps the ordinary per-entry shape (task counts, status)
 *    over the date-prefixed archive name, per `references/openspec-1.14.0-report.md`
 *    section 3 — CLI evidence only; the Archive list projection owner stays the
 *    reactive-filesystem adapter this line.
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
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
} from './__tests__/official-cli-v14-fixtures.js'
import { CliChangeListSchema } from './cli-contracts/workflow.js'

describe('pinned OpenSpec 1.14 change list inventory fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V14_VERSIONS) {
    it(`marks archived inventory and keeps the default list flag-free on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-list-inventory`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      const initialized = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

      // One change with one done and one open task so the archived row keeps a
      // meaningful in-progress status; archive without validate so the open task
      // does not block the move.
      const created = await runPinnedOpenspec(
        version,
        ['new', 'change', 'shipped-work'],
        project,
        env
      )
      expect(created.exitCode, created.stdout + created.stderr).toBe(0)
      const changeDir = join(project, 'openspec', 'changes', 'shipped-work')
      await writeFile(join(changeDir, 'proposal.md'), '# Proposal\n\nShipped work.\n')
      await writeFile(
        join(changeDir, 'tasks.md'),
        ['# Tasks', '', '- [x] Finish the work', '- [ ] Follow-up later', ''].join('\n')
      )
      const archived = await runPinnedOpenspec(
        version,
        ['archive', 'shipped-work', '--json', '--yes', '--no-validate'],
        project,
        env
      )
      expect(archived.exitCode, archived.stdout + archived.stderr).toBe(0)

      // A second change stays active beside the archive.
      const activeDir = join(project, 'openspec', 'changes', 'active-work')
      await mkdir(activeDir, { recursive: true })
      await writeFile(join(activeDir, '.openspec.yaml'), 'schema: spec-driven\n')
      await writeFile(join(activeDir, 'proposal.md'), '# Proposal\n\nActive work.\n')

      // The archive inventory names the archived entry only, flag true, with the
      // date-prefixed archive name and the ordinary task/status shape intact.
      const archivedList = parsePinnedSuccessJson(
        await runPinnedOpenspec(version, ['list', '--archived', '--json'], project, env),
        (payload) => CliChangeListSchema.parse(payload)
      )
      expect(archivedList.changes).toHaveLength(1)
      const archivedEntry = archivedList.changes[0]
      expect(archivedEntry?.archived).toBe(true)
      expect(archivedEntry?.name.endsWith('shipped-work')).toBe(true)
      expect(archivedEntry?.completedTasks).toBe(1)
      expect(archivedEntry?.totalTasks).toBe(2)
      expect(archivedEntry?.status).toBe('in-progress')

      // --all mixes both sides of the inventory with an explicit flag per entry.
      const allList = parsePinnedSuccessJson(
        await runPinnedOpenspec(version, ['list', '--all', '--json'], project, env),
        (payload) => CliChangeListSchema.parse(payload)
      )
      expect(allList.changes).toHaveLength(2)
      const activeInAll = allList.changes.find((entry) => entry.name === 'active-work')
      expect(activeInAll?.archived).toBe(false)
      const archivedInAll = allList.changes.find((entry) => entry.archived === true)
      expect(archivedInAll?.name).toBe(archivedEntry?.name)
      expect(archivedInAll?.completedTasks).toBe(1)
      expect(archivedInAll?.totalTasks).toBe(2)

      // The default list keeps its pre-1.14 shape: active entries only and the
      // archived member absent (never null, never false).
      const defaultListResult = await runPinnedOpenspec(version, ['list', '--json'], project, env)
      expectPinnedJsonDiscipline(defaultListResult)
      const defaultList = parsePinnedSuccessJson(defaultListResult, (payload) =>
        CliChangeListSchema.parse(payload)
      )
      expect(defaultList.changes.map((entry) => entry.name)).toEqual(['active-work'])
      for (const entry of defaultList.changes) {
        expect('archived' in entry).toBe(false)
        expect(entry.archived).toBeUndefined()
      }
    }, 60_000)
  }
})
