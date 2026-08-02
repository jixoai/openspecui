/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Orchestrate fixed Home/project tabs, browser actions, and iframe lifecycle.
 * 2. Publish shell state once and consume exact-tab reachability from the shared observation owner.
 * 3. Bind Home directory launch and refresh/retry feedback to their exact runtime lifecycle.
 * 4. Preserve cross-window shell-state convergence.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 * Original request (2026-07-28): "你说的组件化封装是必要的。"
 * Original request (2026-07-29): "Workspaces 的 tab 可以提供一个 open in browser 的 icon-button。"
 * Owner correction (2026-07-31): Home is content-sized; Refresh and Open in browser are project-only global actions.
 * Owner-reported defect (2026-07-31): an offline Workspace must render one coherent recovery state.
 * Owner correction (2026-07-31): PWA is fully retired; the shell owns no install or service-worker update flow.
 * Delivery correction (2026-07-24): bind launch credentials before forwarding credential-free tabs.
 */

import { type HostedShellTheme } from '@openspecui/core/hosted-app'
import { selectWorkspaceDirectoryCatalogView } from '@openspecui/core/workspace-directory-catalog'
import { AccessibleStatus } from '@openspecui/web-src/components/realtime/realtime-primitives'
import { RealtimeSkeleton } from '@openspecui/web-src/components/realtime/realtime-skeleton'
import { type Tab } from '@openspecui/web-src/components/tabs'
import { TerminalTabs } from '@openspecui/web-src/components/terminal/terminal-tabs'
import { AlertCircle, Home, Link2, LoaderCircle, Plus, RefreshCw, Unlink2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  ConnectionObservationBoundary,
  useConnectionObservationOwner,
  useConnectionObservations,
} from '../lib/connection-observation'
import type { HostedTabReachability } from '../lib/reachability'
import { probeHostedBackend } from '../lib/reachability'
import {
  activateHostedTab,
  applyHostedLaunchRequest,
  buildHostedEmbeddedUiUrl,
  normalizeHostedApiBaseUrl,
  removeHostedTab,
  reorderHostedTabs,
  type HostedShellLaunchRequest,
  type HostedShellTab,
} from '../lib/shell-state'
import { broadcastThemeToIframes } from '../lib/theme-iframe-sync'
import { useConnections, useConnectionsActions } from '../lib/use-connections'
import {
  useWorkspaceCandidateActions,
  useWorkspaceCandidates,
} from '../lib/use-workspace-candidates'
import { composeLauncherCandidates } from '../lib/workspace-candidate-catalog'
import type { LauncherPendingCommand } from '../lib/workspace-launcher-selector'
import { selectWorkspacePathLabel } from '../lib/workspace-path-label'
import { useAppDaemonWorkspace } from './app-daemon-workspace-owner'
import { useAppLaunchError } from './app-launch-owner'
import { HostedShellThemeBootstrap } from './hosted-shell-theme'
import { WorkspaceHome } from './workspace-home'
import { WorkspaceLauncherDialog } from './workspace-launcher-dialog'
import { WorkspaceTabBrowserAction } from './workspace-tab-browser-action'

const REFRESH_FEEDBACK_MS = 1200
const HOME_TAB_ID = 'workspace-home'

function launcherProbeFailure(result: Awaited<ReturnType<typeof probeHostedBackend>>): string {
  if (result.errorMessage) return result.errorMessage
  switch (result.reachability) {
    case 'offline':
      return 'This backend is currently offline.'
    case 'authentication-required':
      return 'This backend requires a valid launch credential.'
    case 'unsupported':
      return 'This backend is not compatible with this App.'
    case 'checking':
      return 'This backend is still being checked.'
    case 'online':
      return 'The Workspace could not be opened.'
  }
}

type HostedTabFrameStatus = 'idle' | 'loading' | 'loaded' | 'error'

interface HostedShellProps {
  initialLaunchRequest: HostedShellLaunchRequest | null
  fallbackLaunchRequest?: HostedShellLaunchRequest | null
  initialError: string | null
  onOpenTaskManager?: () => void
  /**
   * App theme master preference. Force-synced to every live Workspace iframe via
   * postMessage when it changes. Child windows never echo back.
   */
  appTheme?: HostedShellTheme
}

interface HostedTabRuntimeState {
  reachability: HostedTabReachability
  projectName: string | null
  /** Canonical project directory from backend health; used for path-first tab labels. */
  projectDir: string | null
  git: { githubRemote?: string | null; branch?: string | null } | null
  openspecuiVersion: string | null
  embeddedUiUrl: string | null
  errorMessage: string | null
}

interface HostedTabFrameState {
  src: string | null
  status: HostedTabFrameStatus
}

