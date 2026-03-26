import type {
  DashboardGitEntry,
  GitEntryFilePatch,
  GitEntryFileSummary,
  GitEntrySelector,
} from '@openspecui/core'
import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { renderReactStory } from '@/storybook/render-react-story'

import { GitEntryDetailPanel } from './git-panel-detail'

const storyEntry: DashboardGitEntry = {
  type: 'commit',
  hash: '9f8e7d6c',
  title: 'feat: tighten git detail scroll behavior',
  committedAt: Date.UTC(2026, 2, 26),
  relatedChanges: ['add-git-panel-worktree-handoff'],
  diff: {
    files: 48,
    insertions: 432,
    deletions: 117,
  },
}

const storySelector: GitEntrySelector = {
  type: 'commit',
  hash: storyEntry.hash,
}

const storyFiles: GitEntryFileSummary[] = Array.from({ length: 48 }, (_, index) => ({
  fileId: `file-${index + 1}`,
  source: 'tracked',
  path: `src/features/group-${Math.floor(index / 4) + 1}/file-${index + 1}.tsx`,
  displayPath: `src/features/group-${Math.floor(index / 4) + 1}/file-${index + 1}.tsx`,
  previousPath: null,
  changeType:
    index % 4 === 0
      ? 'added'
      : index % 4 === 1
        ? 'modified'
        : index % 4 === 2
          ? 'deleted'
          : 'renamed',
  diff: {
    state: 'ready',
    files: 1,
    insertions: 4 + index,
    deletions: index % 3,
  },
}))

const storyPatchesByFileId = new Map<string, GitEntryFilePatch>(
  storyFiles.map((file, index) => [
    file.fileId,
    {
      ...file,
      state: 'available',
      patch: [
        `diff --git a/${file.path} b/${file.path}`,
        'index 0000000..1111111 100644',
        `--- a/${file.path}`,
        `+++ b/${file.path}`,
        '@@ -1,6 +1,6 @@',
        ...Array.from(
          { length: 12 + (index % 5) * 8 },
          (_, lineIndex) =>
            `${lineIndex % 2 === 0 ? '+' : '-'} line ${lineIndex + 1} for ${file.fileId}`
        ),
      ].join('\n'),
    },
  ])
)

function requireStoryShell(node: Element | null): HTMLElement {
  const shell = node?.closest<HTMLElement>('[data-testid="git-detail-story-shell"]') ?? null
  expect(shell).toBeTruthy()

  if (!shell) {
    throw new Error('git detail story shell not found')
  }

  return shell
}

function GitDetailStory({ width }: { width: number }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: Number.POSITIVE_INFINITY,
          },
        },
      }),
    []
  )

  return (
    <QueryClientProvider client={queryClient}>
      <div
        data-testid="git-detail-story-shell"
        style={{
          width: `${width}px`,
          height: '360px',
          overflowY: 'auto',
          padding: '16px',
          background: '#fff',
        }}
      >
        <GitEntryDetailPanel
          selector={storySelector}
          entry={storyEntry}
          files={storyFiles}
          isLoading={false}
          error={null}
          patchLoader={async ({ fileId }) => {
            const file = storyPatchesByFileId.get(fileId) ?? null
            return file ? { entry: storyEntry, file } : null
          }}
        />
      </div>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Git/GitDetailScrollHarness',
  render: () => renderReactStory(<GitDetailStory width={1200} />),
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const WideScrollSpy: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const diffLabel = await canvas.findByText('Diff Stream')
    const shell = requireStoryShell(diffLabel)

    shell.scrollTo({
      top: Math.max(shell.scrollHeight - shell.clientHeight, 0),
      behavior: 'auto',
    })

    await waitFor(() => {
      const treeViewport = canvasElement.querySelector<HTMLElement>(
        '[data-testid="git-file-tree-viewport"]'
      )
      expect(treeViewport).toBeTruthy()

      if (!treeViewport) {
        return
      }

      expect(treeViewport.getAttribute('style') ?? '').toContain('height:')
      const shellRect = shell.getBoundingClientRect()
      const viewportRect = treeViewport.getBoundingClientRect()
      expect(viewportRect.bottom).toBeLessThanOrEqual(shellRect.bottom + 1)
    })
  },
}

export const NarrowTabsScrollSpy: Story = {
  render: () => renderReactStory(<GitDetailStory width={480} />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const diffTab = await canvas.findByRole('button', { name: 'Diff Stream' })
    const shell = requireStoryShell(diffTab)

    shell.scrollTo({
      top: Math.max(shell.scrollHeight - shell.clientHeight, 0),
      behavior: 'auto',
    })

    await userEvent.click(await canvas.findByRole('button', { name: 'File Tree' }))

    await waitFor(() => {
      const tree = canvas.getByRole('tree')
      expect(tree.style.maxHeight).toBe('')
      expect(tree.scrollHeight).toBe(tree.clientHeight)
      expect(shell.scrollHeight).toBeGreaterThan(shell.clientHeight)
    })
  },
}
