import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GitCommitViewRoute, GitUncommittedViewRoute } from './git-view'

const { getEntryShellQueryMock, staticModeMock, useParamsMock, projectDir } = vi.hoisted(() => ({
  getEntryShellQueryMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
  useParamsMock: vi.fn(() => ({ hash: 'abc12345' })),
  projectDir: '/Users/kzf/Dev/GitHub/jixoai-labs/agenter',
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    git: {
      getEntryShell: {
        query: getEntryShellQueryMock,
      },
    },
  },
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: staticModeMock,
}))

vi.mock('@/lib/use-server-status', () => ({
  useServerStatus: () => ({ projectDir }),
}))

vi.mock('@/components/git/git-panel-detail', () => ({
  GitEntryDetailPanel: ({
    selector,
    projectDir,
  }: {
    selector: { type: string; hash?: string }
    projectDir?: string | null
  }) => (
    <div data-testid="git-entry-detail-panel">
      {selector.type}
      {selector.hash ? `:${selector.hash}` : ''}
      {projectDir ? `:${projectDir}` : ''}
    </div>
  ),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: ReactNode
    [key: string]: unknown
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useParams: () => useParamsMock(),
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function renderWithQueryClient(children: ReactNode) {
  const queryClient = createQueryClient()
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>)
}

describe('Git entry routes', () => {
  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
    useParamsMock.mockReturnValue({ hash: 'abc12345' })
    getEntryShellQueryMock.mockResolvedValue({
      entry: {
        type: 'commit',
        hash: 'abc12345',
        title: 'feat: add git panel',
        committedAt: 1,
        relatedChanges: ['add-git-panel-worktree-handoff'],
        diff: { files: 1, insertions: 3, deletions: 1 },
      },
      files: [],
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders a back button to commits on the commit detail page', async () => {
    renderWithQueryClient(<GitCommitViewRoute />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Back to commits' })).toHaveAttribute('href', '/git')
    })

    expect(screen.getByTestId('git-entry-detail-panel')).toHaveTextContent(
      `commit:abc12345:${projectDir}`
    )
  })

  it('keeps the commit title and subtitle fully wrappable instead of truncating them', async () => {
    getEntryShellQueryMock.mockResolvedValue({
      entry: {
        type: 'commit',
        hash: 'abc12345',
        title: 'docs(spec): archive chat layout and history pagination follow-up summary',
        committedAt: 1,
        relatedChanges: ['compact-chat-density-and-layout-rubric'],
        diff: { files: 41, insertions: 196, deletions: 18 },
      },
      files: [],
    })

    renderWithQueryClient(<GitCommitViewRoute />)

    await waitFor(() => {
      const heading = screen.getByRole('heading', {
        name: /docs\(spec\): archive chat layout and history pagination follow-up summary/i,
      })
      const headingText = heading.querySelector('span')
      expect(headingText?.className).not.toContain('truncate')
      expect(screen.getByText(/abc12345 · linked openspec changes:/i).className).not.toContain(
        'truncate'
      )
    })
  })

  it('renders the uncommitted detail route with the uncommitted selector', async () => {
    getEntryShellQueryMock.mockResolvedValue({
      entry: {
        type: 'uncommitted',
        title: 'working tree',
        updatedAt: 1,
        relatedChanges: [],
        diff: { files: 1, insertions: 3, deletions: 1 },
      },
      files: [],
    })

    renderWithQueryClient(<GitUncommittedViewRoute />)

    await waitFor(() => {
      expect(screen.getByTestId('git-entry-detail-panel')).toHaveTextContent(
        `uncommitted:${projectDir}`
      )
    })
  })
})
