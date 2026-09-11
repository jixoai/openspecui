/**
 * Orthogonal intents (created 2026-09-12 Asia/Shanghai):
 * 1. Pin that the Planning-root CLI Projection Work contract passes the OpenSpec 1.13
 *    Apply `warnings` and `missingPrerequisites` members through the shared
 *    `ApplyInstructionsProjectionSchema` value without any projection-specific branch:
 *    the planning projection neither drops nor synthesizes them.
 *
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
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
})
