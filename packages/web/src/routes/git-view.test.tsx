import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GitCommitViewRoute, GitUncommittedViewRoute } from './git-view'

const { getEntryMetaQueryMock, getEntryFilesQueryMock, staticModeMock, useParamsMock, projectDir } =
  vi.hoisted(() => ({
    getEntryMetaQueryMock: vi.fn(),
    getEntryFilesQueryMock: vi.fn(),
    staticModeMock: vi.fn(() => false),
    useParamsMock: vi.fn(() => ({ hash: 'abc12345' })),
    projectDir: '/Users/kzf/Dev/GitHub/jixoai-labs/agenter',
  }))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    git: {
      getEntryMeta: {
        query: getEntryMetaQueryMock,
      },
      getEntryFiles: {
        query: getEntryFilesQueryMock,
      },
    },
  },
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: staticModeMock,
  getBasePath: () => '/',
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
  useLocation: () => ({
    pathname: '/git/commit/abc12345',
    search: '',
    hash: '',
    state: null,
  }),
  useNavigate: () => vi.fn(),
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
    getEntryMetaQueryMock.mockResolvedValue({
      type: 'commit',
      hash: 'abc12345',
      title: 'feat: add git panel',
      committedAt: 1,
      relatedChanges: ['add-git-panel-worktree-handoff'],
      diff: { files: 1, insertions: 3, deletions: 1 },
    })
    getEntryFilesQueryMock.mockResolvedValue({
      files: [],
      eagerFiles: [],
      eagerPatchLineBudget: 1000,
      eagerPatchLineCount: 0,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders a back button to commits on the commit detail page', async () => {
    renderWithQueryClient(<GitCommitViewRoute />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Back to commits' }).getAttribute('href')).toBe(
        '/git'
      )
    })

    expect(screen.getByTestId('git-entry-detail-panel').textContent).toContain(
      `commit:abc12345:${projectDir}`
    )
  })

  it('keeps the commit title and subtitle fully wrappable instead of truncating them', async () => {
    getEntryMetaQueryMock.mockResolvedValue({
      type: 'commit',
      hash: 'abc12345',
      title: 'docs(spec): archive chat layout and history pagination follow-up summary',
      committedAt: 1,
      relatedChanges: ['compact-chat-density-and-layout-rubric'],
      diff: { files: 41, insertions: 196, deletions: 18 },
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
    getEntryMetaQueryMock.mockResolvedValue({
      type: 'uncommitted',
      title: 'working tree',
      updatedAt: 1,
      relatedChanges: [],
      diff: { files: 1, insertions: 3, deletions: 1 },
    })

    renderWithQueryClient(<GitUncommittedViewRoute />)

    await waitFor(() => {
      expect(screen.getByTestId('git-entry-detail-panel').textContent).toContain(
        `uncommitted:${projectDir}`
      )
    })
  })

  it('keeps git detail content in document flow so the shell can scroll long diffs', async () => {
    renderWithQueryClient(<GitCommitViewRoute />)

    await waitFor(() => {
      const detailContainer = screen
        .getByTestId('git-entry-detail-panel')
        .closest('.vt-detail-content')
      expect(detailContainer).toBeTruthy()
      expect(detailContainer?.className).not.toContain('flex-1')
      expect(detailContainer?.className).not.toContain('min-h-0')
    })
  })
})
