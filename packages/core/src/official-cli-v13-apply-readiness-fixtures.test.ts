/**
 * Orthogonal intents (updated 2026-09-26 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.13 Apply readiness contract (`instructions apply
 *    --json`) against a real fixture repo: the blocked-state build-order closure and
 *    the ready-state no-delta-specs advisory.
 * 2. Prove `missingPrerequisites` is additive readiness evidence, never a new gate:
 *    the blocked change names the whole prerequisite chain
 *    (`proposal,specs,design,tasks`) beside `missingArtifacts:["tasks"]`, while the
 *    proposal+tasks change stays `ready` with `missingPrerequisites:["specs","design"]`.
 * 3. Prove the ready-state `warnings` advisory names the objective downstream fact
 *    (`openspec validate` fails on the change) plus both remedies (write the delta
 *    specs / declare `skip_specs: true`), matching the Verified CLI observations in
 *    `references/openspec-1.13.1-report.md`.
 * 4. Prove upstream conditional spreading: `warnings` is absent (not `[]`) while
 *    blocked, and `missingArtifacts` is absent while ready.
 * 5. (2026-09-26, update-openspec-cli-1132 Slice 4) Prove the 1.13.2 tracking-evidence
 *    members on the executed executable: every standard-schema payload emits
 *    `taskTrackingConfigured: true` with `unavailableTrackingFiles` absent.
 * 6. (2026-09-26) Prove glob-tracked aggregation through a project-local custom schema
 *    (`*`-class `apply.tracks` over two files): `tasks`/`progress` aggregate across every
 *    matched file; zero matches keep `taskTrackingConfigured: true` with empty `tasks`
 *    (configured-but-unmatched is not no-tracking) and the tracking-file-missing branch.
 * 7. (2026-09-26) Prove matched-but-unreadable tracking files (POSIX chmod 000, non-root
 *    only) surface as `unavailableTrackingFiles` absolute-path + reason evidence, the
 *    readable file still contributes tasks, `state` stays `ready` while readable tasks
 *    remain (with the not-verified instruction suffix) and blocks with
 *    "No readable task descriptions are available." when none remain — evidence only,
 *    never a synthesized gate, per `references/openspec-1.13.2-report.md` P1.
 *
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-09-26): "Openspec 1.13.2 释放了…" — in-window patch rotation 1.13.1 -> 1.13.2,
 * tracking-evidence executable matrix (update-openspec-cli-1132 Slice 4).
 */
import { chmod, mkdir, writeFile } from 'node:fs/promises'
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
import { CliApplyInstructionsSuccessSchema } from './cli-contracts/workflow.js'

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

async function newChange(
  version: PinnedOpenspecV13Version,
  project: string,
  env: NodeJS.ProcessEnv,
  changeId: string
): Promise<void> {
  const created = await runPinnedOpenspec(version, ['new', 'change', changeId], project, env)
  expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
}

/**
 * Project-local custom schemas for glob-tracked apply evidence
 * (`<project>/openspec/schemas/<name>/schema.yaml`, the first resolution hop).
 *
 * The fixture scope is deliberately `*`-class only: the local
 * `opsxPathMatchesPattern` tracked-task matcher stays wildcard-level, and
 * brace/extglob task tracking is a documented boundary (Slice 2 scope note),
 * so the executable matrix proves agreement on the shared wildcard class.
 */
async function writeGlobTrackedSchemas(project: string): Promise<void> {
  await mkdir(join(project, 'openspec', 'schemas', 'glob-tracked'), { recursive: true })
  await writeFile(
    join(project, 'openspec', 'schemas', 'glob-tracked', 'schema.yaml'),
    [
      'name: glob-tracked',
      'version: 1',
      'description: Minimal schema whose apply tracking is a wildcard glob over task files',
      'artifacts:',
      '  - id: proposal',
      '    generates: proposal.md',
      '    description: Proposal document',
      '    template: proposal.md',
      '  - id: tasks',
      '    generates: docs/tasks-*.md',
      '    description: Task files',
      '    template: tasks.md',
      'apply:',
      '  requires: [proposal, tasks]',
      '  tracks: docs/tasks-*.md',
      '',
    ].join('\n')
  )
  // `zero-match` gates apply on proposal only, so a change with no matched task
  // file reaches the tracking-file-missing branch instead of missingArtifacts.
  await mkdir(join(project, 'openspec', 'schemas', 'zero-match'), { recursive: true })
  await writeFile(
    join(project, 'openspec', 'schemas', 'zero-match', 'schema.yaml'),
    [
      'name: zero-match',
      'version: 1',
      'description: Minimal schema whose apply tracking glob matches nothing on this change',
      'artifacts:',
      '  - id: proposal',
      '    generates: proposal.md',
      '    description: Proposal document',
      '    template: proposal.md',
      '  - id: tasks',
      '    generates: docs/tasks-*.md',
      '    description: Task files',
      '    template: tasks.md',
      'apply:',
      '  requires: [proposal]',
      '  tracks: docs/tasks-*.md',
      '',
    ].join('\n')
  )
}

