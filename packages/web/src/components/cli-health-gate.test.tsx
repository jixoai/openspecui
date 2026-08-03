/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Lock the Web compatibility gate to the OpenSpecUI 7 / CLI 1.7 line.
 * 2. Prove incompatible-version blocking and the current-page-runtime escape hatch.
 * 3. Prove shared Root Context is the gate's only CLI availability truth and refresh is readonly.
 *
 * Original request (2026-07-15): "CLI 1.6 compatibility gate."
 * Original request (2026-07-31): "目前这个版本先给它支持1.7.*，因为基本兼容。"
 * Owner clarification (2026-07-31): "6.* 本身就是适配 1.6.*；对于 1.7 只是兼容而已。"
 * Owner correction (2026-07-31): Root observation refresh uses query transport.
 * Original request (2026-08-01): "v7不兼容1.6.x，明确要求必须使用 v1.7.x。"
 * Owner bypass-lifetime decision (2026-08-01): "仅当前页面会话有效"
 */
import type { RootContext, RootContextState } from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CliHealthGate } from './cli-health-gate'

interface CliAvailability {
  available: boolean
  version?: string
  error?: string
}

let rootState: RootContextState
let config: { cli?: { command?: string; args?: string[] } } | undefined
let rootRefreshCalls = 0

function rootContext(cli: CliAvailability): RootContext {
  return {
    launchProject: { path: '/tmp/project' },
    planningRoot: cli.available
      ? { path: '/tmp/project', source: 'nearest', healthy: true, status: [] }
      : null,
    storeId: null,
    cli,
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/tmp/data/openspec',
      source: 'user-home-default',
      environmentVariable: null,
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

function setAvailability(cli: CliAvailability): void {
  const context = rootContext(cli)
  rootState = cli.available
    ? { state: 'ready', data: context, attempt: null, error: null, observedAt: 1 }
    : {
        state: 'error',
        data: null,
        attempt: context,
        error: { code: 'cli-unavailable', message: cli.error ?? 'CLI unavailable.' },
        observedAt: 1,
      }
}

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => false,
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => ({ data: config }),
}))

vi.mock('@/lib/use-context-subscription', () => ({
  useContextSubscription: () => ({
    data: rootState,
    isLoading: rootState.state === 'loading',
    error: null,
    authority: { state: 'current' },
  }),
  selectRootContextSnapshot: (state: RootContextState | undefined) => {
    if (!state || state.state === 'loading') return null
    return state.state === 'error' ? (state.data ?? state.attempt) : state.data
  },
}))

vi.mock('@/lib/trpc', () => ({
  queryClient: {
    invalidateQueries: async () => undefined,
  },
  trpc: {
    config: {
      getEffectiveCliCommand: {
        queryFilter: () => ({ queryKey: ['config.getEffectiveCliCommand'] }),
      },
    },
  },
  trpcClient: {
    config: {
      update: {
        mutate: async () => ({ success: true }),
      },
    },
    rootContext: {
      refreshProjection: {
        query: async () => {
          rootRefreshCalls += 1
          return { state: 'loading' }
        },
      },
    },
  },
}))

function renderGate() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <CliHealthGate />
    </QueryClientProvider>
  )
}

describe('CliHealthGate', () => {
  beforeEach(() => {
    setAvailability({ available: true, version: '1.7.0' })
    config = undefined
    rootRefreshCalls = 0
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render for current OpenSpec CLI 1.7.x', async () => {
    setAvailability({ available: true, version: '1.7.1' })
    renderGate()

    await waitFor(() => {
      expect(screen.queryByText(/OpenSpec CLI .* Required/)).not.toBeInTheDocument()
      expect(screen.queryByText(/upgrade/)).not.toBeInTheDocument()
    })
  })

  it('blocks OpenSpec CLI 1.6.x in OpenSpecUI 7', async () => {
    setAvailability({ available: true, version: '1.6.1' })

    renderGate()

    expect(await screen.findByText(/OpenSpec CLI >=1.7.0 <1.8.0 Required/)).toBeInTheDocument()
    expect(screen.getByText(/Detected OpenSpec CLI 1.6.1/)).toBeInTheDocument()
  })

  it('offers a skip-version-check escape hatch when the CLI is available', async () => {
    setAvailability({ available: true, version: '1.8.0' })

    renderGate()

    expect(await screen.findByText(/Skip version check/)).toBeInTheDocument()
  })

  it('clears the blocking dialog after skipping the version check for the current runtime', async () => {
    setAvailability({ available: true, version: '1.6.1' })

    const firstRuntime = renderGate()

    const skip = await screen.findByText(/Skip version check/)
    fireEvent.click(skip)

    await waitFor(() => {
      expect(screen.queryByText(/OpenSpec CLI >=1.7.0 <1.8.0 Required/)).not.toBeInTheDocument()
    })

    firstRuntime.unmount()
    renderGate()

    expect(await screen.findByText(/OpenSpec CLI >=1.7.0 <1.8.0 Required/)).toBeInTheDocument()
    expect(screen.getByText(/Detected OpenSpec CLI 1.6.1/)).toBeInTheDocument()
  })

  it('does not offer a skip escape hatch when the CLI is unavailable', async () => {
    setAvailability({ available: false, error: 'command not found' })

    renderGate()

    expect(await screen.findByText(/OpenSpec CLI >=1.7.0 <1.8.0 Required/)).toBeInTheDocument()
    expect(screen.queryByText(/Skip version check/)).not.toBeInTheDocument()
  })

  it('rechecks by invalidating the shared Root Context projection', async () => {
    setAvailability({ available: false, error: 'command not found' })
    renderGate()

    fireEvent.click(await screen.findByRole('button', { name: 'Recheck' }))

    await waitFor(() => expect(rootRefreshCalls).toBe(1))
  })

  it('invalidates the shared Root Context projection after saving an execute path', async () => {
    config = { cli: { command: 'openspec' } }
    setAvailability({ available: false, error: 'command not found' })
    renderGate()

    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: '/opt/openspec/bin/openspec' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(rootRefreshCalls).toBe(1))
  })
})
