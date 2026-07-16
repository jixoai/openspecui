import { describe, expect, it, vi } from 'vitest'
import type {
  CliCommandResult,
  CliContext,
  CliDoctor,
  CliRootSelector,
} from './cli-contracts/index.js'
import {
  getRootContextCliSelector,
  resolveRootContext,
  type RootContext,
  type RootContextCli,
  type RootContextCliAvailability,
} from './root-context.js'

function commandResult<T>(data: T, overrides: Partial<CliCommandResult<T>> = {}) {
  return {
    success: true,
    stdout: JSON.stringify(data),
    stderr: '',
    exitCode: 0,
    data,
    payload: data,
    diagnostics: [],
    ...overrides,
  } satisfies CliCommandResult<T>
}

function healthyDoctor(overrides: Partial<CliDoctor> = {}): CliDoctor {
  return {
    root: { path: '/planning', source: 'nearest', healthy: true, status: [] },
    store: null,
    references: [],
    status: [],
    ...overrides,
  }
}

function healthyContext(overrides: Partial<CliContext> = {}): CliContext {
  return {
    root: { path: '/planning', source: 'nearest', role: 'openspec_root' },
    members: [],
    status: [],
    ...overrides,
  }
}

function createCli(
  options: {
    availability?: RootContextCliAvailability
    doctor?: CliCommandResult<CliDoctor>
    context?: CliCommandResult<CliContext>
  } = {}
): RootContextCli {
  const doctor = options.doctor ?? commandResult(healthyDoctor())
  const context = options.context ?? commandResult(healthyContext())
  return {
    checkAvailability: vi
      .fn()
      .mockResolvedValue(options.availability ?? { available: true, version: '1.6.0' }),
    contracts: {
      doctorRoot: vi.fn(async (_selector?: CliRootSelector) => doctor),
      context: vi.fn(async (_selector?: CliRootSelector) => context),
    },
  }
}

describe('resolveRootContext', () => {
  it('combines launch, root, CLI, Context, Reference, and data-scope facts', async () => {
    const reference = {
      store_id: 'design-system',
      root: '/stores/design-system',
      status: [],
    }
    const cli = createCli({
      doctor: commandResult(
        healthyDoctor({
          root: {
            path: '/stores/platform',
            source: 'declared',
            healthy: true,
            status: [],
          },
          store: {
            id: 'platform',
            metadata: { present: true, valid: true },
            status: [],
          },
          references: [reference],
        })
      ),
      context: commandResult(
        healthyContext({
          root: {
            path: '/stores/platform',
            source: 'declared',
            role: 'openspec_root',
          },
          members: [
            {
              role: 'referenced_store',
              id: 'design-system',
              path: '/stores/design-system',
              status: [],
            },
          ],
        })
      ),
    })

    const state = await resolveRootContext({
      launchProjectDir: '/workspace/app',
      cliExecutor: cli,
      env: { XDG_DATA_HOME: '/runtime/data' },
      platform: 'linux',
      homedir: '/home/test',
      now: () => 123,
    })

    expect(state.state).toBe('ready')
    if (state.state !== 'ready') return
    expect(state.data.launchProject.path).toBe('/workspace/app')
    expect(state.data.planningRoot).toMatchObject({
      path: '/stores/platform',
      source: 'declared',
    })
    expect(state.data.storeId).toBe('platform')
    expect(state.data.references).toEqual([reference])
    expect(state.data.contextMembers[0]?.id).toBe('design-system')
    expect(state.data.cli.version).toBe('1.6.0')
    expect(state.data.dataScope.path).toBe('/runtime/data/openspec')
    expect(state.observedAt).toBe(123)
  })

  it('returns CLI-owned failure evidence when root selection fails', async () => {
    const doctor = healthyDoctor({ root: null })
    const state = await resolveRootContext({
      launchProjectDir: '/workspace/app',
      cliExecutor: createCli({
        doctor: commandResult(doctor, {
          success: false,
          exitCode: 1,
          stderr: 'No OpenSpec root found',
        }),
      }),
      now: () => 456,
    })

    expect(state.state).toBe('error')
    if (state.state !== 'error') return
    expect(state.error).toEqual({
      code: 'doctor-command-failed',
      message: 'No OpenSpec root found',
    })
    expect(state.attempt.evidence.doctor?.exitCode).toBe(1)
    expect(state.attempt.evidence.doctor?.stderr).toBe('No OpenSpec root found')
    expect(state.attempt.planningRoot).toBeNull()
  })

  it('does not treat unresolved Reference diagnostics as ready', async () => {
    const state = await resolveRootContext({
      launchProjectDir: '/workspace/app',
      cliExecutor: createCli({
        doctor: commandResult(
          healthyDoctor({
            references: [
              {
                store_id: 'missing',
                status: [
                  {
                    severity: 'warning',
                    code: 'reference_unresolved',
                    message: 'Reference is not registered.',
                  },
                ],
              },
            ],
          })
        ),
      }),
    })

    expect(state.state).toBe('error')
    if (state.state !== 'error') return
    expect(state.error.code).toBe('references-unresolved')
    expect(state.attempt.references[0]?.status[0]?.code).toBe('reference_unresolved')
  })

  it('reports cross-command root mismatch instead of choosing one silently', async () => {
    const state = await resolveRootContext({
      launchProjectDir: '/workspace/app',
      cliExecutor: createCli({
        context: commandResult(
          healthyContext({
            root: { path: '/other', source: 'nearest', role: 'openspec_root' },
          })
        ),
      }),
    })

    expect(state.state).toBe('error')
    if (state.state !== 'error') return
    expect(state.error.code).toBe('context-root-mismatch')
    expect(state.attempt.planningRoot?.path).toBe('/planning')
    expect(state.attempt.evidence.context?.stdout).toContain('"path":"/other"')
  })

  it('does not execute root commands when CLI availability fails', async () => {
    const cli = createCli({
      availability: { available: false, error: 'openspec not found' },
    })

    const state = await resolveRootContext({
      launchProjectDir: '/workspace/app',
      cliExecutor: cli,
    })

    expect(state.state).toBe('error')
    if (state.state !== 'error') return
    expect(state.error).toEqual({ code: 'cli-unavailable', message: 'openspec not found' })
    expect(cli.contracts.doctorRoot).not.toHaveBeenCalled()
    expect(cli.contracts.context).not.toHaveBeenCalled()
  })
})

describe('getRootContextCliSelector', () => {
  const context = {
    launchProject: { path: '/launch' },
    planningRoot: {
      path: '/planning',
      source: 'nearest',
      healthy: true,
      status: [],
    },
    storeId: null,
    cli: { available: true },
    references: [],
    contextMembers: [],
    dataScope: { path: '/data/openspec', source: 'user-home-default', environmentVariable: null },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  } satisfies RootContext

  it('uses cwd/config selection for nearest and declared roots', () => {
    expect(getRootContextCliSelector(context)).toEqual({})
    expect(
      getRootContextCliSelector({
        ...context,
        planningRoot: { ...context.planningRoot, source: 'declared', store_id: 'shared' },
        storeId: 'shared',
      })
    ).toEqual({})
  })

  it('retains --store only for an explicit Store root', () => {
    expect(
      getRootContextCliSelector({
        ...context,
        planningRoot: { ...context.planningRoot, source: 'store', store_id: 'shared' },
        storeId: 'shared',
      })
    ).toEqual({ store: 'shared' })
  })
})
