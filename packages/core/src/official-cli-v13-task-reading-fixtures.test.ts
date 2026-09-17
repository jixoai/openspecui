/**
 * Orthogonal intents (created 2026-09-17 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.13.1 widened task-line reading through `list --json`
 *    on a real repository: plus/ordered markers, an indented `~` wave, and a padded
 *    `[ x]` box all count, multi-token `[WIP]` labels and link bullets never count, and
 *    only an `x`/`X` marker reads as done.
 * 2. Prove the shared local parser (`parseMarkdownTasks`) counts the exact same file
 *    identically — executable parity evidence for the Slice 3 task-line reading law.
 *
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — task-count parity fixture evidence (update-openspec-cli-1131 Slice 4).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V13_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  expectPinnedVersion,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV13Version,
} from './__tests__/official-cli-v13-fixtures.js'
import { CliChangeListSchema } from './cli-contracts/workflow.js'
import { parseMarkdownTasks } from './task-progress.js'

/**
 * Widened-syntax tasks fixture. Counting derivation against the pinned upstream pattern
 * (references/openspec/src/utils/task-progress.ts, v1.13.1 634c557):
 *
 *   `+ [ ] plus marker`      -> task, NOT done (whitespace-only box under a `+` marker)
 *   `1. [ ] ordered marker`  -> task, NOT done (ordered `1.` marker)
 *   `1) [x] ordered done`    -> task, DONE (ordered `1)` marker)
 *   `  - [~] indented wave`  -> task, NOT done (leading indent allowed; `~` reads not-done)
 *   `- [ x] padded done`     -> task, DONE (padded box captures the marker `x`)
 *   `- [WIP] multi token`    -> never a task (marker holds more than one token)
 *   `- [doc](./d.md)`        -> never a task (closing `]` continues link syntax)
 *
 * Seven candidate lines => total 5, completed 2. The executed CLI below must report
 * exactly these counts, and the local parser must agree line for line.
 */
const WIDENED_TASKS_MARKDOWN = [
  '# Tasks',
  '',
  '+ [ ] plus marker',
  '1. [ ] ordered marker',
  '1) [x] ordered done',
  '  - [~] indented wave',
  '- [ x] padded done',
  '- [WIP] multi token label',
  '- [doc](./d.md) link bullet',
  '',
].join('\n')

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

describe('pinned OpenSpec 1.13 task-line reading fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V13_VERSIONS) {
    it(`counts widened task lines exactly like the local parser on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-task-reading`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)

      const changeDir = join(project, 'openspec', 'changes', 'widened-tasks')
      await mkdir(changeDir, { recursive: true })
      await writeFile(join(changeDir, '.openspec.yaml'), 'schema: spec-driven\n')
      await writeFile(
        join(changeDir, 'proposal.md'),
        '# Proposal\n\nExercise the widened task-line reading.\n'
      )
      await writeFile(join(changeDir, 'tasks.md'), WIDENED_TASKS_MARKDOWN)

      const result = await runPinnedOpenspec(version, ['list', '--json'], project, env)
      expectPinnedJsonDiscipline(result)
      const parsed = parsePinnedSuccessJson(result, (payload) => CliChangeListSchema.parse(payload))

      const entry = parsed.changes.find((change) => change.name === 'widened-tasks')
      if (entry === undefined) throw new Error('expected the widened-tasks change listed')
      // CLI authority: the upstream widened pattern counts 5 of the 7 candidate lines,
      // 2 done, with no warnings surface involved on this fixture.
      expect(entry.totalTasks).toBe(5)
      expect(entry.completedTasks).toBe(2)
      expect(entry.status).toBe('in-progress')
      expect(parsed.warnings).toBeUndefined()

      // Local parity: the shared parser reads the identical file byte for byte and must
      // derive the same denominator and numerator as the executed CLI.
      const localTasks = parseMarkdownTasks(WIDENED_TASKS_MARKDOWN)
      expect(localTasks.map((task) => task.text)).toEqual([
        'plus marker',
        'ordered marker',
        'ordered done',
        'indented wave',
        'padded done',
      ])
      expect(localTasks.map((task) => task.completed)).toEqual([false, false, true, false, true])
      expect(localTasks).toHaveLength(entry.totalTasks)
      expect(localTasks.filter((task) => task.completed).length).toBe(entry.completedTasks)
    }, 60_000)
  }
})
