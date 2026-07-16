import {
  RuntimeInvalidationIndex,
  type CliCommandResult,
  type CliContext,
  type CliDoctor,
  type CliRootSelector,
  type RootContext,
  type RootContextCli,
  type RootContextResolvedState,
} from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createRootContextSubscription,
  resolveServerRootContext,
  retainStaleRootContext,
} from './root-context-service.js'

function commandResult<T>(data: T): CliCommandResult<T> {
  return {
    success: true,
    stdout: JSON.stringify(data),
    stderr: '',
    exitCode: 0,
    data,
    payload: data,
    diagnostics: [],
  }
}

function createCli(): RootContextCli {
  const doctor: CliDoctor = {
    root: { path: '/planning', source: 'nearest', healthy: true, status: [] },
    store: null,
    references: [],
    status: [],
  }
  const context: CliContext = {
    root: { path: '/planning', source: 'nearest', role: 'openspec_root' },
    members: [],
    status: [],
  }
  return {
    checkAvailability: vi.fn().mockResolvedValue({ available: true, version: '1.6.0' }),
    contracts: {
      doctorRoot: vi.fn(async (_selector?: CliRootSelector) => commandResult(doctor)),
      context: vi.fn(async (_selector?: CliRootSelector) => commandResult(context)),
    },
  }
}

describe('Root Context server projection', () => {
  it('uses the same resolved contract for a query', async () => {
    const state = await resolveServerRootContext({
      projectDir: '/launch',
      cliExecutor: createCli(),
      now: () => 10,
    })

    expect(state.state).toBe('ready')
    if (state.state !== 'ready') return
    expect(state.data.launchProject.path).toBe('/launch')
    expect(state.data.planningRoot?.path).toBe('/planning')
    expect(state.observedAt).toBe(10)
  })

  it('emits loading before the first ready subscription snapshot', async () => {
    const states: string[] = []
    const ready = Promise.withResolvers<void>()
    const subscription = createRootContextSubscription({
      projectDir: '/launch',
      cliExecutor: createCli(),
      runtimeInvalidation: new RuntimeInvalidationIndex(),
      now: () => 20,
    }).subscribe({
      next: (state) => {
        states.push(state.state)
        if (state.state === 'ready') ready.resolve()
      },
      error: ready.reject,
    })

    await ready.promise
    subscription.unsubscribe()
    expect(states.slice(0, 2)).toEqual(['loading', 'ready'])
  })

  it('pulls fresh CLI Context after the runtime context facet is invalidated', async () => {
    const cliExecutor = createCli()
    const runtimeInvalidation = new RuntimeInvalidationIndex()
    const readyStates = Promise.withResolvers<void>()
    let readyCount = 0
    const subscription = createRootContextSubscription({
      projectDir: '/launch',
      cliExecutor,
      runtimeInvalidation,
      now: () => 30,
    }).subscribe({
      next: (state) => {
        if (state.state !== 'ready') return
        readyCount += 1
        if (readyCount === 1) runtimeInvalidation.invalidate(['context'])
        if (readyCount === 2) readyStates.resolve()
      },
      error: readyStates.reject,
    })

    await readyStates.promise
    subscription.unsubscribe()
    expect(cliExecutor.contracts.doctorRoot).toHaveBeenCalledTimes(2)
    expect(cliExecutor.contracts.context).toHaveBeenCalledTimes(2)
  })

  it('retains successful data while exposing the current failed attempt', () => {
    const previous = {
      launchProject: { path: '/launch' },
      planningRoot: { path: '/planning', source: 'nearest', healthy: true, status: [] },
      storeId: null,
      cli: { available: true, version: '1.6.0' },
      references: [],
      contextMembers: [],
      dataScope: {
        path: '/home/test/.local/share/openspec',
        source: 'user-home-default',
        environmentVariable: null,
      },
      diagnostics: { root: [], doctor: [], context: [] },
      evidence: { doctor: null, context: null },
      observedAt: 1,
    } satisfies RootContext
    const failed: RootContextResolvedState = {
      state: 'error',
      data: null,
      attempt: { ...previous, planningRoot: null, observedAt: 2 },
      error: { code: 'root-unresolved', message: 'No root.' },
      observedAt: 2,
    }

    expect(retainStaleRootContext(previous, failed)).toMatchObject({
      state: 'error',
      data: previous,
      attempt: { planningRoot: null, observedAt: 2 },
      error: { code: 'root-unresolved' },
    })
  })
})
