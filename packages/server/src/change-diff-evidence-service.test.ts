/**
 * Orthogonal intents (created 2026-08-28 Asia/Shanghai):
 * 1. Prove the 1.11-gated `show --diff` projection retains per-delta diff/warning and CLI provenance.
 * 2. Prove 1.10, retired, and unavailable-CLI sessions never construct the command (transport count 0).
 * 3. Prove capability refusal, root loss, and command failure project as typed unavailability, not errors.
 * 4. Prove the root Store selector is preserved into the command invocation and display provenance.
 *
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */
import type { CliExecutor, RootContext } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  readChangeDiffEvidence,
  type ChangeDiffEvidenceDeps,
} from './change-diff-evidence-service.js'

function rootContextFixture(input: {
  version?: string
  available?: boolean
  planningRoot?: RootContext['planningRoot']
  storeId?: string | null
}): RootContext {
  return {
    launchProject: { path: '/launch' },
    planningRoot:
      input.planningRoot === undefined ? { path: '/repo', source: 'nearest' } : input.planningRoot,
    storeId: input.storeId ?? null,
    cli: {
      available: input.available ?? true,
      ...(input.version !== undefined ? { version: input.version } : {}),
    },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/data-home',
      source: 'user-home-default',
      environmentVariable: null,
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

function successPayload() {
  return {
    id: 'add-search',
    title: 'Add search',
    deltaCount: 2,
    deltas: [
      {
        spec: 'search',
        operation: 'MODIFIED',
        requirement: { name: 'Keyword search', text: 'The system SHALL search by keyword.' },
        diff: '@@ Requirement: Keyword search @@\n-old line\n+new line\n context',
        warning:
          'No matching requirement was found in the "search" capability. Verify the header matches an existing requirement.',
      },
      { spec: ' glossary ', operation: 'ADDED' },
    ],
    root: { path: '/repo', source: 'store', store_id: 'team-store' },
  }
}

function commandResultFixture(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    stdout: JSON.stringify(data ?? {}),
    stderr: '',
    exitCode: 0,
    data: data ?? null,
    payload: data ?? null,
    diagnostics: [],
    ...overrides,
  }
}

function depsFixture(
  gated: Awaited<ReturnType<CliExecutor['contracts']['showChangeDiff']>>
): ChangeDiffEvidenceDeps & { showChangeDiff: ReturnType<typeof vi.fn> } {
  const showChangeDiff = vi.fn(async () => gated)
  return {
    cliExecutor: { contracts: { showChangeDiff: showChangeDiff as unknown as never } },
    showChangeDiff,
  }
}

describe('readChangeDiffEvidence', () => {
  it('projects MODIFIED delta diff and warning with CLI provenance for an admitted 1.11 session', async () => {
    const deps = depsFixture({
      kind: 'executed',
      result: commandResultFixture(successPayload()),
    })
    const projection = await readChangeDiffEvidence(
      deps,
      rootContextFixture({ version: '1.11.0' }),
      'add-search'
    )

    expect(deps.showChangeDiff).toHaveBeenCalledTimes(1)
    expect(deps.showChangeDiff).toHaveBeenCalledWith('add-search', {
      capabilities: { requirementDiff: true },
    })
    expect(projection).toEqual({
      kind: 'executed',
      deltas: [
        {
          spec: 'search',
          operation: 'MODIFIED',
          diff: '@@ Requirement: Keyword search @@\n-old line\n+new line\n context',
          warning:
            'No matching requirement was found in the "search" capability. Verify the header matches an existing requirement.',
        },
        { spec: ' glossary ', operation: 'ADDED', diff: null, warning: null },
      ],
      provenance: {
        command: 'openspec show add-search --json --diff',
        root: '/repo',
        rootSource: 'store',
        exitCode: 0,
      },
    })
  })

  it('forwards the resolved Store selector into the command and the display provenance', async () => {
    const deps = depsFixture({
      kind: 'executed',
      result: commandResultFixture(successPayload()),
    })
    const projection = await readChangeDiffEvidence(
      deps,
      rootContextFixture({
        version: '1.11.2',
        planningRoot: { path: '/store/repo', source: 'store' },
        storeId: 'team-store',
      }),
      'add-search'
    )

    expect(deps.showChangeDiff).toHaveBeenCalledWith('add-search', {
      capabilities: { requirementDiff: true },
      store: 'team-store',
    })
    expect(projection).toMatchObject({
      kind: 'executed',
      provenance: {
        command: 'openspec show add-search --json --diff --store team-store',
        root: '/repo',
      },
    })
  })

  it('never constructs the command on an admitted 1.10 session and projects capability unavailability', async () => {
    const deps = depsFixture({
      kind: 'executed',
      result: commandResultFixture(successPayload()),
    })
    const projection = await readChangeDiffEvidence(
      deps,
      rootContextFixture({ version: '1.10.0' }),
      'add-search'
    )

    expect(deps.showChangeDiff).toHaveBeenCalledTimes(0)
    expect(projection).toEqual({
      kind: 'unavailable',
      reason: 'capability',
      detectedVersion: '1.10.0',
    })
  })

  it('never constructs the command for a retired or unavailable CLI session', async () => {
    const deps = depsFixture({
      kind: 'executed',
      result: commandResultFixture(successPayload()),
    })
    const retired = await readChangeDiffEvidence(
      deps,
      rootContextFixture({ version: '1.9.3' }),
      'add-search'
    )
    const unavailable = await readChangeDiffEvidence(
      deps,
      rootContextFixture({ available: false }),
      'add-search'
    )

    expect(deps.showChangeDiff).toHaveBeenCalledTimes(0)
    expect(retired).toEqual({ kind: 'unavailable', reason: 'capability', detectedVersion: '1.9.3' })
    expect(unavailable).toEqual({
      kind: 'unavailable',
      reason: 'capability',
      detectedVersion: null,
    })
  })

  it('projects root loss as unavailability without constructing the command', async () => {
    const deps = depsFixture({
      kind: 'executed',
      result: commandResultFixture(successPayload()),
    })
    const projection = await readChangeDiffEvidence(
      deps,
      rootContextFixture({ version: '1.11.0', planningRoot: null }),
      'add-search'
    )

    expect(deps.showChangeDiff).toHaveBeenCalledTimes(0)
    expect(projection).toEqual({ kind: 'unavailable', reason: 'root-unavailable' })
  })

  it('projects an executor capability refusal as unavailability instead of an error', async () => {
    const deps = depsFixture({ kind: 'unavailable', capability: 'requirementDiff' })
    const projection = await readChangeDiffEvidence(
      deps,
      rootContextFixture({ version: '1.11.0' }),
      'add-search'
    )

    expect(projection).toEqual({
      kind: 'unavailable',
      reason: 'capability',
      detectedVersion: '1.11.0',
    })
  })

  it('projects a CLI diagnostic failure payload as unavailability, never as a thrown error', async () => {
    const deps = depsFixture({
      kind: 'executed',
      result: commandResultFixture(
        { status: [{ code: 'FS-001', message: 'No active change found with that name' }] },
        { success: false, exitCode: 1 }
      ),
    })
    const projection = await readChangeDiffEvidence(
      deps,
      rootContextFixture({ version: '1.11.0' }),
      'missing-change'
    )

    expect(projection).toEqual({
      kind: 'unavailable',
      reason: 'command-failed',
      detail: 'FS-001: No active change found with that name',
      exitCode: 1,
    })
  })

  it('projects contract drift and empty stdout as command-failed unavailability', async () => {
    const drift = depsFixture({
      kind: 'executed',
      result: commandResultFixture(null, {
        success: false,
        exitCode: 2,
        stdout: '',
        payload: null,
        contractError: 'deltas: Required',
      }),
    })
    const projection = await readChangeDiffEvidence(
      drift,
      rootContextFixture({ version: '1.11.0' }),
      'add-search'
    )

    expect(projection).toEqual({
      kind: 'unavailable',
      reason: 'command-failed',
      detail: 'deltas: Required',
      exitCode: 2,
    })
  })

  it('retains the near-miss warning beside its diff so one never swallows the other', async () => {
    const payload = successPayload()
    payload.deltas[0].warning =
      'Header differs from the main spec requirement by case or spacing, so archive will not merge it.'
    const deps = depsFixture({
      kind: 'executed',
      result: commandResultFixture(payload),
    })
    const projection = await readChangeDiffEvidence(
      deps,
      rootContextFixture({ version: '1.11.0' }),
      'add-search'
    )

    const delta = projection.kind === 'executed' ? projection.deltas[0] : null
    expect(delta).toMatchObject({
      operation: 'MODIFIED',
      diff: '@@ Requirement: Keyword search @@\n-old line\n+new line\n context',
      warning:
        'Header differs from the main spec requirement by case or spacing, so archive will not merge it.',
    })
  })
})
