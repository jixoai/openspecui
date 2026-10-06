/**
 * Orthogonal intents (updated 2026-10-06 Asia/Shanghai):
 * 1. Prove the executable identity of the retired boundary line: the retained
 *    `openspec-cli-113` npm alias (1.13.2, the line the v14 gate revoked) and the
 *    admitted v14 helper's 1.14.1 bin.
 * 2. Prove the production v14 gate classifies 1.13.2 as `unsupported` (the v13 window
 *    is below-admitted), so the single-series window cannot silently re-admit it.
 * 3. Record the 1.14-only protocol members as absent on the 1.13.2 executable over
 *    the same fixture repo the admitted line reads: apply tasks carry no
 *    `sourcePath`/`line`, `list --archived` is rejected, show-Spec requirements and
 *    scenarios carry no `name`, and status emits no top-level `warnings`.
 * 4. Never assert v13-era members (for example `taskTrackingConfigured`) absent —
 *    those are 1.13.2's own facts; the boundary proves only what 1.14 added.
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
 * Original request (2026-10-06): "官方发布了 v1.14.1，请按照规范更新跟进这个版本"
 *   — in-window patch rotation moves the admitted-line literals to 1.14.1; the
 *   retired boundary executable stays 1.13.2 through openspec-cli-113.
 */
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPinnedFixtureRoot,
  expectPinnedVersion as expectPinnedV14Version,
  parsePinnedSuccessJson as parsePinnedV14SuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec as runPinnedV14Openspec,
} from './__tests__/official-cli-v14-fixtures.js'
import {
  CliApplyInstructionsSuccessSchema,
  CliShowSpecDocumentSchema,
  CliWorkflowStatusSuccessSchema,
} from './cli-contracts/workflow.js'
import { classifyOpenSpecCliVersion } from './openspec-compat.js'

/** The retired below-admitted boundary executable kept through the openspec-cli-113 alias. */
const RETIRED_V13_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-113/bin/openspec.js'
)

interface BoundaryRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

