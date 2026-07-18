/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify Context projects CLI-selected root, Store, launch, and inherited data-scope facts.
 * 2. Verify direct Reference diagnostics remain neutral, read-only, and incomplete-by-design.
 * 3. Verify loading, refreshing, stale-error, and command-evidence states remain observable.
 *
 * Original request (2026-07-18): "replace the project WebUI Stores route with the canonical Context surface."
 */
import type { RootContext, RootContextState } from '@openspecui/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContextView } from './context'

const useContextSubscriptionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-context-subscription', () => ({
  useContextSubscription: useContextSubscriptionMock,
  selectRootContextSnapshot: (state: RootContextState | undefined) => {
    if (!state || state.state === 'loading') return null
    return state.state === 'error' ? (state.data ?? state.attempt) : state.data
  },
}))

function setState(overrides: Partial<{ data: unknown; isLoading: boolean; error: Error | null }>) {
  useContextSubscriptionMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  })
}

function rootContext(overrides: Partial<RootContext> = {}): RootContext {
  return {
    launchProject: { path: '/tmp/launch' },
    planningRoot: {
      path: '/tmp/planning',
      source: 'store',
      store_id: 'platform',
      healthy: true,
      status: [],
    },
    storeId: 'platform',
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/tmp/data/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
    ...overrides,
  }
}

function readyState(context: RootContext = rootContext()): RootContextState {
  return {
    state: 'ready',
    data: context,
    attempt: null,
    error: null,
    observedAt: context.observedAt,
  }
}

describe('ContextView', () => {
  beforeEach(() => {
    useContextSubscriptionMock.mockReset()
    setState({})
  })
  afterEach(() => cleanup())

  it('renders loading state while context resolves', () => {
    setState({ isLoading: true, data: undefined })
    render(<ContextView />)
    expect(screen.getByText('Loading context...')).toBeTruthy()
  })

  it('renders error state with message', () => {
    setState({ error: new Error('boom'), data: undefined })
    render(<ContextView />)
    expect(screen.getByRole('alert').textContent).toContain('boom')
  })

  it('renders refreshing state while retaining the current Context projection', () => {
    const current = rootContext()
    setState({
      data: {
        state: 'refreshing',
        data: current,
        attempt: null,
        error: null,
        observedAt: current.observedAt,
      } satisfies RootContextState,
    })

    render(<ContextView />)

    expect(screen.getByText('Updating')).toBeTruthy()
    expect(screen.getByText('/tmp/planning')).toBeTruthy()
  })

  it('retains stale Context facts beside failed-attempt evidence', () => {
    const stale = rootContext()
    setState({
      data: {
        state: 'error',
        data: stale,
        attempt: rootContext({ planningRoot: null, storeId: null }),
        error: { kind: 'transport', message: 'refresh failed' },
        observedAt: stale.observedAt,
      } satisfies RootContextState,
    })

    render(<ContextView />)

    expect(screen.getByRole('alert').textContent).toContain('refresh failed')
    expect(screen.getByText(/Showing the last successful observation/)).toBeTruthy()
    expect(screen.getByText('/tmp/planning')).toBeTruthy()
  })

  it('uses neutral copy: "no reference currently observed", never "all references"', () => {
    setState({ data: readyState() })
    const { container } = render(<ContextView />)
    const text = container.textContent ?? ''
    // 关键中性约束（AGENTS.md）：绝不说 "all references" / "unreferenced"。
    expect(text).not.toMatch(/all references|unreferenced/i)
    expect(text).toContain('No reference currently observed')
  })

  it('shows planning root when context data is present', () => {
    setState({ data: readyState() })
    const { container } = render(<ContextView />)
    const text = container.textContent ?? ''
    expect(text).toContain('/tmp/planning')
    expect(text).toContain('store')
    expect(text).toContain('platform')
    expect(text).toContain('/tmp/launch')
    expect(text).toContain('/tmp/data/openspec')
  })

  it('states registry is read-only without Store mutations or machine-wide claims', () => {
    setState({ data: readyState() })
    const { container } = render(<ContextView />)
    const text = container.textContent ?? ''
    // 绝不暗示项目级 registry（AGENTS.md：项目无 project-local registry）。
    expect(text).toContain('does not own a project-local registry')
    expect(text).not.toMatch(/all stores|unregistered stores|machine-wide/i)
    expect(screen.queryByRole('button', { name: /setup|register|remove|unregister/i })).toBeNull()
  })

  it('renders direct Reference diagnostics without claiming completeness', () => {
    setState({
      data: readyState(
        rootContext({
          references: [
            {
              store_id: 'design-system',
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
    })

    const { container } = render(<ContextView />)
    const text = container.textContent ?? ''
    expect(text).toContain('design-system')
    expect(text).toContain('reference_unresolved')
    expect(text).not.toMatch(/all references|unreferenced/i)
  })

  it('retains full Context members and CLI command evidence on demand', () => {
    setState({
      data: readyState(
        rootContext({
          contextMembers: [
            {
              role: 'referenced_store',
              id: 'design-system',
              path: '/stores/design-system',
              status: [],
            },
          ],
          evidence: {
            doctor: {
              success: false,
              stdout: '{"root":null}',
              stderr: 'doctor failed',
              exitCode: 1,
              diagnostics: [],
              contractError: 'root contract drift',
            },
            context: {
              success: true,
              stdout: '{"members":[]}',
              stderr: '',
              exitCode: 0,
              diagnostics: [],
            },
          },
        })
      ),
    })

    render(<ContextView />)

    expect(screen.getByText('Full Root Context evidence')).toBeTruthy()
    expect(screen.getByText(/design-system/)).toBeTruthy()
    expect(screen.getByText('doctor failed')).toBeTruthy()
    expect(screen.getByText('root contract drift')).toBeTruthy()
    expect(screen.getByText('{"root":null}')).toBeTruthy()
  })
})
