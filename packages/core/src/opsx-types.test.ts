/**
 * Orthogonal intents (updated 2026-09-26 Asia/Shanghai):
 * 1. Verify Apply instruction context-file normalization.
 * 2. Require command-specific CLI evidence on demand-driven instruction leaves.
 * 3. Preserve typed OpenSpec 1.6 Reference indexes on both instruction surfaces.
 * 4. Preserve OpenSpec 1.7 operation inputs and skipped dependency identity.
 * 5. Preserve the OpenSpec 1.13 Apply `warnings` and `missingPrerequisites` fields
 *    verbatim through the projection schema without defaulting them to empty arrays
 *    and without letting them alter state/progress semantics.
 * 6. Preserve the OpenSpec 1.13.2 Apply tracking-evidence members (`taskTrackingConfigured`,
 *    `unavailableTrackingFiles`) verbatim through the projection with absent-when-
 *    upstream-absent semantics (never a synthesized `false`/`[]`) and no gating effect
 *    on `state`/`applyInstructionProgress`.
 * 7. Lock `isGlobPattern` to the upstream artifact-graph recognition parity ported from
 *    OpenSpec 1.13.2 (`references/openspec/src/core/artifact-graph/outputs.ts`): original
 *    wildcards plus brace expansions and extglob groups after POSIX normalization, while
 *    literal filenames stay literal — watcher-granularity only.
 *
 * Original request (2026-07-15): "Preserve CLI-provided paths, action context, References, and diagnostics end to end."
 * Original request (2026-07-23): "OPSX Status 不应等待完整 Kernel warmup，且必须保留 CLI evidence。"
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-09-26): "Openspec 1.13.2 释放了…" — tracking-evidence projection + glob-recognition parity (update-openspec-cli-1132 Slice 2).
 */
import { describe, expect, it } from 'vitest'
import { ApplyInstructionsSchema, ArtifactInstructionsSchema, isGlobPattern } from './opsx-types.js'

const referenceIndex = [
  {
    store_id: 'platform',
    root: '/stores/platform',
    specs: [{ id: 'identity', summary: 'Shared identity facts.' }],
    fetch: 'openspec list --specs --store platform',
    status: [],
  },
] as const

const baseApplyInstructions = {
  changeName: 'add-example',
  changeDir: '/repo/openspec/changes/add-example',
  schemaName: 'spec-driven',
  progress: {
    total: 1,
    complete: 0,
    remaining: 1,
  },
  tasks: [
    {
      id: '1',
      description: 'Do the work',
      done: false,
    },
  ],
  state: 'ready',
  instruction: 'Read context files and apply the change.',
  references: referenceIndex,
  evidence: {
    command: 'instructions apply',
    success: true,
    stdout: '{"changeName":"add-example"}',
    stderr: '',
    exitCode: 0,
    payload: { changeName: 'add-example' },
    diagnostics: [],
    selector: { store: 'shared' },
    root: { path: '/repo', source: 'store', store_id: 'shared' },
  },
} as const