function runRetiredV13Openspec(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<BoundaryRunResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [RETIRED_V13_BIN, ...args],
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

describe('pinned OpenSpec 1.13 boundary fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  it('prints the exact line identity for both pinned executables', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-113-boundary-identity')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // The provenance guard for the retired line: the alias bin must print its own
    // exact 1.13.2 identity, never the admitted 1.14.1 string.
    const retired = await runRetiredV13Openspec(['--version'], project, env)
    expect(retired.exitCode, retired.stdout + '\n' + retired.stderr).toBe(0)
    expect(retired.stdout.trim()).toBe('1.13.2')

    await expectPinnedV14Version('1.14.1', project, env)
  }, 60_000)

  it('classifies the retired 1.13.2 line as unsupported under the v14 gate', () => {
    const compatibility = classifyOpenSpecCliVersion('1.13.2')
    expect(compatibility.status).toBe('unsupported')
    expect(compatibility.supported).toBe(false)
    expect(compatibility.recommended).toBe(false)
  })

  it('keeps the 1.14-only members absent on the retired 1.13.2 executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1132-boundary-members')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // One fixture repo feeds both executables; the admitted line initializes it.
    const initialized = await runPinnedV14Openspec(
      '1.14.1',
      ['init', project, '--tools=none'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    // A ready change with two checkbox lines: 1.14 attaches the LocatedTask
    // members, the retired line must answer without them.
    const created = await runPinnedV14Openspec(
      '1.14.1',
      ['new', 'change', 'located-tasks'],
      project,
      env
    )
    expect(created.exitCode, created.stdout + created.stderr).toBe(0)
    const changeDir = join(project, 'openspec', 'changes', 'located-tasks')
    await writeFile(join(changeDir, 'proposal.md'), '# Proposal\n\nBoundary member matrix.\n')
    await writeFile(
      join(changeDir, 'tasks.md'),
      ['# Tasks', '', '- [x] Finish the analysis', '- [ ] Implement it', ''].join('\n')
    )
    // An unrecognized .openspec.yaml key: 1.14 turns it into a top-level warning,
    // the retired line ignores it silently.
    await writeFile(join(changeDir, '.openspec.yaml'), 'schema: spec-driven\nskip_design: true\n')

    // A main spec: 1.14 shows requirement/scenario names, the retired line does not.
    await mkdir(join(project, 'openspec', 'specs', 'billing'), { recursive: true })
    await writeFile(
      join(project, 'openspec', 'specs', 'billing', 'spec.md'),
      [
        '## Purpose',
        'Billing rules.',
        '',
        '## Requirements',
        '',
        '### Requirement: Billing rules',
        'The system SHALL apply billing rules.',
        '',
        '#### Scenario: Existing behavior',
        '- **WHEN** billing runs',
        '- **THEN** billing succeeds',
        '',
      ].join('\n')
    )

    // Apply: same verdict and progress, but no task carries sourcePath or line.
    const applyRetired = await runRetiredV13Openspec(
      ['instructions', 'apply', '--change', 'located-tasks', '--json'],
      project,
      env
    )
    expect(applyRetired.exitCode, applyRetired.stdout + '\n' + applyRetired.stderr).toBe(0)
    const apply = parsePinnedV14SuccessJson(applyRetired, (payload) =>
      CliApplyInstructionsSuccessSchema.parse(payload)
    )
    expect(apply.state).toBe('ready')
    expect(apply.progress).toEqual({ total: 2, complete: 1, remaining: 1 })
    expect(apply.tasks.map((task) => task.description)).toEqual([
      'Finish the analysis',
      'Implement it',
    ])
    for (const task of apply.tasks) {
      expect('sourcePath' in task, JSON.stringify(task)).toBe(false)
      expect('line' in task, JSON.stringify(task)).toBe(false)
      expect(task.sourcePath).toBeUndefined()
      expect(task.line).toBeUndefined()
    }

    // Status: the unrecognized key produces no top-level warnings member.
    const statusRetired = await runRetiredV13Openspec(
      ['status', '--change', 'located-tasks', '--json'],
      project,
      env
    )
    expect(statusRetired.exitCode, statusRetired.stdout + '\n' + statusRetired.stderr).toBe(0)
    const statusPayload = JSON.parse(statusRetired.stdout)
    expect('warnings' in statusPayload).toBe(false)
    const status = parsePinnedV14SuccessJson(statusRetired, (payload) =>
      CliWorkflowStatusSuccessSchema.parse(payload)
    )
    expect(status.warnings).toBeUndefined()
    expect(status.changeName).toBe('located-tasks')

    // Show spec: requirement and scenario bodies survive without the name members.
    const showRetired = await runRetiredV13Openspec(
      ['show', 'billing', '--type', 'spec', '--json'],
      project,
      env
    )
    expect(showRetired.exitCode, showRetired.stdout + showRetired.stderr).toBe(0)
    const shown = parsePinnedV14SuccessJson(showRetired, (payload) =>
      CliShowSpecDocumentSchema.parse(payload)
    )
    expect(shown).toMatchObject({
      id: 'billing',
      requirementCount: 1,
      requirements: [
        {
          text: 'The system SHALL apply billing rules.',
          scenarios: [{ rawText: '- **WHEN** billing runs\n- **THEN** billing succeeds' }],
        },
      ],
    })
    for (const requirement of shown.requirements) {
      expect('name' in requirement, JSON.stringify(requirement)).toBe(false)
      for (const scenario of requirement.scenarios) {
        expect('name' in scenario, JSON.stringify(scenario)).toBe(false)
      }
    }

    // List: the archive inventory flags are not merely absent — the whole option
    // is unknown to the retired line and the invocation fails without JSON output.
    const listRetired = await runRetiredV13Openspec(['list', '--archived', '--json'], project, env)
    expect(listRetired.exitCode).toBe(1)
    expect(listRetired.stderr).toContain("unknown option '--archived'")
    // No JSON document shares the failed invocation's stdout.
    expect(listRetired.stdout.trim()).toBe('')
  }, 60_000)
})
