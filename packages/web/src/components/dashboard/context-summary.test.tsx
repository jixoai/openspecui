/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove Dashboard attributes planning facts to Root Context provenance.
 * 2. Preserve direct Reference diagnostics without inferred health or completeness.
 * 3. Keep Code and distinct Planning Git repositories independently visible.
 * 4. Cover static, loading, stale-error, and Git failure states.
 * 5. Preserve explicit Planning Git identity failure instead of rendering collapse.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 preserves Git binding provenance in Dashboard fixtures.
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 */
import type { GitRepositoryScopes, RootContext, RootContextState } from '@openspecui/core'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardContextSummary } from './context-summary'

const { contextSubscriptionMock, gitScopesMock } = vi.hoisted(() => ({
  contextSubscriptionMock: vi.fn(),
  gitScopesMock: vi.fn(),
}))

vi.mock('@/lib/use-context-subscription', () => ({
  useContextSubscription: contextSubscriptionMock,
  selectRootContextSnapshot: (state: RootContextState | undefined) => {
    if (!state || state.state === 'loading') return null
    return state.state === 'error' ? (state.data ?? state.attempt) : state.data
  },
}))

vi.mock('@/lib/use-git-repository-scope', () => ({
  useGitRepositoryScopes: gitScopesMock,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

function rootContext(overrides: Partial<RootContext> = {}): RootContext {
  return {
    launchProject: { path: '/workspace/code' },
    planningRoot: {
      path: '/workspace/planning',
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
      path: '/data/openspec',
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

function gitScopes(planning = true): GitRepositoryScopes {
  return {
    defaultScope: 'code',
    code: {
      scope: 'code',
      bindingToken: 'code-binding',
      rootPath: '/workspace/code',
      repository: { topLevel: '/repos/code', commonDir: '/repos/code/.git' },
    },
    planningState: 'settled',
    planning: planning
      ? {
          scope: 'planning',
          bindingToken: 'planning-binding',
          rootPath: '/workspace/planning',
          repository: { topLevel: '/repos/planning', commonDir: '/repos/planning/.git' },
        }
      : null,
  }
}

function setContext(
  overrides: Partial<{ data: RootContextState; isLoading: boolean; error: Error | null }> = {}
) {
  contextSubscriptionMock.mockReturnValue({
    data: readyState(),
    isLoading: false,
    error: null,
    ...overrides,
  })
}

function setGit(
  overrides: Partial<{
    data: GitRepositoryScopes
    isLoading: boolean
    error: Error | null
    authority:
      | { state: 'current' }
      | { state: 'waiting'; reason: 'rebind' }
      | { state: 'failed'; error: Error }
  }> = {}
) {
  gitScopesMock.mockReturnValue({
    data: gitScopes(),
    isLoading: false,
    error: null,
    authority: { state: 'current' },
    ...overrides,
  })
}

describe('DashboardContextSummary', () => {
  beforeEach(() => {
    contextSubscriptionMock.mockReset()
    gitScopesMock.mockReset()
    setContext()
    setGit()
  })

  afterEach(() => cleanup())

  it('shows planning path, root source, Store id, and separately scoped Git repositories', () => {
    render(<DashboardContextSummary staticMode={false} />)

    expect(screen.getByText('/workspace/planning')).toBeTruthy()
    expect(screen.getByText('source: store · Store platform')).toBeTruthy()
    expect(screen.getByText('/repos/code')).toBeTruthy()
    expect(screen.getByText(/Distinct Planning repository: \/repos\/planning/)).toBeTruthy()
  })

  it('does not claim Planning is collapsed while its binding is resolving', () => {
    const settled = gitScopes(false)
    const resolving: GitRepositoryScopes = {
      defaultScope: settled.defaultScope,
      code: settled.code,
      planningState: 'resolving',
      planning: null,
    }
    setGit({ data: resolving })

    render(<DashboardContextSummary staticMode={false} />)

    expect(screen.getByText('Resolving Planning Git repository...')).toBeTruthy()
    expect(screen.queryByText('No distinct Planning Git repository.')).toBeNull()
  })

  it('renders raw direct Reference diagnostic counts without health or completeness claims', () => {
    setContext({
      data: readyState(
        rootContext({
          references: [
            {
              store_id: 'design-system',
              status: [
                { severity: 'error', code: 'missing', message: 'Missing Store.' },
                { severity: 'warning', code: 'stale', message: 'Observation is stale.' },
                { severity: 'info', code: 'observed', message: 'Observed.' },
              ],
            },
            { store_id: 'shared', status: [] },
          ],
        })
      ),
    })

    const { container } = render(<DashboardContextSummary staticMode={false} />)
    const text = container.textContent ?? ''

    expect(text).toContain('design-system')
    expect(text).toContain('1 error · 1 warning · 3 total')
    expect(text).toContain('shared')
    expect(text).toContain('No CLI diagnostic')
    expect(text).not.toMatch(/healthy|unhealthy|all references|unreferenced/i)
  })

  it('shows loading, stale Root Context failure, and Git failure independently', () => {
    setContext({ data: undefined, isLoading: true })
    setGit({
      data: undefined,
      isLoading: true,
      error: null,
      authority: { state: 'waiting', reason: 'rebind' },
    })
    const view = render(<DashboardContextSummary staticMode={false} />)
    expect(view.container.querySelector('.rt-skeleton')).not.toBeNull()
    expect(screen.queryByText('Resolving planning root...')).toBeNull()

    setContext({
      data: {
        state: 'error',
        data: rootContext(),
        attempt: rootContext({ planningRoot: null, storeId: null }),
        error: { code: 'root-unresolved', message: 'Planning root unresolved.' },
        observedAt: 2,
      },
      isLoading: false,
    })
    const gitError = new Error('Git scope lookup failed.')
    setGit({ data: undefined, error: gitError, authority: { state: 'failed', error: gitError } })
    view.rerender(<DashboardContextSummary staticMode={false} />)

    expect(screen.getByRole('alert').textContent).toContain('Planning root unresolved.')
    expect(screen.getByText('/workspace/planning')).toBeTruthy()
    expect(screen.getByText('Git scope lookup failed.')).toBeTruthy()
  })

  it('does not subscribe or render in static mode', () => {
    render(<DashboardContextSummary staticMode />)

    expect(screen.queryByLabelText('Dashboard data scopes')).toBeNull()
    expect(contextSubscriptionMock).not.toHaveBeenCalled()
    expect(gitScopesMock).not.toHaveBeenCalled()
  })

  it('states when Planning and Code resolve to one Git repository', () => {
    setGit({ data: gitScopes(false) })
    render(<DashboardContextSummary staticMode={false} />)
    expect(screen.getByText('No distinct Planning Git repository.')).toBeTruthy()
  })

  it('does not render settled-collapse copy when Planning Git identity resolution fails', () => {
    const base = gitScopes(false)
    setGit({
      data: {
        defaultScope: base.defaultScope,
        code: base.code,
        planningState: 'failed',
        planning: null,
        planningError: { message: 'Planning Git identity resolution failed.' },
      },
    })

    render(<DashboardContextSummary staticMode={false} />)

    const gitSection = screen.getByRole('heading', { name: 'Code Git snapshot' }).parentElement
    expect(gitSection?.textContent).toContain('Planning Git repository binding failed:')
    expect(gitSection?.textContent).toContain('Planning Git identity resolution failed.')
    expect(screen.queryByText('No distinct Planning Git repository.')).toBeNull()
  })

  it('surfaces a Git subscription error instead of retained stale scope data', () => {
    const gitError = new Error('Git scope subscription disconnected.')
    setGit({ data: gitScopes(), error: gitError, authority: { state: 'failed', error: gitError } })

    render(<DashboardContextSummary staticMode={false} />)

    expect(screen.getByText('Git scope subscription disconnected.')).toBeInTheDocument()
    expect(screen.queryByText('Distinct Planning repository: /repos/planning')).toBeNull()
  })
})
