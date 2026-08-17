/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Lock workflow mode resolution and generated invocation payloads.
 * 2. Prove Root Context, Manager generation, and explicit Store selectors survive every action boundary.
 * 3. Preserve typed Status/Instructions paths, References, and process diagnostics.
 * 4. Prove project hooks receive and retain the same target/evidence contract.
 * 5. Lock the breaking workflow hook context to protocol v2 and Archive instruction ownership.
 *
 * Original request (2026-07-15): "Change actions preserve CLI-owned evidence end to end."
 */
import type {
  CliApplyInstructions,
  CliArtifactInstructions,
  CliCommandResult,
  CliWorkflowStatus,
  OpenSpecCliContractExecutor,
  OpenSpecUIHooks,
  RootContext,
} from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import type { HookRuntime } from './hook-runtime.js'
import { WorkflowInvocationService } from './workflow-invocation-service.js'

function createRuntime(hooks: OpenSpecUIHooks = {}): HookRuntime {
  return {
    hooksPath: '/planning/openspec/openspecui.hooks.ts',
    load: vi.fn().mockResolvedValue(hooks),
    onDispose: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  }
}

function commandResult<T>(
  data: T,
  overrides: Partial<CliCommandResult<T>> = {}
): CliCommandResult<T> {
  return {
    success: true,
    stdout: JSON.stringify(data),
    stderr: '',
    exitCode: 0,
    data,
    payload: null,
    diagnostics: [],
    ...overrides,
  }
}

function statusFixture(): CliWorkflowStatus {
  return {
    changeName: 'add-auth',
    schemaName: 'spec-driven',
    planningHome: {
      kind: 'repo',
      root: '/planning',
      changesDir: '/planning/openspec/changes',
      defaultSchema: 'spec-driven',
    },
    changeRoot: '/planning/openspec/changes/add-auth',
    artifactPaths: {
      specs: {
        outputPath: 'specs/**/*.md',
        resolvedOutputPath: '/planning/openspec/changes/add-auth/specs/**/*.md',
        existingOutputPaths: [
          '/planning/openspec/changes/add-auth/specs/auth/spec.md',
          '/planning/openspec/changes/add-auth/specs/session/spec.md',
        ],
      },
    },
    isPlanningComplete: true,
    applyRequires: ['specs'],
    nextSteps: ['All planning artifacts are complete; review tasks before implementation.'],
    actionContext: {
      mode: 'repo-local',
      sourceOfTruth: 'repo',
      planningArtifacts: ['specs'],
      linkedContext: [],
      allowedEditRoots: ['/planning'],
      requiresAffectedAreaSelection: false,
      constraints: ['Repo-local edits only.'],
    },
    artifacts: [{ id: 'specs', outputPath: 'specs/**/*.md', status: 'done', requires: [] }],
    root: { path: '/planning', source: 'nearest' },
  }
}

function artifactFixture(): CliArtifactInstructions {
  return {
    changeName: 'add-auth',
    artifactId: 'specs',
    schemaName: 'spec-driven',
    changeDir: '/planning/openspec/changes/add-auth',
    planningHome: {
      kind: 'repo',
      root: '/planning',
      changesDir: '/planning/openspec/changes',
      defaultSchema: 'spec-driven',
    },
    outputPath: 'specs/**/*.md',
    resolvedOutputPath: '/planning/openspec/changes/add-auth/specs/**/*.md',
    existingOutputPaths: ['/planning/openspec/changes/add-auth/specs/auth/spec.md'],
    description: 'Delta specifications.',
    instruction: 'Update existing output files only.',
    context: 'Security-sensitive project.',
    rules: ['Preserve existing scenarios.'],
    template: '# Delta',
    dependencies: [{ id: 'proposal', done: true, path: 'proposal.md', description: 'Why.' }],
    unlocks: [],
    references: [
      {
        store_id: 'platform',
        root: '/stores/platform',
        status: [],
        specs: [{ id: 'identity', summary: 'Shared identity contract.' }],
      },
    ],
    root: { path: '/planning', source: 'store', store_id: 'shared' },
  }
}

