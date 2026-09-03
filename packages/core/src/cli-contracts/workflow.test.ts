/**
 * Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
 * 1. Lock OpenSpec 1.8/1.9 Status artifact status, dependency arrays, and planning completion.
 * 2. Lock Apply and Archive operation-instruction payloads at the CLI contract boundary.
 * 3. Lock the `schemas --json` success/failure sum type and archived Validate report decoding.
 * 4. Lock the OpenSpec 1.11 batch Status envelope, `show --diff` contract, capability gates,
 *    and the OpenSpec 1.10 `init --language` argv passthrough.
 * 5. Lock the OpenSpec 1.12 validate findings report beside the full report: filtered
 *    itemFindings, preserved full-run totals, exit-code-free decoding, the empty-scope
 *    success document, and the `invalid_validation_report_request` failure envelope.

 * Original request (2026-08-01): adapt the complete observable OpenSpec 1.7 workflow protocol.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */
import { beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest'
import { CliExecutor, type CliResult } from '../cli-executor.js'
import { ConfigManager } from '../config.js'
import { deriveOpenSpecCliCapabilities, parseOpenSpecCliVersion } from '../openspec-compat.js'
import {
  CliBatchStatusSchema,
  isCliBatchStatusEntryFailure,
  isCliBatchStatusRootSelectionFailure,
} from './batch-status.js'
import { parseCliCommandResult } from './command-result.js'
import { CliDiagnosticFailureSchema } from './common.js'
import { OpenSpecCliContractExecutor } from './executor.js'
import {
  CliSchemasFailureSchema,
  CliSchemasSchema,
  CliSchemasSuccessSchema,
  isCliSchemasFailure,
} from './schema-resolution.js'
import { CliShowChangeDiffSchema, CliShowChangeDiffSuccessSchema } from './show-diff.js'
import {
  CliApplyInstructionsSuccessSchema,
  CliArchiveSchema,
  CliValidateFindingsResultSchema,
  CliValidateFindingsSchema,
  CliValidateReportSchema,
  CliValidateSchema,
  CliWorkflowStatusSuccessSchema,
  isCliValidateFindings,
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

// Admitted-line capabilities under the OpenSpecUI 12 single-series window: stable 1.12.x
// derives the 1.11-introduced batch/diff transports; the retired 1.10/1.11 lines derive none.
const capabilities112 = deriveOpenSpecCliCapabilities(parseOpenSpecCliVersion('1.12.0'))
const capabilities111 = deriveOpenSpecCliCapabilities(parseOpenSpecCliVersion('1.11.0'))
const capabilities110 = deriveOpenSpecCliCapabilities(parseOpenSpecCliVersion('1.10.0'))

function batchEntryPayload(overrides: Record<string, unknown> = {}) {
  const { root: _entryRoot, ...withoutRoot } = statusPayload()
  void _entryRoot
  return { ...withoutRoot, ...overrides }
}

const failedEntryPayload = {
  changeName: 'broken-change',
  status: [
    {
      severity: 'error',
      code: 'change_error',
      message: 'Unknown schema "ghost" referenced by broken-change.',
    },
  ],
}

describe('OpenSpec 1.11 batch Status CLI contract', () => {
  it('decodes healthy batch entries with the envelope-owned root only', () => {
    const parsed = CliBatchStatusSchema.parse({
      changes: [batchEntryPayload()],
      root,
    })

    expect(parsed.changes).toHaveLength(1)
    const entry = parsed.changes[0]
    if (entry === undefined) throw new Error('missing batch entry')
    expect(isCliBatchStatusEntryFailure(entry)).toBe(false)
    expect(entry.changeName).toBe('add-auth')
    expect('root' in entry && entry.root !== undefined).toBe(false)
    expect(parsed.root).toEqual(root)
    expect(parsed.message).toBeUndefined()
  })

  it('decodes an exit-1 partial-failure batch from stdout without consulting the exit code', () => {
    const stdout = JSON.stringify({
      changes: [batchEntryPayload(), failedEntryPayload],
      root,
    })
    // The whole-result success gate (requireCommandData) treats exit 1 as failure;
    // the batch contract must still decode the complete stdout envelope.
    const parsed = parseCliCommandResult(
      { success: false, stdout, stderr: '', exitCode: 1 } satisfies CliResult,
      CliBatchStatusSchema
    )

    expect(parsed.contractError).toBeUndefined()
    expect(parsed.data).not.toBeNull()
    const failure = parsed.data?.changes.find(isCliBatchStatusEntryFailure)
    expect(failure).toEqual(failedEntryPayload)
    const healthy = parsed.data?.changes.find((entry) => !isCliBatchStatusEntryFailure(entry))
    expect(healthy?.changeName).toBe('add-auth')
  })

  it('decodes the empty-set message envelope', () => {
    const parsed = CliBatchStatusSchema.parse({
      changes: [],
      message: 'No active changes.',
      root,
    })

    expect(parsed.changes).toEqual([])
    expect(parsed.message).toBe('No active changes.')
    expect(isCliBatchStatusRootSelectionFailure(parsed)).toBe(false)
  })

  it('preserves the root-selection failure null shape with its diagnostics', () => {
    const envelope = {
      changes: [],
      root: null,
      status: [
        {
          severity: 'error',
          code: 'root-selection',
          message: 'No openspec project root found.',
        },
      ],
    }
    const parsed = CliBatchStatusSchema.parse(envelope)

    expect(parsed.changes).toEqual([])
    expect(parsed.root).toBeNull()
    expect(isCliBatchStatusRootSelectionFailure(parsed)).toBe(true)
    expect(parsed.status?.[0]).toMatchObject({
      severity: 'error',
      code: 'root-selection',
    })
  })

  it('rejects a failure entry without diagnostics', () => {
    expect(
      CliBatchStatusSchema.safeParse({
        changes: [{ changeName: 'broken-change', status: [] }],
        root,
      }).success
    ).toBe(false)
  })
})

describe('OpenSpec 1.11 show --diff CLI contract', () => {
  const diffPayload = {
    id: 'add-auth',
    title: 'Add authentication',
    deltaCount: 2,
    deltas: [
      {
        spec: 'auth',
        operation: 'MODIFIED',
        description: 'Modified requirement body.',
        requirement: {
          text: 'The system SHALL require authentication.',
          scenarios: [{ rawText: '#### Scenario: unauthenticated request' }],
        },
        diff: '@@ -1,4 +1,5 @@\n ### Requirement: Authentication\n-Old line\n+New line',
        warning:
          'Header differs from the main spec\'s "authentication" only in case or spacing; archive matches names exactly, so reconcile them before archiving',
      },
      {
        spec: 'auth',
        operation: 'ADDED',
        description: 'New requirement.',
        requirement: {
          text: 'The system SHALL rate limit logins.',
          scenarios: [{ rawText: '#### Scenario: brute force' }],
        },
      },
    ],
    root,
  }

  it('decodes MODIFIED-only diff and warning fields alongside unchanged other operations', () => {
    const parsed = CliShowChangeDiffSuccessSchema.parse(diffPayload)

    expect(parsed.deltas[0]).toMatchObject({
      spec: 'auth',
      operation: 'MODIFIED',
      diff: expect.stringContaining('@@ -1,4 +1,5 @@'),
    })
    expect(parsed.deltas[0]?.warning).toContain('only in case or spacing')
    expect(parsed.deltas[1]).toMatchObject({ spec: 'auth', operation: 'ADDED' })
    expect(parsed.deltas[1]?.diff).toBeUndefined()
    expect(parsed.deltas[1]?.warning).toBeUndefined()
    expect(parsed.deltaCount).toBe(2)
    expect(parsed.root).toEqual(root)
  })

  it('still decodes a plain show payload without diff evidence', () => {
    const parsed = CliShowChangeDiffSuccessSchema.parse({
      id: 'add-auth',
      title: 'Add authentication',
      deltaCount: 1,
      deltas: [
        {
          spec: 'auth',
          operation: 'RENAMED',
          description: 'Rename a requirement.',
          rename: { from: 'Old name', to: 'New name' },
        },
      ],
      root,
    })

    expect(parsed.deltas[0]?.rename).toEqual({ from: 'Old name', to: 'New name' })
  })

  it('rejects an ADDED delta that carries diff evidence', () => {
    const result = CliShowChangeDiffSuccessSchema.safeParse({
      id: 'add-auth',
      title: 'Add authentication',
      deltaCount: 1,
      deltas: [
        {
          spec: 'auth',
          operation: 'ADDED',
          description: 'New requirement.',
          requirement: {
            text: 'The system SHALL rate limit logins.',
            scenarios: [{ rawText: '#### Scenario: brute force' }],
          },
          diff: '@@ -0,0 +1,2 @@\n+New requirement.',
        },
      ],
      root,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['deltas', 0, 'diff'])
      expect(result.error.issues[0]?.message).toContain(
        'Only MODIFIED deltas carry diff evidence; ADDED deltas never do.'
      )
    }
  })

  it('rejects a REMOVED delta that carries warning evidence', () => {
    const result = CliShowChangeDiffSuccessSchema.safeParse({
      id: 'add-auth',
      title: 'Add authentication',
      deltaCount: 1,
      deltas: [
        {
          spec: 'auth',
          operation: 'REMOVED',
          description: 'Removed requirement.',
          requirement: {
            text: 'The system SHALL require authentication.',
            scenarios: [{ rawText: '#### Scenario: unauthenticated request' }],
          },
          warning: 'No main spec exists at openspec/specs/auth/spec.md',
        },
      ],
      root,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['deltas', 0, 'warning'])
      expect(result.error.issues[0]?.message).toContain(
        'Only MODIFIED deltas carry warning evidence; REMOVED deltas never do.'
      )
    }
  })

  it('keeps the shared diagnostic failure union for unknown items', () => {
    const parsed = CliShowChangeDiffSchema.parse({
      status: [
        {
          severity: 'error',
          code: 'unknown_item',
          message: "Unknown item 'ghost-change'.",
        },
      ],
    })

    expect('deltas' in parsed).toBe(false)
    if (!('deltas' in parsed)) {
      expect(parsed.status[0]).toMatchObject({ code: 'unknown_item' })
    }
  })
})

/**
 * Executed `validate --all --report findings --json` document from the pinned v1.12.0
 * build (references/openspec-1.12.0-report.md): the item stays `valid: true` with one
 * merge-conflict INFO issue and the run exits 0.
 */
const executedFindingsDocument = {
  report: {
    kind: 'validation-findings',
    version: '1.0',
    scope: 'all',
    returnedItems: 1,
    totalItems: 1,
  },
  itemFindings: [
    {
      id: 'test-change',
      type: 'change',
      valid: true,
      issues: [
        {
          level: 'INFO',
          path: 'missing-spec/spec.md',
          message:
            'Archive would refuse this delta: missing-spec: target spec does not exist; only ADDED requirements are allowed for new specs. MODIFIED and RENAMED operations require an existing spec.',
        },
      ],
      durationMs: 19,
    },
  ],
  summary: {
    totals: { items: 1, passed: 1, failed: 0 },
    byType: {
      change: { items: 1, passed: 1, failed: 0 },
      spec: { items: 0, passed: 0, failed: 0 },
    },
  },
  root: { path: '/private/tmp/os112-fixture', source: 'nearest' },
}

describe('OpenSpec 1.12 validate findings CLI contract', () => {
  it('decodes the executed populated findings document with preserved full-run totals', () => {
    const parsed = CliValidateFindingsSchema.parse(executedFindingsDocument)

    expect(parsed.report).toEqual({
      kind: 'validation-findings',
      version: '1.0',
      scope: 'all',
      returnedItems: 1,
      totalItems: 1,
    })
    expect(parsed.itemFindings).toHaveLength(1)
    const finding = parsed.itemFindings[0]
    if (finding === undefined) throw new Error('missing finding')
    expect(finding.id).toBe('test-change')
    expect(finding.type).toBe('change')
    // INFO is verdict-neutral: the item carrying it stays valid.
    expect(finding.valid).toBe(true)
    expect(finding.issues[0]).toMatchObject({
      level: 'INFO',
      path: 'missing-spec/spec.md',
    })
    expect(finding.issues[0]?.message).toContain('Archive would refuse this delta:')
    // summary/root stay the full-report values, not the filtered view.
    expect(parsed.summary.totals).toEqual({ items: 1, passed: 1, failed: 0 })
    expect(parsed.root).toEqual({ path: '/private/tmp/os112-fixture', source: 'nearest' })
  })

  it('keeps the findings document outside every full-report validate schema', () => {
    // Findings is a separate transport, never the full validation truth: the full
    // report union and the diagnostic failure schema must both reject it.
    expect(CliValidateReportSchema.safeParse(executedFindingsDocument).success).toBe(false)
    expect(CliValidateSchema.safeParse(executedFindingsDocument).success).toBe(false)
    expect(CliDiagnosticFailureSchema.safeParse(executedFindingsDocument).success).toBe(false)
  })

  it('decodes the empty-scope findings document as a normal success, not a failure', () => {
    const parsed = CliValidateFindingsResultSchema.parse({
      report: {
        kind: 'validation-findings',
        version: '1.0',
        scope: 'specs',
        returnedItems: 0,
        totalItems: 0,
      },
      itemFindings: [],
      summary: {
        totals: { items: 0, passed: 0, failed: 0 },
        byType: {},
      },
      root,
    })

    expect(isCliValidateFindings(parsed)).toBe(true)
    if (!isCliValidateFindings(parsed)) throw new Error('expected findings document')
    expect(parsed.report.returnedItems).toBe(0)
    expect(parsed.report.totalItems).toBe(0)
    expect(parsed.itemFindings).toEqual([])
    expect(CliDiagnosticFailureSchema.safeParse(parsed).success).toBe(false)
  })

  it('filters itemFindings to items with issues and decodes exit-1 stdout without consulting the exit code', () => {
    // Hand-crafted contract shape: a two-item run whose clean item never enters
    // itemFindings while summary keeps both, and whose failure exits 1.
    const stdout = JSON.stringify({
      report: {
        kind: 'validation-findings',
        version: '1.0',
        scope: 'changes',
        returnedItems: 1,
        totalItems: 2,
      },
      itemFindings: [
        {
          id: 'broken-change',
          type: 'change',
          valid: false,
          issues: [
            { level: 'ERROR', path: 'tasks.md', message: '2 incomplete tasks (0/2 completed).' },
          ],
          durationMs: 4,
        },
      ],
      summary: {
        totals: { items: 2, passed: 1, failed: 1 },
        byType: { change: { items: 2, passed: 1, failed: 1 } },
      },
      root,
    })
    const parsed = parseCliCommandResult(
      { success: false, stdout, stderr: '', exitCode: 1 } satisfies CliResult,
      CliValidateFindingsResultSchema
    )

    expect(parsed.contractError).toBeUndefined()
    const data = parsed.data
    if (data === null || !isCliValidateFindings(data)) {
      throw new Error('expected findings document')
    }
    expect(data.itemFindings.map((finding) => finding.id)).toEqual(['broken-change'])
    expect(data.summary.totals.items).toBe(2)
  })

  it('decodes the invalid_validation_report_request envelope with its fix preserved', () => {
    // Hand-crafted contract shape for the shared status-array failure envelope; the
    // pinned 1.12.0 executable fixtures prove the exact upstream wording later.
    const requestError = {
      status: [
        {
          severity: 'error',
          code: 'invalid_validation_report_request',
          message:
            '--report findings requires one bulk scope (--all, --changes, --specs, or --archived) and no item name.',
          fix: 'Re-run with an explicit bulk scope, for example: openspec validate --all --report findings --json',
        },
      ],
    }
    const parsed = CliValidateFindingsResultSchema.parse(requestError)

    expect(isCliValidateFindings(parsed)).toBe(false)
    if (!isCliValidateFindings(parsed)) {
      expect(parsed.status[0]).toMatchObject({
        severity: 'error',
        code: 'invalid_validation_report_request',
      })
      expect(parsed.status[0]?.fix).toBe(
        'Re-run with an explicit bulk scope, for example: openspec validate --all --report findings --json'
      )
    }
    // The findings document schema never decodes the request-error path.
    expect(CliValidateFindingsSchema.safeParse(requestError).success).toBe(false)
  })
})

describe('OpenSpec 1.12 validate findings contract executor', () => {
  let execute: Mock<(args: string[]) => Promise<CliResult>>
  let contracts: OpenSpecCliContractExecutor

  beforeEach(() => {
    execute = vi.fn(async () => ({
      success: true,
      stdout: JSON.stringify(executedFindingsDocument),
      stderr: '',
      exitCode: 0,
    }))
    contracts = new OpenSpecCliContractExecutor(execute)
  })

  it('decodes a findings document only through the findings report option', async () => {
    const findings = await contracts.validate({
      target: { kind: 'scope', scope: 'all' },
      report: 'findings',
    })

    expect(execute.mock.calls.map(([args]) => args)).toEqual([
      ['validate', '--all', '--report', 'findings', '--json'],
    ])
    expect(findings.contractError).toBeUndefined()
    const findingsData = findings.data
    if (findingsData === null || !isCliValidateFindings(findingsData)) {
      throw new Error('expected findings document')
    }
    expect(findingsData.report.kind).toBe('validation-findings')
    expect(findingsData.report.returnedItems).toBe(1)

    // The same stdout is a contract error without the report option: the full
    // report schema must never swallow a findings document.
    const full = await contracts.validate({ target: { kind: 'scope', scope: 'all' } })
    expect(execute.mock.calls[1]?.[0]).toEqual(['validate', '--all', '--json'])
    expect(full.contractError).toBeDefined()
    expect(full.data).toBeNull()
  })
})

describe('capability-gated 1.11 command argv', () => {
  let execute: Mock<(args: string[]) => Promise<CliResult>>
  let contracts: OpenSpecCliContractExecutor

  beforeEach(() => {
    execute = vi.fn(async () => ({
      success: true,
      stdout: '{}',
      stderr: '',
      exitCode: 0,
    }))
    contracts = new OpenSpecCliContractExecutor(execute)
  })

  it('builds status --all --json argv only for the admitted batch capability', async () => {
    const admitted = await contracts.workflowStatusAll({
      capabilities: capabilities112,
      schema: 'custom',
      store: 'shared',
    })

    expect(admitted.kind).toBe('executed')
    expect(execute.mock.calls.map(([args]) => args)).toEqual([
      ['status', '--all', '--json', '--schema', 'custom', '--store', 'shared'],
    ])

    const refused = await contracts.workflowStatusAll({ capabilities: capabilities111 })
    expect(refused).toEqual({ kind: 'unavailable', capability: 'batchStatus' })
    expect(await contracts.workflowStatusAll({ capabilities: capabilities110 })).toEqual({
      kind: 'unavailable',
      capability: 'batchStatus',
    })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('builds show <change> --json --diff argv only for the admitted diff capability', async () => {
    const admitted = await contracts.showChangeDiff('add-auth', {
      capabilities: capabilities112,
      store: 'shared',
    })

    expect(admitted.kind).toBe('executed')
    expect(execute.mock.calls.map(([args]) => args)).toEqual([
      ['show', 'add-auth', '--json', '--diff', '--store', 'shared'],
    ])

    const refused = await contracts.showChangeDiff('add-auth', { capabilities: capabilities111 })
    expect(refused).toEqual({ kind: 'unavailable', capability: 'requirementDiff' })
    expect(await contracts.showChangeDiff('add-auth', { capabilities: capabilities110 })).toEqual({
      kind: 'unavailable',
      capability: 'requirementDiff',
    })
    expect(execute).toHaveBeenCalledTimes(1)
  })
})

describe('OpenSpec 1.10 init --language argv passthrough', () => {
  let executor: CliExecutor
  let execute: MockInstance<CliExecutor['execute']>
  let executeStream: MockInstance<CliExecutor['executeStream']>

  beforeEach(() => {
    executor = new CliExecutor(new ConfigManager('/project'), '/project')
    execute = vi.spyOn(executor, 'execute').mockResolvedValue({
      success: true,
      stdout: '',
      stderr: '',
      exitCode: 0,
    })
    executeStream = vi.spyOn(executor, 'executeStream').mockReturnValue({
      settled: Promise.resolve({ reason: 'exited', exitCode: 0 }),
      cancel: () => Promise.resolve({ reason: 'cancelled', exitCode: null }),
    })
  })

  it('appends --language to init and initStream argv only for a non-empty value', async () => {
    await executor.init({ tools: 'none', language: 'Chinese' })
    expect(execute.mock.calls[0]?.[0]).toEqual(['init', '--tools', 'none', '--language', 'Chinese'])

    executor.initStream({ tools: 'none', language: 'Chinese' }, () => {})
    expect(executeStream.mock.calls[0]?.[0]).toEqual([
      'init',
      '--tools',
      'none',
      '--language',
      'Chinese',
    ])
  })

  it('omits the language flag when absent or empty', async () => {
    await executor.init({ tools: 'none' })
    executor.initStream({ tools: 'none', language: '' }, () => {})

    expect(execute.mock.calls[0]?.[0]).toEqual(['init', '--tools', 'none'])
    expect(executeStream.mock.calls[0]?.[0]).toEqual(['init', '--tools', 'none'])
  })
})
