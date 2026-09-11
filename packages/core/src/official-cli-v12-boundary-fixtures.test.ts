/**
 * Orthogonal intents (updated 2026-09-12 Asia/Shanghai):
 * 1. Prove the executable identity of both pinned fixture lines: the v13 helper's
 *    1.13.0 bin and the retained v12 helper's 1.12.0 boundary bin.
 * 2. Record the apply-readiness projection boundary: the retained 1.12.0 executable
 *    answers `instructions apply --json` without the 1.13 `missingPrerequisites`
 *    build-order closure and without the ready-state `warnings` advisory, so the
 *    v13 projection contract cannot silently ride a below-admitted line.
 * 3. Keep boundary negatives executable so the v13 single-series window cannot
 *    silently re-admit a line that lacks the apply-readiness evidence fields.
 *
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPinnedFixtureRoot,
  parsePinnedSuccessJson as parsePinnedV13SuccessJson,
  pinnedFixtureEnv as pinnedV13FixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec as runPinnedV13Openspec,
} from './__tests__/official-cli-v13-fixtures.js'
import {
  expectPinnedVersion as expectPinnedV12Version,
  pinnedFixtureEnv as pinnedV12FixtureEnv,
  runPinnedOpenspec as runPinnedV12Openspec,
} from './__tests__/official-cli-v12-fixtures.js'
import { CliApplyInstructionsSuccessSchema } from './cli-contracts/workflow.js'

describe('pinned OpenSpec 1.13 boundary fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  it('prints the exact line identity for both pinned executables', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-113-boundary-identity')
    const project = join(fixtureRoot, 'project')
    const v13Env = pinnedV13FixtureEnv(fixtureRoot)
    const v12Env = pinnedV12FixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // The provenance guard: each bins-map entry must print its own exact version.
    const v13 = await runPinnedV13Openspec('1.13.0', ['--version'], project, v13Env)
    expect(v13.exitCode, v13.stdout + '\n' + v13.stderr).toBe(0)
    expect(v13.stdout.trim()).toBe('1.13.0')

    await expectPinnedV12Version('1.12.0', project, v12Env)
  }, 60_000)

  it('keeps the apply-readiness projection fields a 1.13-only capability on the pinned 1.12.0 executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1120-apply-readiness-boundary')
    const project = join(fixtureRoot, 'project')
    const v13Env = pinnedV13FixtureEnv(fixtureRoot)
    const v12Env = pinnedV12FixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // One fixture repo feeds both executables: the identical proposal+tasks change
    // without delta specs is the 1.13 ready-with-warning scenario.
    for (const env of [v13Env, v12Env]) {
      const initialized = await runPinnedV13Openspec(
        '1.13.0',
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)
    }
    const created = await runPinnedV13Openspec(
      '1.13.0',
      ['new', 'change', 'no-specs-but-tasks'],
      project,
      v13Env
    )
    expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
    const changeDir = join(project, 'openspec', 'changes', 'no-specs-but-tasks')
    await writeFile(
      join(changeDir, 'proposal.md'),
      '# Proposal\n\nExercise the ready-state no-delta-specs advisory.\n'
    )
    await writeFile(
      join(changeDir, 'tasks.md'),
      ['# Tasks', '', '- [x] Finish the analysis', '- [ ] Implement it', ''].join('\n')
    )

    // The admitted 1.13.0 line projects the readiness evidence fields.
    const v13Result = await runPinnedV13Openspec(
      '1.13.0',
      ['instructions', 'apply', '--change', 'no-specs-but-tasks', '--json'],
      project,
      v13Env
    )
    const v13Apply = parsePinnedV13SuccessJson(v13Result, (payload) =>
      CliApplyInstructionsSuccessSchema.parse(payload)
    )
    expect(v13Apply.state).toBe('ready')
    expect(v13Apply.missingPrerequisites).toEqual(['specs', 'design'])
    expect(v13Apply.warnings?.[0]).toContain('no delta specs')

    // The retained 1.12.0 executable answers the same command over the same change
    // with the same verdict, but its document carries neither 1.13 evidence field:
    // below-admitted lines must stay incapable of the v13 projection contract.
    const v12Result = await runPinnedV12Openspec(
      '1.12.0',
      ['instructions', 'apply', '--change', 'no-specs-but-tasks', '--json'],
      project,
      v12Env
    )
    const v12Apply = parsePinnedV13SuccessJson(v12Result, (payload) =>
      CliApplyInstructionsSuccessSchema.parse(payload)
    )
    expect(v12Apply.state).toBe('ready')
    expect(v12Apply.progress).toEqual(v13Apply.progress)
    expect(v12Apply.missingPrerequisites).toBeUndefined()
    expect(v12Apply.warnings).toBeUndefined()
  }, 60_000)
})