function applyFixture(): CliApplyInstructions {
  return {
    changeName: 'add-auth',
    changeDir: '/planning/openspec/changes/add-auth',
    schemaName: 'spec-driven',
    contextFiles: {
      specs: ['/planning/openspec/changes/add-auth/specs/auth/spec.md'],
    },
    progress: { total: 1, complete: 0, remaining: 1 },
    tasks: [{ id: '1', description: 'Implement authentication.', done: false }],
    state: 'ready',
    instruction: 'Implement pending tasks.',
    context: 'Authentication changes require a threat model.',
    operationGuidance: ['Run security-focused tests before completion.'],
    references: [{ store_id: 'platform', root: '/stores/platform', status: [] }],
    root: { path: '/planning', source: 'nearest' },
  }
}

function rootContext(source: 'nearest' | 'declared' | 'store' = 'nearest'): RootContext {
  const storeId = source === 'nearest' ? null : 'shared'
  return {
    launchProject: { path: '/launch' },
    planningRoot: {
      path: '/planning',
      source,
      ...(storeId ? { store_id: storeId } : {}),
      healthy: true,
      status: [],
    },
    storeId,
    cli: { available: true, version: '1.6.0' },
    references: [{ store_id: 'platform', root: '/stores/platform', status: [] }],
    contextMembers: [],
    dataScope: {
      path: '/runtime/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: {
      doctor: {
        success: true,
        stdout: '{"root":{"path":"/planning"}}',
        stderr: '',
        exitCode: 0,
        diagnostics: [],
      },
      context: null,
    },
    observedAt: 1,
  }
}

type WorkflowContracts = Pick<
  OpenSpecCliContractExecutor,
  'workflowStatus' | 'artifactInstructions' | 'applyInstructions' | 'archiveInstructions'
>

function createContracts(): WorkflowContracts {
  return {
    workflowStatus: vi.fn().mockResolvedValue(commandResult(statusFixture())),
    artifactInstructions: vi.fn().mockResolvedValue(commandResult(artifactFixture())),
    applyInstructions: vi.fn().mockResolvedValue(commandResult(applyFixture())),
    archiveInstructions: vi.fn().mockResolvedValue(
      commandResult({
        changeName: 'add-auth',
        context: 'Authentication changes require a threat model.',
        operationGuidance: ['Review the final spec delta before moving the change.'],
        root: { path: '/planning', source: 'nearest' },
      })
    ),
  }
}

function createService(
  options: {
    root?: RootContext
    rootGeneration?: string
    hooks?: OpenSpecUIHooks
    contracts?: WorkflowContracts
  } = {}
) {
  const root = options.root ?? rootContext()
  const contracts = options.contracts ?? createContracts()
  return {
    contracts,
    service: new WorkflowInvocationService({
      getRootContext: () => root,
      rootGeneration: options.rootGeneration ?? 'test-generation',
      hookRuntime: createRuntime(options.hooks),
      contracts,
    }),
  }
}

