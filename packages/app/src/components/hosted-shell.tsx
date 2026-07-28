/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Orchestrate persistent credential-free project tabs and the embedded frame's visual lifecycle.
 * 2. Coordinate PWA install, display, and update ownership.
 * 3. Publish shell state once and consume exact-tab reachability from the shared observation owner.
 * 4. Keep refresh/retry feedback attached to the affected tab runtime.
 * 5. Preserve cross-window shell-state convergence.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 * Original request (2026-07-28): "你说的组件化封装是必要的。"
 * Delivery correction (2026-07-24): bind launch credentials before forwarding credential-free tabs.
 * Compromise: tab, frame, and PWA display lifecycles remain co-located because they settle in one mounted
 * shell; launch, health, and Root observation are physically extracted into App-lifetime owners.
 */
import { Dialog } from '@openspecui/web-src/components/dialog'
import { AccessibleStatus } from '@openspecui/web-src/components/realtime/realtime-primitives'
import { RealtimeSkeleton } from '@openspecui/web-src/components/realtime/realtime-skeleton'
import { type Tab } from '@openspecui/web-src/components/tabs'
import { TerminalTabs } from '@openspecui/web-src/components/terminal/terminal-tabs'
import { AlertCircle, Download, Link2, LoaderCircle, Plus, RefreshCw, Unlink2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import {
  ConnectionObservationBoundary,
  useConnectionObservationOwner,
  useConnectionObservations,
} from '../lib/connection-observation'
import {
  computeHostedAppDisplayMode,
  EMPTY_TITLEBAR_INSETS,
  isBeforeInstallPromptEvent,
  readHostedAppTitlebarInsets,
  type BeforeInstallPromptEventLike,
  type HostedAppDisplayMode,
  type HostedAppTitlebarInsets,
  type HostedAppWindowControlsOverlayLike,
} from '../lib/pwa-runtime'
import type { HostedTabReachability } from '../lib/reachability'
import {
  activateHostedTab,
  applyHostedLaunchRequest,
  buildHostedEmbeddedUiUrl,
  getHostedTabLabel,
  normalizeHostedApiBaseUrl,
  removeHostedTab,
  reorderHostedTabs,
  type HostedShellLaunchRequest,
  type HostedShellTab,
} from '../lib/shell-state'
import { useConnections, useConnectionsActions } from '../lib/use-connections'
import { useAppLaunchError } from './app-launch-owner'
import { HostedShellThemeBootstrap } from './hosted-shell-theme'

const REFRESH_FEEDBACK_MS = 1200
const UPDATE_CHECK_INTERVAL_MS = 60000
const UPDATE_READY_MESSAGE = 'A newer OpenSpec UI App shell is ready.'

type HostedTabFrameStatus = 'idle' | 'loading' | 'loaded' | 'error'

interface HostedShellProps {
  initialLaunchRequest: HostedShellLaunchRequest | null
  fallbackLaunchRequest?: HostedShellLaunchRequest | null
  initialError: string | null
}

interface HostedTabRuntimeState {
  reachability: HostedTabReachability
  projectName: string | null
  openspecuiVersion: string | null
  embeddedUiUrl: string | null
  errorMessage: string | null
}

interface HostedTabFrameState {
  src: string | null
  status: HostedTabFrameStatus
}

interface HostedShellPwaState {
  canInstall: boolean
  isInstalling: boolean
  isInstalled: boolean
  displayMode: HostedAppDisplayMode
  titlebarInsets: HostedAppTitlebarInsets
}

type HostedAppUpdateStatus = 'idle' | 'ready'

interface HostedAppUpdateState {
  status: HostedAppUpdateStatus
  errorMessage: string | null
}

interface HostedShellRootStyle extends CSSProperties {
  '--hosted-pwa-titlebar-left': string
  '--hosted-pwa-titlebar-right': string
  '--hosted-pwa-titlebar-top': string
  '--hosted-pwa-titlebar-height': string
}

interface HostedNavigator extends Navigator {
  standalone?: boolean
  windowControlsOverlay?: HostedAppWindowControlsOverlayLike
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
  openspecuiVersion: null,
  embeddedUiUrl: null,
  errorMessage: null,
}

const DEFAULT_FRAME_STATE: HostedTabFrameState = {
  src: null,
  status: 'idle',
}

const DEFAULT_PWA_STATE: HostedShellPwaState = {
  canInstall: false,
  isInstalling: false,
  isInstalled: false,
  displayMode: 'browser',
  titlebarInsets: EMPTY_TITLEBAR_INSETS,
}

const DEFAULT_UPDATE_STATE: HostedAppUpdateState = {
  status: 'idle',
  errorMessage: null,
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function shouldExposeHostedAppUpdate(options: {
  hasTabs: boolean
  registration: Pick<ServiceWorkerRegistration, 'waiting'>
}): HostedAppUpdateState {
  if (options.registration.waiting && options.hasTabs) {
    return { status: 'ready', errorMessage: null }
  }
  return { status: 'idle', errorMessage: null }
}

function shouldAutoApplyHostedAppUpdate(options: {
  hasTabs: boolean
  registration: Pick<ServiceWorkerRegistration, 'waiting'>
}): boolean {
  return !options.hasTabs && Boolean(options.registration.waiting)
}

function buildHostedTabIframeSrc(
  tab: HostedShellTab,
  runtime: HostedTabRuntimeState
): string | null {
  return runtime.embeddedUiUrl ? buildHostedEmbeddedUiUrl(tab, runtime.embeddedUiUrl) : null
}

function createBrowserPwaSnapshot(deferredPrompt: BeforeInstallPromptEventLike | null) {
  const hostedNavigator = navigator as HostedNavigator
  const runtime = {
    matchMedia: (query: string) => window.matchMedia(query),
    innerWidth: window.innerWidth,
    navigatorStandalone: hostedNavigator.standalone,
    windowControlsOverlay: hostedNavigator.windowControlsOverlay,
  }
  const displayMode = computeHostedAppDisplayMode(runtime)
  return {
    canInstall: deferredPrompt !== null && displayMode === 'browser',
    isInstalling: false,
    isInstalled: displayMode !== 'browser',
    displayMode,
    titlebarInsets: readHostedAppTitlebarInsets(runtime),
  } satisfies HostedShellPwaState
}

function HostedShellUpdateIcon() {
  return <RefreshCw className="h-3.5 w-3.5" />
}

function HostedShellActions(props: {
  isRefreshing: boolean
  isRefreshFeedbackActive: boolean
  onRefresh: () => void
  onAdd: () => void
  canInstall: boolean
  isInstalling: boolean
  onInstall: () => void
  onApplyUpdate: () => void
  updateStatus: HostedAppUpdateStatus
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
      {props.updateStatus === 'ready' ? (
        <button
          type="button"
          onClick={props.onApplyUpdate}
          className={buttonClassName}
          aria-label="Apply app update"
          title="Apply app update"
        >
          <HostedShellUpdateIcon />
        </button>
      ) : (
        props.canInstall && (
          <button
            type="button"
            onClick={props.onInstall}
            className={buttonClassName}
            aria-label="Install OpenSpec UI App"
            title="Install OpenSpec UI App"
          >
            <Download className={cx('h-4 w-4', props.isInstalling && 'animate-pulse')} />
          </button>
        )
      )}
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
  const title = runtime.projectName ?? getHostedTabLabel(tab)
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
      {runtime.reachability === 'offline' && (
        <div className="border-border bg-muted/40 text-muted-foreground flex items-center justify-between gap-3 border-b px-3 py-2 text-xs">
          <span>
            Backend unreachable. The session stays mounted so you can retry without losing context.
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
                <p className="text-muted-foreground text-xs">
                  Waiting for this backend to come online.
                </p>
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
  const title = props.runtime.projectName ?? getHostedTabLabel(props.tab)

  return {
    id: props.tab.id,
    closable: true,
    closeButtonVisibility: 'always',
    label: (
      <div
        className={cx(
          'flex min-w-0 flex-col py-0.5 text-left transition',
          props.runtime.reachability === 'offline' && 'opacity-60 grayscale'
        )}
        data-hosted-reachability={props.runtime.reachability}
      >
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
        <span className="text-muted-foreground max-w-72 truncate text-[10px]">
          {props.tab.apiBaseUrl}
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
}: HostedShellProps) {
  const appLaunchError = useAppLaunchError()
  const [errorMessage, setErrorMessage] = useState(initialError)
  const connectionOwner = useConnectionObservationOwner()
  const connectionSnapshot = useConnectionObservations()
  const connectionActions = useConnectionsActions()
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
  const [apiDraft, setApiDraft] = useState('')
  const [addDialogError, setAddDialogError] = useState<string | null>(null)
  const [pwaState, setPwaState] = useState<HostedShellPwaState>(DEFAULT_PWA_STATE)
  const [updateState, setUpdateState] = useState<HostedAppUpdateState>(DEFAULT_UPDATE_STATE)
  const installPromptRef = useRef<BeforeInstallPromptEventLike | null>(null)
  const isolatedLaunchHandledRef = useRef(false)
  const refreshFeedbackTimerRef = useRef<number | null>(null)
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const shouldReloadForUpdateRef = useRef(false)

  useEffect(() => {
    if (appLaunchError !== undefined) setErrorMessage(appLaunchError)
  }, [appLaunchError])

  const openAddDialog = useCallback(() => {
    setAddDialogError(null)
    setIsAddDialogOpen(true)
  }, [])

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
    },
    [updateTabFrameState]
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

  const submitApi = useCallback((apiBaseUrl: string) => {
    setShellState((current) => applyHostedLaunchRequest(current, { apiBaseUrl }))
    setErrorMessage(null)
  }, [])

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
        const health = observation?.health ?? null
        const reachability = observation?.reachability ?? 'checking'
        return [
          tab.id,
          {
            reachability,
            projectName: health?.projectName ?? null,
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
  }, [connectionSnapshot.observations, shellState.tabs])

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

  const syncPwaState = useCallback(() => {
    setPwaState((current) => ({
      ...createBrowserPwaSnapshot(installPromptRef.current),
      isInstalling: current.isInstalling,
    }))
  }, [])

  useEffect(() => {
    syncPwaState()

    const hostedNavigator = navigator as HostedNavigator
    const onDisplayChange = () => {
      syncPwaState()
    }
    const onBeforeInstallPrompt = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) {
        return
      }
      event.preventDefault()
      installPromptRef.current = event
      setPwaState((current) => ({
        ...createBrowserPwaSnapshot(event),
        isInstalling: current.isInstalling,
      }))
    }
    const onAppInstalled = () => {
      installPromptRef.current = null
      setPwaState(() => ({
        ...createBrowserPwaSnapshot(null),
        isInstalling: false,
        isInstalled: true,
      }))
    }

    const standaloneMedia = window.matchMedia('(display-mode: standalone)')
    const overlayMedia = window.matchMedia('(display-mode: window-controls-overlay)')
    standaloneMedia.addEventListener('change', onDisplayChange)
    overlayMedia.addEventListener('change', onDisplayChange)
    window.addEventListener('resize', onDisplayChange)
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', onAppInstalled)
    hostedNavigator.windowControlsOverlay?.addEventListener('geometrychange', onDisplayChange)

    return () => {
      standaloneMedia.removeEventListener('change', onDisplayChange)
      overlayMedia.removeEventListener('change', onDisplayChange)
      window.removeEventListener('resize', onDisplayChange)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', onAppInstalled)
      hostedNavigator.windowControlsOverlay?.removeEventListener('geometrychange', onDisplayChange)
    }
  }, [syncPwaState])

  const handleInstall = useCallback(async () => {
    const promptEvent = installPromptRef.current
    if (!promptEvent) {
      return
    }

    setPwaState((current) => ({ ...current, isInstalling: true }))
    installPromptRef.current = null

    try {
      await promptEvent.prompt()
      await promptEvent.userChoice
    } finally {
      setPwaState(() => ({
        ...createBrowserPwaSnapshot(installPromptRef.current),
        isInstalling: false,
      }))
    }
  }, [])

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

  const activateWaitingHostedAppUpdate = useCallback((registration: ServiceWorkerRegistration) => {
    if (!registration.waiting || shouldReloadForUpdateRef.current) {
      return false
    }

    shouldReloadForUpdateRef.current = true
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    return true
  }, [])

  const syncUpdateStateFromRegistration = useCallback(
    (registration: ServiceWorkerRegistration, options?: { hasTabsOverride?: boolean }) => {
      serviceWorkerRegistrationRef.current = registration
      const hasTabs = options?.hasTabsOverride ?? shellState.tabs.length > 0
      if (shouldAutoApplyHostedAppUpdate({ hasTabs, registration })) {
        if (activateWaitingHostedAppUpdate(registration)) {
          setUpdateState({ status: 'idle', errorMessage: null })
        }
        return
      }
      setUpdateState(shouldExposeHostedAppUpdate({ hasTabs, registration }))
    },
    [activateWaitingHostedAppUpdate, shellState.tabs.length]
  )

  const checkForHostedAppUpdate = useCallback(async () => {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.serviceWorker === 'undefined' ||
      typeof navigator.serviceWorker.getRegistration !== 'function'
    ) {
      return
    }

    const registration =
      serviceWorkerRegistrationRef.current ?? (await navigator.serviceWorker.getRegistration())
    if (!registration) {
      return
    }

    serviceWorkerRegistrationRef.current = registration
    await registration.update().catch(() => {})
    syncUpdateStateFromRegistration(registration)
  }, [syncUpdateStateFromRegistration])

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.serviceWorker === 'undefined' ||
      typeof navigator.serviceWorker.getRegistration !== 'function' ||
      typeof navigator.serviceWorker.addEventListener !== 'function'
    ) {
      return
    }

    let disposed = false
    let cleanupRegistrationListener = () => {}

    const bindRegistration = (registration: ServiceWorkerRegistration) => {
      const onUpdateFound = () => {
        const installing = registration.installing
        if (!installing) {
          return
        }

        const onStateChange = () => {
          if (installing.state !== 'installed') {
            return
          }

          if (!navigator.serviceWorker.controller) {
            syncUpdateStateFromRegistration(registration, { hasTabsOverride: false })
            return
          }

          if (shellState.tabs.length === 0) {
            activateWaitingHostedAppUpdate(registration)
            return
          }

          syncUpdateStateFromRegistration(registration, { hasTabsOverride: true })
        }

        installing.addEventListener('statechange', onStateChange)
      }

      registration.addEventListener('updatefound', onUpdateFound)
      syncUpdateStateFromRegistration(registration)

      return () => {
        registration.removeEventListener('updatefound', onUpdateFound)
      }
    }

    const initialize = async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      if (disposed || !registration) {
        return
      }

      cleanupRegistrationListener()
      cleanupRegistrationListener = bindRegistration(registration)
    }

    const onControllerChange = () => {
      if (shouldReloadForUpdateRef.current) {
        shouldReloadForUpdateRef.current = false
        window.location.reload()
      }
    }

    const onFocus = () => {
      void checkForHostedAppUpdate()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForHostedAppUpdate()
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    void initialize()

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkForHostedAppUpdate()
      }
    }, UPDATE_CHECK_INTERVAL_MS)

    return () => {
      disposed = true
      cleanupRegistrationListener()
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(interval)
    }
  }, [
    activateWaitingHostedAppUpdate,
    checkForHostedAppUpdate,
    shellState.tabs.length,
    syncUpdateStateFromRegistration,
  ])

  const activeHostedTab =
    shellState.tabs.find((tab) => tab.id === shellState.activeTabId) ?? shellState.tabs[0] ?? null
  const activeRuntime = activeHostedTab
    ? (tabRuntime[activeHostedTab.id] ?? DEFAULT_RUNTIME_STATE)
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
    void checkForHostedAppUpdate()
  }, [activeHostedTab, checkForHostedAppUpdate, probeTabs, reloadHostedTab])

  const handleApplyHostedUpdate = useCallback(() => {
    const registration = serviceWorkerRegistrationRef.current
    if (!registration?.waiting) {
      window.location.reload()
      return
    }

    shouldReloadForUpdateRef.current = true
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }, [])

  useEffect(() => {
    if (!activeHostedTab) {
      document.title = 'OpenSpec UI App'
      return
    }
    const title = activeRuntime?.projectName ?? getHostedTabLabel(activeHostedTab)
    document.title = `${title} - OpenSpec UI App`
  }, [activeHostedTab, activeRuntime])

  const tabs = useMemo(
    () =>
      shellState.tabs.map((tab) =>
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
      ),
    [
      markFrameErrored,
      markFrameLoaded,
      probeTabs,
      setIframeRef,
      shellState.tabs,
      tabFrames,
      tabRuntime,
    ]
  )

  const handleAddSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const normalizedApiBaseUrl = normalizeHostedApiBaseUrl(apiDraft)
      if (!normalizedApiBaseUrl) {
        setAddDialogError('Enter a valid API URL, for example http://localhost:3100')
        return
      }

      submitApi(normalizedApiBaseUrl)
      setApiDraft('')
      setAddDialogError(null)
      setIsAddDialogOpen(false)
    },
    [apiDraft, submitApi]
  )

  const rootStyle: HostedShellRootStyle = {
    '--hosted-pwa-titlebar-left': `${pwaState.titlebarInsets.left}px`,
    '--hosted-pwa-titlebar-right': `${pwaState.titlebarInsets.right}px`,
    '--hosted-pwa-titlebar-top': `${pwaState.titlebarInsets.top}px`,
    '--hosted-pwa-titlebar-height': `${pwaState.titlebarInsets.height}px`,
  }

  return (
    <div
      className="hosted-shell-root bg-background text-foreground flex h-full min-h-0 min-w-0 flex-col"
      data-titlebar-overlay={pwaState.displayMode === 'window-controls-overlay'}
      style={rootStyle}
    >
      <HostedShellThemeBootstrap />

      {updateState.status === 'ready' && (
        <div className="border-border bg-muted/30 text-muted-foreground border-b px-3 py-2 text-xs">
          {updateState.errorMessage ?? UPDATE_READY_MESSAGE}
        </div>
      )}

      {tabs.length === 0 ? (
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="tabs-header border-border bg-terminal text-terminal-foreground flex min-w-0 items-stretch border-b">
            <div
              className="tabs-strip bg-terminal min-w-0 flex-1 px-4 py-3"
              onDoubleClick={openAddDialog}
            >
              <p className="font-nav text-xs uppercase tracking-[0.16em]">OpenSpec UI App</p>
            </div>
            <div className="tabs-actions border-border bg-terminal text-terminal-foreground flex shrink-0 items-center border-l">
              <HostedShellActions
                isRefreshing={false}
                isRefreshFeedbackActive={false}
                onRefresh={() => {}}
                onAdd={openAddDialog}
                canInstall={pwaState.canInstall}
                isInstalling={pwaState.isInstalling}
                onInstall={() => {
                  void handleInstall()
                }}
                onApplyUpdate={handleApplyHostedUpdate}
                updateStatus={updateState.status}
                showRefresh={false}
              />
            </div>
          </div>
          {errorMessage && (
            <div className="border-border bg-muted/30 border-b px-3 py-2 text-xs">
              {errorMessage}
            </div>
          )}
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 text-center">
            <div className="space-y-3">
              <p className="font-nav text-xs uppercase tracking-[0.16em]">No Hosted Sessions</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                Open a backend connection to start a hosted OpenSpec UI tab.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <TerminalTabs
          tabs={tabs}
          selectedTab={shellState.activeTabId ?? tabs[0]?.id}
          onTabChange={(tabId) => {
            setShellState((current) => activateHostedTab(current, tabId))
          }}
          onTabClose={(tabId) => {
            setShellState((current) => removeHostedTab(current, tabId))
          }}
          onTabOrderChange={(orderedTabIds) => {
            setShellState((current) => reorderHostedTabs(current, orderedTabIds))
          }}
          onTabBarDoubleClick={openAddDialog}
          actions={
            <HostedShellActions
              isRefreshing={isRefreshing}
              isRefreshFeedbackActive={isRefreshFeedbackActive}
              onRefresh={handleRefreshCurrentTab}
              onAdd={openAddDialog}
              canInstall={pwaState.canInstall}
              isInstalling={pwaState.isInstalling}
              onInstall={() => {
                void handleInstall()
              }}
              onApplyUpdate={handleApplyHostedUpdate}
              updateStatus={updateState.status}
            />
          }
          className="hosted-shell-tabs h-full min-h-0"
        />
      )}

      <Dialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        title={
          <span className="font-nav text-sm uppercase tracking-[0.14em]">Add Backend API</span>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddDialogOpen(false)}
              className="border-border bg-background text-foreground hover:bg-muted border px-3 py-1.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="hosted-shell-add-api"
              className="bg-primary text-primary-foreground px-3 py-1.5 text-sm transition hover:opacity-90"
            >
              Add
            </button>
          </>
        }
      >
        <form id="hosted-shell-add-api" onSubmit={handleAddSubmit} className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="hosted-shell-api" className="text-sm font-medium">
              API URL
            </label>
            <input
              id="hosted-shell-api"
              type="text"
              autoFocus
              value={apiDraft}
              onChange={(event) => {
                setApiDraft(event.target.value)
                if (addDialogError) {
                  setAddDialogError(null)
                }
              }}
              placeholder="http://localhost:3100"
              className="border-border bg-background w-full border px-3 py-2 font-mono text-sm"
            />
          </div>
          {addDialogError && <p className="text-xs text-red-500">{addDialogError}</p>}
        </form>
      </Dialog>
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
