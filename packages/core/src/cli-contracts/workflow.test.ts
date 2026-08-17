/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Lock OpenSpec 1.8/1.9 Status artifact status, dependency arrays, and planning completion.
 * 2. Lock Apply and Archive operation-instruction payloads at the CLI contract boundary.
 * 3. Lock the `schemas --json` success/failure sum type and archived Validate report decoding.
 *
 * Original request (2026-08-01): adapt the complete observable OpenSpec 1.7 workflow protocol.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { describe, expect, it } from 'vitest'
import {
  CliSchemasFailureSchema,
  CliSchemasSchema,
  CliSchemasSuccessSchema,
  isCliSchemasFailure,
} from './schema-resolution.js'
import {
  CliApplyInstructionsSuccessSchema,
  CliArchiveSchema,
  CliValidateSchema,
  CliWorkflowStatusSuccessSchema,
} from './workflow.js'

const root = { path: '/repo', source: 'nearest' as const }

const planningHome = {
  kind: 'repo',
  root: '/repo',
  changesDir: '/repo/openspec/changes',
  defaultSchema: 'spec-driven',
}

const actionContext = {
  mode: 'repo-local',
  sourceOfTruth: 'repo',
  planningArtifacts: ['proposal', 'specs', 'tasks'],
  linkedContext: [],
  allowedEditRoots: ['/repo'],
  requiresAffectedAreaSelection: false,
  constraints: [],
}

function statusPayload(overrides: Record<string, unknown> = {}) {
  return {
    changeName: 'add-auth',
    schemaName: 'spec-driven',
    planningHome,
    changeRoot: '/repo/openspec/changes/add-auth',
    artifactPaths: {},
    isPlanningComplete: false,
    isComplete: false,
    applyRequires: ['tasks'],
    nextSteps: [],
    actionContext,
    artifacts: [],
    root,
    ...overrides,
  }
}

describe('OpenSpec 1.7 workflow CLI contracts', () => {
  it('preserves skipped artifacts and exact requires edges from Status', () => {
    const parsed = CliWorkflowStatusSuccessSchema.parse(
      statusPayload({
        changeName: 'skip-specs',
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
        artifacts: [
          { id: 'proposal', outputPath: 'proposal.md', status: 'done', requires: [] },
          { id: 'specs', outputPath: 'specs/**/*.md', status: 'skipped', requires: ['proposal'] },
          { id: 'tasks', outputPath: 'tasks.md', status: 'ready', requires: ['specs'] },
        ],
      })
    )

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

describe('OpenSpec 1.8/1.9 workflow CLI contracts', () => {
  it('requires the explicit planning-completion fact from Status', () => {
    const parsed = CliWorkflowStatusSuccessSchema.parse(
      statusPayload({ isPlanningComplete: true, isComplete: true })
    )
    expect(parsed.isPlanningComplete).toBe(true)

    expect(
      CliWorkflowStatusSuccessSchema.safeParse(statusPayload({ isPlanningComplete: undefined }))
        .success
    ).toBe(false)
  })

  it('keeps the retained isComplete alias optional as raw CLI evidence', () => {
    const { isComplete, ...withoutAlias } = statusPayload({ isPlanningComplete: false })
    void isComplete
    const parsed = CliWorkflowStatusSuccessSchema.parse(withoutAlias)
    expect(parsed.isPlanningComplete).toBe(false)
    expect(parsed.isComplete).toBeUndefined()
  })

  it('preserves a successful schemas array', () => {
    const payload = [
      {
        name: 'spec-driven',
        description: 'Spec-driven schema.',
        artifacts: ['proposal', 'tasks'],
        source: 'project',
      },
    ]
    const parsed = CliSchemasSchema.parse(payload)
    expect(parsed).toEqual(payload)
    expect(isCliSchemasFailure(parsed)).toBe(false)
    expect(CliSchemasSuccessSchema.safeParse(payload).success).toBe(true)
  })

  it('decodes the 1.9 selected-Root schemas failure envelope without inventing a catalog', () => {
    const envelope = {
      schemas: [],
      root: null,
      status: [
        {
          severity: 'error',
          code: 'root-selection',
          message: 'No openspec project root found.',
        },
      ],
    }
    const parsed = CliSchemasSchema.parse(envelope)
    expect(isCliSchemasFailure(parsed)).toBe(true)
    if (isCliSchemasFailure(parsed)) {
      expect(parsed.root).toBeNull()
      expect(parsed.schemas).toEqual([])
      expect(parsed.status[0]).toMatchObject({
        severity: 'error',
        code: 'root-selection',
      })
    }
    expect(CliSchemasFailureSchema.safeParse(envelope).success).toBe(true)
    // The failure envelope is never a successful schema array.
    expect(CliSchemasSuccessSchema.safeParse(envelope).success).toBe(false)
  })

  it('rejects a schemas failure envelope without diagnostics', () => {
    expect(CliSchemasFailureSchema.safeParse({ schemas: [], root: null, status: [] }).success).toBe(
      false
    )
  })

  it('decodes a 1.9 archived validation report through the ordinary Validate envelope', () => {
    const report = {
      items: [
        {
          id: '2026-01-01-done-change',
          type: 'change',
          valid: false,
          issues: [
            {
              level: 'ERROR',
              path: 'tasks.md',
              message: '2 incomplete tasks (0/2 completed)',
            },
          ],
          durationMs: 4,
        },
      ],
      summary: {
        totals: { items: 1, passed: 0, failed: 1 },
        byType: { change: { items: 1, passed: 0, failed: 1 } },
      },
      version: '1.0',
      root,
    }
    const parsed = CliValidateSchema.parse(report)
    if (!Array.isArray(parsed) && !('status' in parsed)) {
      expect(parsed.items[0]?.valid).toBe(false)
      expect(parsed.items[0]?.issues[0]).toMatchObject({
        level: 'ERROR',
        path: 'tasks.md',
      })
      expect(parsed.summary.totals.failed).toBe(1)
    }
  })

  it('preserves archive retirement warnings as upstream evidence', () => {
    const parsed = CliArchiveSchema.parse({
      archive: {
        change: 'retire-capability',
        archivedAs: '2026-08-15-retire-capability',
        path: '/repo/openspec/changes/archive/2026-08-15-retire-capability',
        specsUpdated: true,
        totals: { added: 0, modified: 0, removed: 3, renamed: 0 },
        warnings: ['Capability spec-code fully retired and removed.'],
      },
      root,
    })
    expect(parsed.archive?.warnings).toEqual(['Capability spec-code fully retired and removed.'])
    expect(parsed.archive?.totals?.removed).toBe(3)
  })

  it('preserves an archive failure payload with diagnostics and no result object', () => {
    const parsed = CliArchiveSchema.parse({
      archive: null,
      root,
      status: [
        {
          severity: 'error',
          code: 'archive-blocked',
          message: 'Scenario loss detected; archiving was refused.',
        },
      ],
    })
    expect(parsed.archive).toBeNull()
    expect(parsed.status?.[0]).toMatchObject({ severity: 'error' })
  })
})
