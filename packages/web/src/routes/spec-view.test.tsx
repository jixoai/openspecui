/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove Owned routes render local Markdown and Reference routes render exact read-only CLI data.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 */
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpecView } from './spec-view'

const { locationState, paramsState, useSpecDocumentSubscriptionMock, markdownViewerMock } =
  vi.hoisted(() => ({
    locationState: { current: null as Record<string, unknown> | null },
    paramsState: { current: { specId: 'auth' } as { specId: string; storeId?: string } },
    useSpecDocumentSubscriptionMock: vi.fn(),
    markdownViewerMock: vi.fn(),
  }))

vi.mock('@tanstack/react-router', () => ({
  useParams: () => paramsState.current,
  useLocation: () => ({ state: locationState.current }),
}))

vi.mock('@/lib/use-subscription', () => ({
  useSpecDocumentSubscription: useSpecDocumentSubscriptionMock,
  useConfigSubscription: () => ({ data: undefined }),
  useGlobalSettingsSubscription: () => ({ data: undefined }),
}))

vi.mock('@/components/markdown-viewer', () => ({
  MarkdownViewer: (props: { markdown: string; path: string }) => {
    markdownViewerMock(props)
    return <div data-testid="markdown">{props.markdown}</div>
  },
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    children,
    state,
    ...props
  }: {
    children: ReactNode
    state?:
      | Record<string, unknown>
      | ((previous: Record<string, unknown>) => Record<string, unknown>)
    'aria-label'?: string
  }) => {
    const resolvedState = typeof state === 'function' ? state({}) : state
    return (
      <a
        href="/specs"
        aria-label={props['aria-label']}
        data-list-scope={resolvedState?.__specListScope}
      >
        {children}
      </a>
    )
  },
}))

describe('SpecView', () => {
  beforeEach(() => {
    locationState.current = null
    paramsState.current = { specId: 'auth' }
    useSpecDocumentSubscriptionMock.mockReset()
    markdownViewerMock.mockReset()
  })
  afterEach(() => cleanup())

  it('renders an owned route through its local Markdown projection', () => {
    useSpecDocumentSubscriptionMock.mockReturnValue({
      data: {
        identity: { kind: 'owned', specId: 'auth' },
        source: 'owned',
        readOnly: false,
        state: 'ready',
        spec: { id: 'auth', name: 'Owned Auth', overview: '', requirements: [] },
        rawMarkdown: '# Owned Auth',
        upstream: null,
        evidence: null,
      },
      isLoading: false,
      error: null,
    })

    render(<SpecView />)

    expect(useSpecDocumentSubscriptionMock).toHaveBeenCalledWith({
      kind: 'owned',
      specId: 'auth',
    })
    expect(screen.getByTestId('markdown').textContent).toBe('# Owned Auth')
    expect(markdownViewerMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'specs/auth/spec.md' })
    )
    expect(screen.getByText('Owned · auth')).toBeTruthy()
    expect(screen.queryByText(/Read-only Reference/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to specifications' })).toHaveAttribute(
      'data-list-scope',
      'owned'
    )
  })

  it('renders the exact referenced Store projection as read-only CLI evidence', () => {
    paramsState.current = { storeId: 'platform-b', specId: 'auth' }
    useSpecDocumentSubscriptionMock.mockReturnValue({
      data: {
        identity: { kind: 'referenced', storeId: 'platform-b', specId: 'auth' },
        source: 'referenced',
        readOnly: true,
        state: 'ready',
        spec: null,
        rawMarkdown: null,
        upstream: {
          id: 'auth',
          title: 'Platform B Auth',
          overview: 'Platform B overview',
          requirementCount: 1,
          requirements: [
            {
              text: 'The platform SHALL authenticate.',
              scenarios: [{ rawText: 'WHEN used\nTHEN authenticated' }],
            },
          ],
          metadata: { version: '1.0.0', format: 'openspec' },
          root: { path: '/stores/platform-b', source: 'store', store_id: 'platform-b' },
        },
        evidence: {
          success: true,
          stdout: '{}',
          stderr: '',
          exitCode: 0,
          diagnostics: [],
        },
      },
      isLoading: false,
      error: null,
    })

    render(<SpecView />)

    expect(useSpecDocumentSubscriptionMock).toHaveBeenCalledWith({
      kind: 'referenced',
      storeId: 'platform-b',
      specId: 'auth',
    })
    expect(screen.getByRole('heading', { name: 'Platform B Auth' })).toBeTruthy()
    expect(
      screen.getByText(/Read-only Reference projected from OpenSpec Store platform-b/)
    ).toBeTruthy()
    expect(screen.getByText('Referenced from platform-b · auth')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to specifications' })).toHaveAttribute(
      'data-list-scope',
      'referenced'
    )
    expect(screen.getByText('The platform SHALL authenticate.')).toBeTruthy()
    expect(markdownViewerMock).not.toHaveBeenCalled()
  })
})
