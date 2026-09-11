/**
 * Orthogonal intents (created 2026-09-12 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.13.0 Apply readiness contract (`instructions apply
 *    --json`) against a real fixture repo: the blocked-state build-order closure and
 *    the ready-state no-delta-specs advisory.
 * 2. Prove `missingPrerequisites` is additive readiness evidence, never a new gate:
 *    the blocked change names the whole prerequisite chain
 *    (`proposal,specs,design,tasks`) beside `missingArtifacts:["tasks"]`, while the
 *    proposal+tasks change stays `ready` with `missingPrerequisites:["specs","design"]`.
 * 3. Prove the ready-state `warnings` advisory names the objective downstream fact
 *    (`openspec validate` fails on the change) plus both remedies (write the delta
 *    specs / declare `skip_specs: true`), matching the Verified CLI observations in
 *    `references/openspec-1.13.0-report.md`.
 * 4. Prove upstream conditional spreading: `warnings` is absent (not `[]`) while
 *    blocked, and `missingArtifacts` is absent while ready.
 *
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
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
    }, 60_000)
  }
})
