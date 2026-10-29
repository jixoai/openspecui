/**
 * Orthogonal intents (updated 2026-10-29 Asia/Shanghai):
 * 1. Prove the executable identity of the retired boundary line: the retained
 *    `openspec-cli-114` npm alias (1.14.3, the line the v15 gate revoked) and the
 *    admitted v15 helper's 1.15.0 bin.
 * 2. Prove the production v15 gate classifies 1.14.3 as `unsupported` (the v14 window
 *    is below-admitted), so the single-series window cannot silently re-admit it.
 * 3. Record the 1.15-only protocol member as absent on the 1.14.3 executable over the
 *    same fixture repo the admitted line reads: `update --dry-run` (plain and `--json`)
 *    is an unknown option there, while the admitted 1.15.0 executable answers the same
 *    invocation with the always-together `changes`/`notes`/`failures` plan keys.
 * 4. Never assert v14-era members absent — `sourcePath`/`line` on apply tasks,
 *    `list --archived`/`--all`, top-level status `warnings`, show requirement/scenario
 *    `name`, and `validate --report findings` are 1.14.3's own facts; the boundary
 *    proves only what 1.15 added.
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
 * Original request (2026-10-06): "官方发布了 v1.14.1，请按照规范更新跟进这个版本"
 *   — the retired-boundary harness was first written against openspec-cli-113 (1.13.2)
 *   when the v14 gate opened; this suite inherits its structure and discipline.
 * Original request (2026-10-29): "检查一下上游openspec是否发布新版本，如果我们按照规范跟进更新"
 *   — the v15 gate revokes the 1.14 line: the retired boundary executable rotates to
 *   1.14.3 through openspec-cli-114 and the boundary negative becomes the 1.15-only
 *   `update --dry-run` plan surface.
 */
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPinnedFixtureRoot,
  expectPinnedVersion,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v15-fixtures.js'
import { CliUpdatePlanSchema } from './cli-contracts/workflow.js'
import { classifyOpenSpecCliVersion } from './openspec-compat.js'

/** The retired below-admitted boundary executable kept through the openspec-cli-114 alias. */
const RETIRED_V14_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-114/bin/openspec.js'
)

interface BoundaryRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

function runRetiredV14Openspec(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<BoundaryRunResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [RETIRED_V14_BIN, ...args],
      { cwd, env, maxBuffer: 4 * 1024 * 1024, timeout: 30_000, windowsHide: true },
      (error, stdout, stderr) => {
        complete({
          exitCode: typeof error?.code === 'number' ? error.code : error ? 1 : 0,
          stdout,
          stderr,
        })
      }
    )
  })
}

describe('pinned OpenSpec 1.14 boundary fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  it('prints the exact line identity for both pinned executables', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-114-boundary-identity')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // The provenance guard for the retired line: the alias bin must print its own
    // exact 1.14.3 identity, never the admitted 1.15.0 string.
    const retired = await runRetiredV14Openspec(['--version'], project, env)
    expect(retired.exitCode, retired.stdout + '\n' + retired.stderr).toBe(0)
    expect(retired.stdout.trim()).toBe('1.14.3')

    await expectPinnedVersion('1.15.0', project, env)
  }, 60_000)

  it('classifies the retired 1.14.3 line as unsupported under the v15 gate', () => {
    const compatibility = classifyOpenSpecCliVersion('1.14.3')
    expect(compatibility.status).toBe('unsupported')
    expect(compatibility.supported).toBe(false)
    expect(compatibility.recommended).toBe(false)
    // Unsupported detection blocks Core interactions: a stale CLI cannot drive the
    // admitted command surface even when the executable still runs.
    expect(compatibility.blocksCoreInteractions).toBe(true)
  })

  it('keeps the 1.15-only update plan option absent on the retired 1.14.3 executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1143-boundary-members')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // One fixture repo feeds both executables; the admitted line initializes it.
    const initialized = await runPinnedOpenspec(
      '1.15.0',
      ['init', project, '--tools=none'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    // A ready change with tracked tasks so the repo is a real loadable workspace for
    // both executables — the boundary never depends on an empty project shape.
    const created = await runPinnedOpenspec(
      '1.15.0',
      ['new', 'change', 'plan-boundary'],
      project,
      env
    )
    expect(created.exitCode, created.stdout + created.stderr).toBe(0)
    const changeDir = join(project, 'openspec', 'changes', 'plan-boundary')
    await writeFile(join(changeDir, 'proposal.md'), '# Proposal\n\nBoundary member matrix.\n')
    await writeFile(
      join(changeDir, 'tasks.md'),
      ['# Tasks', '', '- [x] Finish the analysis', '- [ ] Implement it', ''].join('\n')
    )

    // Plain form: the retired line does not know the 1.15 option at all — the whole
    // option is unknown, the invocation fails, and no plan output is produced.
    const retiredPlain = await runRetiredV14Openspec(['update', '--dry-run'], project, env)
    expect(retiredPlain.exitCode).toBe(1)
    expect(retiredPlain.stderr).toContain("unknown option '--dry-run'")
    expect(retiredPlain.stdout.trim()).toBe('')

    // JSON form: the same rejection — no JSON document shares the failed invocation's
    // stdout, so a consumer can never decode a partial or fabricated plan from 1.14.3.
    const retiredJson = await runRetiredV14Openspec(['update', '--dry-run', '--json'], project, env)
    expect(retiredJson.exitCode).toBe(1)
    expect(retiredJson.stderr).toContain("unknown option '--dry-run'")
    expect(retiredJson.stdout.trim()).toBe('')

    // Admitted-line contrast over the identical fixture and argv: 1.15.0 accepts the
    // option and answers with the typed plan whose three keys stay together — the
    // absence on 1.14.3 above is a version boundary, never a fixture artifact.
    const admitted = await runPinnedOpenspec(
      '1.15.0',
      ['update', '--dry-run', '--json'],
      project,
      env
    )
    expect(admitted.exitCode, admitted.stdout + '\n' + admitted.stderr).toBe(0)
    const plan = parsePinnedSuccessJson(admitted, (payload) => CliUpdatePlanSchema.parse(payload))
    expect(plan.changes).toEqual([])
    expect(plan.notes).toEqual([])
    expect(plan.failures).toEqual([])
  }, 60_000)
})
