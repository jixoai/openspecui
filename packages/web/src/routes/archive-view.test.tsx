import type { OpsxEntityDetail } from '@openspecui/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArchiveView } from './archive-view'

const archiveSubscriptionMock = vi.hoisted(() => vi.fn())

interface MockMarkdownBuilderComponents {
  H1: (props: { children?: ReactNode }) => ReactNode
  Section: (props: { children?: ReactNode }) => ReactNode
}

type MockMarkdown = string | ((components: MockMarkdownBuilderComponents) => ReactNode)

vi.mock('@/lib/use-subscription', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/use-subscription')>()
  return {
    ...actual,
    useArchiveSubscription: archiveSubscriptionMock,
  }
})

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({
    useParams: () => ({ changeId: '2026-05-17-fix-change-document-hook-rendering' }),
  }),
  useLocation: () => ({ state: null }),
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    children,
    to,
    title,
    className,
  }: {
    children?: ReactNode
    to: string
    title?: string
    className?: string
  }) => (
    <a href={to} title={title} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/view-transitions/shared-elements', () => ({
  getSharedElementBinding: () => ({}),
  readSharedElementHandoffState: () => null,
}))

vi.mock('@/lib/view-transitions/tabs', () => ({
  useRoutedCarouselTabs: ({ initialTab }: { initialTab?: string }) => ({
    tabsRef: { current: null },
    selectedTab: initialTab,
    onTabChange: vi.fn(),
  }),
}))

vi.mock('@/components/folder-editor-viewer', () => ({
  FolderEditorViewer: ({ files }: { files?: Array<{ path: string }> }) => (
    <div>folder:{files?.map((file) => file.path).join(',')}</div>
  ),
}))

vi.mock('@/components/markdown-viewer', async () => {
  const React = await import('react')
  const renderMarkdown = (markdown: MockMarkdown) => {
    if (typeof markdown === 'string') return markdown
    return markdown({
      H1: ({ children }) => React.createElement('h1', null, children),
      Section: ({ children }) => React.createElement('section', null, children),
    })
  }

  function MarkdownViewer({ markdown, path }: { markdown: MockMarkdown; path?: string }) {
    return (
      <article>
        <div>{path}</div>
        <div>{renderMarkdown(markdown)}</div>
      </article>
    )
  }

  return {
    MarkdownViewer,
  }
})

vi.mock('@/components/tabs', () => ({
  Tabs: ({
    tabs,
    selectedTab,
  }: {
    tabs: Array<{ id: string; label?: ReactNode; content: ReactNode }>
    selectedTab?: string
  }) => (
    <div>
      <nav>
        {tabs.map((tab) => (
          <button key={tab.id} type="button">
            {tab.label}
          </button>
        ))}
      </nav>
      <div>{tabs.find((tab) => tab.id === selectedTab)?.content ?? tabs[0]?.content}</div>
    </div>
  ),
}))

const archivedChange: OpsxEntityDetail = {
  stage: 'archive',
  id: '2026-05-17-fix-change-document-hook-rendering',
  exists: true,
  schemaName: 'custom-audit',
  files: [
    { path: '.openspec.yaml', type: 'file', content: 'schema: custom-audit\n' },
    { path: 'reports/summary.md', type: 'file', content: '# Source summary' },
  ],
  artifacts: [
    {
      id: 'summary',
      outputPath: 'reports/summary.md',
      files: [{ path: 'reports/summary.md', type: 'file', content: '# Processed summary' }],
    },
  ],
  ungroupedFiles: [{ path: '.openspec.yaml', type: 'file', content: 'schema: custom-audit\n' }],
  diagnostics: [],
}

describe('ArchiveView', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    archiveSubscriptionMock.mockReset()
    archiveSubscriptionMock.mockReturnValue({
      data: archivedChange,
      isLoading: false,
      error: null,
    })
  })

  it('renders archive entity artifacts by the full route archive id', async () => {
    render(<ArchiveView />)

    await waitFor(() =>
      expect(archiveSubscriptionMock).toHaveBeenCalledWith(
        '2026-05-17-fix-change-document-hook-rendering'
      )
    )
    expect(screen.queryByText(/Archived change not found:/)).not.toBeInTheDocument()
    expect(screen.getAllByText('summary').length).toBeGreaterThan(0)
    expect(screen.getByText('# Processed summary')).toBeTruthy()
    expect(screen.getByText(/Schema: custom-audit/)).toBeTruthy()
  })

  it('keeps the loading state while the archive subscription has not resolved', () => {
    archiveSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    render(<ArchiveView />)

    expect(screen.getByText('Loading archived entity...')).toBeTruthy()
    expect(screen.queryByText(/Archived change not found:/)).not.toBeInTheDocument()
  })

  it('renders generic archives as markdown content plus a distinct folder tab', () => {
    archiveSubscriptionMock.mockReturnValue({
      data: {
        ...archivedChange,
        artifacts: [],
        files: [
          { path: '.openspec.yaml', type: 'file', content: 'schema: custom-audit\n' },
          { path: 'notes/decision.md', type: 'file', content: '# Decision\n\nKeep visible.' },
          { path: 'data/config.json', type: 'file', content: '{"ok":true}' },
        ],
        ungroupedFiles: [
          { path: '.openspec.yaml', type: 'file', content: 'schema: custom-audit\n' },
          { path: 'notes/decision.md', type: 'file', content: '# Decision\n\nKeep visible.' },
          { path: 'data/config.json', type: 'file', content: '{"ok":true}' },
        ],
      },
      isLoading: false,
      error: null,
    })

    render(<ArchiveView />)

    expect(screen.getByText('Content')).toBeTruthy()
    expect(screen.getByText('Folder')).toBeTruthy()
    expect(screen.getByText('notes/decision.md')).toBeTruthy()
    expect(screen.getByText(/Keep visible/)).toBeTruthy()
    expect(screen.queryByText(/^folder:/)).not.toBeInTheDocument()
  })
})