describe('ApplyInstructionsSchema', () => {
  it('accepts OpenSpec CLI 1.3 contextFiles arrays', () => {
    const parsed = ApplyInstructionsSchema.parse({
      ...baseApplyInstructions,
      contextFiles: {
        proposal: ['/repo/openspec/changes/add-example/proposal.md'],
        specs: [
          '/repo/openspec/changes/add-example/specs/alpha/spec.md',
          '/repo/openspec/changes/add-example/specs/beta/spec.md',
        ],
        tasks: ['/repo/openspec/changes/add-example/tasks.md'],
      },
    })

    expect(parsed.contextFiles).toEqual({
      proposal: ['/repo/openspec/changes/add-example/proposal.md'],
      specs: [
        '/repo/openspec/changes/add-example/specs/alpha/spec.md',
        '/repo/openspec/changes/add-example/specs/beta/spec.md',
      ],
      tasks: ['/repo/openspec/changes/add-example/tasks.md'],
    })
    expect(parsed).not.toHaveProperty('progress')
    expect(parsed.applyInstructionProgress).toMatchObject({
      source: 'openspec-instructions-apply',
      total: 1,
      complete: 0,
      remaining: 1,
      state: 'ready',
      divergence: null,
    })
    expect(parsed.references).toEqual(referenceIndex)
  })

  it('keeps CLI Apply progress authoritative when the actionable task list is shorter', () => {
    // OpenSpec 1.8/1.9 count indented and blank-description checkboxes in
    // progress while `tasks` hides blank-description entries. The projection
    // must preserve the CLI denominator, never recompute it from tasks.length.
    const parsed = ApplyInstructionsSchema.parse({
      ...baseApplyInstructions,
      contextFiles: {},
      progress: { total: 3, complete: 1, remaining: 2 },
      tasks: [
        { id: '1', description: 'Plan the migration', done: true },
        {
          id: '2',
          description: 'Nested sub-task counted by progress',
          done: false,
        },
      ],
    })

    expect(parsed.tasks).toHaveLength(2)
    expect(parsed.applyInstructionProgress).toMatchObject({
      source: 'openspec-instructions-apply',
      total: 3,
      complete: 1,
      remaining: 2,
      state: 'ready',
    })
    expect(parsed.applyInstructionProgress.total).not.toBe(parsed.tasks.length)
  })

  it('normalizes legacy contextFiles strings to arrays', () => {
    const parsed = ApplyInstructionsSchema.parse({
      ...baseApplyInstructions,
      contextFiles: {
        proposal: '/repo/openspec/changes/add-example/proposal.md',
        specs: '/repo/openspec/changes/add-example/specs/alpha/spec.md',
        tasks: '/repo/openspec/changes/add-example/tasks.md',
      },
    })

    expect(parsed.contextFiles).toEqual({
      proposal: ['/repo/openspec/changes/add-example/proposal.md'],
      specs: ['/repo/openspec/changes/add-example/specs/alpha/spec.md'],
      tasks: ['/repo/openspec/changes/add-example/tasks.md'],
    })
  })

  it('requires matching full Apply CLI evidence', () => {
    expect(() =>
      ApplyInstructionsSchema.parse({
        ...baseApplyInstructions,
        contextFiles: {},
        evidence: { ...baseApplyInstructions.evidence, command: 'instructions' },
      })
    ).toThrow(/instructions apply/)
  })

  it('preserves project context and Apply operation guidance', () => {
    const parsed = ApplyInstructionsSchema.parse({
      ...baseApplyInstructions,
      contextFiles: {},
      context: 'Authentication changes require a threat model.',
      operationGuidance: ['Run security-focused tests before completion.'],
    })

    expect(parsed.context).toBe('Authentication changes require a threat model.')
    expect(parsed.operationGuidance).toEqual(['Run security-focused tests before completion.'])
  })

  it('preserves OpenSpec 1.13 ready-state warnings and missingPrerequisites verbatim', () => {
    // Executed `instructions apply --change no-specs-but-tasks --json` from the
    // npm-published 1.13.0 executable (references/openspec-1.13.0-report.md,
    // Verified CLI observations, scenario 2): a ready change whose conditional
    // specs/design artifacts were never built and which has no delta specs.
    const parsed = ApplyInstructionsSchema.parse({
      ...baseApplyInstructions,
      changeName: 'no-specs-but-tasks',
      changeDir: '/private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks',
      contextFiles: {
        proposal: [
          '/private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks/proposal.md',
        ],
        tasks: ['/private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks/tasks.md'],
      },
      progress: { total: 2, complete: 1, remaining: 1 },
      tasks: [
        { id: '1', description: 'First task done', done: true },
        { id: '2', description: 'Second task pending', done: false },
      ],
      missingPrerequisites: ['specs', 'design'],
      warnings: [
        'This change has no delta specs and does not declare `skip_specs: true`, so `openspec validate no-specs-but-tasks` fails on it. Write the delta specs before implementing (`openspec instructions specs --change no-specs-but-tasks`), or add `skip_specs: true` to /private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks/.openspec.yaml if this change really changes no specified behavior.',
      ],
    })

    expect(parsed.warnings).toEqual([
      'This change has no delta specs and does not declare `skip_specs: true`, so `openspec validate no-specs-but-tasks` fails on it. Write the delta specs before implementing (`openspec instructions specs --change no-specs-but-tasks`), or add `skip_specs: true` to /private/tmp/os113-slice2.SykHfF/openspec/changes/no-specs-but-tasks/.openspec.yaml if this change really changes no specified behavior.',
    ])
    expect(parsed.missingPrerequisites).toEqual(['specs', 'design'])
    // Evidence fields never rewrite the readiness or progress semantics.
    expect(parsed.state).toBe('ready')
    expect(parsed.applyInstructionProgress).toMatchObject({
      total: 2,
      complete: 1,
      remaining: 1,
      state: 'ready',
    })
  })

  it('keeps both OpenSpec 1.13 Apply fields absent without synthesizing empty arrays', () => {
    const parsed = ApplyInstructionsSchema.parse({
      ...baseApplyInstructions,
      contextFiles: {},
    })

    expect(parsed.warnings).toBeUndefined()
    expect(parsed.missingPrerequisites).toBeUndefined()
    expect('warnings' in parsed).toBe(false)
    expect('missingPrerequisites' in parsed).toBe(false)
  })

  it('preserves OpenSpec 1.13.2 tracking evidence verbatim without gating', () => {
    // 1.13.2 `instructions apply --json` with one unreadable matched tracking file:
    // the upstream state chain excludes `all_done` while evidence is unavailable, so
    // a still-readable workload settles at `ready`; the members are evidence only and
    // must not touch the local progress authority.
    const unavailableTrackingFiles = [
      {
        path: '/repo/openspec/changes/add-example/tasks.md',
        reason: "EACCES: permission denied, open '/repo/openspec/changes/add-example/tasks.md'",
      },
    ]
    const parsed = ApplyInstructionsSchema.parse({
      ...baseApplyInstructions,
      contextFiles: {},
      taskTrackingConfigured: true,
      unavailableTrackingFiles,
    })

    expect(parsed.taskTrackingConfigured).toBe(true)
    expect(parsed.unavailableTrackingFiles).toEqual(unavailableTrackingFiles)
    expect(parsed.unavailableTrackingFiles?.[0]?.path).toBe(
      '/repo/openspec/changes/add-example/tasks.md'
    )
    expect(parsed.unavailableTrackingFiles?.[0]?.reason).toContain('EACCES')
    // No gating: the payload's own state and the derived progress stay exactly what
    // they were without the members.
    expect(parsed.state).toBe('ready')
    expect(parsed.applyInstructionProgress).toMatchObject({
      source: 'openspec-instructions-apply',
      total: 1,
      complete: 0,
      remaining: 1,
      state: 'ready',
      divergence: null,
    })
  })

  it('keeps both tracking members absent on pre-1.13.2 payloads without synthesizing', () => {
    // 1.13.0/1.13.1 payloads (also admitted by the compat window) never emit the
    // members: the projection must keep them absent — a synthesized `false` would
    // recode "unknown CLI" as "schema tracks no tasks", and an empty array would
    // fabricate a "everything readable" claim.
    const parsed = ApplyInstructionsSchema.parse({
      ...baseApplyInstructions,
      contextFiles: {},
    })

    expect(parsed.taskTrackingConfigured).toBeUndefined()
    expect('taskTrackingConfigured' in parsed).toBe(false)
    expect(parsed.unavailableTrackingFiles).toBeUndefined()
    expect('unavailableTrackingFiles' in parsed).toBe(false)
  })
})

