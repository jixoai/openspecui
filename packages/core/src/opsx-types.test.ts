/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Verify Apply instruction context-file normalization.
 * 2. Require command-specific CLI evidence on demand-driven instruction leaves.
 * 3. Preserve typed OpenSpec 1.6 Reference indexes on both instruction surfaces.
 * 4. Preserve OpenSpec 1.7 operation inputs and skipped dependency identity.
 *
 * Original request (2026-07-15): "Preserve CLI-provided paths, action context, References, and diagnostics end to end."
 * Original request (2026-07-23): "OPSX Status 不应等待完整 Kernel warmup，且必须保留 CLI evidence。"
 */
import { describe, expect, it } from 'vitest'
import { ApplyInstructionsSchema, ArtifactInstructionsSchema } from './opsx-types.js'

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
