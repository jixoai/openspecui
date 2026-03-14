import {
  resolveHostedChannelForVersion,
  type HostedAppVersionManifest,
} from '@openspecui/core/hosted-app'
import { Dialog } from '@openspecui/web-src/components/dialog'
import { Tabs, type Tab } from '@openspecui/web-src/components/tabs'
import {
  AlertCircle,
  CloudDownload,
  CloudUpload,
  Download,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Unlink2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { parseHostedLaunchParams } from '../lib/bootstrap'
import { createHostedAppCacheBroadcast } from '../lib/hosted-app-cache-broadcast'
import {
  buildClaimedHostedCacheNames,
  cleanupHostedCaches,
  collectStaleHostedCacheNames,
  collectTargetChannelIds,
  hasHostedDeploymentUpdate,
  refreshHostedManifestCache,
  warmHostedAppShell,
  warmHostedVersionChannels,
} from '../lib/hosted-app-update'
import { createHostedShellSync } from '../lib/hosted-shell-sync'
import { createHostedLaunchRelay } from '../lib/launch-relay'
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
import {
  fetchHostedAppManifest,
  probeHostedBackend,
  type HostedTabReachability,
} from '../lib/reachability'
import {
  activateHostedTab,
  applyHostedLaunchRequest,
  areHostedShellStatesEqual,
  buildHostedVersionEntryUrl,
  getHostedTabLabel,
  hasHostedTabForApi,
  normalizeHostedApiBaseUrl,
  removeHostedTab,
  reorderHostedTabs,
  type HostedShellLaunchRequest,
  type HostedShellState,
  type HostedShellTab,
} from '../lib/shell-state'
import { HostedShellThemeBootstrap } from './hosted-shell-theme'

const PROBE_INTERVAL_MS = 15000
const REFRESH_FEEDBACK_MS = 1200
const FORWARDED_LAUNCH_MESSAGE = 'Launch forwarded to the active OpenSpec UI App window.'
const FORWARDED_SYNC_TIMEOUT_MS = 1600
const FORWARDED_SYNC_INTERVAL_MS = 120
const UPDATE_CHECK_INTERVAL_MS = 60000

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
  resolvedChannel: string | null
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

type HostedAppUpdateStatus = 'idle' | 'checking' | 'warming' | 'ready' | 'error'

interface HostedAppUpdateState {
  availableVersionId: string | null
  errorMessage: string | null
  status: HostedAppUpdateStatus
}

interface HostedShellRootStyle extends CSSProperties {
  '--hosted-pwa-titlebar-left': string
  '--hosted-pwa-titlebar-right': string
  '--hosted-pwa-titlebar-top': string
  '--hosted-pwa-titlebar-height': string
}

interface LaunchQueueLike {
  setConsumer(consumer: (params: { targetURL?: URL | null }) => void): void
}

interface HostedNavigator extends Navigator {
  standalone?: boolean
  windowControlsOverlay?: HostedAppWindowControlsOverlayLike
  launchQueue?: LaunchQueueLike
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
  resolvedChannel: null,
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
  availableVersionId: null,
  errorMessage: null,
  status: 'idle',
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function buildHostedTabIframeSrc(
  tab: HostedShellTab,
  runtime: HostedTabRuntimeState
): string | null {
  return runtime.resolvedChannel ? buildHostedVersionEntryUrl(tab, runtime.resolvedChannel) : null
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

function closeCurrentWindowBestEffort(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.close()
  } catch {
    // Ignore best-effort close failures in regular browser tabs.
  }
}

function CloudSyncIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="M6 18a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 17.5 8 4 4 0 1 1 18 16H9" />
      <path d="m10 15 2-2 2 2" />
      <path d="M14 13v6" />
      <path d="m10 9-2 2-2-2" />
      <path d="M10 11V5" />
    </svg>
  )
}

