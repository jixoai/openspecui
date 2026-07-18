/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Render commit and uncommitted detail from an explicit repository scope.
 * 2. Preserve scope and binding across metadata/files/patch requests and cache keys.
 * 3. Preserve shared-element handoff and long-diff document flow.
 * 4. Keep cached Git detail non-authoritative while scope subscriptions reconnect.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 * Derived requirement (2026-07-19): Checkpoint 6.11 retires stale Git repository bindings.
 */
import { GitEntryDetailPanel } from '@/components/git/git-panel-detail'
import {
  DiffStat,
  formatRelatedChanges,
  getGitEntrySharedDescriptor,
  GitFilesBadge,
} from '@/components/git/git-shared'
import {
  buildGitRepositoryHref,
  getGitEntryFilesQueryKey,
  getGitEntryMetaQueryKey,
} from '@/lib/git-panel'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useGitRepositoryScope } from '@/lib/use-git-repository-scope'
import { VTLink } from '@/lib/view-transitions/navigation'
import {
  getSharedElementBinding,
  readGitSharedElementHandoffState,
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
  const {
    requestedScope,
    scope,
    descriptor: scopeDescriptor,
    scopes,
    locationSearch,
    query: scopesQuery,
  } = useGitRepositoryScope(!staticMode)
  const scopeReconnecting = scopesQuery.isLoading
  const headerRef = useRef<HTMLDivElement | null>(null)
  const sharedDescriptor = useMemo(() => getGitEntrySharedDescriptor(selector), [selector])
  const backHref = buildGitRepositoryHref('/git', requestedScope, locationSearch)
  const bindingToken = scopeDescriptor?.bindingToken ?? null
  const handoff = readGitSharedElementHandoffState(location.state, selector, bindingToken)
  const metaQuery = useQuery({
    queryKey: getGitEntryMetaQueryKey(scope, bindingToken ?? 'unavailable', selector),
    queryFn: () => {
      if (!bindingToken) throw new Error('Git repository binding is unavailable.')
      return trpcClient.git.getEntryMeta.query({
        scope,
        expectedBindingToken: bindingToken,
        selector,
      })
    },
    enabled: !staticMode && !scopeReconnecting && bindingToken !== null,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const filesQuery = useQuery({
    queryKey: getGitEntryFilesQueryKey(scope, bindingToken ?? 'unavailable', selector),
    queryFn: () => {
      if (!bindingToken) throw new Error('Git repository binding is unavailable.')
      return trpcClient.git.getEntryFiles.query({
        scope,
        expectedBindingToken: bindingToken,
        selector,
      })
    },
    enabled: !staticMode && !scopeReconnecting && bindingToken !== null,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const entry = metaQuery.data ?? null
  const files = filesQuery.data?.files ?? []
  const eagerFiles = filesQuery.data?.eagerFiles ?? []
  const EntryIcon = selector.type === 'commit' ? GitCommitHorizontal : LoaderCircle

  if (staticMode) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Git detail is only available in live mode.
      </div>
    )
  }

  if (scopeReconnecting) {
    return <div className="route-loading animate-pulse">Loading git repository scope...</div>
  }

  if (scopesQuery.error && !scopes) {
    return (
      <div className="text-destructive flex items-center gap-2 p-4 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Error loading git repository scope: {scopesQuery.error.message}
      </div>
    )
  }

  if (metaQuery.isLoading && !entry) {
    if (handoff) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <div className="flex items-start gap-4">
            <VTLink
              to={backHref}
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

    return (
      <div className="route-loading animate-pulse">
        Loading Git detail for{' '}
        {scopeDescriptor?.repository?.topLevel ?? scopeDescriptor?.rootPath ?? 'repository'}...
      </div>
    )
  }

  if (metaQuery.error && !entry) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Error loading commit detail: {metaQuery.error.message}
        </div>
        <div>
          <VTLink to={backHref} className="text-primary hover:underline">
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
          <VTLink to={backHref} className="text-primary hover:underline">
            Back to Commits
          </VTLink>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <VTLink
            to={backHref}
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
            <p className="text-muted-foreground whitespace-normal text-xs [overflow-wrap:anywhere]">
              {scope === 'code' ? 'Code repository' : 'Planning repository'} ·{' '}
              {scopeDescriptor?.repository?.topLevel ?? scopeDescriptor?.rootPath}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <GitFilesBadge files={filesQuery.data ? files.length : entry.diff.files} />
          <DiffStat diff={entry.diff} />
        </div>
      </div>

      <div className="vt-detail-content">
        <GitEntryDetailPanel
          selector={selector}
          entry={entry}
          files={files}
          eagerFiles={eagerFiles}
          projectDir={scopeDescriptor?.repository?.topLevel ?? scopeDescriptor?.rootPath}
          repositoryScope={scope}
          repositoryBindingToken={bindingToken ?? 'unavailable'}
          isLoading={filesQuery.isLoading || filesQuery.isFetching}
          error={
            (filesQuery.error instanceof Error ? filesQuery.error : null) ??
            (metaQuery.error instanceof Error ? metaQuery.error : null)
          }
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
