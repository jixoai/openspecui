/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove Dashboard omits only the healthy same-root default and otherwise attributes Root provenance.
 * 2. Preserve Reference diagnostics through compact scan status without inferred health.
 * 3. Keep Git detail retrievable while binding failures remain directly visible.
 * 4. Cover static, loading, stale-error, and Git failure states.
 * 5. Preserve explicit Planning Git identity failure instead of rendering collapse.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 preserves Git binding provenance in Dashboard fixtures.
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Original request (2026-07-28): restore 5.x-like clarity while keeping 6.x context facts retrievable.
 * Owner same-root direction (2026-07-29): hide redundant Dashboard context when Launch equals Planning.
 */
import type { GitRepositoryScopes, RootContext, RootContextState } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

  it('keeps the planning path direct and makes source and Git detail keyboard-retrievable', async () => {
    render(<DashboardContextSummary staticMode={false} />)

    expect(screen.getByText('/workspace/planning')).toBeTruthy()
    expect(screen.getByText('Store platform')).toBeTruthy()
    expect(screen.getByText('Git 2 repos')).toBeTruthy()
    expect(screen.queryByText('/repos/code')).toBeNull()

    fireEvent.focus(
      screen.getByRole('note', { name: 'Planning root source store, Store platform' })
    )
    expect(await screen.findByText('Source: store')).toBeTruthy()

    fireEvent.focus(
      screen.getByRole('note', { name: 'Code and distinct Planning Git repositories' })
    )
    expect(await screen.findByText('Code repository: /repos/code')).toBeTruthy()
    expect(await screen.findByText('Distinct Planning repository: /repos/planning')).toBeTruthy()
  })

  it('does not claim Planning is collapsed while its binding is resolving', async () => {
    const settled = gitScopes(false)
    const resolving: GitRepositoryScopes = {
      defaultScope: settled.defaultScope,
      code: settled.code,
      planningState: 'resolving',
      planning: null,
    }
    setGit({ data: resolving })

    render(<DashboardContextSummary staticMode={false} />)

    const badge = screen.getByRole('note', { name: 'Code Git current, Planning Git resolving' })
    expect(badge.textContent).toBe('Git resolving')
    expect(screen.queryByText('No distinct Planning Git repository.')).toBeNull()
    fireEvent.focus(badge)
    expect(await screen.findByText('Resolving Planning Git repository.')).toBeTruthy()
  })

  it('keeps Reference errors direct and full objective counts keyboard-retrievable', async () => {
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

    expect(text).toContain('Reference errors: design-system (1)')
    expect(text).not.toContain('shared: 0 error')
    const badge = screen.getByRole('note', {
      name: '2 direct References, 1 errors, 1 warnings',
    })
    fireEvent.focus(badge)
    expect(await screen.findByText(/design-system: 1 error · 1 warning · 3 total/)).toBeTruthy()
    expect(await screen.findByText(/shared: 0 error · 0 warning · 0 total/)).toBeTruthy()
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

    expect(screen.getByText('Planning root unresolved.')).toBeTruthy()
    expect(screen.getByText('/workspace/planning')).toBeTruthy()
    expect(screen.getByText('Git scope binding failed: Git scope lookup failed.')).toBeTruthy()
  })

  it('does not subscribe or render in static mode', () => {
    render(<DashboardContextSummary staticMode />)

    expect(screen.queryByLabelText('Dashboard data scopes')).toBeNull()
    expect(contextSubscriptionMock).not.toHaveBeenCalled()
    expect(gitScopesMock).not.toHaveBeenCalled()
  })

  it('states on demand when Planning and Code resolve to one Git repository', async () => {
    setGit({ data: gitScopes(false) })
    render(<DashboardContextSummary staticMode={false} />)
    const badge = screen.getByRole('note', { name: 'Code Git repository' })
    expect(badge.textContent).toBe('Git 1 repo')
    expect(screen.queryByText('No distinct Planning Git repository.')).toBeNull()
    fireEvent.focus(badge)
    expect(await screen.findByText('No distinct Planning Git repository.')).toBeTruthy()
  })

  it('omits the entire healthy collapsed context band', () => {
    setContext({
      data: readyState(
        rootContext({
          launchProject: { path: '/workspace/code', physicalPath: '/workspace/code' },
          planningRoot: {
            path: '/workspace/code',
            source: 'nearest',
            healthy: true,
            status: [],
          },
          storeId: null,
        })
      ),
    })
    setGit({ data: gitScopes(false) })

    render(<DashboardContextSummary staticMode={false} />)

    expect(screen.queryByLabelText('Dashboard data scopes')).toBeNull()
  })

  it('restores collapsed context for References and refresh', () => {
    const collapsed = rootContext({
      launchProject: { path: '/workspace/code', physicalPath: '/workspace/code' },
      planningRoot: {
        path: '/workspace/code',
        source: 'nearest',
        healthy: true,
        status: [],
      },
      storeId: null,
    })
    setGit({ data: gitScopes(false) })
    setContext({
      data: readyState({
        ...collapsed,
        references: [{ store_id: 'shared', status: [] }],
      }),
    })
    const view = render(<DashboardContextSummary staticMode={false} />)
    expect(screen.getByLabelText('Dashboard data scopes')).toBeVisible()
    expect(screen.getByText('References 1')).toBeVisible()

    setContext({
      data: {
        state: 'refreshing',
        data: collapsed,
        attempt: null,
        error: null,
        observedAt: 2,
      },
    })
    view.rerender(<DashboardContextSummary staticMode={false} />)
    expect(screen.getByLabelText('Dashboard data scopes')).toBeVisible()
    expect(view.container.querySelector('.rt-revalidate-cue')).not.toBeNull()
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

    expect(
      screen.getByText('Git scope binding failed: Planning Git identity resolution failed.')
    ).toBeTruthy()
    expect(screen.queryByText('No distinct Planning Git repository.')).toBeNull()
  })

  it('surfaces a Git subscription error instead of retained stale scope data', () => {
    const gitError = new Error('Git scope subscription disconnected.')
    setGit({ data: gitScopes(), error: gitError, authority: { state: 'failed', error: gitError } })

    render(<DashboardContextSummary staticMode={false} />)

    expect(
      screen.getByText('Git scope binding failed: Git scope subscription disconnected.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Distinct Planning repository: /repos/planning')).toBeNull()
  })
})
