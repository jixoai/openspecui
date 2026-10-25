/**
 * Orthogonal intents (updated 2026-10-25 Asia/Shanghai):
 * 1. Prove the executable identity of the retired boundary line: the kept v14 helper's
 *    `openspec-cli-114` npm alias bin is exactly 1.14.3 — the just-retired line the
 *    v15 gate revoked (below-admitted for the `>=1.15.0 <1.16.0` window).
 * 2. Prove the production v15 gate classifies 1.14.3 as `unsupported`, so the
 *    single-series window cannot silently re-admit the v14 line.
 * 3. Record the 1.15-only protocol surfaces as absent on the boundary executable over
 *    a real fixture repo (both verified against the pinned binaries): `update
 *    --dry-run` is an unknown option and `install` is an unknown command — the two
 *    standalone-distribution surfaces 1.15 adds — each failing with exit 1 and no
 *    stdout document.
 * 4. Retain the v14-era protocol members as positive 1.14 facts over the same fixture
 *    repo (the semantic flip of the retired 1.13.2 negatives): apply tasks carry the
 *    LocatedTask `sourcePath`/`line`, status emits the top-level `warnings` advisory
 *    for an unrecognized `.openspec.yaml` key, show-Spec requirements and scenarios
 *    carry `name`, and `list --archived` is a working flag (not merely unknown to the
 *    predecessor).
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
 * Original request (2026-10-06): "官方发布了 v1.14.1，请按照规范更新跟进这个版本"
 *   — in-window patch rotation moved the admitted-line literals to 1.14.1; the
 *   retired boundary executable stayed 1.13.2 through openspec-cli-113.
 * Original request (2026-10-16): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
 *   — in-window patch rotation moved the admitted-line literals to 1.14.2; the
 *   retired boundary executable stayed 1.13.2 through openspec-cli-113.
 * Original request (2026-10-24): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
 *   — in-window patch rotation moved the admitted-line literals to 1.14.3; the
 *   retired boundary executable stayed 1.13.2 through openspec-cli-113.
 * Original request (2026-10-25): "开工"
 *   — target-openspec-cli-15-line Slice 3 rewrites this suite as the v14 boundary for
 *   the v15 line: openspec-cli-113 retires with its 1.13.2 negatives, the kept v14
 *   helper's 1.14.3 bin becomes the boundary executable, and the 1.13.2-absence
 *   assertions flip to 1.14.3-presence facts beside the new 1.15-only surface checks.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  expectPinnedVersion,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v14-fixtures.js'
import {
  CliApplyInstructionsSuccessSchema,
  CliShowSpecDocumentSchema,
  CliWorkflowStatusSuccessSchema,
} from './cli-contracts/workflow.js'
import { classifyOpenSpecCliVersion } from './openspec-compat.js'

describe('pinned OpenSpec 1.14 boundary fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  it('prints the exact line identity for the boundary executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-114-boundary-identity')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // The provenance guard for the retired line: the kept v14 helper bin must print
    // its own exact 1.14.3 identity, never the admitted 1.15.0 string.
    await expectPinnedVersion('1.14.3', project, env)
  }, 60_000)

  it('classifies the retired 1.14.3 line as unsupported under the v15 gate', () => {
    const compatibility = classifyOpenSpecCliVersion('1.14.3')
    expect(compatibility.status).toBe('unsupported')
    expect(compatibility.supported).toBe(false)
    expect(compatibility.recommended).toBe(false)
  })

  it('keeps the 1.15-only standalone surfaces absent on the boundary executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1143-boundary-surfaces')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // `update --dry-run` (1.15 standalone-distribution surface): the 1.14.3 parser
    // rejects the whole option, so the invocation fails without any JSON output.
    const update = await runPinnedOpenspec('1.14.3', ['update', '--dry-run'], project, env)
    expect(update.exitCode).toBe(1)
    expect(update.stderr).toContain("error: unknown option '--dry-run'")
    expect(update.stdout.trim()).toBe('')

    // `install` (1.15 standalone installer command): unknown command on 1.14.3.
    const install = await runPinnedOpenspec('1.14.3', ['install'], project, env)
    expect(install.exitCode).toBe(1)
    expect(install.stderr).toContain("error: unknown command 'install'")
    expect(install.stdout.trim()).toBe('')
  }, 60_000)

  it('carries the v14-era protocol members on the boundary executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1143-boundary-members')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // The boundary executable initializes its own fixture repo.
    const initialized = await runPinnedOpenspec(
      '1.14.3',
      ['init', project, '--tools=none'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    // A ready change with two checkbox lines plus an unrecognized .openspec.yaml key:
    // 1.14 attaches the LocatedTask members to tasks and turns the key into a
    // top-level status warning.
    const created = await runPinnedOpenspec(
      '1.14.3',
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
    await writeFile(join(changeDir, '.openspec.yaml'), 'schema: spec-driven\nskip_design: true\n')

    // A main spec: 1.14 shows requirement and scenario names beside the raw bodies.
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

    // Apply: same verdict and progress as the admitted line, and every task carries
    // its LocatedTask sourcePath/line (the 1.13-era payload lacked both).
    const apply = await runPinnedOpenspec(
      '1.14.3',
      ['instructions', 'apply', '--change', 'located-tasks', '--json'],
      project,
      env
    )
    expect(apply.exitCode, apply.stdout + '\n' + apply.stderr).toBe(0)
    const applyReport = parsePinnedSuccessJson(apply, (payload) =>
      CliApplyInstructionsSuccessSchema.parse(payload)
    )
    expect(applyReport.state).toBe('ready')
    expect(applyReport.progress).toEqual({ total: 2, complete: 1, remaining: 1 })
    expect(applyReport.tasks.map((task) => task.description)).toEqual([
      'Finish the analysis',
      'Implement it',
    ])
    for (const task of applyReport.tasks) {
      expect(typeof task.sourcePath, JSON.stringify(task)).toBe('string')
      expect(task.sourcePath?.length ?? 0).toBeGreaterThan(0)
      expect(typeof task.line, JSON.stringify(task)).toBe('number')
      expect(task.line ?? 0).toBeGreaterThan(0)
    }

    // Status: the unrecognized key produces the top-level warnings advisory.
    const status = await runPinnedOpenspec(
      '1.14.3',
      ['status', '--change', 'located-tasks', '--json'],
      project,
      env
    )
    expect(status.exitCode, status.stdout + '\n' + status.stderr).toBe(0)
    const statusPayload = JSON.parse(status.stdout)
    expect(Array.isArray(statusPayload.warnings)).toBe(true)
    expect(statusPayload.warnings.length).toBeGreaterThan(0)
    const statusReport = parsePinnedSuccessJson(status, (payload) =>
      CliWorkflowStatusSuccessSchema.parse(payload)
    )
    expect(statusReport.warnings).toEqual(statusPayload.warnings)
    expect(statusReport.changeName).toBe('located-tasks')

    // Show spec: requirement and scenario bodies survive beside their name members.
    const show = await runPinnedOpenspec(
      '1.14.3',
      ['show', 'billing', '--type', 'spec', '--json'],
      project,
      env
    )
    expect(show.exitCode, show.stdout + show.stderr).toBe(0)
    const shown = parsePinnedSuccessJson(show, (payload) =>
      CliShowSpecDocumentSchema.parse(payload)
    )
    expect(shown).toMatchObject({
      id: 'billing',
      requirementCount: 1,
      requirements: [
        {
          name: 'Billing rules',
          text: 'The system SHALL apply billing rules.',
          scenarios: [
            {
              name: 'Existing behavior',
              rawText: '- **WHEN** billing runs\n- **THEN** billing succeeds',
            },
          ],
        },
      ],
    })

    // List: the archive inventory flag works on 1.14 (the retired 1.13.2 executable
    // rejected the whole option), answering one complete empty-inventory document.
    const list = await runPinnedOpenspec('1.14.3', ['list', '--archived', '--json'], project, env)
    expect(list.exitCode, list.stdout + '\n' + list.stderr).toBe(0)
    expectPinnedJsonDiscipline(list)
  }, 60_000)
})
