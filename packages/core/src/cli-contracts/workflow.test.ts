/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Lock OpenSpec 1.7 Status artifact status and dependency arrays.
 * 2. Lock Apply and Archive operation-instruction payloads at the CLI contract boundary.
 *
 * Original request (2026-08-01): adapt the complete observable OpenSpec 1.7 workflow protocol.
 */
import { describe, expect, it } from 'vitest'
import { CliApplyInstructionsSuccessSchema, CliWorkflowStatusSuccessSchema } from './workflow.js'

const root = { path: '/repo', source: 'nearest' as const }

describe('OpenSpec 1.7 workflow CLI contracts', () => {
  it('preserves skipped artifacts and exact requires edges from Status', () => {
    const parsed = CliWorkflowStatusSuccessSchema.parse({
      changeName: 'skip-specs',
      schemaName: 'spec-driven',
      planningHome: {
        kind: 'repo',
        root: '/repo',
        changesDir: '/repo/openspec/changes',
        defaultSchema: 'spec-driven',
      },
      changeRoot: '/repo/openspec/changes/skip-specs',
      artifactPaths: {
        proposal: {
          outputPath: 'proposal.md',
          resolvedOutputPath: '/repo/openspec/changes/skip-specs/proposal.md',
          existingOutputPaths: ['/repo/openspec/changes/skip-specs/proposal.md'],
        },
        specs: {
          outputPath: 'specs/**/*.md',
          resolvedOutputPath: '/repo/openspec/changes/skip-specs/specs/**/*.md',
          existingOutputPaths: [],
        },
        tasks: {
          outputPath: 'tasks.md',
          resolvedOutputPath: '/repo/openspec/changes/skip-specs/tasks.md',
          existingOutputPaths: [],
        },
      },
      isComplete: false,
      applyRequires: ['tasks'],
      nextSteps: [],
      actionContext: {
        mode: 'repo-local',
        sourceOfTruth: 'repo',
        planningArtifacts: ['proposal', 'specs', 'tasks'],
        linkedContext: [],
        allowedEditRoots: ['/repo'],
        requiresAffectedAreaSelection: false,
        constraints: [],
      },
      artifacts: [
        { id: 'proposal', outputPath: 'proposal.md', status: 'done', requires: [] },
        { id: 'specs', outputPath: 'specs/**/*.md', status: 'skipped', requires: ['proposal'] },
        { id: 'tasks', outputPath: 'tasks.md', status: 'ready', requires: ['specs'] },
      ],
      root,
    })

    expect(parsed.artifacts[1]).toEqual({
      id: 'specs',
      outputPath: 'specs/**/*.md',
      status: 'skipped',
      requires: ['proposal'],
    })
    expect(parsed.artifacts[2]?.requires).toEqual(['specs'])
  })

  it('preserves Apply project context and operation guidance separately', () => {
    const parsed = CliApplyInstructionsSuccessSchema.parse({
      changeName: 'add-auth',
      changeDir: '/repo/openspec/changes/add-auth',
      schemaName: 'spec-driven',
      contextFiles: {},
      progress: { total: 1, complete: 0, remaining: 1 },
      tasks: [{ id: '1', description: 'Implement auth.', done: false }],
      state: 'ready',
      instruction: 'Implement pending tasks.',
      context: 'Authentication changes require a threat model.',
      operationGuidance: ['Run security-focused tests before completion.'],
      root,
    })

    expect(parsed.context).toBe('Authentication changes require a threat model.')
    expect(parsed.operationGuidance).toEqual(['Run security-focused tests before completion.'])
  })
})
