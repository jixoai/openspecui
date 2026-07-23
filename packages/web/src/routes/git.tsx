/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Make Code versus distinct Planning repository scope explicit in URL and UI.
 * 2. Render scoped status, history, worktrees, pagination, and refresh lifecycles.
 * 3. Execute worktree removal and handoff only against the selected repository.
 * 4. Preserve Git list/detail View Transition continuity without cross-binding cache reuse.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 * Derived requirement (2026-07-19): Checkpoint 6.11 retires stale Git repository bindings.
 */
import {
  getGitEntrySharedDescriptor,
  getGitEntrySharedHandoff,
  GitAutoRefreshPresetIcon,
  GitEntryRow,
  WorktreeRow,
} from '@/components/git/git-shared'
import { WorktreeCard } from '@/components/git/git-worktree-card'
import { GitWorktreeSkeleton } from '@/components/realtime'
import { Select, type SelectOption } from '@/components/select'
import { Tooltip } from '@/components/tooltip'
import {
  getDashboardGitAutoRefreshIntervalMs,
  getDashboardGitAutoRefreshProgress,
  getDashboardGitAutoRefreshReason,
  loadDashboardGitAutoRefreshPreset,
  persistDashboardGitAutoRefreshPreset,
  type DashboardGitAutoRefreshPreset,
} from '@/lib/dashboard-git'
import {
  buildGitEntryHrefFromEntry,
  buildGitRepositoryHref,
  getGitEntryEntityId,
  GIT_ENTRY_PAGE_SIZE,
} from '@/lib/git-panel'
import { navigateToServerHandoff } from '@/lib/server-handoff'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useGitRepositoryScope } from '@/lib/use-git-repository-scope'
import { vtNavController } from '@/lib/view-transitions/navigation'
import { withSharedElementHandoffState } from '@/lib/view-transitions/shared-elements'
import type { GitWorktreeSummary } from '@openspecui/core'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRightLeft,
  FileCode2,
  GitBranch,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGitListContinuity } from './git-list-continuity'

const GIT_AUTO_REFRESH_OPTIONS: SelectOption<DashboardGitAutoRefreshPreset>[] = [
  { value: '30s', label: '30s' },
  { value: '5min', label: '5min' },
  { value: '30min', label: '30min' },
  { value: 'none', label: 'none' },
]

function isAnimatedGitRefreshReason(reason: string | null): boolean {
  return reason === 'manual-button' || reason?.startsWith('auto-refresh:') === true
}

