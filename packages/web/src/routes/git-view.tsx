import { GitEntryDetailPanel } from '@/components/git/git-panel-detail'
import {
  DiffStat,
  formatRelatedChanges,
  getGitEntrySharedDescriptor,
  GitFilesBadge,
} from '@/components/git/git-shared'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useServerStatus } from '@/lib/use-server-status'
import { VTLink } from '@/lib/view-transitions/navigation'
import {
  getSharedElementBinding,
  readSharedElementHandoffState,
} from '@/lib/view-transitions/shared-elements'
import type { GitEntrySelector } from '@openspecui/core'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useParams } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, GitCommitHorizontal, LoaderCircle } from 'lucide-react'
import { useMemo, useRef } from 'react'

function entrySubtitle(selector: GitEntrySelector, relatedChanges: string[]): string {
  if (selector.type === 'commit') {
    return `${selector.hash} · ${formatRelatedChanges(relatedChanges)}`
  }
  return `working tree · ${formatRelatedChanges(relatedChanges)}`
}

function GitEntryView({ selector }: { selector: GitEntrySelector }) {
  const staticMode = isStaticMode()
  const location = useLocation()
  const { projectDir } = useServerStatus()
  const headerRef = useRef<HTMLDivElement | null>(null)
  const sharedDescriptor = useMemo(() => getGitEntrySharedDescriptor(selector), [selector])
  const handoff = readSharedElementHandoffState(location.state)
  const shellQuery = useQuery({
    queryKey:
      selector.type === 'commit'
        ? ['git', 'shell', 'commit', selector.hash]
        : ['git', 'shell', 'uncommitted'],
    queryFn: () => trpcClient.git.getEntryShell.query({ selector }),
    enabled: !staticMode,
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const entry = shellQuery.data?.entry ?? null
  const files = shellQuery.data?.files ?? []
  const EntryIcon = selector.type === 'commit' ? GitCommitHorizontal : LoaderCircle

  if (staticMode) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Git detail is only available in live mode.
      </div>
    )
  }

  if (shellQuery.isLoading && !entry) {
    if (handoff) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <div className="flex items-start gap-4">
            <VTLink
              to="/git"
              vt={{ source: headerRef, sharedElements: sharedDescriptor }}
              className="hover:bg-muted rounded-md p-2"
              aria-label="Back to commits"
            >
              <ArrowLeft className="h-5 w-5" />
            </VTLink>
            <div
              ref={headerRef}
              {...getSharedElementBinding(sharedDescriptor, 'container')}
              className="min-w-0 space-y-1"
            >
              <h1 className="font-nav flex flex-wrap items-start gap-2 text-2xl font-bold">
                <EntryIcon
                  {...getSharedElementBinding(sharedDescriptor, 'icon')}
                  className={`h-5 w-5 shrink-0 ${selector.type === 'commit' ? 'text-sky-600 dark:text-sky-300' : 'text-amber-600 dark:text-amber-300'}`}
                />
                <span
                  {...getSharedElementBinding(sharedDescriptor, 'title')}
                  className="min-w-0 whitespace-normal [overflow-wrap:anywhere]"
                >
                  {handoff.title ?? (selector.type === 'commit' ? selector.hash : 'working tree')}
                </span>
              </h1>
              <p className="text-muted-foreground whitespace-normal text-sm [overflow-wrap:anywhere]">
                {handoff.subtitle ?? 'Loading git entry…'}
              </p>
            </div>
          </div>
          <div className="vt-detail-content route-loading animate-pulse rounded-lg border p-4">
            Loading commit detail...
          </div>
        </div>
      )
    }

    return <div className="route-loading animate-pulse">Loading commit detail...</div>
  }

  if (shellQuery.error && !entry) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Error loading commit detail: {shellQuery.error.message}
        </div>
        <div>
          <VTLink to="/git" className="text-primary hover:underline">
            Back to Commits
          </VTLink>
        </div>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Commit detail is unavailable in the current project.
        </div>
        <div>
          <VTLink to="/git" className="text-primary hover:underline">
            Back to Commits
          </VTLink>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <VTLink
            to="/git"
            vt={{ source: headerRef, sharedElements: sharedDescriptor }}
            className="hover:bg-muted rounded-md p-2"
            aria-label="Back to commits"
          >
            <ArrowLeft className="h-5 w-5" />
          </VTLink>
          <div
            ref={headerRef}
            {...getSharedElementBinding(sharedDescriptor, 'container')}
            className="min-w-0 space-y-1"
          >
            <h1 className="font-nav flex flex-wrap items-start gap-2 text-2xl font-bold">
              <EntryIcon
                {...getSharedElementBinding(sharedDescriptor, 'icon')}
                className={`h-5 w-5 shrink-0 ${selector.type === 'commit' ? 'text-sky-600 dark:text-sky-300' : 'text-amber-600 dark:text-amber-300'}`}
              />
              <span
                {...getSharedElementBinding(sharedDescriptor, 'title')}
                className="min-w-0 whitespace-normal [overflow-wrap:anywhere]"
              >
                {entry.title}
              </span>
            </h1>
            <p className="text-muted-foreground whitespace-normal text-sm [overflow-wrap:anywhere]">
              {entrySubtitle(selector, entry.relatedChanges)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <GitFilesBadge files={files.length || entry.diff.files} />
          <DiffStat diff={entry.diff} />
        </div>
      </div>

      <div className="vt-detail-content flex min-h-0 flex-1 flex-col">
        <GitEntryDetailPanel
          selector={selector}
          entry={entry}
          files={files}
          projectDir={projectDir}
          isLoading={shellQuery.isLoading || shellQuery.isFetching}
          error={shellQuery.error instanceof Error ? shellQuery.error : null}
          showEntrySummary={false}
        />
      </div>
    </div>
  )
}

export function GitUncommittedViewRoute() {
  return <GitEntryView selector={{ type: 'uncommitted' }} />
}

export function GitCommitViewRoute() {
  const { hash } = useParams({ from: '/git/commit/$hash' })
  return <GitEntryView selector={{ type: 'commit', hash }} />
}
