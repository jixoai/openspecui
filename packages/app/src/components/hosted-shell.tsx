import { resolveHostedChannelForVersion } from '@openspecui/core/hosted-app'
import { Dialog } from '@openspecui/web-src/components/dialog'
import { Tabs, type Tab } from '@openspecui/web-src/components/tabs'
import { AlertCircle, Link2, LoaderCircle, Plus, RefreshCw, Unlink2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  fetchHostedAppManifest,
  probeHostedBackend,
  type HostedTabReachability,
} from '../lib/reachability'
import {
  activateHostedTab,
  applyHostedLaunchRequest,
  buildHostedVersionEntryUrl,
  getHostedTabLabel,
  loadHostedShellState,
  normalizeHostedApiBaseUrl,
  removeHostedTab,
  saveHostedShellState,
  type HostedShellLaunchRequest,
  type HostedShellTab,
} from '../lib/shell-state'
import { HostedShellThemeBootstrap } from './hosted-shell-theme'

const PROBE_INTERVAL_MS = 15000

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

const DEFAULT_RUNTIME_STATE: HostedTabRuntimeState = {
  reachability: 'checking',
  projectName: null,
  openspecuiVersion: null,
  resolvedChannel: null,
  errorMessage: null,
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function HostedShellActions(props: {
  isRefreshing: boolean
  onRefresh: () => void
  onAdd: () => void
}) {
  const buttonClassName =
    'border-border bg-terminal text-terminal-foreground hover:bg-background hover:text-foreground cursor-hover inline-flex items-center justify-center border-l p-4 text-sm transition-colors'

  return (
    <div className="flex h-full items-stretch">
      <button
        type="button"
        onClick={props.onRefresh}
        className={buttonClassName}
        aria-label="Refresh backend metadata"
        title="Refresh backend metadata"
      >
        <RefreshCw className={cx('h-3.5 w-3.5', props.isRefreshing && 'animate-spin')} />
      </button>
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

function createHostedShellTab(
  tab: HostedShellTab,
  runtime: HostedTabRuntimeState,
  onRetry: (tabId: string) => void
): Tab {
  const title = runtime.projectName ?? getHostedTabLabel(tab)
  const iframeTitle = `Hosted OpenSpec UI ${title}`
  const iframeSrc = runtime.resolvedChannel
    ? buildHostedVersionEntryUrl(tab, runtime.resolvedChannel)
    : null
  const showInlineError = runtime.reachability === 'online' && runtime.errorMessage

  return {
    id: tab.id,
    closable: true,
    closeButtonVisibility: 'always',
    label: (
      <div
        className={cx(
          'flex min-w-0 flex-col py-0.5 text-left transition',
          runtime.reachability === 'offline' && 'opacity-60 grayscale'
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {runtime.reachability === 'checking' && <LoaderCircle className="h-3 w-3 animate-spin" />}
          {runtime.reachability === 'online' && <Link2 className="h-3 w-3 text-emerald-500" />}
          {runtime.reachability === 'offline' && <Unlink2 className="h-3 w-3 text-amber-500" />}
          <span className="font-nav min-w-0 truncate text-xs">{title}</span>
        </span>
        <span className="text-muted-foreground max-w-72 truncate text-[10px]">
          {tab.apiBaseUrl}
        </span>
      </div>
    ),
    content: (
      <div className="flex min-h-0 flex-1 flex-col">
        {runtime.reachability === 'offline' && (
          <div className="border-border bg-muted/40 text-muted-foreground flex items-center justify-between gap-3 border-b px-3 py-2 text-xs">
            <span>
              Backend unreachable. The session stays mounted so you can retry without losing
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
          <iframe
            title={iframeTitle}
            src={iframeSrc}
            className={cx(
              'min-h-0 flex-1 border-0 bg-transparent',
              runtime.reachability === 'offline' && 'opacity-75 saturate-0'
            )}
          />
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
                  This tab is online, but the hosted shell could not resolve a compatible bundle
                  yet.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    ),
  }
}

export function HostedShell({
  initialLaunchRequest,
  fallbackLaunchRequest = null,
  initialError,
}: HostedShellProps) {
  const [errorMessage, setErrorMessage] = useState(initialError)
  const [shellState, setShellState] = useState(() => {
    const persisted = loadHostedShellState(window.localStorage)
    if (initialLaunchRequest) {
      return applyHostedLaunchRequest(persisted, initialLaunchRequest)
    }
    if (persisted.tabs.length === 0 && fallbackLaunchRequest) {
      return applyHostedLaunchRequest(persisted, fallbackLaunchRequest)
    }
    return persisted
  })
  const [tabRuntime, setTabRuntime] = useState<Record<string, HostedTabRuntimeState>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [apiDraft, setApiDraft] = useState('')
  const [addDialogError, setAddDialogError] = useState<string | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const manifestRef = useRef<Awaited<ReturnType<typeof fetchHostedAppManifest>> | null>(null)

  useEffect(() => {
    saveHostedShellState(window.localStorage, shellState)
  }, [shellState])

  useEffect(() => {
    setTabRuntime((current) => {
      const next: Record<string, HostedTabRuntimeState> = {}
      for (const tab of shellState.tabs) {
        next[tab.id] = current[tab.id] ?? DEFAULT_RUNTIME_STATE
      }
      return next
    })
  }, [shellState.tabs])

  const loadManifest = useCallback(async (force = false) => {
    if (!force && manifestRef.current) {
      return manifestRef.current
    }

    try {
      const manifest = await fetchHostedAppManifest(window.location)
      manifestRef.current = manifest
      setManifestError(null)
      return manifest
    } catch (error) {
      setManifestError(error instanceof Error ? error.message : String(error))
      return manifestRef.current
    }
  }, [])

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

      const manifest = await loadManifest(options?.refetchManifest)
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

      if (options?.visualFeedback) {
        setIsRefreshing(false)
      }
    },
    [loadManifest, manifestError, shellState.tabs]
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

  const activeHostedTab =
    shellState.tabs.find((tab) => tab.id === shellState.activeTabId) ?? shellState.tabs[0] ?? null
  const activeRuntime = activeHostedTab
    ? (tabRuntime[activeHostedTab.id] ?? DEFAULT_RUNTIME_STATE)
    : null

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
        createHostedShellTab(tab, tabRuntime[tab.id] ?? DEFAULT_RUNTIME_STATE, (tabId) => {
          void probeTabs({ tabIds: [tabId], visualFeedback: true, refetchManifest: true })
        })
      ),
    [probeTabs, shellState.tabs, tabRuntime]
  )

  const submitApi = useCallback((apiBaseUrl: string) => {
    setShellState((current) => applyHostedLaunchRequest(current, { apiBaseUrl }))
    setErrorMessage(null)
  }, [])

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

  const addButtonClassName =
    'border-border bg-background text-foreground hover:bg-muted inline-flex items-center justify-center border px-3 py-2 text-sm transition-colors'

  const addButton = (
    <button
      type="button"
      onClick={() => {
        setAddDialogError(null)
        setIsAddDialogOpen(true)
      }}
      className={addButtonClassName}
    >
      Add API
    </button>
  )

  return (
    <div className="bg-background text-foreground flex min-h-screen min-w-0 flex-col">
      <HostedShellThemeBootstrap />

      {tabs.length === 0 ? (
        <div className="flex min-h-screen min-w-0 flex-col">
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
              <div className="flex items-center justify-center">{addButton}</div>
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
          actions={
            <HostedShellActions
              isRefreshing={isRefreshing}
              onRefresh={() => {
                setErrorMessage(null)
                void probeTabs({ visualFeedback: true, refetchManifest: true })
              }}
              onAdd={() => {
                setAddDialogError(null)
                setIsAddDialogOpen(true)
              }}
            />
          }
          className="min-h-screen"
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
