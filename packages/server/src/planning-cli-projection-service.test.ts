/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Prove selector-exact isolation, including Reference-content invalidation, and same-identity single-flight.
 * 2. Prove retained A becomes display-only during B and survives a refresh failure.
 * 3. Prove an initial failure publishes no fabricated Planning CLI snapshot.
 * 4. Prove explicit and config-dependent retirement suppress late prior generations.
 * 5. Prove lifecycle Push carries no business data while every Instructions selector remains isolated.
 *
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 * Original request (2026-07-26): "public Pull retains full CliProjection failure evidence."
 */
import {
  CliProjectionCommandError,
  OpenSpecCliContractExecutor,
  RuntimeInvalidationIndex,
  type ArchiveInstructions,
  type ChangeStatus,
  type CliCommandResult,
  type CliProjectionCommandEvidence,
  type CliProjectionNotice,
  type PlanningCliProjectionSelector,
  type RootContext,
} from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createPlanningCliProjectionWorkOwner,
  PlanningCliProjectionService,
  type PlanningCliProjectionServiceOptions,
} from './planning-cli-projection-service.js'
import type { ProjectionWorkIdentity } from './projection-work/index.js'
import { createServerProjectionWorkRuntime } from './projection-work/runtime.js'
import type {
  StoreObservationChange,
  StoreObservationListener,
} from './store-observation-service.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  let rejectPromise: ((reason: unknown) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  if (!resolvePromise || !rejectPromise) throw new Error('Deferred resolver was not initialized.')
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

function createStatus(changeName: string): ChangeStatus {
  return {
    changeName,
    schemaName: 'spec-driven',
    isComplete: false,
    applyRequires: [],
    artifacts: [],
    provenance: { kind: 'static' },
  }
}

function createArchiveInstructions(context: string): ArchiveInstructions {
  return {
    changeName: 'alpha',
    context,
    operationGuidance: [`Guidance for ${context}`],
    evidence: {
      command: 'instructions archive',
      success: true,
      stdout: JSON.stringify({ changeName: 'alpha', context }),
      stderr: '',
      exitCode: 0,
      payload: { changeName: 'alpha', context },
      diagnostics: [],
      selector: { store: 'team' },
      root: { path: '/planning', source: 'store', store_id: 'team' },
    },
  }
}