/**
 * The unreadable-tracking fixture needs POSIX permission bits that actually deny
 * read (`chmod 000`): Windows ACLs never map to EACCES here and a root uid
 * bypasses the bits entirely, so both environments would assert a branch the
 * fixture cannot produce.
 */
const RUNS_UNREADABLE_TRACKING_FIXTURE =
  (process.platform === 'darwin' || process.platform === 'linux') &&
  typeof process.getuid === 'function' &&
  process.getuid() !== 0

describe('pinned OpenSpec 1.13 apply readiness fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V13_VERSIONS) {
    it(`names the whole prerequisite chain on the blocked state and stays warning-free on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-apply-blocked`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)
      // A scaffolded change carries only its `.openspec.yaml` marker: apply is blocked.
      await newChange(version, project, env, 'blocked-apply')

      const result = await runPinnedOpenspec(
        version,
        ['instructions', 'apply', '--change', 'blocked-apply', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(result)
      const apply = parsePinnedSuccessJson(result, (payload) =>
        CliApplyInstructionsSuccessSchema.parse(payload)
      )

      expect(apply.state).toBe('blocked')
      // Apply still blocks on its own first hop only.
      expect(apply.missingArtifacts).toEqual(['tasks'])
      // The 1.13 build-order closure names every not-completed prerequisite.
      expect(apply.missingPrerequisites).toEqual(['proposal', 'specs', 'design', 'tasks'])
      // Warnings fire only outside the blocked state, and conditional spreading keeps
      // the key absent (never `[]`) here.
      expect(apply.warnings).toBeUndefined()
      // 1.13.2 tracking evidence: spec-driven tracks tasks.md, so tracking is
      // configured even before the file exists, and nothing was unreadable.
      expect(apply.taskTrackingConfigured).toBe(true)
      expect(apply.unavailableTrackingFiles).toBeUndefined()
    }, 60_000)

    it(`pairs the ready state with the no-delta-specs advisory and conditional prerequisites on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-apply-ready`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)
      await newChange(version, project, env, 'no-specs-but-tasks')
      const changeDir = join(project, 'openspec', 'changes', 'no-specs-but-tasks')
      await writeFile(
        join(changeDir, 'proposal.md'),
        '# Proposal\n\nExercise the ready-state no-delta-specs advisory.\n'
      )
      await writeFile(
        join(changeDir, 'tasks.md'),
        ['# Tasks', '', '- [x] Finish the analysis', '- [ ] Implement it', ''].join('\n')
      )

      const result = await runPinnedOpenspec(
        version,
        ['instructions', 'apply', '--change', 'no-specs-but-tasks', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(result)
      const apply = parsePinnedSuccessJson(result, (payload) =>
        CliApplyInstructionsSuccessSchema.parse(payload)
      )

      expect(apply.state).toBe('ready')
      expect(apply.progress).toEqual({ total: 2, complete: 1, remaining: 1 })
      // Unblocked: upstream conditionally spreads, so missingArtifacts is absent.
      expect(apply.missingArtifacts).toBeUndefined()
      // Conditional artifacts (specs/design) apply does not gate on stay named as
      // readable next-step evidence on the ready state.
      expect(apply.missingPrerequisites).toEqual(['specs', 'design'])

      // One warning names the objective downstream fact plus both remedies.
      expect(apply.warnings).toHaveLength(1)
      const warning = apply.warnings?.[0] ?? ''
      expect(warning).toContain('no delta specs')
      expect(warning).toContain('does not declare `skip_specs: true`')
      expect(warning).toContain('`openspec validate no-specs-but-tasks` fails')
      expect(warning).toContain('`openspec instructions specs --change no-specs-but-tasks`')
      expect(warning).toContain('add `skip_specs: true`')

      // 1.13.2 tracking evidence: tasks.md is tracked and was readable, so the
      // unavailable member stays absent (never `[]`).
      expect(apply.taskTrackingConfigured).toBe(true)
      expect(apply.unavailableTrackingFiles).toBeUndefined()
    }, 60_000)

    it(`aggregates tasks across every file matched by a wildcard apply.tracks on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-apply-glob`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)
      await writeGlobTrackedSchemas(project)

      const changeDir = join(project, 'openspec', 'changes', 'glob-two-files')
      await mkdir(join(changeDir, 'docs'), { recursive: true })
      await writeFile(join(changeDir, '.openspec.yaml'), 'schema: glob-tracked\n')
      await writeFile(
        join(changeDir, 'proposal.md'),
        '# Proposal\n\nExercise glob-tracked aggregation.\n'
      )
      await writeFile(
        join(changeDir, 'docs', 'tasks-alpha.md'),
        '# Tasks Alpha\n\n- [x] alpha done one\n- [ ] alpha open two\n'
      )
      await writeFile(
        join(changeDir, 'docs', 'tasks-beta.md'),
        '# Tasks Beta\n\n- [x] beta done one\n- [ ] beta open two\n- [ ] beta open three\n'
      )

      const result = await runPinnedOpenspec(
        version,
        ['instructions', 'apply', '--change', 'glob-two-files', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(result)
      const apply = parsePinnedSuccessJson(result, (payload) =>
        CliApplyInstructionsSuccessSchema.parse(payload)
      )

      // The 1.13.2 aggregation resolves `apply.tracks` with glob semantics: the
      // two matched files contribute one shared task list (2 + 3 tasks) and one
      // progress total, exactly what the local tracked-task projection must
      // agree with on the wildcard class.
      expect(apply.taskTrackingConfigured).toBe(true)
      expect(apply.tasks.map((task) => task.description)).toEqual([
        'alpha done one',
        'alpha open two',
        'beta done one',
        'beta open two',
        'beta open three',
      ])
      expect(apply.progress).toEqual({ total: 5, complete: 2, remaining: 3 })
      expect(apply.state).toBe('ready')
      // Every matched file was readable: absent, never an empty array.
      expect(apply.unavailableTrackingFiles).toBeUndefined()
      // The custom schema declares no spec artifact and both required artifacts
      // exist, so no gate or advisory fires beside the tracking evidence.
      expect(apply.missingArtifacts).toBeUndefined()
      expect(apply.missingPrerequisites).toBeUndefined()
      expect(apply.warnings).toBeUndefined()
    }, 60_000)

    it(`keeps tracking configured with empty tasks when the apply.tracks glob matches zero files on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-apply-glob-zero`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)
      await writeGlobTrackedSchemas(project)

      const changeDir = join(project, 'openspec', 'changes', 'glob-zero-match')
      await mkdir(changeDir, { recursive: true })
      await writeFile(join(changeDir, '.openspec.yaml'), 'schema: zero-match\n')
      await writeFile(
        join(changeDir, 'proposal.md'),
        '# Proposal\n\nExercise zero-match tracking.\n'
      )

      const result = await runPinnedOpenspec(
        version,
        ['instructions', 'apply', '--change', 'glob-zero-match', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(result)
      const apply = parsePinnedSuccessJson(result, (payload) =>
        CliApplyInstructionsSuccessSchema.parse(payload)
      )

      // Tracking is configured (the schema sets a non-null `apply.tracks`) even
      // though the glob matched nothing: configured-but-unmatched is a distinct
      // fact from no-tracking, which is why the member is never a synthesized
      // `false` from empty results.
      expect(apply.taskTrackingConfigured).toBe(true)
      expect(apply.tasks).toEqual([])
      expect(apply.progress).toEqual({ total: 0, complete: 0, remaining: 0 })
      // Nothing matched, so nothing was unreadable: the member stays absent.
      expect(apply.unavailableTrackingFiles).toBeUndefined()
      // Apply gates on proposal only; the unmatched tracking file itself is the
      // named blocker, addressed by the tracks basename.
      expect(apply.missingArtifacts).toBeUndefined()
      expect(apply.state).toBe('blocked')
      expect(apply.instruction).toContain('tasks-*.md file is missing and must be created')
    }, 60_000)

    it.skipIf(!RUNS_UNREADABLE_TRACKING_FIXTURE)(
      `reports matched-but-unreadable tracking files as non-gating evidence on OpenSpec ${version}`,
      async () => {
        fixtureRoot = await createPinnedFixtureRoot(
          `cli-${version.replace(/\./g, '')}-apply-unreadable`
        )
        const project = join(fixtureRoot, 'project')
        const env = pinnedFixtureEnv(fixtureRoot)
        await mkdir(project, { recursive: true })

        await expectPinnedVersion(version, project, env)
        await initProject(version, project, env)
        await writeGlobTrackedSchemas(project)

        const changeDir = join(project, 'openspec', 'changes', 'glob-unreadable')
        await mkdir(join(changeDir, 'docs'), { recursive: true })
        await writeFile(join(changeDir, '.openspec.yaml'), 'schema: glob-tracked\n')
        await writeFile(
          join(changeDir, 'proposal.md'),
          '# Proposal\n\nExercise unreadable tracking evidence.\n'
        )
        await writeFile(
          join(changeDir, 'docs', 'tasks-alpha.md'),
          '# Tasks Alpha\n\n- [x] alpha done one\n- [ ] alpha open two\n'
        )
        const lockedPath = join(changeDir, 'docs', 'tasks-beta.md')
        await writeFile(lockedPath, '# Tasks Beta\n\n- [x] beta done one\n- [ ] beta open two\n')
        await chmod(lockedPath, 0o000)
        try {
          const result = await runPinnedOpenspec(
            version,
            ['instructions', 'apply', '--change', 'glob-unreadable', '--json'],
            project,
            env
          )
          expectPinnedJsonDiscipline(result)
          const apply = parsePinnedSuccessJson(result, (payload) =>
            CliApplyInstructionsSuccessSchema.parse(payload)
          )

          // The readable file still contributes its tasks; the unreadable one
          // becomes typed evidence instead of failing the run.
          expect(apply.taskTrackingConfigured).toBe(true)
          expect(apply.tasks.map((task) => task.description)).toEqual([
            'alpha done one',
            'alpha open two',
          ])
          expect(apply.progress).toEqual({ total: 2, complete: 1, remaining: 1 })
          expect(apply.unavailableTrackingFiles).toHaveLength(1)
          const unavailable = apply.unavailableTrackingFiles?.[0]
          // The payload's changeDir is the canonical absolute base the CLI
          // itself resolved, so the evidence path joins against it exactly.
          expect(unavailable?.path).toBe(join(apply.changeDir, 'docs', 'tasks-beta.md'))
          expect(unavailable?.reason).toContain('EACCES')
          // Readable tasks remain, so apply stays ready while completion is
          // explicitly not verified.
          expect(apply.state).toBe('ready')
          expect(apply.instruction).toContain(
            'Task completion is not verified because tracking evidence was unavailable:'
          )
          expect(apply.instruction).toContain(`- ${unavailable?.path}:`)
        } finally {
          // Restore readability before the shared fixture-root cleanup.
          await chmod(lockedPath, 0o600)
        }

        // With zero readable tasks the same evidence blocks apply: state
        // 'all_done' additionally requires every matched file readable.
        const onlyDir = join(project, 'openspec', 'changes', 'glob-unreadable-only')
        await mkdir(join(onlyDir, 'docs'), { recursive: true })
        await writeFile(join(onlyDir, '.openspec.yaml'), 'schema: glob-tracked\n')
        await writeFile(
          join(onlyDir, 'proposal.md'),
          '# Proposal\n\nExercise blocked unreadable tracking.\n'
        )
        const onlyLockedPath = join(onlyDir, 'docs', 'tasks-beta.md')
        await writeFile(onlyLockedPath, '# Tasks Beta\n\n- [x] beta done one\n')
        await chmod(onlyLockedPath, 0o000)
        try {
          const blocked = await runPinnedOpenspec(
            version,
            ['instructions', 'apply', '--change', 'glob-unreadable-only', '--json'],
            project,
            env
          )
          expectPinnedJsonDiscipline(blocked)
          const blockedApply = parsePinnedSuccessJson(blocked, (payload) =>
            CliApplyInstructionsSuccessSchema.parse(payload)
          )

          expect(blockedApply.state).toBe('blocked')
          expect(blockedApply.tasks).toEqual([])
          expect(blockedApply.taskTrackingConfigured).toBe(true)
          expect(blockedApply.unavailableTrackingFiles).toHaveLength(1)
          expect(blockedApply.unavailableTrackingFiles?.[0]?.path).toBe(
            join(blockedApply.changeDir, 'docs', 'tasks-beta.md')
          )
          expect(blockedApply.instruction).toContain('No readable task descriptions are available.')
        } finally {
          await chmod(onlyLockedPath, 0o600)
        }
      },
      60_000
    )
  }
})