interface HostedShellTabContentProps {
  tab: HostedShellTab
  runtime: HostedTabRuntimeState
  frameState: HostedTabFrameState
  onRetry: (tabId: string) => void
  onSetIframeRef: (tabId: string, node: HTMLIFrameElement | null) => void
  onFrameLoad: (tabId: string) => void
  onFrameError: (tabId: string) => void
}

const DEFAULT_RUNTIME_STATE: HostedTabRuntimeState = {
  reachability: 'checking',
  projectName: null,
  projectDir: null,
  git: null,
  openspecuiVersion: null,
  embeddedUiUrl: null,
  errorMessage: null,
}

const DEFAULT_FRAME_STATE: HostedTabFrameState = {
  src: null,
  status: 'idle',
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function buildHostedTabIframeSrc(
  tab: HostedShellTab,
  runtime: HostedTabRuntimeState
): string | null {
  return runtime.embeddedUiUrl ? buildHostedEmbeddedUiUrl(tab, runtime.embeddedUiUrl) : null
}

function HostedShellActions(props: {
  isRefreshing: boolean
  isRefreshFeedbackActive: boolean
  onRefresh: () => void
  onAdd: () => void
  browserAction?: ReactNode
  showRefresh?: boolean
}) {
  const buttonClassName =
    'border-border bg-terminal text-terminal-foreground hover:bg-background hover:text-foreground cursor-hover inline-flex items-center justify-center border-l p-4 text-sm transition-colors duration-200'
  const refreshActive = props.isRefreshing || props.isRefreshFeedbackActive

  return (
    <div className="flex h-full items-stretch" data-tabs-actions="true">
      {props.showRefresh !== false && (
        <button
          type="button"
          onClick={props.onRefresh}
          className={cx(buttonClassName, refreshActive && 'bg-background text-foreground')}
          aria-label="Reload current tab"
          title="Reload current tab"
        >
          <RefreshCw className={cx('h-3.5 w-3.5', refreshActive && 'animate-spin')} />
        </button>
      )}
      {props.browserAction}
      <button
        type="button"
        onClick={props.onAdd}
        className={buttonClassName}
        aria-label="Add backend API"
        title="Add backend API"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

export function HostedShellTabContent({
  tab,
  runtime,
  frameState,
  onRetry,
  onSetIframeRef,
  onFrameLoad,
  onFrameError,
}: HostedShellTabContentProps) {
  const pathLabel =
    runtime.projectDir !== null
      ? selectWorkspacePathLabel({ projectPath: runtime.projectDir, git: null })
      : null
  const title = pathLabel?.title ?? runtime.projectName ?? tab.apiBaseUrl
  const iframeTitle = `Hosted OpenSpec UI ${title}`
  const iframeSrc = buildHostedTabIframeSrc(tab, runtime)
  const showInlineError =
    runtime.reachability !== 'checking' &&
    runtime.reachability !== 'offline' &&
    runtime.errorMessage
  const isFrameLoading =
    iframeSrc !== null && (frameState.status === 'idle' || frameState.status === 'loading')
  const showFrameError = iframeSrc !== null && frameState.status === 'error'

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-hosted-reachability={runtime.reachability}>
      {runtime.reachability === 'offline' && iframeSrc !== null && (
        <div className="border-border bg-muted/40 text-muted-foreground flex items-center justify-between gap-3 border-b px-3 py-2 text-xs">
          <span>
            Backend unreachable. The Workspace stays mounted so you can retry without losing
            context.
          </span>
          <button
            type="button"
            onClick={() => onRetry(tab.id)}
            className="hover:bg-muted border-border rounded-none border px-2 py-1 font-medium transition"
          >
            Retry
          </button>
        </div>
      )}

      {showInlineError && (
        <div className="border-border bg-muted/30 flex items-start gap-2 border-b px-3 py-2 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p>{runtime.errorMessage}</p>
            {runtime.openspecuiVersion && (
              <p className="text-muted-foreground">
                Detected backend version: {runtime.openspecuiVersion}
              </p>
            )}
          </div>
        </div>
      )}

      {iframeSrc ? (
        <div className="relative flex min-h-0 flex-1" aria-busy={isFrameLoading}>
          {isFrameLoading && (
            <div className="bg-background/85 pointer-events-none absolute inset-0 z-10 grid content-start gap-3 p-4 backdrop-blur-[1px]">
              <AccessibleStatus>Loading hosted project</AccessibleStatus>
              <RealtimeSkeleton className="h-8 w-48" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <RealtimeSkeleton className="h-24" />
                <RealtimeSkeleton className="h-24" />
                <RealtimeSkeleton className="h-24" />
              </div>
              <RealtimeSkeleton className="h-48" />
            </div>
          )}
          {showFrameError && !isFrameLoading && (
            <div className="bg-background/75 pointer-events-none absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]">
              <div className="border-border bg-background/95 text-muted-foreground inline-flex items-center gap-2 border px-3 py-2 text-xs shadow-sm">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span>Reload did not finish. Try refresh again.</span>
              </div>
            </div>
          )}
          <iframe
            ref={(node) => {
              onSetIframeRef(tab.id, node)
            }}
            title={iframeTitle}
            src={iframeSrc}
            allow="clipboard-read; clipboard-write"
            onLoad={() => {
              onFrameLoad(tab.id)
            }}
            onError={() => {
              onFrameError(tab.id)
            }}
            className={cx(
              'min-h-0 flex-1 border-0 bg-transparent',
              runtime.reachability === 'offline' && 'opacity-75 saturate-0'
            )}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 text-center">
          {runtime.reachability === 'checking' ? (
            <div className="w-full max-w-lg space-y-3 text-left" aria-busy="true">
              <AccessibleStatus>connecting backend</AccessibleStatus>
              <RealtimeSkeleton className="h-7 w-44" />
              <RealtimeSkeleton className="h-3 w-3/4" />
              <RealtimeSkeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="max-w-sm space-y-2 text-sm">
              {runtime.reachability === 'offline' && !iframeSrc && (
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="text-muted-foreground h-5 w-5" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-medium">Backend unreachable</p>
                    <p className="text-muted-foreground text-xs">
                      This Workspace remains open and will reconnect when the backend returns.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRetry(tab.id)}
                    className="hover:bg-muted border-border rounded-none border px-3 py-1.5 text-xs font-medium transition"
                  >
                    Retry
                  </button>
                </div>
              )}
              {runtime.reachability === 'authentication-required' && runtime.errorMessage && (
                <p className="text-muted-foreground text-xs">{runtime.errorMessage}</p>
              )}
              {runtime.reachability === 'online' && runtime.errorMessage && (
                <p className="text-muted-foreground text-xs">
                  This backend is reachable, but it does not expose a compatible embedded UI yet.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function createHostedShellTab(props: {
  tab: HostedShellTab
  runtime: HostedTabRuntimeState
  frameState: HostedTabFrameState
  onRetry: (tabId: string) => void
  onSetIframeRef: (tabId: string, node: HTMLIFrameElement | null) => void
  onFrameLoad: (tabId: string) => void
  onFrameError: (tabId: string) => void
}): Tab {
  // Path-first label: verified GitHub org/repo or directory basename when projectDir is known;
  // fall back to projectName. host/port stays diagnostic-only (not the primary tab label).
  const pathLabel =
    props.runtime.projectDir !== null
      ? selectWorkspacePathLabel({ projectPath: props.runtime.projectDir, git: props.runtime.git })
      : null
  const title = pathLabel?.title ?? props.runtime.projectName ?? props.tab.apiBaseUrl
  const subtitle = pathLabel?.subtitle ?? pathLabel?.detail ?? props.tab.apiBaseUrl

  return {
    id: props.tab.id,
    closable: true,
    closeButtonVisibility: 'always',
    label: (
      <div
        className={cx(
          'flex min-w-0 items-center gap-1 py-0.5 text-left transition',
          props.runtime.reachability === 'offline' && 'opacity-60 grayscale'
        )}
        data-hosted-reachability={props.runtime.reachability}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            {props.runtime.reachability === 'checking' && (
              <LoaderCircle className="h-3 w-3 animate-spin" />
            )}
            {props.runtime.reachability === 'online' && (
              <Link2 className="h-3 w-3 text-emerald-500" />
            )}
            {props.runtime.reachability === 'offline' && (
              <Unlink2 className="h-3 w-3 text-amber-500" />
            )}
            {props.runtime.reachability === 'authentication-required' && (
              <AlertCircle className="h-3 w-3 text-amber-500" />
            )}
            <span className="font-nav min-w-0 truncate text-xs">{title}</span>
          </span>
          <span className="text-muted-foreground max-w-72 truncate text-[10px]">{subtitle}</span>
        </span>
      </div>
    ),
    content: <HostedShellTabContent {...props} />,
  }
}

function HostedShellRuntime({
  initialLaunchRequest,
  fallbackLaunchRequest = null,
  initialError,
  onOpenTaskManager,
  appTheme,
}: HostedShellProps) {
  const appLaunchError = useAppLaunchError()
  const daemonWorkspace = useAppDaemonWorkspace()
  const [errorMessage, setErrorMessage] = useState(initialError)
  const connectionOwner = useConnectionObservationOwner()
  const connectionSnapshot = useConnectionObservations()
  const connectionActions = useConnectionsActions()
  const candidateCatalog = useWorkspaceCandidates()
  const candidateActions = useWorkspaceCandidateActions()
  const shellState = useConnections()
  const setShellState = useCallback(
    (resolveNext: (current: typeof shellState) => typeof shellState) => {
      connectionActions.setState(resolveNext(connectionActions.getState()))
    },
    [connectionActions]
  )
  const [tabFrames, setTabFrames] = useState<Record<string, HostedTabFrameState>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRefreshFeedbackActive, setIsRefreshFeedbackActive] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(null)
  const [addDialogError, setAddDialogError] = useState<string | null>(null)
  const [launcherPending, setLauncherPending] = useState<readonly LauncherPendingCommand[]>([])
  const launcherPendingRef = useRef(new Map<string, LauncherPendingCommand>())
  // Favorites / Recent are replaced from daemon snapshots, never browser persistence.
  const directoryCatalog = daemonWorkspace.directoryCatalog
  const [homePathError, setHomePathError] = useState<string | null>(null)
  const [homePathPending, setHomePathPending] = useState(false)
  const [selectedWorkspaceTabId, setSelectedWorkspaceTabId] = useState(HOME_TAB_ID)
  const [candidateReachability, setCandidateReachability] = useState<
    Readonly<Record<string, HostedTabReachability>>
  >({})
  const isolatedLaunchHandledRef = useRef(false)
  const refreshFeedbackTimerRef = useRef<number | null>(null)
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

  // Force-sync the App theme to every live Workspace iframe (one-directional master push).
  useEffect(() => {
    if (!appTheme) return
    broadcastThemeToIframes(iframeRefs.current, appTheme)
  }, [appTheme])

  useEffect(() => {
    if (appLaunchError !== undefined) setErrorMessage(appLaunchError)
  }, [appLaunchError])

  useEffect(() => {
    setSelectedWorkspaceTabId(shellState.activeTabId ?? HOME_TAB_ID)
  }, [shellState.activeTabId])

  useEffect(() => {
    let active = true
    const closedCandidates = composeLauncherCandidates(
      candidateCatalog,
      daemonWorkspace.workspaces.map((workspace) => ({
        apiBaseUrl: workspace.backendUrl,
        source: 'daemon-live' as const,
        label: workspace.projectDir,
      }))
    ).filter((candidate) => !shellState.tabs.some((tab) => tab.apiBaseUrl === candidate.apiBaseUrl))
    for (const candidate of closedCandidates) {
      setCandidateReachability((current) => ({
        ...current,
        [candidate.apiBaseUrl]: 'checking',
      }))
      void probeHostedBackend(candidate.apiBaseUrl).then((result) => {
        if (!active) return
        setCandidateReachability((current) => ({
          ...current,
          [candidate.apiBaseUrl]: result.reachability,
        }))
      })
    }
    return () => {
      active = false
    }
  }, [candidateCatalog, daemonWorkspace.workspaces, shellState.tabs])

  const openAddDialog = useCallback(() => {
    setAddDialogError(null)
    setIsAddDialogOpen(true)
  }, [])

  const runLauncherTransition = useCallback(
    (apiBaseUrl: string, kind: LauncherPendingCommand['kind']) => {
      const normalized = normalizeHostedApiBaseUrl(apiBaseUrl)
      if (!normalized) {
        setAddDialogError('Enter a valid backend API URL.')
        return
      }
      if (launcherPendingRef.current.has(normalized)) return

      const command = { apiBaseUrl: normalized, kind } satisfies LauncherPendingCommand
      launcherPendingRef.current.set(normalized, command)
      setLauncherPending([...launcherPendingRef.current.values()])
      setAddDialogError(null)

      void probeHostedBackend(normalized)
        .then((result) => {
          setCandidateReachability((current) => ({
            ...current,
            [normalized]: result.reachability,
          }))
          if (result.reachability !== 'online') {
            setAddDialogError(launcherProbeFailure(result))
            return
          }
          if (kind === 'connect') {
            candidateActions.addManualCandidate(normalized, result.health?.projectName)
          }
          setShellState((current) => applyHostedLaunchRequest(current, { apiBaseUrl: normalized }))
          setIsAddDialogOpen(false)
        })
        .catch((error: unknown) => {
          setAddDialogError(
            error instanceof Error ? error.message : 'The Workspace could not be opened.'
          )
        })
        .finally(() => {
          launcherPendingRef.current.delete(normalized)
          setLauncherPending([...launcherPendingRef.current.values()])
        })
    },
    [candidateActions, setShellState]
  )

  const updateTabFrameState = useCallback(
    (tabId: string, resolveNext: (previous: HostedTabFrameState) => HostedTabFrameState) => {
      setTabFrames((current) => {
        const previous = current[tabId] ?? DEFAULT_FRAME_STATE
        const nextState = resolveNext(previous)
        if (previous.src === nextState.src && previous.status === nextState.status) {
          return current
        }
        return {
          ...current,
          [tabId]: nextState,
        }
      })
    },
    []
  )

  const setIframeRef = useCallback((tabId: string, node: HTMLIFrameElement | null) => {
    if (node) {
      iframeRefs.current[tabId] = node
      return
    }
    delete iframeRefs.current[tabId]
  }, [])

  const markFrameLoaded = useCallback(
    (tabId: string) => {
      updateTabFrameState(tabId, (previous) => ({
        ...previous,
        status: 'loaded',
      }))
      // First-load theme inheritance: push the current App theme to the freshly loaded iframe.
      // This replaces URL-param inheritance (which would reload the iframe on every theme change).
      if (appTheme) {
        const iframe = iframeRefs.current[tabId]
        if (iframe) {
          broadcastThemeToIframes({ [tabId]: iframe }, appTheme)
        }
      }
    },
    [appTheme, updateTabFrameState]
  )

  const markFrameErrored = useCallback(
    (tabId: string) => {
      updateTabFrameState(tabId, (previous) => ({
        ...previous,
        status: 'error',
      }))
    },
    [updateTabFrameState]
  )

  const reloadHostedTab = useCallback(
    (tabId: string) => {
      const iframe = iframeRefs.current[tabId]
      if (!iframe) {
        return
      }

      updateTabFrameState(tabId, (previous) => ({
        ...previous,
        status: 'loading',
      }))

      let currentHref: string | null = null
      try {
        currentHref = iframe.contentWindow?.location.href ?? null
      } catch {
        currentHref = null
      }

      try {
        iframe.contentWindow?.location.reload()
        return
      } catch {
        // Fall back to assigning the current frame URL below.
      }

      const fallbackSrc = currentHref ?? iframe.getAttribute('src') ?? iframe.src
      if (fallbackSrc) {
        iframe.src = fallbackSrc
      }
    },
    [updateTabFrameState]
  )

  const startRefreshFeedback = useCallback(() => {
    setIsRefreshFeedbackActive(true)
    if (refreshFeedbackTimerRef.current !== null) {
      window.clearTimeout(refreshFeedbackTimerRef.current)
    }
    refreshFeedbackTimerRef.current = window.setTimeout(() => {
      refreshFeedbackTimerRef.current = null
      setIsRefreshFeedbackActive(false)
    }, REFRESH_FEEDBACK_MS)
  }, [])

  useEffect(() => {
    if (isolatedLaunchHandledRef.current) return
    isolatedLaunchHandledRef.current = true
    const persisted = connectionActions.getState()
    if (initialLaunchRequest) {
      connectionActions.setState(applyHostedLaunchRequest(persisted, initialLaunchRequest))
      return
    }
    if (persisted.tabs.length === 0 && fallbackLaunchRequest) {
      connectionActions.setState(applyHostedLaunchRequest(persisted, fallbackLaunchRequest))
    }
  }, [connectionActions, fallbackLaunchRequest, initialLaunchRequest])

  const tabRuntime = useMemo(() => {
    const byTabId = new Map(
      connectionSnapshot.observations.map((observation) => [observation.tabId, observation])
    )
    return Object.fromEntries(
      shellState.tabs.map((tab) => {
        const observation = byTabId.get(tab.id)
        const daemonBinding = daemonWorkspace.workspaces.find(
          (workspace) =>
            normalizeHostedApiBaseUrl(workspace.backendUrl) ===
            normalizeHostedApiBaseUrl(tab.apiBaseUrl)
        )
        const health = observation?.health ?? null
        const reachability = observation?.reachability ?? 'checking'
        return [
          tab.id,
          {
            reachability,
            projectName: health?.projectName ?? null,
            projectDir: daemonBinding?.projectDir ?? health?.projectDir ?? null,
            git: daemonBinding?.git
              ? {
                  githubRemote: daemonBinding.git.remoteUrl,
                  branch: daemonBinding.git.branch,
                }
              : null,
            openspecuiVersion: health?.openspecuiVersion ?? null,
            embeddedUiUrl:
              reachability !== 'unsupported' && reachability !== 'authentication-required'
                ? (health?.embeddedUiUrl ?? null)
                : null,
            errorMessage: observation?.healthError ?? null,
          } satisfies HostedTabRuntimeState,
        ]
      })
    )
  }, [connectionSnapshot.observations, daemonWorkspace.workspaces, shellState.tabs])

  const launcherCandidates = useMemo(
    () =>
      composeLauncherCandidates(
        candidateCatalog,
        daemonWorkspace.workspaces.map((workspace) => ({
          apiBaseUrl: workspace.backendUrl,
          source: 'daemon-live' as const,
          label: workspace.projectDir,
        }))
      ).map((candidate) => {
        const binding = daemonWorkspace.workspaces.find(
          (workspace) => workspace.backendUrl === candidate.apiBaseUrl
        )
        const tab = shellState.tabs.find(
          (workspace) => workspace.apiBaseUrl === candidate.apiBaseUrl
        )
        const runtime = tab ? tabRuntime[tab.id] : undefined
        return {
          apiBaseUrl: candidate.apiBaseUrl,
          source: candidate.source,
          reachability:
            runtime?.reachability ??
            candidateReachability[candidate.apiBaseUrl] ??
            (binding ? 'online' : 'checking'),
          label: binding
            ? selectWorkspacePathLabel({
                projectPath: binding.projectDir,
                git: binding.git
                  ? { githubRemote: binding.git.remoteUrl, branch: binding.git.branch }
                  : null,
              })
            : selectWorkspacePathLabel({
                projectPath: candidate.label ?? candidate.apiBaseUrl,
                git: null,
              }),
        }
      }),
    [
      candidateCatalog,
      candidateReachability,
      daemonWorkspace.workspaces,
      shellState.tabs,
      tabRuntime,
    ]
  )

  useEffect(() => {
    return () => {
      if (refreshFeedbackTimerRef.current !== null) {
        window.clearTimeout(refreshFeedbackTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setTabFrames((current) => {
      const activeTabIds = new Set(shellState.tabs.map((tab) => tab.id))
      for (const tabId of Object.keys(iframeRefs.current)) {
        if (!activeTabIds.has(tabId)) {
          delete iframeRefs.current[tabId]
        }
      }

      let changed = Object.keys(current).length !== shellState.tabs.length
      const next: Record<string, HostedTabFrameState> = {}
      for (const tab of shellState.tabs) {
        const runtime = tabRuntime[tab.id] ?? DEFAULT_RUNTIME_STATE
        const src = buildHostedTabIframeSrc(tab, runtime)
        const previous = current[tab.id] ?? null
        const nextState: HostedTabFrameState =
          previous && previous.src === src
            ? previous
            : {
                src,
                status: src ? 'loading' : 'idle',
              }

        if (!previous || previous.src !== nextState.src || previous.status !== nextState.status) {
          changed = true
        }
        next[tab.id] = nextState
      }

      return changed ? next : current
    })
  }, [shellState.tabs, tabRuntime])

  const probeTabs = useCallback(
    async (options?: { tabIds?: readonly string[]; visualFeedback?: boolean }) => {
      const targets = shellState.tabs.filter(
        (tab) => !options?.tabIds || options.tabIds.includes(tab.id)
      )
      if (targets.length === 0) {
        return
      }

      if (options?.visualFeedback) {
        startRefreshFeedback()
        setIsRefreshing(true)
      }

      try {
        await connectionOwner.refresh(targets.map((tab) => tab.id))
      } finally {
        if (options?.visualFeedback) {
          setIsRefreshing(false)
        }
      }
    },
    [connectionOwner, shellState.tabs, startRefreshFeedback]
  )

  const activeHostedTab =
    shellState.tabs.find((tab) => tab.id === shellState.activeTabId) ?? shellState.tabs[0] ?? null
  const activeRuntime = activeHostedTab
    ? (tabRuntime[activeHostedTab.id] ?? DEFAULT_RUNTIME_STATE)
    : null
  const activePathLabel =
    activeRuntime?.projectDir !== null && activeRuntime?.projectDir !== undefined
      ? selectWorkspacePathLabel({
          projectPath: activeRuntime.projectDir,
          git: activeRuntime.git,
        })
      : null
  const activeWorkspaceTitle = activeHostedTab
    ? (activePathLabel?.title ?? activeRuntime?.projectName ?? activeHostedTab.apiBaseUrl)
    : null
  const activeWorkspaceId = activeHostedTab
    ? daemonWorkspace.resolveWorkspaceId(activeHostedTab.apiBaseUrl)
    : null

  const handleRefreshCurrentTab = useCallback(() => {
    if (!activeHostedTab) {
      return
    }

    setErrorMessage(null)
    reloadHostedTab(activeHostedTab.id)
    void probeTabs({
      tabIds: [activeHostedTab.id],
      visualFeedback: true,
    })
  }, [activeHostedTab, probeTabs, reloadHostedTab])

  const handleOpenWorkspaceInBrowser = useCallback(
    (workspaceId: string) => {
      if (openingWorkspaceId !== null) return
      setOpeningWorkspaceId(workspaceId)
      void daemonWorkspace
        .openWorkspaceInBrowser(workspaceId)
        .catch(() => {})
        .finally(() => {
          setOpeningWorkspaceId((current) => (current === workspaceId ? null : current))
        })
    },
    [daemonWorkspace, openingWorkspaceId]
  )

  useEffect(() => {
    if (!activeHostedTab) {
      document.title = 'OpenSpec UI App'
      return
    }
    document.title = `${activeWorkspaceTitle} - OpenSpec UI App`
  }, [activeHostedTab, activeWorkspaceTitle])

  const tabs = useMemo(() => {
    const projectTabs = shellState.tabs.map((tab) =>
      createHostedShellTab({
        tab,
        runtime: tabRuntime[tab.id] ?? DEFAULT_RUNTIME_STATE,
        frameState: tabFrames[tab.id] ?? DEFAULT_FRAME_STATE,
        onRetry: (tabId) => {
          void probeTabs({ tabIds: [tabId], visualFeedback: true })
        },
        onSetIframeRef: setIframeRef,
        onFrameLoad: markFrameLoaded,
        onFrameError: markFrameErrored,
      })
    )
    // Fixed, non-closeable Home tab as the first Workspace tab (4.0a).
    const homeTab: Tab = {
      id: HOME_TAB_ID,
      closable: false,
      label: (
        <div className="flex min-w-0 items-center gap-1 py-0.5 text-left">
          <Home className="h-3 w-3 shrink-0" />
          <span className="font-nav min-w-0 truncate text-xs">Home</span>
        </div>
      ),
      content: (
        <WorkspaceHome
          catalog={selectWorkspaceDirectoryCatalogView(directoryCatalog)}
          launchSupported={daemonWorkspace.availability === 'supported'}
          pending={homePathPending}
          error={homePathError}
          onOpenTaskManager={onOpenTaskManager}
          onSubmitPath={(projectDir) => {
            setHomePathPending(true)
            setHomePathError(null)
            void daemonWorkspace
              .startManagedProject(projectDir)
              .then((workspace) => {
                const tab = connectionActions
                  .getState()
                  .tabs.find((candidate) => candidate.apiBaseUrl === workspace.backendUrl)
                setSelectedWorkspaceTabId(tab?.id ?? HOME_TAB_ID)
              })
              .catch((error: unknown) => {
                setHomePathError(
                  error instanceof Error ? error.message : 'Managed project failed to start.'
                )
              })
              .finally(() => setHomePathPending(false))
          }}
          onToggleFavorite={(canonicalPath, favorite) => {
            setHomePathError(null)
            void daemonWorkspace
              .setDirectoryFavorite(canonicalPath, favorite)
              .catch((error: unknown) => {
                setHomePathError(
                  error instanceof Error ? error.message : 'Failed to persist Workspace favorite.'
                )
              })
          }}
          onOpenDirectory={(canonicalPath) => {
            setHomePathPending(true)
            setHomePathError(null)
            void daemonWorkspace
              .startManagedProject(canonicalPath)
              .then((workspace) => {
                const tab = connectionActions
                  .getState()
                  .tabs.find((candidate) => candidate.apiBaseUrl === workspace.backendUrl)
                setSelectedWorkspaceTabId(tab?.id ?? HOME_TAB_ID)
              })
              .catch((error: unknown) => {
                setHomePathError(
                  error instanceof Error ? error.message : 'Managed project failed to start.'
                )
              })
              .finally(() => setHomePathPending(false))
          }}
        />
      ),
    }
    return [homeTab, ...projectTabs]
  }, [
    markFrameErrored,
    markFrameLoaded,
    connectionActions,
    daemonWorkspace,
    directoryCatalog,
    homePathError,
    homePathPending,
    onOpenTaskManager,
    probeTabs,
    setIframeRef,
    shellState.tabs,
    tabFrames,
    tabRuntime,
  ])

  return (
    <div className="hosted-shell-root bg-background text-foreground flex h-full min-h-0 min-w-0 flex-col">
      <HostedShellThemeBootstrap />

      {(daemonWorkspace.error ?? errorMessage) && (
        <div
          role="status"
          className="border-border bg-muted/30 flex items-center gap-2 border-b px-3 py-2 text-xs"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
          <span>{daemonWorkspace.error ?? errorMessage}</span>
        </div>
      )}

      {tabs.length === 0 ? (
        <div className="flex h-full min-w-0 flex-col">
          <div className="tabs-header border-border bg-muted/40 text-foreground flex min-w-0 items-stretch border-b">
            <div
              className="tabs-strip bg-muted/40 min-w-0 flex-1 px-4 py-3"
              onDoubleClick={openAddDialog}
            >
              <p className="font-nav text-xs uppercase tracking-[0.16em]">OpenSpec UI App</p>
            </div>
            <div className="tabs-actions border-border bg-muted/40 text-foreground flex shrink-0 items-center border-l">
              <HostedShellActions
                isRefreshing={false}
                isRefreshFeedbackActive={false}
                onRefresh={() => {}}
                onAdd={openAddDialog}
                showRefresh={false}
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 text-center">
            <div className="space-y-3">
              <p className="font-nav text-xs uppercase tracking-[0.16em]">No Workspaces</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                Open a backend connection to start an OpenSpec UI Workspace.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="h-full min-h-0"
          style={
            {
              '--terminal': 'var(--background)',
              '--terminal-foreground': 'var(--foreground)',
            } as CSSProperties
          }
        >
          <TerminalTabs
            tabs={tabs}
            selectedTab={selectedWorkspaceTabId}
            onTabChange={(tabId) => {
              setSelectedWorkspaceTabId(tabId)
              if (tabId === HOME_TAB_ID) return
              setShellState((current) => activateHostedTab(current, tabId))
            }}
            onTabClose={(tabId) => {
              if (tabId === HOME_TAB_ID) return
              setShellState((current) => {
                // Resolve the locator before removing the tab so an unchanged daemon snapshot does not
                // reopen this Workspace (3.2/3.7). No-op for non-daemon-backed locators.
                const closing = current.tabs.find((tab) => tab.id === tabId)
                if (closing) daemonWorkspace.dismissDaemonWorkspace(closing.apiBaseUrl)
                const next = removeHostedTab(current, tabId)
                setSelectedWorkspaceTabId(next.activeTabId ?? HOME_TAB_ID)
                return next
              })
            }}
            onTabOrderChange={(orderedTabIds) => {
              // Home tab stays first; filter it out before reordering project tabs.
              const projectIds = orderedTabIds.filter((id) => id !== HOME_TAB_ID)
              setShellState((current) => reorderHostedTabs(current, projectIds))
            }}
            onTabBarDoubleClick={openAddDialog}
            actions={
              <HostedShellActions
                isRefreshing={isRefreshing}
                isRefreshFeedbackActive={isRefreshFeedbackActive}
                onRefresh={handleRefreshCurrentTab}
                onAdd={openAddDialog}
                showRefresh={selectedWorkspaceTabId !== HOME_TAB_ID}
                browserAction={
                  selectedWorkspaceTabId !== HOME_TAB_ID && activeWorkspaceTitle ? (
                    <WorkspaceTabBrowserAction
                      label={activeWorkspaceTitle}
                      workspaceId={activeWorkspaceId}
                      pending={
                        activeWorkspaceId !== null && openingWorkspaceId === activeWorkspaceId
                      }
                      onOpen={handleOpenWorkspaceInBrowser}
                    />
                  ) : undefined
                }
              />
            }
            className="hosted-shell-tabs h-full min-h-0"
          />
        </div>
      )}

      <WorkspaceLauncherDialog
        open={isAddDialogOpen}
        onClose={() => {
          if (launcherPending.length === 0) setIsAddDialogOpen(false)
        }}
        candidates={launcherCandidates}
        openWorkspaces={shellState.tabs.map((tab) => ({ apiBaseUrl: tab.apiBaseUrl }))}
        pending={launcherPending}
        onFocus={(apiBaseUrl) => {
          const tab = shellState.tabs.find((t) => t.apiBaseUrl === apiBaseUrl)
          if (tab) setShellState((current) => activateHostedTab(current, tab.id))
          setIsAddDialogOpen(false)
        }}
        onOpen={(apiBaseUrl) => {
          runLauncherTransition(apiBaseUrl, 'open')
        }}
        onForget={(apiBaseUrl) => candidateActions.forgetManualCandidate(apiBaseUrl)}
        onConnect={(apiBaseUrl) => {
          runLauncherTransition(apiBaseUrl, 'connect')
        }}
        error={addDialogError}
      />
    </div>
  )
}

/** Render Hosted Shell against the App owner, supplying one only for isolated component mounts. */
export function HostedShell(props: HostedShellProps) {
  return (
    <ConnectionObservationBoundary>
      <HostedShellRuntime {...props} />
    </ConnectionObservationBoundary>
  )
}
