import { render, screen, waitFor } from '@testing-library/react'
import type { OpsxEntityDetail } from '@openspecui/core'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ArchiveView } from './archive-view'

const archiveSubscriptionMock = vi.hoisted(() => vi.fn())

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
  VTLink: ({ children, to, title, className }: { children?: ReactNode; to: string; title?: string; className?: string }) => (
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

vi.mock('@/components/markdown-viewer', () => ({
  MarkdownViewer: ({ markdown, path }: { markdown: string; path?: string }) => (
    <article>
      <div>{path}</div>
      <div>{markdown}</div>
    </article>
  ),
}))

vi.mock('@/components/tabs', () => ({
  Tabs: ({ tabs, selectedTab }: { tabs: Array<{ id: string; content: ReactNode }>; selectedTab?: string }) => (
    <div>{tabs.find((tab) => tab.id === selectedTab)?.content ?? tabs[0]?.content}</div>
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
})
