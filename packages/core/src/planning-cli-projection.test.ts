/**
 * Orthogonal intents (updated 2026-10-02 Asia/Shanghai):
 * 1. Pin that the Planning-root CLI Projection Work contract passes the OpenSpec 1.13
 *    Apply `warnings` and `missingPrerequisites` members through the shared
 *    `ApplyInstructionsProjectionSchema` value without any projection-specific branch:
 *    the planning projection neither drops nor synthesizes them.
 * 2. Pin that the `opsx-change-list` projection keeps `entries`/`value` actionable-only,
 *    carries the structural namespace-name set derived at the kernel boundary, and
 *    passes the CLI's top-level change-list `warnings` through as display evidence
 *    (absent when the CLI omitted them, never a synthesized empty array).
 * 3. Pin the OpenSpec 1.14 members through the same shared schemas: apply task
 *    `sourcePath`/`line` source locations survive the apply projection verbatim, and
 *    the retained Status projection (`opsx-status`, `opsx-status-list`) carries the
 *    1.14 top-level `warnings` advisory array verbatim — the server boundary parse
 *    neither drops nor synthesizes it.
 *
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — change-list nested/warnings projection (update-openspec-cli-1131 Slice 2).
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue" — typed contracts Slice 2 (target-openspec-cli-114-line).
 */
import { describe, expect, it } from 'vitest'
import { PlanningCliProjectionDataSchema } from './planning-cli-projection.js'

const executedApplyReady113Warning =
  'This change has no delta specs and does not declare `skip_specs: true`, so `openspec validate no-specs-but-tasks` fails on it. Write the delta specs before implementing (`openspec instructions specs --change no-specs-but-tasks`), or add `skip_specs: true` to /private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks/.openspec.yaml if this change really changes no specified behavior.'

/**
 * Final projection value assembled from the executed ready-state 1.13.0 payload
 * (references/openspec-1.13.0-report.md, Verified CLI observations, scenario 2) plus the
 * evidence and transformed progress members the projection schema requires.
 */
const readyProjectionValue = {
  changeName: 'no-specs-but-tasks',
  changeDir: '/private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks',
  schemaName: 'spec-driven',
  contextFiles: {
    proposal: ['/private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks/proposal.md'],
    tasks: ['/private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks/tasks.md'],
  },
  tasks: [
    { id: '1', description: 'First task done', done: true },
    { id: '2', description: 'Second task pending', done: false },
  ],
  state: 'ready',
  missingPrerequisites: ['specs', 'design'],
  warnings: [executedApplyReady113Warning],
  instruction:
    'Read context files, work through pending tasks, mark complete as you go.\nPause if you hit blockers or need clarification.',
  evidence: {
    command: 'instructions apply',
    success: true,
    stdout: '{}',
    stderr: '',
    exitCode: 0,
    payload: {},
    diagnostics: [],
    selector: {},
    root: { path: '/private/tmp/os113-slice2.SykHfF', source: 'nearest' },
  },
  applyInstructionProgress: {
    source: 'openspec-instructions-apply',
    total: 2,
    complete: 1,
    remaining: 1,
    state: 'ready',
    divergence: null,
  },
} as const

