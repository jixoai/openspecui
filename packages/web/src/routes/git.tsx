import { GitAutoRefreshPresetIcon, GitEntryRow, WorktreeRow } from '@/components/git/git-shared'
import { Select, type SelectOption } from '@/components/select'
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
  buildGitWorktreeHandoffHref,
  GIT_ENTRY_PAGE_SIZE,
} from '@/lib/git-panel'
import { navController } from '@/lib/nav-controller'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import {
  refreshDashboardGitSnapshot,
  removeDetachedDashboardWorktree,
  useDashboardGitTaskStatusSubscription,
} from '@/lib/use-dashboard'
import type { GitWorktreeSummary } from '@openspecui/core'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowRightLeft, FileCode2, GitBranch, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  const { data: gitTaskStatus } = useDashboardGitTaskStatusSubscription()
  const overviewQuery = useQuery({
    queryKey: ['git', 'overview'],
    queryFn: () => trpcClient.git.overview.query(),
    enabled: !staticMode,
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const entriesQuery = useInfiniteQuery({
    queryKey: ['git', 'entries'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      trpcClient.git.listEntries.query({
        cursor: pageParam,
        limit: GIT_ENTRY_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !staticMode,
    placeholderData: (previousData) => previousData,
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
  const lastHandledGitRefreshAtRef = useRef<number | null>(null)

  const switchWorktreeMutation = useMutation({
    mutationFn: (path: string) => trpcClient.git.switchWorktree.mutate({ path }),
  })

  const gitEntries = useMemo(
    () => entriesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [entriesQuery.data]
  )

  const focusRefreshAtRef = useRef(0)
  const gitAutoRefreshTimerRef = useRef<number | null>(null)
  const gitRefreshRequestRef = useRef(gitRefreshRequest)
  const refreshBusyRef = useRef(false)
  const refreshBusy =
    gitRefreshRequest !== null ||
    gitTaskStatus?.running === true ||
    switchWorktreeMutation.isPending
  const refreshReason = gitRefreshRequest?.reason ?? gitTaskStatus?.lastReason ?? null

  const clearGitAutoRefreshTimer = useCallback(() => {
    if (gitAutoRefreshTimerRef.current === null) return
    window.clearTimeout(gitAutoRefreshTimerRef.current)
    gitAutoRefreshTimerRef.current = null
  }, [])

  const runGitRefresh = useCallback((reason: string) => {
    const requestedAt = Date.now()
    setGitRefreshRequest({ reason, requestedAt })

    void refreshDashboardGitSnapshot(reason).catch((error) => {
      console.error('[GitRoute] Failed to refresh git data:', error)
      setGitRefreshRequest((current) =>
        current?.reason === reason && current.requestedAt === requestedAt ? null : current
      )
    })
  }, [])

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
      if (staticMode || worktree.isCurrent || !worktree.detached) {
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
        await removeDetachedDashboardWorktree(worktree.path)
        await overviewQuery.refetch()
      } catch (error) {
        console.error('[GitRoute] Failed to remove detached worktree:', error)
        window.alert(error instanceof Error ? error.message : 'Failed to remove detached worktree.')
      } finally {
        setRemovingWorktreePath((current) => (current === worktree.path ? null : current))
      }
    },
    [overviewQuery, staticMode]
  )

  const handleSwitchWorktree = useCallback(
    async (worktree: GitWorktreeSummary) => {
      setSwitchingWorktreePath(worktree.path)
      try {
        const handoff = await switchWorktreeMutation.mutateAsync(worktree.path)
        window.location.assign(
          buildGitWorktreeHandoffHref({
            handoff,
            location: window.location,
          })
        )
      } catch (error) {
        console.error('[GitRoute] Failed to switch worktree:', error)
        window.alert(error instanceof Error ? error.message : 'Failed to switch worktree.')
      } finally {
        setSwitchingWorktreePath((current) => (current === worktree.path ? null : current))
      }
    },
    [switchWorktreeMutation]
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
    if (!gitTaskStatus || !gitRefreshRequest) return

    const finishedAfterRequest =
      gitTaskStatus.running === false &&
      (gitTaskStatus.lastFinishedAt ?? 0) >= gitRefreshRequest.requestedAt

    if (!finishedAfterRequest) return

    setGitRefreshRequest((current) =>
      current?.reason === gitRefreshRequest.reason &&
      current.requestedAt === gitRefreshRequest.requestedAt
        ? null
        : current
    )
  }, [gitRefreshRequest, gitTaskStatus])

  useEffect(() => {
    if (staticMode) return
    if (!gitTaskStatus?.lastFinishedAt) return
    setGitAutoRefreshNow(Date.now())
  }, [gitTaskStatus?.lastFinishedAt, staticMode])

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

  useEffect(() => {
    if (staticMode) return

    const lastFinishedAt = gitTaskStatus?.lastFinishedAt ?? null
    if (lastFinishedAt === null || lastHandledGitRefreshAtRef.current === lastFinishedAt) {
      return
    }

    lastHandledGitRefreshAtRef.current = lastFinishedAt

    const hasCachedGitData = queryClient
      .getQueriesData({ queryKey: ['git'] })
      .some(([, data]) => data !== undefined)

    if (!hasCachedGitData) {
      return
    }

    void queryClient.invalidateQueries({
      queryKey: ['git'],
      refetchType: 'active',
    })
  }, [gitTaskStatus?.lastFinishedAt, queryClient, staticMode])

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

  if (overviewQuery.isLoading && !overview) {
    return <div className="route-loading animate-pulse">Loading git panel...</div>
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

        <div className="space-y-1">
          {gitEntries.map((entry) => (
            <GitEntryRow
              key={entry.type === 'commit' ? entry.hash : `uncommitted:${entry.updatedAt ?? '0'}`}
              entry={entry}
              onSelect={() => {
                navController.push('bottom', buildGitEntryHrefFromEntry(entry), null)
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
              onClick={() => void entriesQuery.fetchNextPage()}
              disabled={entriesQuery.isFetchingNextPage}
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
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 shrink-0" />
            <h2 className="font-medium">Other Worktrees</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {otherWorktrees.map((worktree) => (
              <div key={worktree.path} className="space-y-2">
                <WorktreeRow
                  worktree={worktree}
                  emphasize={false}
                  removing={removingWorktreePath === worktree.path}
                  onRemoveDetachedWorktree={handleRemoveDetachedWorktree}
                />
                <div className="flex justify-end">
                  {worktree.pathAvailable ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleSwitchWorktree(worktree)
                      }}
                      disabled={switchingWorktreePath === worktree.path}
                      className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      {switchingWorktreePath === worktree.path ? 'Switching…' : 'Switch worktree'}
                    </button>
                  ) : (
                    <span className="text-muted-foreground rounded-md border border-dashed px-2.5 py-1 text-[11px]">
                      Path missing
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