describe('WorkflowInvocationService', () => {
  it('uses the manager-owned generation rather than Root Context observation time', async () => {
    const { service } = createService({ rootGeneration: 'manager-generation' })

    await expect(
      service.runWorkflow({ action: 'propose', text: 'add auth' }, 'compose')
    ).resolves.toMatchObject({ target: { generation: 'manager-generation', observedAt: 1 } })
  })

  it('builds root-explicit propose compose and command payloads', async () => {
    const { service } = createService()

    await expect(
      service.runWorkflow({ action: 'propose', text: ' add auth ' }, 'compose')
    ).resolves.toMatchObject({
      kind: 'agent-prompt',
      text: expect.stringContaining('planning root (OpenSpec write root): /planning'),
      target: { launchProject: { path: '/launch' }, planningRoot: { path: '/planning' } },
      evidence: null,
    })

    await expect(
      service.runWorkflow({ action: 'propose', text: ' add auth ' }, 'command')
    ).resolves.toMatchObject({
      kind: 'agent-command',
      text: '/opsx:propose add auth',
    })
  })

  it('uses typed Apply output without replacing Reference or progress facts', async () => {
    const { service, contracts } = createService()
    const result = await service.runWorkflow(
      { action: 'apply', changeId: 'add-auth', schema: 'spec-driven' },
      'compose'
    )

    expect(result).toMatchObject({
      kind: 'agent-prompt',
      text: expect.stringContaining('"contextFiles"'),
      evidence: {
        kind: 'apply-instructions',
        options: { schema: 'spec-driven' },
        result: {
          data: {
            progress: { total: 1, complete: 0, remaining: 1 },
            references: [{ store_id: 'platform' }],
          },
        },
      },
    })
    expect(contracts.applyInstructions).toHaveBeenCalledWith('add-auth', {
      schema: 'spec-driven',
    })
    if (result.kind !== 'agent-prompt') throw new Error('Expected an Agent prompt.')
    expect(result.text).toContain('planning root (OpenSpec write root): /planning')
    expect(result.text).toContain('/planning/openspec/changes/add-auth/specs/auth/spec.md')
    expect(result.text).toContain('Authentication changes require a threat model.')
    expect(result.text).toContain('Run security-focused tests before completion.')
    expect(result.text).not.toContain('Preserve existing scenarios.')
    expect(result.text).toContain('Never reconstruct `<launch-project>/openspec`')
  })

  it('preserves explicit Store flags, glob paths, References, and failed process evidence', async () => {
    const artifact = artifactFixture()
    const failed = commandResult(artifact, {
      success: false,
      exitCode: 1,
      stderr: 'instruction warning on stderr',
      diagnostics: [
        {
          severity: 'warning',
          code: 'reference_unresolved',
          message: 'One Reference could not be resolved.',
        },
      ],
    })
    const contracts = createContracts()
    vi.mocked(contracts.artifactInstructions).mockResolvedValue(failed)
    const { service } = createService({ root: rootContext('store'), contracts })

    const result = await service.runWorkflow(
      { action: 'continue', changeId: 'add-auth', artifactId: 'specs', schema: 'custom' },
      'compose'
    )

    expect(contracts.artifactInstructions).toHaveBeenCalledWith('add-auth', 'specs', {
      schema: 'custom',
      store: 'shared',
    })
    expect(result).toMatchObject({
      target: {
        planningRoot: { path: '/planning', source: 'store', store_id: 'shared' },
        rootSelector: { store: 'shared' },
        references: [{ store_id: 'platform' }],
      },
      evidence: {
        kind: 'artifact-instructions',
        result: {
          success: false,
          exitCode: 1,
          stderr: 'instruction warning on stderr',
          data: {
            resolvedOutputPath: '/planning/openspec/changes/add-auth/specs/**/*.md',
            existingOutputPaths: ['/planning/openspec/changes/add-auth/specs/auth/spec.md'],
            references: [{ store_id: 'platform' }],
          },
        },
      },
    })
    expect(result.diagnostics?.map((diagnostic) => diagnostic.message)).toEqual([
      'One Reference could not be resolved.',
      'instruction warning on stderr',
    ])
    if (result.kind !== 'agent-prompt') throw new Error('Expected an Agent prompt.')
    expect(result.text).toContain('/planning/openspec/changes/add-auth/specs/**/*.md')
    expect(result.text).not.toContain('/launch/openspec')
  })

  it('preserves status changeRoot, artifact paths, action context, and Store command mode', async () => {
    const { service, contracts } = createService({ root: rootContext('store') })

    const result = await service.runWorkflow({ action: 'update', changeId: 'add-auth' }, 'command')

    expect(contracts.workflowStatus).toHaveBeenCalledWith('add-auth', { store: 'shared' })
    expect(result).toMatchObject({
      kind: 'agent-command',
      text: '/opsx:update add-auth --store shared',
      evidence: {
        kind: 'workflow-status',
        result: {
          data: {
            changeRoot: '/planning/openspec/changes/add-auth',
            artifactPaths: {
              specs: {
                existingOutputPaths: [
                  '/planning/openspec/changes/add-auth/specs/auth/spec.md',
                  '/planning/openspec/changes/add-auth/specs/session/spec.md',
                ],
              },
            },
            actionContext: { allowedEditRoots: ['/planning'] },
          },
        },
      },
    })
  })

  it('keeps CLI-resolved status paths inside Agent prompts', async () => {
    const { service } = createService({ root: rootContext('store') })

    const result = await service.runWorkflow({ action: 'update', changeId: 'add-auth' }, 'compose')

    expect(result).toMatchObject({ kind: 'agent-prompt' })
    if (result.kind !== 'agent-prompt') throw new Error('Expected an Agent prompt.')
    expect(result.text).toContain('/planning/openspec/changes/add-auth')
    expect(result.text).toContain('/planning/openspec/changes/add-auth/specs/auth/spec.md')
    expect(result.text).toContain('"allowedEditRoots":["/planning"]')
    expect(result.text).toContain('CLI selector: --store shared')
  })

  it.each([
    [
      'update' as const,
      'Update the existing planning artifacts for change add-auth without creating missing artifacts or editing implementation code.',
    ],
    ['sync' as const, 'Sync specs for change add-auth.'],
  ])('keeps %s intent beside raw Status and root evidence', async (action, instruction) => {
    const { service } = createService({ root: rootContext('store') })

    const result = await service.runWorkflow({ action, changeId: 'add-auth' }, 'compose')

    expect(result).toMatchObject({
      kind: 'agent-prompt',
      target: {
        rootSelector: { store: 'shared' },
        rootEvidence: { doctor: { stdout: '{"root":{"path":"/planning"}}' } },
      },
      evidence: { kind: 'workflow-status', options: { store: 'shared' } },
    })
    if (result.kind !== 'agent-prompt') throw new Error('Expected an Agent prompt.')
    expect(result.text).toContain(instruction)
    expect(result.text).toContain('CLI-owned workflow-status evidence:')
    expect(result.text).toContain('"changeRoot":"/planning/openspec/changes/add-auth"')
    expect(result.text).toContain('CLI selector: --store shared')
  })

  it('keeps the resolved Store selector on an existing OPSX command', async () => {
    const { service } = createService({ root: rootContext('store') })

    await expect(
      service.runWorkflow({ action: 'propose', text: '/opsx:propose add-auth' }, 'command')
    ).resolves.toMatchObject({
      kind: 'agent-command',
      text: '/opsx:propose add-auth --store shared',
    })
  })

  it('uses selected-Root Archive Instructions instead of Status evidence', async () => {
    const { service, contracts } = createService({ root: rootContext('declared') })

    const result = await service.runWorkflow({ action: 'archive', changeId: 'add-auth' }, 'compose')

    expect(result).toMatchObject({ kind: 'agent-prompt' })
    if (result.kind !== 'agent-prompt') throw new Error('Expected an Agent prompt.')
    expect(result.text).toContain('launch project (command cwd only): /launch')
    expect(result.text).toContain('planning root (OpenSpec write root): /planning')
    expect(result.text).toContain('Authentication changes require a threat model.')
    expect(result.text).toContain('Review the final spec delta before moving the change.')
    expect(result.text).not.toContain('CLI selector: --store')
    expect(result.text).not.toContain('/launch/openspec')
    expect(contracts.archiveInstructions).toHaveBeenCalledWith('add-auth', {})
    expect(contracts.workflowStatus).not.toHaveBeenCalled()
    expect(result.evidence).toMatchObject({ kind: 'archive-instructions' })
  })

  it('attaches status evidence and Store selection to direct Verify commands', async () => {
    const { service } = createService({ root: rootContext('store') })

    await expect(
      service.runWorkflow({ action: 'verify', changeId: 'add-auth', strict: true }, 'direct')
    ).resolves.toMatchObject({
      kind: 'cli-command',
      args: ['validate', 'add-auth', '--type', 'change', '--strict', '--store', 'shared'],
      evidence: { kind: 'workflow-status', options: { store: 'shared' } },
    })
  })

  it('passes explicit target and default evidence through onRunWorkflow', async () => {
    const observedTargets: string[] = []
    const observedVersions: number[] = []
    const { service } = createService({
      hooks: {
        onRunWorkflow: async (ctx, run) => {
          observedVersions.push(ctx.version)
          observedTargets.push(ctx.target.planningRoot.path)
          const result = await run()
          if (result.kind !== 'agent-prompt') return result
          return { ...result, text: `${result.text}\n\nProject policy appended.` }
        },
      },
    })

    const result = await service.runWorkflow({ action: 'apply', changeId: 'add-auth' }, 'compose')

    expect(observedTargets).toEqual(['/planning'])
    expect(observedVersions).toEqual([2])
    expect(result).toMatchObject({
      kind: 'agent-prompt',
      text: expect.stringContaining('Project policy appended.'),
      evidence: { kind: 'apply-instructions' },
    })
  })

  it('fails open to the same default evidence when onRunWorkflow throws', async () => {
    const { service } = createService({
      hooks: {
        onRunWorkflow: async () => {
          throw new Error('policy daemon unavailable')
        },
      },
    })

    const result = await service.runWorkflow({ action: 'apply', changeId: 'add-auth' }, 'compose')

    expect(result).toMatchObject({
      kind: 'agent-prompt',
      evidence: { kind: 'apply-instructions' },
    })
    expect(result.diagnostics?.at(-1)?.message).toContain('policy daemon unavailable')
  })
})