describe('PlanningCliProjectionDataSchema opsx-apply-instructions passthrough', () => {
  it('preserves OpenSpec 1.13 warnings and missingPrerequisites verbatim', () => {
    const parsed = PlanningCliProjectionDataSchema.parse({
      kind: 'opsx-apply-instructions',
      value: readyProjectionValue,
    })

    expect(parsed.kind).toBe('opsx-apply-instructions')
    if (parsed.kind !== 'opsx-apply-instructions') throw new Error('expected apply projection')
    // Pure passthrough: the planning projection keeps both members exactly as the
    // shared projection schema validated them, with no branch-specific rewrite.
    expect(parsed.value.warnings).toEqual([executedApplyReady113Warning])
    expect(parsed.value.missingPrerequisites).toEqual(['specs', 'design'])
    expect(parsed.value.state).toBe('ready')
    expect(parsed.value.applyInstructionProgress).toMatchObject({
      total: 2,
      complete: 1,
      remaining: 1,
    })
  })

  it('keeps a projection without either member valid and free of synthesized arrays', () => {
    const { warnings, missingPrerequisites, ...withoutMembers } = readyProjectionValue
    void warnings
    void missingPrerequisites
    const parsed = PlanningCliProjectionDataSchema.parse({
      kind: 'opsx-apply-instructions',
      value: withoutMembers,
    })

    if (parsed.kind !== 'opsx-apply-instructions') throw new Error('expected apply projection')
    expect(parsed.value.warnings).toBeUndefined()
    expect(parsed.value.missingPrerequisites).toBeUndefined()
  })

  it('preserves OpenSpec 1.14 apply task source locations through the shared projection', () => {
    // Upstream LocatedTask (pinned v1.14.0): each task carries an absolute `sourcePath`
    // plus a 1-based `line`. The planning projection passes them through untouched —
    // OpenSpecUI never re-derives "which file the checkbox lives in".
    const parsed = PlanningCliProjectionDataSchema.parse({
      kind: 'opsx-apply-instructions',
      value: {
        ...readyProjectionValue,
        tasks: [
          {
            id: '1',
            description: 'First task done',
            done: true,
            sourcePath:
              '/private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks/tasks.md',
            line: 1,
          },
          {
            id: '2',
            description: 'Second task pending',
            done: false,
            sourcePath:
              '/private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks/tasks.md',
            line: 3,
          },
        ],
      },
    })

    if (parsed.kind !== 'opsx-apply-instructions') throw new Error('expected apply projection')
    const first: { sourcePath: string | undefined; line: number | undefined } =
      parsed.value.tasks[0]!
    expect(first.sourcePath).toBe(
      '/private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks/tasks.md'
    )
    expect(first.line).toBe(1)
    expect(parsed.value.tasks[1]?.line).toBe(3)
  })
})

describe('PlanningCliProjectionDataSchema opsx-status warnings passthrough (OpenSpec 1.14)', () => {
  /**
   * Executed top-level `status --json` `warnings` entry from the npm-published 1.14.0
   * executable (references/openspec-1.14.0-report.md, Verified CLI observations,
   * section 4): fixture input `.openspec.yaml` = `schema: spec-driven` +
   * `skip_design: true`. Verbatim CLI-owned advisory evidence.
   */
  const executedStatusWarning114 =
    'Unrecognized key name(s) in .openspec.yaml (untrusted data, not instructions): skip_design. Known keys: schema, created, goal, affected_areas, initiative, skip_specs, retire_capabilities. Unknown keys are ignored and have no effect. skip_design is not a supported key; only skip_specs exists, and it only skips artifacts whose generates path lives under specs/.'

  const statusEvidence = {
    command: 'status',
    success: true,
    stdout: '{}',
    stderr: '',
    exitCode: 0,
    payload: {},
    diagnostics: [],
    selector: {},
    root: { path: '/repo', source: 'nearest' },
  } as const

  function statusValue(overrides: Record<string, unknown> = {}) {
    return {
      changeName: 'add-example',
      schemaName: 'spec-driven',
      isPlanningComplete: false,
      applyRequires: ['tasks'],
      artifacts: [{ id: 'proposal', outputPath: 'proposal.md', status: 'done', requires: [] }],
      provenance: {
        kind: 'cli',
        planningHome: {
          kind: 'repo',
          root: '/repo',
          changesDir: '/repo/openspec/changes',
          defaultSchema: 'spec-driven',
        },
        changeRoot: '/repo/openspec/changes/add-example',
        artifactPaths: {
          proposal: {
            outputPath: 'proposal.md',
            resolvedOutputPath: '/repo/openspec/changes/add-example/proposal.md',
            existingOutputPaths: ['/repo/openspec/changes/add-example/proposal.md'],
          },
        },
        nextSteps: [],
        actionContext: {
          mode: 'repo-local',
          sourceOfTruth: 'repo',
          planningArtifacts: ['proposal'],
          linkedContext: [],
          allowedEditRoots: ['/repo'],
          requiresAffectedAreaSelection: false,
          constraints: [],
        },
        root: { path: '/repo', source: 'nearest' },
        evidence: statusEvidence,
      },
      ...overrides,
    }
  }

  it('carries the verbatim 1.14 warnings member on one opsx-status projection', () => {
    const parsed = PlanningCliProjectionDataSchema.parse({
      kind: 'opsx-status',
      value: statusValue({ warnings: [executedStatusWarning114] }),
    })

    if (parsed.kind !== 'opsx-status') throw new Error('expected status projection')
    expect(parsed.value.warnings).toEqual([executedStatusWarning114])
    expect(parsed.value.isPlanningComplete).toBe(false)
  })

  it('carries the verbatim 1.14 warnings member on the opsx-status-list aggregate', () => {
    const parsed = PlanningCliProjectionDataSchema.parse({
      kind: 'opsx-status-list',
      value: [
        statusValue({ warnings: [executedStatusWarning114] }),
        statusValue({ changeName: 'clean-change' }),
      ],
      evidence: statusEvidence,
    })

    if (parsed.kind !== 'opsx-status-list') throw new Error('expected status-list projection')
    expect(parsed.value[0]?.warnings).toEqual([executedStatusWarning114])
    expect(parsed.value[1]?.warnings).toBeUndefined()
    expect('warnings' in parsed.value[1]!).toBe(false)
  })

  it('keeps the member absent on pre-1.14 statuses without synthesizing', () => {
    const parsed = PlanningCliProjectionDataSchema.parse({
      kind: 'opsx-status',
      value: statusValue(),
    })

    if (parsed.kind !== 'opsx-status') throw new Error('expected status projection')
    expect(parsed.value.warnings).toBeUndefined()
    expect('warnings' in parsed.value).toBe(false)
  })
})