export function GitRoute() {
  const staticMode = isStaticMode()
  const queryClient = useQueryClient()
  const {
    requestedScope,
    scope,
    descriptor: scopeDescriptor,
    scopes,
    locationSearch,
    planningReady,
    planningMessage,
    query: scopesQuery,
  } = useGitRepositoryScope(!staticMode)
  const bindingToken = scopeDescriptor?.bindingToken ?? null
  const scopeNonAuthoritative = scopesQuery.authority.state !== 'current'
  const scopeNonAuthoritativeRef = useRef(scopeNonAuthoritative)
  scopeNonAuthoritativeRef.current = scopeNonAuthoritative
  const overviewQuery = useQuery({
    queryKey: ['git', scope, bindingToken, 'overview'],
    queryFn: () => {
      if (!bindingToken) throw new Error('Git repository binding is unavailable.')
      return trpcClient.git.overview.query({ scope, expectedBindingToken: bindingToken })
    },
    enabled: !staticMode && !scopeNonAuthoritative && bindingToken !== null,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const entriesQuery = useInfiniteQuery({
    queryKey: ['git', scope, bindingToken, 'entries'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      bindingToken
        ? trpcClient.git.listEntries.query({
            scope,
            expectedBindingToken: bindingToken,
            cursor: pageParam,
            limit: GIT_ENTRY_PAGE_SIZE,
          })
        : Promise.reject(new Error('Git repository binding is unavailable.')),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !staticMode && !scopeNonAuthoritative && bindingToken !== null,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const [gitAutoRefreshPreset, setGitAutoRefreshPreset] = useState<DashboardGitAutoRefreshPreset>(
    () => loadDashboardGitAutoRefreshPreset()
  )
  const [gitAutoRefreshCycleStartedAt, setGitAutoRefreshCycleStartedAt] = useState<number | null>(
    null
  )
  const [gitAutoRefreshNow, setGitAutoRefreshNow] = useState(() => Date.now())
  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  )
  const [gitRefreshRequest, setGitRefreshRequest] = useState<{
    reason: string
    requestedAt: number
  } | null>(null)
  const [removingWorktreePath, setRemovingWorktreePath] = useState<string | null>(null)
  const [switchingWorktreePath, setSwitchingWorktreePath] = useState<string | null>(null)

  const switchWorktreeMutation = useMutation({
    mutationFn: (input: { scope: typeof scope; expectedBindingToken: string; path: string }) =>
      trpcClient.git.switchWorktree.mutate(input),
  })

  const gitEntries = useMemo(
    () => entriesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [entriesQuery.data]
  )

  const gitEntriesContainerRef = useRef<HTMLDivElement>(null)
  // Preserve physical row identity across same-binding entry mutations; rotate immediately on
  // scope/bindingToken change. `gitEntries` is memoized so the hook can no-op on reference-equal
  // snapshots and never fabricate `[]` for an unobserved query.
  const displayedGitEntries = useGitListContinuity(
    gitEntries,
    { scope, bindingToken },
    gitEntriesContainerRef
  )

  const focusRefreshAtRef = useRef(0)
  const gitAutoRefreshTimerRef = useRef<number | null>(null)
  const gitRefreshRequestRef = useRef(gitRefreshRequest)
  const refreshBusyRef = useRef(false)
  const refreshBusy =
    scopeNonAuthoritative ||
    gitRefreshRequest !== null ||
    switchWorktreeMutation.isPending ||
    removingWorktreePath !== null
  const refreshReason = gitRefreshRequest?.reason ?? null

  const clearGitAutoRefreshTimer = useCallback(() => {
    if (gitAutoRefreshTimerRef.current === null) return
    window.clearTimeout(gitAutoRefreshTimerRef.current)
    gitAutoRefreshTimerRef.current = null
  }, [])

  const runGitRefresh = useCallback(
    (reason: string) => {
      if (!bindingToken || scopeNonAuthoritativeRef.current) return
      const requestedAt = Date.now()
      setGitRefreshRequest({ reason, requestedAt })

      void (async () => {
        try {
          await trpcClient.git.refresh.mutate({
            scope,
            expectedBindingToken: bindingToken,
            reason,
          })
          await queryClient.invalidateQueries({
            queryKey: ['git', scope, bindingToken],
            refetchType: 'active',
          })
        } catch (error) {
          console.error('[GitRoute] Failed to refresh git data:', error)
        } finally {
          setGitRefreshRequest((current) =>
            current?.reason === reason && current.requestedAt === requestedAt ? null : current
          )
        }
      })()
    },
    [bindingToken, queryClient, scope]
  )

  const scheduleGitAutoRefresh = useCallback(() => {
    clearGitAutoRefreshTimer()

    const intervalMs = getDashboardGitAutoRefreshIntervalMs(gitAutoRefreshPreset)
    const autoRefreshReason =
      gitAutoRefreshPreset === 'none'
        ? null
        : getDashboardGitAutoRefreshReason(gitAutoRefreshPreset)

    if (
      staticMode ||
      intervalMs === null ||
      autoRefreshReason === null ||
      refreshBusy ||
      !isDocumentVisible
    ) {
      setGitAutoRefreshCycleStartedAt(null)
      return
    }

    const startedAt = Date.now()
    setGitAutoRefreshCycleStartedAt(startedAt)
    setGitAutoRefreshNow(startedAt)

    gitAutoRefreshTimerRef.current = window.setTimeout(() => {
      gitAutoRefreshTimerRef.current = null
      setGitAutoRefreshCycleStartedAt(null)
      setGitAutoRefreshNow(Date.now())
      runGitRefresh(autoRefreshReason)
    }, intervalMs)
  }, [
    clearGitAutoRefreshTimer,
    gitAutoRefreshPreset,
    isDocumentVisible,
    refreshBusy,
    runGitRefresh,
    staticMode,
  ])

  const handleManualGitRefresh = useCallback(() => {
    if (refreshBusy) return
    clearGitAutoRefreshTimer()
    setGitAutoRefreshCycleStartedAt(null)
    setGitAutoRefreshNow(Date.now())
    runGitRefresh('manual-button')
  }, [clearGitAutoRefreshTimer, refreshBusy, runGitRefresh])

  const handleRemoveDetachedWorktree = useCallback(
    async (worktree: GitWorktreeSummary) => {
      if (
        !bindingToken ||
        scopeNonAuthoritativeRef.current ||
        staticMode ||
        worktree.isCurrent ||
        !worktree.detached
      ) {
        return
      }

      const confirmed = window.confirm(
        [
          'Remove detached worktree?',
          '',
          worktree.path,
          '',
          'This runs git worktree remove --force.',
        ].join('\n')
      )
      if (!confirmed) return

      setRemovingWorktreePath(worktree.path)
      try {
        await trpcClient.git.removeDetachedWorktree.mutate({
          scope,
          expectedBindingToken: bindingToken,
          path: worktree.path,
        })
        await queryClient.invalidateQueries({
          queryKey: ['git', scope, bindingToken],
          refetchType: 'active',
        })
      } catch (error) {
        console.error('[GitRoute] Failed to remove detached worktree:', error)
        window.alert(error instanceof Error ? error.message : 'Failed to remove detached worktree.')
      } finally {
        setRemovingWorktreePath((current) => (current === worktree.path ? null : current))
      }
    },
    [bindingToken, queryClient, scope, staticMode]
  )

  const handleSwitchWorktree = useCallback(
    async (worktree: GitWorktreeSummary) => {
      if (!bindingToken || scopeNonAuthoritativeRef.current) return
      setSwitchingWorktreePath(worktree.path)
      try {
        const handoff = await switchWorktreeMutation.mutateAsync({
          scope,
          expectedBindingToken: bindingToken,
          path: worktree.path,
        })
        navigateToServerHandoff({
          handoff,
          location: window.location,
        })
      } catch (error) {
        console.error('[GitRoute] Failed to switch worktree:', error)
        window.alert(error instanceof Error ? error.message : 'Failed to switch worktree.')
      } finally {
        setSwitchingWorktreePath((current) => (current === worktree.path ? null : current))
      }
    },
    [bindingToken, scope, switchWorktreeMutation]
  )

  useEffect(() => {
    gitRefreshRequestRef.current = gitRefreshRequest
  }, [gitRefreshRequest])

  useEffect(() => {
    refreshBusyRef.current = refreshBusy
  }, [refreshBusy])

  useEffect(() => {
    if (staticMode) return

    const triggerOnce = (reason: string) => {
      if (gitRefreshRequestRef.current !== null) return
      if (refreshBusyRef.current) return
      const now = Date.now()
      if (now - focusRefreshAtRef.current < 700) return
      focusRefreshAtRef.current = now
      clearGitAutoRefreshTimer()
      setGitAutoRefreshCycleStartedAt(null)
      setGitAutoRefreshNow(Date.now())
      runGitRefresh(reason)
    }

    const onFocus = () => triggerOnce('window-focus')
    const onVisibilityChange = () => {
      const visible = document.visibilityState === 'visible'
      setIsDocumentVisible(visible)
      if (visible) {
        triggerOnce('document-visible')
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [clearGitAutoRefreshTimer, runGitRefresh, staticMode])

  useEffect(() => {
    if (staticMode) return
    persistDashboardGitAutoRefreshPreset(gitAutoRefreshPreset)
  }, [gitAutoRefreshPreset, staticMode])

  useEffect(() => {
    if (staticMode) return
    scheduleGitAutoRefresh()
    return () => {
      clearGitAutoRefreshTimer()
    }
  }, [clearGitAutoRefreshTimer, scheduleGitAutoRefresh, staticMode])

  useEffect(() => {
    const intervalMs = getDashboardGitAutoRefreshIntervalMs(gitAutoRefreshPreset)
    if (staticMode || intervalMs === null || gitAutoRefreshCycleStartedAt === null || refreshBusy) {
      return
    }

    const updateNow = () => {
      setGitAutoRefreshNow(Date.now())
    }

    updateNow()
    const timer = window.setInterval(updateNow, 250)
    return () => {
      window.clearInterval(timer)
    }
  }, [gitAutoRefreshCycleStartedAt, gitAutoRefreshPreset, refreshBusy, staticMode])

  const overview = overviewQuery.data
  const currentWorktree = overview?.currentWorktree ?? null
  const otherWorktrees = overview?.otherWorktrees ?? []
  const gitAutoRefreshIntervalMs = getDashboardGitAutoRefreshIntervalMs(gitAutoRefreshPreset)
  const gitAutoRefreshProgress =
    refreshBusy || gitAutoRefreshIntervalMs === null
      ? 0
      : getDashboardGitAutoRefreshProgress(
          gitAutoRefreshCycleStartedAt,
          gitAutoRefreshIntervalMs,
          gitAutoRefreshNow
        )
  const animateRefreshButton = refreshBusy && isAnimatedGitRefreshReason(refreshReason)

  if (staticMode) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Git panel is only available in live mode.
      </div>
    )
  }

  if (scopesQuery.authority.state === 'failed') {
    return (
      <div className="text-destructive flex items-center gap-2 p-4">
        <AlertCircle className="h-5 w-5 shrink-0" />
        Git repository scope projection failed: {scopesQuery.authority.error.message}
      </div>
    )
  }

  if (scopeNonAuthoritative) {
    // The authority gate stays a hard block (cached scope data is not made current during reconnect per the
    // Git repository-rebind law); only the wait presentation becomes a visual skeleton.
    return (
      <div
        className="space-y-4 p-4"
        aria-busy="true"
        data-git-loading="scopes"
        data-testid="git-loading-region"
      >
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">Git</h1>
        <GitWorktreeSkeleton count={4} />
      </div>
    )
  }

  if (overviewQuery.isLoading && !overview) {
    return (
      <div
        className="space-y-4 p-4"
        aria-busy="true"
        data-git-loading="overview"
        data-testid="git-loading-region"
      >
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">Git</h1>
        <GitWorktreeSkeleton count={4} />
      </div>
    )
  }

  if (overviewQuery.error && !overview) {
    return (
      <div className="text-destructive flex items-center gap-2 p-4">
        <AlertCircle className="h-5 w-5 shrink-0" />
        Error loading git panel: {overviewQuery.error.message}
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
            <FileCode2 className="h-6 w-6 shrink-0" />
            Git
          </h1>
          <p className="text-muted-foreground text-sm">
            Commit history for the current worktree plus live handoff to sibling worktrees.
          </p>
        </div>

        <div className="border-border bg-card inline-flex overflow-hidden rounded-md border">
          <Select
            value={gitAutoRefreshPreset}
            options={GIT_AUTO_REFRESH_OPTIONS}
            onValueChange={setGitAutoRefreshPreset}
            ariaLabel="Git auto refresh"
            className="text-foreground/75 hover:text-foreground border-r-current/10 bg-muted/20 relative isolate h-8 w-10 shrink-0 justify-center rounded-none border-0 border-r px-0"
            positionerClassName="z-50"
            popupClassName="min-w-[7rem]"
            renderTrigger={({ selectedOption }) => (
              <span className="relative inline-flex h-full w-full items-center justify-center overflow-hidden">
                <span className="bg-muted/20 pointer-events-none absolute inset-0" />
                {gitAutoRefreshIntervalMs !== null && !refreshBusy ? (
                  <span
                    className="bg-primary/30 dark:bg-primary/35 pointer-events-none absolute inset-y-0 left-0 transition-[width]"
                    style={{ width: `${gitAutoRefreshProgress * 100}%` }}
                  />
                ) : null}
                <span className="relative z-10 inline-flex items-center justify-center">
                  <GitAutoRefreshPresetIcon
                    preset={selectedOption?.value ?? gitAutoRefreshPreset}
                  />
                </span>
              </span>
            )}
          />
          <button
            type="button"
            onClick={handleManualGitRefresh}
            disabled={refreshBusy}
            className={`inline-flex h-8 items-center gap-1 px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
              animateRefreshButton
                ? 'bg-primary/10 text-primary'
                : 'text-foreground/75 hover:text-foreground'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${animateRefreshButton ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <section className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {scope === 'code' ? 'Code repository' : 'Planning repository'}
          </div>
          <div className="text-muted-foreground truncate text-xs" title={scopeDescriptor?.rootPath}>
            {scopeDescriptor?.repository?.topLevel ?? scopeDescriptor?.rootPath}
          </div>
          {requestedScope === 'planning' && scope === 'code' ? (
            <div className="text-muted-foreground mt-1 text-xs">{planningMessage}</div>
          ) : null}
        </div>

        {scopes?.planning ? (
          <div
            role="group"
            aria-label="Git repository scope"
            className="border-border bg-muted/30 inline-flex overflow-hidden rounded-md border"
          >
            {(['code', 'planning'] as const).map((nextScope) => (
              <button
                key={nextScope}
                type="button"
                aria-pressed={scope === nextScope}
                disabled={refreshBusy || (nextScope === 'planning' && !planningReady)}
                onClick={() => {
                  if (scope === nextScope) return
                  const href = buildGitRepositoryHref('/git', nextScope, locationSearch)
                  void vtNavController.replace(vtNavController.getAreaForPath('/git'), href)
                }}
                className={`h-8 px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  scope === nextScope
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {nextScope === 'code' ? 'Code repository' : 'Planning repository'}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="bg-card space-y-3 rounded-lg border border-zinc-500/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <GitBranch className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {currentWorktree?.branchName ?? '(no worktree)'} against{' '}
                {overview?.defaultBranch ?? 'main'}
              </span>
            </div>
            <div className="text-muted-foreground truncate text-xs">
              Current worktree summary and branch delta.
            </div>
          </div>
        </div>

        {currentWorktree ? (
          <WorktreeRow
            worktree={currentWorktree}
            emphasize
            removing={removingWorktreePath === currentWorktree.path}
            onRemoveDetachedWorktree={handleRemoveDetachedWorktree}
          />
        ) : (
          <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
            No Git worktree information is available for this project.
          </div>
        )}
      </section>

      <section className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">Commits</h2>
          <span className="text-muted-foreground text-xs">{gitEntries.length} loaded</span>
        </div>

        <div className="space-y-1" ref={gitEntriesContainerRef}>
          {(displayedGitEntries ?? []).map((entry) => (
            <GitEntryRow
              key={`${bindingToken ?? 'none'}:${getGitEntryEntityId(entry)}`}
              entry={entry}
              onSelect={(selectedEntry, sourceElement) => {
                if (!bindingToken || scopeNonAuthoritativeRef.current) return
                void vtNavController.push(
                  'bottom',
                  buildGitEntryHrefFromEntry(selectedEntry, requestedScope, locationSearch),
                  withSharedElementHandoffState(
                    undefined,
                    getGitEntrySharedHandoff(selectedEntry, bindingToken)
                  ),
                  {
                    source: sourceElement,
                    sharedElements: getGitEntrySharedDescriptor(selectedEntry),
                  }
                )
              }}
            />
          ))}

          {entriesQuery.error ? (
            <div className="text-destructive border-current/20 rounded-md border px-3 py-3 text-sm">
              {entriesQuery.error.message}
            </div>
          ) : null}

          {entriesQuery.hasNextPage ? (
            <button
              type="button"
              onClick={() => {
                if (scopeNonAuthoritativeRef.current) return
                void entriesQuery.fetchNextPage()
              }}
              disabled={scopeNonAuthoritative || entriesQuery.isFetchingNextPage}
              className="hover:bg-muted w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              {entriesQuery.isFetchingNextPage ? 'Loading more…' : 'Load older commits'}
            </button>
          ) : gitEntries.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
              No uncommitted files or commits ahead of the default branch.
            </div>
          ) : null}
        </div>
      </section>

      {otherWorktrees.length > 0 ? (
        <section className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 shrink-0" />
            <h2 className="font-medium">Other Worktrees</h2>
          </div>
          <div className="grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
            {otherWorktrees.map((worktree) => (
              <WorktreeCard
                key={worktree.path}
                worktree={worktree}
                emphasize={false}
                removing={removingWorktreePath === worktree.path}
                onRemoveDetachedWorktree={handleRemoveDetachedWorktree}
                action={
                  worktree.pathAvailable ? (
                    <Tooltip content={`Switch to ${worktree.branchName}`} sideOffset={8}>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSwitchWorktree(worktree)
                        }}
                        disabled={switchingWorktreePath === worktree.path}
                        className="bg-primary text-primary-foreground inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                        title={`Switch to ${worktree.branchName}`}
                        aria-label={`Switch to ${worktree.branchName}`}
                      >
                        {switchingWorktreePath === worktree.path ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRightLeft className="h-4 w-4" />
                        )}
                      </button>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground rounded-md border border-dashed px-2.5 py-1 text-[11px]">
                      Path missing
                    </span>
                  )
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