describe('ArtifactInstructionsSchema', () => {
  it('requires command-specific Artifact CLI evidence', () => {
    const parsed = ArtifactInstructionsSchema.parse({
      changeName: 'add-example',
      artifactId: 'proposal',
      schemaName: 'spec-driven',
      changeDir: '/repo/openspec/changes/add-example',
      outputPath: 'proposal.md',
      description: 'Describe the change.',
      instruction: 'Write the proposal.',
      context: null,
      rules: [],
      template: '# Proposal',
      dependencies: [],
      unlocks: ['design'],
      references: referenceIndex,
      evidence: {
        command: 'instructions',
        success: true,
        stdout: '{"artifactId":"proposal"}',
        stderr: '',
        exitCode: 0,
        payload: { artifactId: 'proposal' },
        diagnostics: [],
        selector: {},
        root: { path: '/repo', source: 'nearest' },
      },
    })

    expect(parsed.evidence).toMatchObject({
      command: 'instructions',
      selector: {},
      root: { source: 'nearest' },
    })
    expect(parsed.references).toEqual(referenceIndex)
  })

  it('preserves skipped dependency satisfaction without a physical path', () => {
    const parsed = ArtifactInstructionsSchema.parse({
      changeName: 'add-example',
      artifactId: 'tasks',
      schemaName: 'spec-driven',
      changeDir: '/repo/openspec/changes/add-example',
      outputPath: 'tasks.md',
      description: 'Track implementation.',
      instruction: 'Write tasks.',
      context: null,
      rules: [],
      template: '# Tasks',
      dependencies: [
        {
          id: 'specs',
          done: true,
          skipped: true,
          path: 'specs/**/*.md',
          description: 'Delta specifications.',
        },
      ],
      unlocks: [],
      evidence: {
        command: 'instructions',
        success: true,
        stdout: '{}',
        stderr: '',
        exitCode: 0,
        payload: {},
        diagnostics: [],
        selector: {},
        root: { path: '/repo', source: 'nearest' },
      },
    })

    expect(parsed.dependencies[0]).toMatchObject({ id: 'specs', done: true, skipped: true })
  })
})