function HostedShellUpdateIcon(props: { status: HostedAppUpdateStatus }) {
  if (props.status === 'ready') {
    return <CloudSyncIcon className="h-4 w-4" />
  }

  return (
    <span className="relative h-4 w-4">
      <CloudDownload className="absolute inset-0 h-4 w-4 animate-pulse" />
      <CloudUpload
        className="absolute inset-0 h-4 w-4 animate-pulse opacity-0"
        style={{ animationDelay: '700ms' }}
      />
    </span>
  )
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
  const showUpdateAction =
    props.updateStatus === 'checking' ||
    props.updateStatus === 'warming' ||
    props.updateStatus === 'ready'
  const updateInteractive = props.updateStatus === 'ready'

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
      {showUpdateAction ? (
        <button
          type="button"
          onClick={updateInteractive ? props.onApplyUpdate : undefined}
          disabled={!updateInteractive}
          className={cx(
            buttonClassName,
            !updateInteractive &&
              'hover:bg-terminal hover:text-terminal-foreground cursor-default opacity-80'
          )}
          aria-label={
            updateInteractive ? 'Apply hosted app update' : 'Downloading hosted app update'
          }
          title={updateInteractive ? 'Apply hosted app update' : 'Downloading hosted app update'}
        >
          <HostedShellUpdateIcon status={props.updateStatus} />
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

function HostedShellTabContent({
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
  const showInlineError = runtime.reachability === 'online' && runtime.errorMessage
  const isFrameLoading = iframeSrc !== null && frameState.status !== 'loaded'
  const showFrameError = iframeSrc !== null && frameState.status === 'error'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
            <div className="bg-background/70 pointer-events-none absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]">
              <div className="border-border bg-background/90 text-foreground inline-flex items-center gap-2 border px-3 py-2 text-xs shadow-sm">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                <span>Loading view...</span>
              </div>
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
          <div className="max-w-sm space-y-2 text-sm">
            {runtime.reachability === 'checking' && (
              <>
                <p className="font-nav text-xs uppercase tracking-[0.16em]">Resolving Bundle</p>
                <p className="text-muted-foreground text-xs">
                  Querying backend metadata and selecting a compatible hosted bundle.
                </p>
              </>
            )}
            {runtime.reachability === 'offline' && !iframeSrc && (
              <p className="text-muted-foreground text-xs">
                Waiting for this backend to come online.
              </p>
            )}
            {runtime.reachability === 'online' && runtime.errorMessage && (
              <p className="text-muted-foreground text-xs">
                This tab is online, but the hosted shell could not resolve a compatible bundle yet.
              </p>
            )}
          </div>
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

export function HostedShell({
  initialLaunchRequest,
  fallbackLaunchRequest = null,
  initialError,
}: HostedShellProps) {
  const shellSync = useMemo(
    () =>
      createHostedShellSync({
        storage: window.localStorage,
      }),
    []
  )
  const [errorMessage, setErrorMessage] = useState(initialError)
  const [shellState, setShellState] = useState(() => {
    const persisted = shellSync.readCurrent()
    if (persisted.tabs.length === 0 && fallbackLaunchRequest) {
      return applyHostedLaunchRequest(persisted, fallbackLaunchRequest)
    }
    return persisted
  })
  const [tabRuntime, setTabRuntime] = useState<Record<string, HostedTabRuntimeState>>({})
  const [tabFrames, setTabFrames] = useState<Record<string, HostedTabFrameState>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRefreshFeedbackActive, setIsRefreshFeedbackActive] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [apiDraft, setApiDraft] = useState('')
  const [addDialogError, setAddDialogError] = useState<string | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [pwaState, setPwaState] = useState<HostedShellPwaState>(DEFAULT_PWA_STATE)
  const [updateState, setUpdateState] = useState<HostedAppUpdateState>(DEFAULT_UPDATE_STATE)
  const cacheBroadcast = useMemo(() => createHostedAppCacheBroadcast(), [])
  const manifestRef = useRef<HostedAppVersionManifest | null>(null)
  const preparedManifestRef = useRef<HostedAppVersionManifest | null>(null)
  const tabRuntimeRef = useRef<Record<string, HostedTabRuntimeState>>({})
  const updateStateRef = useRef<HostedAppUpdateState>(DEFAULT_UPDATE_STATE)
  const installPromptRef = useRef<BeforeInstallPromptEventLike | null>(null)
  const initialLaunchHandledRef = useRef(false)
  const refreshFeedbackTimerRef = useRef<number | null>(null)
  const updateCheckPromiseRef = useRef<Promise<void> | null>(null)
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

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

  const applySyncedShellState = useCallback((nextState: HostedShellState) => {
    setShellState((current) =>
      areHostedShellStatesEqual(current, nextState) ? current : nextState
    )
    if (nextState.tabs.length > 0) {
      setErrorMessage((current) => (current === FORWARDED_LAUNCH_MESSAGE ? null : current))
    }
  }, [])

  const waitForForwardedLaunch = useCallback(
    async (apiBaseUrl: string) => {
      const deadline = Date.now() + FORWARDED_SYNC_TIMEOUT_MS
      while (Date.now() <= deadline) {
        const syncedState = shellSync.syncNow(applySyncedShellState)
        const currentState = syncedState ?? shellSync.readCurrent()
        if (hasHostedTabForApi(currentState, apiBaseUrl)) {
          setErrorMessage((current) => (current === FORWARDED_LAUNCH_MESSAGE ? null : current))
          return
        }
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, FORWARDED_SYNC_INTERVAL_MS)
        })
      }
    },
    [applySyncedShellState, shellSync]
  )

  useEffect(() => {
    shellSync.write(shellState)
  }, [shellState, shellSync])

  useEffect(() => {
    tabRuntimeRef.current = tabRuntime
  }, [tabRuntime])

  useEffect(() => {
    updateStateRef.current = updateState
  }, [updateState])

  useEffect(() => {
    return () => {
      if (refreshFeedbackTimerRef.current !== null) {
        window.clearTimeout(refreshFeedbackTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const syncNow = () => {
      shellSync.syncNow(applySyncedShellState)
    }

    syncNow()
    const stop = shellSync.start(applySyncedShellState)
    const onFocus = () => {
      syncNow()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncNow()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stop()
    }
  }, [applySyncedShellState, shellSync])

  useEffect(() => {
    setTabRuntime((current) => {
      const next: Record<string, HostedTabRuntimeState> = {}
      for (const tab of shellState.tabs) {
        next[tab.id] = current[tab.id] ?? DEFAULT_RUNTIME_STATE
      }
      return next
    })
  }, [shellState.tabs])

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

  useEffect(() => {
    const relay = createHostedLaunchRelay({
      storage: window.localStorage,
    })
    const dispatchLaunch = async (request: HostedShellLaunchRequest) => {
      const result = await relay.dispatch(request)
      if (result === 'forwarded-to-pwa') {
        await waitForForwardedLaunch(request.apiBaseUrl)
        closeCurrentWindowBestEffort()
        return
      }
      if (result === 'forwarded') {
        setErrorMessage(FORWARDED_LAUNCH_MESSAGE)
        await waitForForwardedLaunch(request.apiBaseUrl)
        return
      }
      setErrorMessage(null)
    }

    const stop = relay.start((request) => {
      submitApi(request.apiBaseUrl)
    })

    if (initialLaunchRequest && !initialLaunchHandledRef.current) {
      initialLaunchHandledRef.current = true
      void dispatchLaunch(initialLaunchRequest)
    }

    const hostedNavigator = navigator as HostedNavigator
    hostedNavigator.launchQueue?.setConsumer((params) => {
      const targetUrl = params.targetURL
      if (!(targetUrl instanceof URL)) {
        return
      }
      const launch = parseHostedLaunchParams(targetUrl.search)
      if (launch.error) {
        setErrorMessage(launch.error)
        return
      }
      if (launch.request) {
        void dispatchLaunch(launch.request)
      }
    })

    return () => {
      hostedNavigator.launchQueue?.setConsumer(() => {})
      stop()
    }
  }, [initialLaunchRequest, submitApi, waitForForwardedLaunch])

  const getResolvedChannelIds = useCallback(() => {
    const channels = new Set<string>()
    for (const runtime of Object.values(tabRuntimeRef.current)) {
      if (runtime.resolvedChannel) {
        channels.add(runtime.resolvedChannel)
      }
    }
    return Array.from(channels)
  }, [])

  const getClaimedCacheNames = useCallback(() => {
    const manifest =
      updateStateRef.current.status === 'ready' && preparedManifestRef.current
        ? preparedManifestRef.current
        : manifestRef.current
    if (!manifest) {
      return []
    }
    return buildClaimedHostedCacheNames(manifest, getResolvedChannelIds())
  }, [getResolvedChannelIds])

  const loadManifest = useCallback(async () => {
    if (manifestRef.current) {
      return manifestRef.current
    }

    try {
      const manifest = await fetchHostedAppManifest(window.location, fetch)
      manifestRef.current = manifest
      setManifestError(null)
      return manifest
    } catch (error) {
      setManifestError(error instanceof Error ? error.message : String(error))
      return manifestRef.current
    }
  }, [])

  useEffect(() => {
    const stopResponder = cacheBroadcast.startResponder(() => getClaimedCacheNames())
    return () => {
      stopResponder()
      cacheBroadcast.stop()
    }
  }, [cacheBroadcast, getClaimedCacheNames])

  const checkForHostedAppUpdate = useCallback(async () => {
    if (typeof window === 'undefined' || typeof caches === 'undefined') {
      return
    }

    if (updateCheckPromiseRef.current) {
      await updateCheckPromiseRef.current
      return
    }

    const job = (async () => {
      const currentManifest = manifestRef.current ?? (await loadManifest())
      if (!currentManifest) {
        return
      }

      setUpdateState((current) =>
        current.status === 'warming' || current.status === 'ready'
          ? current
          : {
              availableVersionId: current.availableVersionId,
              errorMessage: null,
              status: 'checking',
            }
      )

      try {
        const registration = await navigator.serviceWorker?.getRegistration?.()
        await registration?.update()
      } catch {
        // Ignore update check failures and continue with manifest warming.
      }

      try {
        const nextManifest = await refreshHostedManifestCache(window.location, caches)
        const targetChannelIds = collectTargetChannelIds(nextManifest, getResolvedChannelIds())
        if (!hasHostedDeploymentUpdate(currentManifest, nextManifest, targetChannelIds)) {
          preparedManifestRef.current = null
          setUpdateState(DEFAULT_UPDATE_STATE)
          return
        }

        if (preparedManifestRef.current?.generatedAt === nextManifest.generatedAt) {
          setUpdateState({
            availableVersionId: nextManifest.generatedAt,
            errorMessage: null,
            status: 'ready',
          })
          return
        }

        setUpdateState({
          availableVersionId: nextManifest.generatedAt,
          errorMessage: null,
          status: 'warming',
        })

        await warmHostedAppShell(nextManifest, window.location, caches)
        await warmHostedVersionChannels(nextManifest, targetChannelIds, window.location, caches)
        const staleCacheNames = await collectStaleHostedCacheNames(caches, nextManifest)

        preparedManifestRef.current = nextManifest
        setUpdateState({
          availableVersionId: nextManifest.generatedAt,
          errorMessage: null,
          status: 'ready',
        })

        const peerClaims = await cacheBroadcast.collectPeerClaims()
        const deletableCaches = staleCacheNames.filter((cacheName) => !peerClaims.has(cacheName))
        await cleanupHostedCaches(caches, deletableCaches)
      } catch (error) {
        preparedManifestRef.current = null
        console.warn('Failed to prepare hosted app update:', error)
        setUpdateState((current) =>
          current.status === 'ready'
            ? current
            : {
                availableVersionId: null,
                errorMessage: error instanceof Error ? error.message : String(error),
                status: 'error',
              }
        )
      }
    })()

    updateCheckPromiseRef.current = job.finally(() => {
      updateCheckPromiseRef.current = null
    })
    await updateCheckPromiseRef.current
  }, [cacheBroadcast, getResolvedChannelIds, loadManifest])

  const probeTabs = useCallback(
    async (options?: {
      tabIds?: readonly string[]
      visualFeedback?: boolean
      refetchManifest?: boolean
    }) => {
      const targets = shellState.tabs.filter(
        (tab) => !options?.tabIds || options.tabIds.includes(tab.id)
      )
      if (targets.length === 0) return

      if (options?.visualFeedback) {
        startRefreshFeedback()
        setIsRefreshing(true)
      }

      setTabRuntime((current) => {
        const next = { ...current }
        for (const tab of targets) {
          next[tab.id] = {
            ...(current[tab.id] ?? DEFAULT_RUNTIME_STATE),
            reachability: 'checking',
            errorMessage: null,
          }
        }
        return next
      })

      try {
        const manifest = await loadManifest()
        const probeResults = await Promise.all(
          targets.map(async (tab) => ({
            tab,
            probe: await probeHostedBackend(tab.apiBaseUrl),
          }))
        )

        setTabRuntime((current) => {
          const next = { ...current }
          for (const { tab, probe } of probeResults) {
            const previous = current[tab.id] ?? DEFAULT_RUNTIME_STATE

            if (probe.reachability === 'offline') {
              next[tab.id] = {
                ...previous,
                reachability: 'offline',
                errorMessage: null,
              }
              continue
            }

            const projectName = probe.health?.projectName ?? previous.projectName
            const openspecuiVersion = probe.health?.openspecuiVersion ?? previous.openspecuiVersion
            const resolvedChannel =
              manifest && openspecuiVersion
                ? resolveHostedChannelForVersion(manifest, openspecuiVersion)
                : previous.resolvedChannel

            next[tab.id] = {
              reachability: 'online',
              projectName,
              openspecuiVersion,
              resolvedChannel: resolvedChannel ?? null,
              errorMessage:
                probe.errorMessage ??
                (!manifest && !previous.resolvedChannel
                  ? (manifestError ?? 'Hosted manifest is unavailable.')
                  : !resolvedChannel
                    ? `No compatible hosted bundle found for openspecui@${openspecuiVersion ?? 'unknown'}.`
                    : null),
            }
          }
          return next
        })
      } finally {
        if (options?.visualFeedback) {
          setIsRefreshing(false)
        }
      }
    },
    [loadManifest, manifestError, shellState.tabs, startRefreshFeedback]
  )

  useEffect(() => {
    if (shellState.tabs.length === 0) {
      return
    }

    void probeTabs()
    const interval = window.setInterval(() => {
      void probeTabs()
    }, PROBE_INTERVAL_MS)

    const onFocus = () => {
      void probeTabs()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void probeTabs()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [probeTabs, shellState.tabs.length])

  useEffect(() => {
    void checkForHostedAppUpdate()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkForHostedAppUpdate()
      }
    }, UPDATE_CHECK_INTERVAL_MS)

    const onFocus = () => {
      void checkForHostedAppUpdate()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForHostedAppUpdate()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [checkForHostedAppUpdate])

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
      refetchManifest: true,
    })
    void checkForHostedAppUpdate()
  }, [activeHostedTab, checkForHostedAppUpdate, probeTabs, reloadHostedTab])

  const handleApplyHostedUpdate = useCallback(() => {
    if (updateStateRef.current.status !== 'ready' || !preparedManifestRef.current) {
      return
    }

    window.location.reload()
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
            void probeTabs({ tabIds: [tabId], visualFeedback: true, refetchManifest: true })
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
      className="hosted-shell-root bg-background text-foreground flex min-h-screen min-w-0 flex-col"
      data-titlebar-overlay={pwaState.displayMode === 'window-controls-overlay'}
      style={rootStyle}
    >
      <HostedShellThemeBootstrap />

      {tabs.length === 0 ? (
        <div className="flex min-h-screen min-w-0 flex-col">
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
        <Tabs
          tabs={tabs}
          variant="terminal"
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
          className="hosted-shell-tabs min-h-screen"
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
