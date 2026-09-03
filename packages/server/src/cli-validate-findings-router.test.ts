/**
 * Orthogonal intents (created 2026-09-03 Asia/Shanghai):
 * 1. Prove the public `cli.validate` findings member runs the OpenSpec 1.12
 *    `validate --report findings` transport through the real Core contract executor.
 * 2. Prove the typed findings document and the `invalid_validation_report_request`
 *    status envelope both pass through the route boundary without rewriting.
 * 3. Prove a non-admitted CLI session is refused before any argv is constructed,
 *    naming the accepted range the compatibility gate owns.
 *
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */
import { OpenSpecCliContractExecutor, type RootContext } from '@openspecui/core'
import { isCliValidateFindings } from '@openspecui/core/openspec-compat'
import { describe, expect, it } from 'vitest'
import type { PlanningRootServices } from './planning-root-service.js'
import { appRouter, type Context } from './router.js'

/**
 * Executed OpenSpec 1.12 findings document (pinned-reference observation, 2026-09-03):
 * the item stays `valid: true` while carrying the merge-conflict INFO finding, so the
 * payload proves INFO is transported verbatim and never re-labeled by decode.
 */
function findingsPayload() {
  return {
    report: {
      kind: 'validation-findings',
      version: '1.0',
      scope: 'changes',
      returnedItems: 1,
      totalItems: 2,
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
      totals: { items: 2, passed: 2, failed: 0 },
      byType: {
        change: { items: 1, passed: 1, failed: 0 },
        spec: { items: 1, passed: 1, failed: 0 },
      },
    },
    root: { path: '/repo', source: 'nearest' },
  }
}

function requestErrorPayload() {
  return {
    status: [
      {
        severity: 'error',
        code: 'invalid_validation_report_request',
        message: 'The findings report requires an explicit bulk scope.',
        fix: 'Use one of --all, --changes, --specs, or --archived with --report findings.',
      },
    ],
  }
}

function rootContextFixture(version: string): RootContext {
  return {
    launchProject: { path: '/launch' },
    planningRoot: { path: '/repo', source: 'nearest' },
    storeId: null,
    cli: { available: true, version },
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

/**
 * Minimal public-boundary harness: the findings member only crosses
 * `planningRootServices.runOperation` (for the Root Context lease) and
 * `cliExecutor.contracts` (the real typed executor), so the fixture wires exactly
 * those two owners around the real contract executor with an in-memory argv sink.
 */
function createFindingsCallerFixture(
  version: string,
  respond: (args: string[]) => { stdout: string; exitCode: number }
) {
  const executedArgv: string[][] = []
  const contracts = new OpenSpecCliContractExecutor(async (args) => {
    executedArgv.push(args)
    const { stdout, exitCode } = respond(args)
    return { success: true, stdout, stderr: '', exitCode }
  })
  const rootContext = rootContextFixture(version)
  const planningRootServices = {
    runOperation: async <T>(task: (services: PlanningRootServices) => Promise<T> | T): Promise<T> =>
      task({ rootContext } as unknown as PlanningRootServices),
  }
  const context = {
    planningRootServices,
    cliExecutor: { contracts },
  } as unknown as Context
  return { caller: appRouter.createCaller(context), executedArgv }
}

describe('cli.validate findings transport', () => {
  it('runs the findings report through the real contract executor on an admitted 1.12 session', async () => {
    const fixture = createFindingsCallerFixture('1.12.0', () => ({
      stdout: JSON.stringify(findingsPayload()),
      exitCode: 0,
    }))

    const result = await fixture.caller.cli.validate({ kind: 'findings', scope: 'changes' })

    // The argv boundary: explicit bulk scope, findings report transport, JSON run —
    // never an item name, and the Store selector stays derived from Root Context.
    expect(fixture.executedArgv).toEqual([
      ['validate', '--changes', '--report', 'findings', '--json'],
    ])
    // The typed chain: the route returns the executor's contract result, and the
    // decoded data is the findings document with INFO preserved verbatim.
    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(isCliValidateFindings(result.data)).toBe(true)
    if (!isCliValidateFindings(result.data)) throw new Error('findings document expected')
    expect(result.data.report).toEqual({
      kind: 'validation-findings',
      version: '1.0',
      scope: 'changes',
      returnedItems: 1,
      totalItems: 2,
    })
    expect(result.data.itemFindings).toHaveLength(1)
    expect(result.data.itemFindings[0]?.issues[0]?.level).toBe('INFO')
    expect(result.data.itemFindings[0]?.issues[0]?.message).toContain(
      'Archive would refuse this delta'
    )
    // Full-run totals stay the CLI's truth beside the filtered view.
    expect(result.data.summary.totals).toEqual({ items: 2, passed: 2, failed: 0 })
  })

  it('maps the archived findings scope onto the archived bulk flag', async () => {
    const fixture = createFindingsCallerFixture('1.12.0', () => ({
      stdout: JSON.stringify(findingsPayload()),
      exitCode: 0,
    }))

    await fixture.caller.cli.validate({ kind: 'findings', scope: 'archived' })

    expect(fixture.executedArgv).toEqual([
      ['validate', '--archived', '--report', 'findings', '--json'],
    ])
  })

  it('passes the typed request-error envelope through without rewriting it as a thrown error', async () => {
    const fixture = createFindingsCallerFixture('1.12.0', () => ({
      stdout: JSON.stringify(requestErrorPayload()),
      exitCode: 1,
    }))

    const result = await fixture.caller.cli.validate({ kind: 'findings', scope: 'changes' })

    // An invalid request is a typed CLI answer (status envelope, exit 1), not a transport
    // failure: the route hands the decoded union back exactly as the executor produced it.
    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(1)
    expect(isCliValidateFindings(result.data)).toBe(false)
    expect(result.data).toEqual(requestErrorPayload())
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid_validation_report_request' }),
      ])
    )
  })

  it('refuses findings on a non-admitted CLI session before any argv is constructed', async () => {
    const fixture = createFindingsCallerFixture('1.11.0', () => ({
      stdout: JSON.stringify(findingsPayload()),
      exitCode: 0,
    }))

    await expect(
      fixture.caller.cli.validate({ kind: 'findings', scope: 'changes' })
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: expect.stringContaining('>=1.12.0 <1.13.0'),
    })
    // The 1.12-only report flag never reaches a spawned CLI process.
    expect(fixture.executedArgv).toEqual([])
  })
})