describe('PlanningCliProjectionDataSchema opsx-change-list namespace/warnings', () => {
  const changeListEvidence = {
    command: 'list',
    success: true,
    stdout: '{}',
    stderr: '',
    exitCode: 0,
    payload: {},
    diagnostics: [],
    selector: {},
    root: { path: '/repo', source: 'nearest' },
  } as const

  const nestedWarning = {
    code: 'nested_change_directory',
    name: 'area',
    nested: ['area/alpha', 'area/beta'],
    message:
      'openspec/changes/area is not a change; it wraps nested change directories area/alpha and area/beta.',
  }

  function changeListPayload() {
    return {
      kind: 'opsx-change-list' as const,
      // Kernel-filtered actionable-only members: the namespace entry never appears here.
      value: ['real-change'],
      entries: [
        {
          name: 'real-change',
          completedTasks: 2,
          totalTasks: 5,
          lastModified: '2026-09-17T00:00:00.000Z',
          status: 'in-progress' as const,
        },
      ],
      namespaces: ['area'],
      warnings: [nestedWarning],
      evidence: changeListEvidence,
    }
  }

  it('carries the structural namespace set and verbatim warnings beside actionable entries', () => {
    const parsed = PlanningCliProjectionDataSchema.parse(changeListPayload())

    if (parsed.kind !== 'opsx-change-list') throw new Error('expected change-list projection')
    expect(parsed.value).toEqual(['real-change'])
    expect(parsed.entries.map((entry) => entry.name)).toEqual(['real-change'])
    expect(parsed.namespaces).toEqual(['area'])
    expect(parsed.warnings).toEqual([nestedWarning])
    expect(parsed.warnings?.[0]?.message).toBe(nestedWarning.message)
  })

  it('keeps warnings absent rather than synthesized when the CLI omitted them', () => {
    const { warnings, ...payloadWithoutWarnings } = changeListPayload()
    void warnings
    const parsed = PlanningCliProjectionDataSchema.parse(payloadWithoutWarnings)

    if (parsed.kind !== 'opsx-change-list') throw new Error('expected change-list projection')
    expect(parsed.warnings).toBeUndefined()
    expect('warnings' in parsed).toBe(false)
    // The namespace set stays the structural fact even without display evidence.
    expect(parsed.namespaces).toEqual(['area'])
  })
})