describe('isGlobPattern (OpenSpec 1.13.2 artifact-graph parity)', () => {
  it('keeps recognizing the original wildcard characters as globs', () => {
    expect(isGlobPattern('specs/**/*.md')).toBe(true)
    expect(isGlobPattern('docs/?eadme.md')).toBe(true)
    expect(isGlobPattern('report[1].md')).toBe(true)
  })

  it('recognizes brace expansions containing a comma after upstream 1.13.2', () => {
    expect(isGlobPattern('docs/{api,cli}.md')).toBe(true)
    expect(isGlobPattern('specs/**/{spec,info}.md')).toBe(true)
    // `{a..b}` numeric/alpha ranges use the `..` separator, not `,`.
    expect(isGlobPattern('docs/chapter{1..9}.md')).toBe(true)
  })

  it('recognizes extglob groups after upstream 1.13.2', () => {
    expect(isGlobPattern('!(a|b).md')).toBe(true)
    expect(isGlobPattern('+(x).md')).toBe(true)
    expect(isGlobPattern('@(proposal|design).md')).toBe(true)
  })

  it('normalizes Windows separators before recognizing widened syntax', () => {
    // Upstream normalizes with `toPosixPath` (replace all `\\` with `/`) first, so a
    // Windows-authored output path with a brace expansion is still glob-watched.
    expect(isGlobPattern('C:\\docs\\{a,b}.md')).toBe(true)
  })

  it('keeps literal output filenames literal', () => {
    expect(isGlobPattern('README.md')).toBe(false)
    expect(isGlobPattern('docs/guide.md')).toBe(false)
    expect(isGlobPattern('C:\\docs\\guide.md')).toBe(false)
    // Parentheses without an extglob prefix char stay literal.
    expect(isGlobPattern('notes(v2).md')).toBe(false)
    // A brace group without `,` or `..` has no expansion to watch.
    expect(isGlobPattern('{notes}.md')).toBe(false)
    // An unmatched closer never invents an opening (empty-stack semantics).
    expect(isGlobPattern('a,b}.md')).toBe(false)
  })
})
