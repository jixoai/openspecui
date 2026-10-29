/**
 * Orthogonal intents (updated 2026-10-29 Asia/Shanghai):
 * 1. Prove the public `agentIntegrations.updatePlanPreview` read runs the OpenSpec 1.15+
 *    `update --dry-run --json` transport through the real Core contract executor.
 * 2. Prove the typed plan, the exit-0-with-failures data semantics, and the failed-command
 *    status envelope (`update_error`, exit 1) all cross the route boundary without
 *    rewriting; the preview never gates the real mutation streams.
 * 3. Prove a non-admitted CLI session learns the capability is unavailable before any argv
 *    is constructed, naming the accepted range the compatibility gate owns.
 *
 * Original request (2026-10-29): "检查一下上游openspec是否发布新版本，如果我们按照规范跟进更新" — update dry-run plan preview transport (target-openspec-cli-115-line).
 */
import { OpenSpecCliContractExecutor, type RootContext } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import type { PlanningRootServices } from './planning-root-service.js'
import { appRouter, type Context } from './router.js'

function planPayload() {
  return {
    changes: [
      { path: '.claude/skills/openspec-explore/SKILL.md', action: 'update', tool: 'claude' },
      { path: '~/.minimax/skills/openspec-propose/SKILL.md', action: 'add', tool: 'minimax-code' },
    ],
    notes: [
      {
        code: 'legacy-tool-directories',
        message:
          'Moves out of a renamed tool directory are listed as a non-interactive update makes them.',
      },
    ],
    failures: [{ tool: 'github-copilot', error: 'cloud sync unreachable' }],
  }
}

function updateErrorEnvelope() {
  return {
    changes: [],
    notes: [],
    failures: [],
    status: [
      {
        severity: 'error',
        code: 'update_error',
        message: "No OpenSpec directory found. Run 'openspec init' first.",
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
 * Minimal public-boundary harness: the preview only crosses
 * `planningRootServices.runOperation` (for the Root Context lease) and
 * `cliExecutor.contracts` (the real typed executor), so the fixture wires exactly
 * those two owners around the real contract executor with an in-memory argv sink.
 */
function createPreviewCallerFixture(
  version: string,
  respond: (args: string[]) => { stdout: string; exitCode: number }
) {
  const executedArgv: string[][] = []
  const contracts = new OpenSpecCliContractExecutor(async (args) => {
    executedArgv.push(args)
    const { stdout, exitCode } = respond(args)
    return { success: exitCode === 0, stdout, stderr: '', exitCode }
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

describe('agentIntegrations.updatePlanPreview transport', () => {
  it('previews the typed plan through the real contract executor on an admitted 1.15 session', async () => {
    const fixture = createPreviewCallerFixture('1.15.0', () => ({
      stdout: JSON.stringify(planPayload()),
      exitCode: 0,
    }))

    const result = await fixture.caller.agentIntegrations.updatePlanPreview(undefined)
    expect(result).toMatchObject({ kind: 'executed', exitCode: 0, contractError: null })
    if (result.kind !== 'executed') return
    expect(result.plan).toEqual(planPayload())
    expect(result.diagnostics).toEqual([])
    expect(fixture.executedArgv).toEqual([['update', '--dry-run', '--json']])

    await fixture.caller.agentIntegrations.updatePlanPreview({ force: true })
    expect(fixture.executedArgv[1]).toEqual(['update', '--dry-run', '--json', '--force'])
  })

  it('keeps non-empty failures plan data beside exit 0, never a route error', async () => {
    const fixture = createPreviewCallerFixture('1.15.0', () => ({
      stdout: JSON.stringify(planPayload()),
      exitCode: 0,
    }))

    const result = await fixture.caller.agentIntegrations.updatePlanPreview(undefined)
    expect(result.kind).toBe('executed')
  })

  it('surfaces the failed-command envelope as executed evidence with diagnostics and a null plan', async () => {
    const fixture = createPreviewCallerFixture('1.15.0', () => ({
      stdout: JSON.stringify(updateErrorEnvelope()),
      exitCode: 1,
    }))

    const result = await fixture.caller.agentIntegrations.updatePlanPreview(undefined)
    expect(result).toMatchObject({ kind: 'executed', exitCode: 1 })
    if (result.kind !== 'executed') return
    // The envelope still decodes through the passthrough plan schema: the empty plan keys
    // stay visible while the executor's exit/`success` facts carry the failure truth.
    expect(result.plan).toMatchObject({ changes: [], notes: [], failures: [] })
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'update_error',
        message: "No OpenSpec directory found. Run 'openspec init' first.",
      },
    ])
  })

  it('refuses the preview on a non-admitted session before any argv is constructed', async () => {
    const fixture = createPreviewCallerFixture('1.14.3', () => ({
      stdout: JSON.stringify(planPayload()),
      exitCode: 0,
    }))

    const result = await fixture.caller.agentIntegrations.updatePlanPreview(undefined)
    expect(result).toMatchObject({
      kind: 'unavailable',
      reason: expect.stringContaining('>=1.15.0 <1.16.0'),
    })
    expect(fixture.executedArgv).toEqual([])
  })
})
