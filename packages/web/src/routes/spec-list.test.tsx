/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove duplicate Catalog ids navigate through source-distinct compound links.
 * 2. Prove Owned is the default and Referenced entries group by Store.
 * 3. Prove Referenced groups remain visibly read-only with a neutral empty state.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpecList } from './spec-list'

const { locationState, useSpecsSubscriptionMock } = vi.hoisted(() => ({
  locationState: { current: null as Record<string, unknown> | null },
  useSpecsSubscriptionMock: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ state: locationState.current }),
}))

vi.mock('@/lib/use-subscription', () => ({
  useSpecsSubscription: useSpecsSubscriptionMock,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    to,
    params,
    children,
    state: _state,
    vt: _vt,
    ...props
  }: {
    to: string
    params: Record<string, string>
    children?: ReactNode
    state?: unknown
    vt?: unknown
  } & Omit<ComponentProps<'a'>, 'href'>) => {
    const href = Object.entries(params).reduce(
      (path, [name, value]) => path.replace(`$${name}`, encodeURIComponent(value)),
      to
    )
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

describe('SpecList', () => {
  beforeEach(() => {
    locationState.current = null
    useSpecsSubscriptionMock.mockReset()
  })
  afterEach(() => cleanup())

  function setCatalog(entries: unknown[], referenceSources: unknown[] = []) {
    useSpecsSubscriptionMock.mockReturnValue({
      data: {
        observedAt: 1,
        entries,
        referenceSources,
      },
      isLoading: false,
      error: null,
    })
  }

  it('defaults to Owned, then groups duplicate referenced ids by Store', () => {
    setCatalog(
      [
        {
          identity: { kind: 'owned', specId: 'auth' },
          source: 'owned',
          readOnly: false,
          name: 'Owned Auth',
          summary: null,
          updatedAt: 1,
        },
        {
          identity: { kind: 'referenced', storeId: 'platform-a', specId: 'auth' },
          source: 'referenced',
          readOnly: true,
          name: 'auth',
          summary: 'Platform A auth',
          updatedAt: 0,
        },
        {
          identity: { kind: 'referenced', storeId: 'platform-b', specId: 'auth' },
          source: 'referenced',
          readOnly: true,
          name: 'auth',
          summary: 'Platform B auth',
          updatedAt: 0,
        },
      ],
      [
        {
          storeId: 'platform-a',
          state: 'ready',
          diagnostics: [],
          evidence: { success: true, stdout: '{}', stderr: '', exitCode: 0, diagnostics: [] },
        },
        {
          storeId: 'platform-b',
          state: 'ready',
          diagnostics: [],
          evidence: { success: true, stdout: '{}', stderr: '', exitCode: 0, diagnostics: [] },
        },
      ]
    )

    render(<SpecList />)

    expect(screen.getByRole('tab', { name: 'Owned 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('link', { name: /Owned Auth/ }).getAttribute('href')).toBe(
      '/specs/owned/auth'
    )
    expect(screen.queryByRole('link', { name: /Platform A auth/ })).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Referenced 2' }))

    expect(screen.queryByRole('link', { name: /Owned Auth/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'platform-a' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'platform-b' })).toBeTruthy()
    expect(screen.getAllByText('Read-only')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /Platform A auth/ }).getAttribute('href')).toBe(
      '/specs/referenced/platform-a/auth'
    )
    expect(screen.getByRole('link', { name: /Platform B auth/ }).getAttribute('href')).toBe(
      '/specs/referenced/platform-b/auth'
    )
  })

  it('uses source-specific neutral empty states', () => {
    setCatalog([])
    render(<SpecList />)

    expect(screen.getByText('No Owned Specs found in the current Planning root.')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Referenced 0' }))
    expect(screen.getByText('No Referenced Specs currently observed.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/all references|unreferenced/i)
  })

  it('restores the Referenced list scope after returning from a referenced detail', () => {
    locationState.current = { __specListScope: 'referenced' }
    setCatalog(
      [
        {
          identity: { kind: 'referenced', storeId: 'platform-b', specId: 'auth' },
          source: 'referenced',
          readOnly: true,
          name: 'auth',
          summary: 'Platform B auth',
          updatedAt: 0,
        },
      ],
      [
        {
          storeId: 'platform-b',
          state: 'ready',
          diagnostics: [],
          evidence: { success: true, stdout: '{}', stderr: '', exitCode: 0, diagnostics: [] },
        },
      ]
    )

    render(<SpecList />)

    expect(screen.getByRole('tab', { name: 'Referenced 1' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('link', { name: /Platform B auth/ }).getAttribute('href')).toBe(
      '/specs/referenced/platform-b/auth'
    )
  })

  it('keeps failed Store enumeration evidence visible beside healthy sources', () => {
    setCatalog(
      [],
      [
        {
          storeId: 'broken',
          state: 'error',
          diagnostics: [
            {
              severity: 'warning',
              code: 'reference_root_unhealthy',
              message: 'Store root is unhealthy.',
            },
          ],
          evidence: {
            success: false,
            stdout: '{}',
            stderr: 'Store is unavailable.',
            exitCode: 1,
            diagnostics: [],
          },
        },
      ]
    )

    render(<SpecList />)
    fireEvent.click(screen.getByRole('tab', { name: 'Referenced 0' }))

    expect(screen.getByRole('heading', { name: 'broken' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('reference_root_unhealthy')
    expect(screen.getByRole('alert').textContent).toContain('Store is unavailable.')
    expect(screen.queryByText('No Referenced Specs currently observed.')).toBeNull()
  })
})
