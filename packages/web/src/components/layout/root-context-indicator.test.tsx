/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove the global shell keeps Planning direct and Launch identity in accessible detail.
 * 2. Prove loading, refresh, and failure remain visible while provenance stays compact.
 *
 * Original request (2026-07-15): "One project backend has one launch project and one CLI-selected writable planning root."
 * Original request (2026-07-28): restore 5.x-like clarity while keeping 6.x context facts retrievable.
 */
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RootContextIndicator } from './root-context-indicator'

const contextSubscriptionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/static-mode', () => ({ isStaticMode: () => false }))

vi.mock('@/lib/use-context-subscription', () => ({
  useContextSubscription: contextSubscriptionMock,
  selectRootContextSnapshot: (
    state: { state: string; data: unknown; attempt?: unknown } | undefined
  ) => {
    if (!state || state.state === 'loading') return null
    return state.state === 'error' ? (state.data ?? state.attempt ?? null) : state.data
  },
}))

vi.mock('@/components/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    to,
    children,
    ...props
  }: { to: string; children?: ReactNode } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

function rootContext() {
  return {
    launchProject: { path: '/workspace/code-app' },
    planningRoot: {
      path: '/stores/shared-planning',
      source: 'store' as const,
      store_id: 'shared',
      healthy: true,
      status: [],
    },
    storeId: 'shared',
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/data/openspec',
      source: 'xdg-data-home' as const,
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

function readySubscription() {
  const context = rootContext()
  return {
    data: { state: 'ready', data: context, attempt: null, error: null, observedAt: 1 },
    isLoading: false,
    error: null,
  }
}

describe('RootContextIndicator', () => {
  beforeEach(() => {
    contextSubscriptionMock.mockReset()
    contextSubscriptionMock.mockReturnValue(readySubscription())
  })
  afterEach(() => cleanup())

  it('keeps Planning direct while Launch stays in the expanded link accessible name', () => {
    render(<RootContextIndicator variant="sidebar" />)

    expect(screen.getByText('Planning')).toBeTruthy()
    expect(screen.getByText('shared-planning')).toBeTruthy()
    expect(screen.getByText('store · shared')).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: 'Open Root Context. Launch: code-app. Planning: shared-planning.',
      })
    ).toHaveAttribute('href', '/context')
    expect(screen.queryByText('Launch')).toBeNull()
    expect(screen.queryByText('code-app')).toBeNull()
  })

  it('keeps the full identity in the collapsed link accessible name', () => {
    render(<RootContextIndicator variant="sidebar" collapsed />)

    expect(
      screen.getByRole('link', {
        name: 'Open Root Context. Launch: code-app. Planning: shared-planning.',
      })
    ).toBeTruthy()
    expect(screen.queryByText('Launch')).toBeNull()
  })

  it('keeps Planning direct and Launch accessible in the mobile header', () => {
    render(<RootContextIndicator variant="mobile" />)

    expect(screen.getByText('shared-planning')).toBeTruthy()
    expect(screen.queryByText('code-app')).toBeNull()
    expect(
      screen.getByRole('link', {
        name: 'Open Root Context. Launch: code-app. Planning: shared-planning.',
      })
    ).toBeTruthy()
  })

  it('shows the failed attempt identity without treating it as ready', () => {
    const context = rootContext()
    contextSubscriptionMock.mockReturnValue({
      data: {
        state: 'error',
        data: null,
        attempt: context,
        error: { code: 'root-unhealthy', message: 'Root is unhealthy.' },
        observedAt: 2,
      },
      isLoading: false,
      error: null,
    })

    const { container } = render(<RootContextIndicator variant="sidebar" />)

    expect(screen.getByText('shared-planning')).toBeTruthy()
    expect(container.querySelector('.text-destructive')).toBeTruthy()
  })
})