function createRootContext(): RootContext {
  return {
    launchProject: { path: '/launch' },
    planningRoot: {
      path: '/planning',
      source: 'nearest',
      healthy: true,
      status: [],
    },
    storeId: null,
    generation: 'planning-generation-a',
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/data/openspec',
      source: 'user-home-default',
      environmentVariable: null,
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

function createCommandEvidence(
  payload: CliProjectionCommandEvidence['payload'] = { changes: [] }
): CliProjectionCommandEvidence {
  return {
    success: true,
    stdout: JSON.stringify(payload),
    stderr: '',
    exitCode: 0,
    payload,
    diagnostics: [],
  }
}

function createFixture(
  readStatusProjection: PlanningCliProjectionServiceOptions['kernel']['readStatusProjection'],
  readChangeListProjection: PlanningCliProjectionServiceOptions['kernel']['readChangeListProjection'] = async () => ({
    value: [],
    evidence: createCommandEvidence(),
  }),
  overrides: Partial<
    Pick<PlanningCliProjectionServiceOptions, 'contracts' | 'rootContext' | 'storeObservation'>
  > & { kernel?: Partial<PlanningCliProjectionServiceOptions['kernel']> } = {}
) {
  const runtime = createServerProjectionWorkRuntime()
  const invalidation = new RuntimeInvalidationIndex()
  const kernel: PlanningCliProjectionServiceOptions['kernel'] = {
    readStatusProjection,
    readChangeListProjection,
    readStatusListProjection: async () => ({ value: [], evidence: createCommandEvidence() }),
    readInstructionsProjection: async () => {
      throw new Error('Unexpected instructions projection.')
    },
    readApplyInstructionsProjection: async () => {
      throw new Error('Unexpected apply-instructions projection.')
    },
    readArchiveInstructionsProjection: async () => {
      throw new Error('Unexpected archive-instructions projection.')
    },
    readConfigBundleProjection: async () => {
      throw new Error('Unexpected config-bundle projection.')
    },
    readTemplatesProjection: async () => {
      throw new Error('Unexpected templates projection.')
    },
    readTemplateContentsProjection: async () => {
      throw new Error('Unexpected template-contents projection.')
    },
    ...overrides.kernel,
  }
  const documentService: PlanningCliProjectionServiceOptions['documentService'] = {
    readSpec: async () => {
      throw new Error('Unexpected Spec read.')
    },
    readSpecRaw: async () => {
      throw new Error('Unexpected raw Spec read.')
    },
  }
  const contracts =
    overrides.contracts ??
    new OpenSpecCliContractExecutor(async () => ({
      success: false,
      stdout: '',
      stderr: 'Unexpected CLI contract execution.',
      exitCode: 1,
    }))
  const workOwner = createPlanningCliProjectionWorkOwner(runtime)
  const service = new PlanningCliProjectionService({
    rootContext: overrides.rootContext ?? createRootContext(),
    gitBindingToken: 'planning-binding-a',
    kernel,
    documentService,
    contracts,
    invalidation,
    storeObservation: overrides.storeObservation ?? { subscribe: () => () => {} },
    workOwner,
  })
  return { invalidation, runtime, service, workOwner }
}

const alphaSelector = {
  kind: 'opsx-status',
  change: 'alpha',
} satisfies PlanningCliProjectionSelector

const betaSelector = {
  kind: 'opsx-status',
  change: 'beta',
} satisfies PlanningCliProjectionSelector

function containsBusinessData(notice: CliProjectionNotice): boolean {
  return Object.hasOwn(notice, 'data') || Object.hasOwn(notice, 'error')
}

describe('PlanningCliProjectionService', () => {
  it('publishes only CLI-confirmed owned Specs while file metadata remains auxiliary', async () => {
    const payload = {
      specs: [{ id: 'cli-owned', requirementCount: 4 }],
      root: { path: '/planning', source: 'nearest' as const },
      status: [],
    }
    const executeCli = vi.fn(async () => ({
      success: true,
      stdout: JSON.stringify(payload),
      stderr: '',
      exitCode: 0,
    }))
    const fixture = createFixture(async () => createStatus('unexpected'), undefined, {
      contracts: new OpenSpecCliContractExecutor(executeCli),
    })
    const selector = { kind: 'spec-catalog' } satisfies PlanningCliProjectionSelector
    const subscription = fixture.service.subscribe(selector, () => {})

    try {
      await vi.waitFor(() => {
        expect(fixture.service.read(selector)).toMatchObject({
          state: 'ready',
          data: {
            kind: 'spec-catalog',
            value: {
              entries: [
                {
                  identity: { kind: 'owned', specId: 'cli-owned' },
                  name: 'cli-owned',
                  requirementCount: 4,
                  updatedAt: 0,
                },
              ],
              ownedProjection: {
                provenance: 'live',
                root: payload.root,
                evidence: { payload },
              },
            },
          },
        })
      })
      expect(executeCli).toHaveBeenCalledWith(['list', '--specs', '--json'])
    } finally {
      subscription.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('retains typed CLI Change-list evidence in Pull while Push carries lifecycle only', async () => {
    const evidence = createCommandEvidence({
      changes: [{ name: 'cli-owned' }],
      root: { path: '/planning', source: 'nearest' },
    })
    const fixture = createFixture(
      async () => createStatus('unexpected'),
      async () => ({ value: ['cli-owned'], evidence })
    )
    const selector = { kind: 'opsx-change-list' } satisfies PlanningCliProjectionSelector
    const notices: CliProjectionNotice[] = []
    const subscription = fixture.service.subscribe(selector, (notice) => notices.push(notice))

    try {
      await vi.waitFor(() => {
        expect(fixture.service.read(selector)).toMatchObject({
          state: 'ready',
          data: { kind: 'opsx-change-list', value: ['cli-owned'], evidence },
        })
      })
      expect(notices.length).toBeGreaterThan(0)
      expect(notices.every((notice) => !containsBusinessData(notice))).toBe(true)
    } finally {
      subscription.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('does not rerun selector Work for unrelated broad project/context invalidation', async () => {
    let reads = 0
    const fixture = createFixture(async () => {
      reads += 1
      return createStatus('alpha')
    })
    const subscription = fixture.service.subscribe(alphaSelector, () => {})

    try {
      await vi.waitFor(() => expect(reads).toBe(1))
      fixture.invalidation.invalidate(['project', 'context'])
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(reads).toBe(1)
      expect(fixture.service.read(alphaSelector)).toMatchObject({
        state: 'ready',
        workGeneration: 1,
      })
    } finally {
      subscription.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('retires every config-dependent current-root Work generation before replacement data can publish', async () => {
    const initial = createDeferred<ChangeStatus>()
    const replacement = createDeferred<ChangeStatus>()
    let reads = 0
    const fixture = createFixture(async () => {
      reads += 1
      return reads === 1 ? initial.promise : replacement.promise
    })
    const subscription = fixture.service.subscribe(alphaSelector, () => {})

    try {
      await vi.waitFor(() => expect(reads).toBe(1))
      fixture.service.invalidateConfigDependentWork()
      expect(fixture.service.read(alphaSelector)).toMatchObject({
        state: 'loading',
        invalidationCause: 'dependency',
        workGeneration: 2,
      })

      initial.resolve(createStatus('retired-config-a'))
      await vi.waitFor(() => expect(reads).toBe(2))
      expect(fixture.service.read(alphaSelector)).toMatchObject({
        state: 'loading',
        invalidationCause: 'dependency',
        workGeneration: 2,
      })

      replacement.resolve(createStatus('current-config-b'))
      await vi.waitFor(() => {
        expect(fixture.service.read(alphaSelector)).toMatchObject({
          state: 'ready',
          invalidationCause: 'dependency',
          data: { value: { changeName: 'current-config-b' } },
          workGeneration: 2,
          snapshotGeneration: 2,
        })
      })
    } finally {
      subscription.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('invalidates only Reference-dependent Planning CLI selectors for a relevant Spec edit', () => {
    const listeners: StoreObservationListener[] = []
    const rootContext: RootContext = {
      ...createRootContext(),
      storeId: 'team',
      references: [{ store_id: 'platform', root: '/stores/platform', status: [] }],
    }
    const fixture = createFixture(async () => createStatus('unused'), undefined, {
      rootContext,
      storeObservation: {
        subscribe: (listener) => {
          listeners.push(listener)
          return () => {}
        },
      },
    })
    const invalidateMatching = vi.spyOn(fixture.workOwner.registry, 'invalidateMatching')
    const change: StoreObservationChange = {
      kind: 'spec-root',
      storeId: 'platform',
      generation: 2,
    }

    for (const listener of listeners) listener(change)

    expect(invalidateMatching).toHaveBeenCalledOnce()
    const matcher = invalidateMatching.mock.calls[0]?.[0]
    if (!matcher) throw new Error('Reference invalidation matcher was not installed.')
    const identity = (selector: string): ProjectionWorkIdentity => ({
      projectionKind: 'planning-cli',
      planningRoot: {
        identity: '/planning',
        source: 'nearest',
        storeSelector: 'team',
      },
      owner: { generation: 'planning-generation-a', gitBindingToken: null },
      selector,
      inputFingerprint: selector,
      protocolVersion: 1,
    })

    expect(
      [
        'spec-catalog',
        'spec-document',
        'opsx-instructions',
        'opsx-apply-instructions',
        'opsx-archive-instructions',
      ].map((selector) => [selector, matcher(identity(selector))])
    ).toEqual([
      ['spec-catalog', true],
      ['spec-document', true],
      ['opsx-instructions', true],
      ['opsx-apply-instructions', true],
      ['opsx-archive-instructions', true],
    ])
    expect(
      [
        'opsx-status',
        'opsx-change-list',
        'opsx-status-list',
        'opsx-config-bundle',
        'opsx-templates',
        'opsx-template-contents',
      ].map((selector) => [selector, matcher(identity(selector))])
    ).toEqual([
      ['opsx-status', false],
      ['opsx-change-list', false],
      ['opsx-status-list', false],
      ['opsx-config-bundle', false],
      ['opsx-templates', false],
      ['opsx-template-contents', false],
    ])

    fixture.service.dispose()
    fixture.runtime.clear()
  })

  it('isolates selectors while exact duplicate subscribers join one in-flight read', async () => {
    const alpha = createDeferred<ChangeStatus>()
    const beta = createDeferred<ChangeStatus>()
    const reads: string[] = []
    const fixture = createFixture(async (change) => {
      reads.push(change)
      if (change === 'alpha') return alpha.promise
      if (change === 'beta') return beta.promise
      throw new Error(`Unexpected change selector: ${change}`)
    })
    const notices: CliProjectionNotice[] = []
    const alphaFirst = fixture.service.subscribe(alphaSelector, (notice) => notices.push(notice))
    const alphaSecond = fixture.service.subscribe(alphaSelector, (notice) => notices.push(notice))

    try {
      await vi.waitFor(() => expect(reads).toEqual(['alpha']))
      alpha.resolve(createStatus('alpha'))
      await vi.waitFor(() => {
        expect(fixture.service.read(alphaSelector)).toMatchObject({
          state: 'ready',
          invalidationCause: 'initial',
          data: { kind: 'opsx-status', value: { changeName: 'alpha' } },
        })
      })

      const betaSubscription = fixture.service.subscribe(betaSelector, (notice) =>
        notices.push(notice)
      )
      try {
        await vi.waitFor(() => expect(reads).toEqual(['alpha', 'beta']))
        beta.resolve(createStatus('beta'))
        await vi.waitFor(() => {
          expect(fixture.service.read(betaSelector)).toMatchObject({
            state: 'ready',
            invalidationCause: 'initial',
            data: { kind: 'opsx-status', value: { changeName: 'beta' } },
          })
        })

        expect(fixture.service.read(alphaSelector).identity).not.toBe(
          fixture.service.read(betaSelector).identity
        )
        expect(reads).toEqual(['alpha', 'beta'])
        expect(notices.every((notice) => !containsBusinessData(notice))).toBe(true)
      } finally {
        betaSubscription.unsubscribe()
      }
    } finally {
      alphaFirst.unsubscribe()
      alphaSecond.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('retains ready A as display-only while B runs and after B fails', async () => {
    const replacement = createDeferred<ChangeStatus>()
    const notices: CliProjectionNotice[] = []
    let reads = 0
    const fixture = createFixture(async () => {
      reads += 1
      return reads === 1 ? createStatus('ready-a') : replacement.promise
    })
    const subscription = fixture.service.subscribe(alphaSelector, (notice) => notices.push(notice))

    try {
      await vi.waitFor(() => {
        expect(fixture.service.read(alphaSelector)).toMatchObject({
          state: 'ready',
          invalidationCause: 'initial',
          data: { value: { changeName: 'ready-a' } },
          freshness: 'current',
          workGeneration: 1,
          snapshotGeneration: 1,
        })
      })

      expect(fixture.service.refresh(alphaSelector)).toMatchObject({
        state: 'revalidating',
        invalidationCause: 'explicit-refresh',
        data: { value: { changeName: 'ready-a' } },
        freshness: 'stale-display-only',
        workGeneration: 2,
        snapshotGeneration: 1,
      })
      await vi.waitFor(() => expect(reads).toBe(2))

      replacement.reject(new Error('replacement B failed'))
      await vi.waitFor(() => {
        expect(fixture.service.read(alphaSelector)).toMatchObject({
          state: 'refresh-error',
          invalidationCause: 'explicit-refresh',
          data: { value: { changeName: 'ready-a' } },
          freshness: 'stale-display-only',
          workGeneration: 2,
          snapshotGeneration: 1,
          error: { name: 'Error', message: 'replacement B failed', cliEvidence: null },
        })
      })
      expect(notices.every((notice) => !containsBusinessData(notice))).toBe(true)
    } finally {
      subscription.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('retains Archive inputs through refresh failure and publishes only recovered current authority', async () => {
    const replacement = createDeferred<ArchiveInstructions>()
    const recovery = createDeferred<ArchiveInstructions>()
    let reads = 0
    const fixture = createFixture(async () => createStatus('unused'), undefined, {
      kernel: {
        readArchiveInstructionsProjection: async () => {
          reads += 1
          if (reads === 1) return createArchiveInstructions('Root A context')
          if (reads === 2) return replacement.promise
          return recovery.promise
        },
      },
    })
    const selector = {
      kind: 'opsx-archive-instructions' as const,
      change: 'alpha',
    }
    const subscription = fixture.service.subscribe(selector, () => {})

    try {
      await vi.waitFor(() => {
        expect(fixture.service.read(selector)).toMatchObject({
          state: 'ready',
          freshness: 'current',
          data: {
            rootGeneration: 'planning-generation-a',
            value: { context: 'Root A context' },
          },
          workGeneration: 1,
        })
      })

      expect(fixture.service.refresh(selector)).toMatchObject({
        state: 'revalidating',
        freshness: 'stale-display-only',
        data: { value: { context: 'Root A context' } },
        workGeneration: 2,
      })
      replacement.reject(new Error('Root B archive inputs failed'))

      await vi.waitFor(() => {
        expect(fixture.service.read(selector)).toMatchObject({
          state: 'refresh-error',
          freshness: 'stale-display-only',
          data: { value: { context: 'Root A context' } },
          error: { message: 'Root B archive inputs failed' },
          workGeneration: 2,
        })
      })

      expect(fixture.service.refresh(selector)).toMatchObject({
        state: 'revalidating',
        freshness: 'stale-display-only',
        workGeneration: 3,
      })
      recovery.resolve(createArchiveInstructions('Root C context'))

      await vi.waitFor(() => {
        expect(fixture.service.read(selector)).toMatchObject({
          state: 'ready',
          freshness: 'current',
          data: { value: { context: 'Root C context' } },
          workGeneration: 3,
          snapshotGeneration: 3,
        })
      })
    } finally {
      subscription.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('exposes an initial failure without a fabricated snapshot', async () => {
    const fixture = createFixture(async () => {
      throw new TypeError('initial projection failed')
    })
    const notices: CliProjectionNotice[] = []
    const subscription = fixture.service.subscribe(alphaSelector, (notice) => notices.push(notice))

    try {
      await vi.waitFor(() => {
        expect(fixture.service.read(alphaSelector)).toMatchObject({
          state: 'error',
          invalidationCause: 'initial',
          data: null,
          freshness: null,
          workGeneration: 1,
          snapshotGeneration: null,
          error: {
            name: 'TypeError',
            message: 'initial projection failed',
            cliEvidence: null,
          },
        })
      })
      expect(notices.every((notice) => !containsBusinessData(notice))).toBe(true)
    } finally {
      subscription.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('retains complete CLI command evidence in Pull while Push exposes only lifecycle cause', async () => {
    const diagnostic = {
      severity: 'error' as const,
      code: 'INVALID_STATUS',
      message: 'Status payload is invalid.',
      target: 'alpha',
      fix: 'Repair the status document.',
    }
    const commandResult = {
      success: false,
      stdout:
        '{"status":[{"severity":"error","code":"INVALID_STATUS","message":"Status payload is invalid."}]}',
      stderr: 'openspec status failed\n',
      exitCode: 7,
      data: { mustNotReplacePayload: true },
      payload: { status: [diagnostic] },
      diagnostics: [diagnostic],
      contractError: 'status: expected a valid Change status payload',
    } satisfies CliCommandResult<unknown>
    const fixture = createFixture(async () => {
      throw new CliProjectionCommandError('OpenSpec status failed.', commandResult)
    })
    const notices: CliProjectionNotice[] = []
    const subscription = fixture.service.subscribe(alphaSelector, (notice) => notices.push(notice))

    try {
      await vi.waitFor(() => {
        expect(fixture.service.read(alphaSelector)).toMatchObject({
          state: 'error',
          invalidationCause: 'initial',
          data: null,
          freshness: null,
          snapshotGeneration: null,
          error: {
            name: 'CliProjectionCommandError',
            message: 'OpenSpec status failed.',
            cliEvidence: {
              success: false,
              stdout: commandResult.stdout,
              stderr: 'openspec status failed\n',
              exitCode: 7,
              payload: { status: [diagnostic] },
              diagnostics: [diagnostic],
              contractError: 'status: expected a valid Change status payload',
            },
          },
        })
      })
      expect(notices).toContainEqual(
        expect.objectContaining({ state: 'error', invalidationCause: 'initial' })
      )
      expect(notices.every((notice) => !containsBusinessData(notice))).toBe(true)
      expect(
        notices.every(
          (notice) =>
            Object.keys(notice).sort().join(',') ===
            'identity,invalidationCause,snapshotGeneration,state,workGeneration'
        )
      ).toBe(true)
    } finally {
      subscription.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('suppresses late A after refresh retires its generation', async () => {
    const initial = createDeferred<ChangeStatus>()
    const replacement = createDeferred<ChangeStatus>()
    let reads = 0
    const fixture = createFixture(async () => {
      reads += 1
      return reads === 1 ? initial.promise : replacement.promise
    })
    const subscription = fixture.service.subscribe(alphaSelector, () => {})

    try {
      await vi.waitFor(() => expect(reads).toBe(1))
      expect(fixture.service.refresh(alphaSelector)).toMatchObject({
        state: 'loading',
        invalidationCause: 'explicit-refresh',
        data: null,
        workGeneration: 2,
      })

      initial.resolve(createStatus('retired-a'))
      await vi.waitFor(() => expect(reads).toBe(2))
      expect(fixture.service.read(alphaSelector)).toMatchObject({
        state: 'loading',
        invalidationCause: 'explicit-refresh',
        data: null,
        workGeneration: 2,
      })

      replacement.resolve(createStatus('current-b'))
      await vi.waitFor(() => {
        expect(fixture.service.read(alphaSelector)).toMatchObject({
          state: 'ready',
          invalidationCause: 'explicit-refresh',
          data: { value: { changeName: 'current-b' } },
          workGeneration: 2,
          snapshotGeneration: 2,
        })
      })
    } finally {
      subscription.unsubscribe()
      fixture.runtime.clear()
    }
  })
})
