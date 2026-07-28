/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Verify Context projects CLI-selected root, Store, launch, and inherited data-scope facts.
 * 2. Verify direct Reference diagnostics remain neutral, read-only, and incomplete-by-design.
 * 3. Verify loading, refreshing, terminal-error, stale-error, and command-evidence states stay distinct.
 * 4. Verify Static Context uses only publication-safe snapshot facts and starts no live owner.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Owner acceptance feedback (2026-07-28): "Static 导出后的 /context 页面没数据。"
 */
import type { ExportSnapshot, RootContext, RootContextState } from '@openspecui/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaticDataProvider } from '../ssg/static-data-context'
import { ContextView } from './context'

const useContextSubscriptionMock = vi.hoisted(() => vi.fn())
const staticMode = vi.hoisted(() => ({ value: false }))

vi.mock('@/lib/static-mode', () => ({
  getInitialData: () => null,
  isStaticMode: () => staticMode.value,
}))

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
    staticMode.value = false
    useContextSubscriptionMock.mockReset()
    setState({})
  })
  afterEach(() => cleanup())

  it('renders loading state while context resolves as a visual skeleton', () => {
    setState({ isLoading: true, data: undefined })
    const { container } = render(<ContextView />)
    // The initial-loading topology is now a visual skeleton (luminance language) rather than routine copy.
    expect(container.querySelector('.rt-skeleton')).not.toBeNull()
    expect(screen.queryByText('Loading context...')).toBeNull()
  })

  it('renders error state with message', () => {
    setState({ error: new Error('boom'), data: undefined })
    render(<ContextView />)
    expect(screen.getByRole('alert').textContent).toContain('boom')
  })

  it('renders terminal transport error instead of unresolved projection Loading', () => {
    setState({
      data: {
        state: 'loading',
        data: null,
        attempt: null,
        error: null,
        observedAt: 0,
      } satisfies RootContextState,
      isLoading: false,
      error: new Error('socket closed'),
    })

    render(<ContextView />)

    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0].textContent).toContain('socket closed')
    expect(screen.queryByText('Loading context...')).toBeNull()
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

    const { container } = render(<ContextView />)

    expect(container.querySelector('.rt-revalidate-cue')).not.toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('updating')
    expect(screen.queryByText('Updating')).toBeNull()
    expect(screen.getByText('/tmp/planning')).toBeTruthy()
  })

  it('renders stale Context separately from the complete failed attempt evidence', () => {
    const stale = rootContext()
    const failedAttempt = rootContext({
      planningRoot: {
        path: '/tmp/attempted-root',
        source: 'declared',
        store_id: 'attempted-store',
        healthy: false,
        status: [],
      },
      storeId: 'attempted-store',
      cli: {
        available: false,
        version: '1.6.0',
        error: 'CLI availability failed',
        effectiveCommand: '/usr/local/bin/openspec',
      },
      diagnostics: {
        root: [
          {
            severity: 'error',
            code: 'attempt_root_unhealthy',
            message: 'Attempted root is unavailable.',
          },
        ],
        doctor: [],
        context: [],
      },
      evidence: {
        doctor: {
          success: false,
          stdout: '{"root":null}',
          stderr: 'attempt doctor stderr',
          exitCode: 2,
          diagnostics: [
            {
              severity: 'error',
              code: 'attempt_doctor_failed',
              message: 'Doctor attempt failed.',
            },
          ],
          contractError: 'attempt doctor contract drift',
        },
        context: {
          success: false,
          stdout: '{"members":[]}',
          stderr: 'attempt context stderr',
          exitCode: 3,
          diagnostics: [
            {
              severity: 'error',
              code: 'attempt_context_failed',
              message: 'Context attempt failed.',
            },
          ],
          contractError: 'attempt context contract drift',
        },
      },
    })
    setState({
      data: {
        state: 'error',
        data: stale,
        attempt: failedAttempt,
        error: { code: 'resolver-failed', message: 'refresh failed' },
        observedAt: stale.observedAt,
      } satisfies RootContextState,
    })

    render(<ContextView />)

    expect(screen.getByRole('alert').textContent).toContain('refresh failed')
    expect(screen.getByText(/Showing the last successful observation/)).toBeTruthy()
    const staleRegion = screen.getByRole('region', { name: 'Last successful Context (stale)' })
    expect(within(staleRegion).getByText('/tmp/planning')).toBeTruthy()

    const attemptRegion = screen.getByRole('region', { name: 'Current failed attempt' })
    const attemptText = attemptRegion.textContent ?? ''
    expect(attemptText).toContain('/tmp/attempted-root')
    expect(attemptText).toContain('declared')
    expect(attemptText).toContain('attempted-store')
    expect(attemptText).toContain('CLI availablefalse')
    expect(attemptText).toContain('exit status2')
    expect(attemptText).toContain('attempt doctor stderr')
    expect(attemptText).toContain('attempt doctor contract drift')
    expect(attemptText).toContain('attempt_doctor_failed')
    expect(attemptText).toContain('exit status3')
    expect(attemptText).toContain('attempt context stderr')
    expect(attemptText).toContain('attempt context contract drift')
    expect(attemptText).toContain('attempt_context_failed')
    expect(attemptText).toContain('attempt_root_unhealthy')
  })

  it('renders one failed attempt as the primary Context when no stale data exists', () => {
    const failedAttempt = rootContext({
      planningRoot: {
        path: '/tmp/only-attempt',
        source: 'implicit',
        healthy: false,
        status: [],
      },
      storeId: null,
    })
    setState({
      data: {
        state: 'error',
        data: null,
        attempt: failedAttempt,
        error: { code: 'root-unresolved', message: 'no writable root resolved' },
        observedAt: failedAttempt.observedAt,
      } satisfies RootContextState,
    })

    render(<ContextView />)

    expect(screen.queryByRole('region', { name: 'Last successful Context (stale)' })).toBeNull()
    const attemptRegions = screen.getAllByRole('region', { name: 'Current failed attempt' })
    expect(attemptRegions).toHaveLength(1)
    expect(within(attemptRegions[0]).getByText('/tmp/only-attempt')).toBeTruthy()
    expect(within(attemptRegions[0]).getByText('Full failed attempt evidence')).toBeTruthy()
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

  it('renders publication-safe Static Context without starting the live subscription', () => {
    staticMode.value = true
    const snapshot: ExportSnapshot = {
      meta: {
        timestamp: '2026-07-28T00:00:00.000Z',
        observedAt: 42,
        version: '6.0.0',
        projectName: 'project-a',
        root: {
          planningRootPath: 'store-a/openspec',
          rootSource: 'store',
          storeId: 'writable-a',
        },
        referencePolicy: {
          kind: 'include',
          referenceSources: [{ storeId: 'shared-reference', state: 'ready', specCount: 2 }],
        },
      },
      dashboard: { specsCount: 2, changesCount: 0, archivesCount: 0 },
      specs: [],
      changes: [],
      archives: [],
    }

    render(
      <StaticDataProvider snapshot={snapshot}>
        <ContextView />
      </StaticDataProvider>
    )

    expect(useContextSubscriptionMock).not.toHaveBeenCalled()
    expect(screen.getByText('project-a')).toBeTruthy()
    expect(screen.getByText('store-a/openspec')).toBeTruthy()
    expect(screen.getByText('writable-a')).toBeTruthy()
    expect(screen.getByText('shared-reference')).toBeTruthy()
    expect(screen.getByText(/2 published Specs/)).toBeTruthy()
    expect(
      screen.getByText(/Runtime CLI evidence, registry, and data scope are not published/)
    ).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/envUri|XDG_DATA_HOME|stdout|stderr/)
  })

  it('does not leak Reference Store identities for an omitted static policy', () => {
    staticMode.value = true
    const snapshot: ExportSnapshot = {
      meta: {
        timestamp: '2026-07-28T00:00:00.000Z',
        observedAt: 42,
        version: '6.0.0',
        projectName: 'project-a',
        root: {
          planningRootPath: 'project-a/openspec',
          rootSource: 'nearest',
          storeId: null,
        },
        referencePolicy: { kind: 'omit', referenceSourceCount: 2 },
      },
      dashboard: { specsCount: 0, changesCount: 0, archivesCount: 0 },
      specs: [],
      changes: [],
      archives: [],
    }

    render(
      <StaticDataProvider snapshot={snapshot}>
        <ContextView />
      </StaticDataProvider>
    )

    expect(screen.getByText(/2 Reference sources were observed and omitted/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('shared-reference')
  })
})
