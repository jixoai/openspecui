/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Apply daemon Workspace snapshots while keeping current credentials in runtime memory.
 * 2. Bind persisted backend locators to current opaque daemon Workspace ids.
 * 3. Expose same-origin open-in-browser actions and objective failures to the App surface.
 *
 * Original request (2026-07-29): "Workspaces 的 tab 可以提供一个 open in browser 的 icon-button。"
 */
import type { AppDaemonWorkspaceSnapshot } from '@openspecui/core/app-daemon-control'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  createDaemonWorkspaceControl,
  type DaemonWorkspaceControl,
} from '../lib/daemon-workspace-control'
import { bindLaunchCredential, clearLaunchCredential } from '../lib/launch-credential'
import { applyHostedLaunchRequest, normalizeHostedApiBaseUrl } from '../lib/shell-state'
import { useConnectionsActions } from '../lib/use-connections'

interface AppDaemonWorkspaceContextValue {
  error: string | null
  openWorkspaceInBrowser(workspaceId: string): Promise<void>
  resolveWorkspaceId(apiBaseUrl: string): string | null
}

const AppDaemonWorkspaceContext = createContext<AppDaemonWorkspaceContextValue | null>(null)

/** Bind runtime authority before applying credential-free launch targets and return opaque ids. */
export function applyDaemonWorkspaceSnapshot(
  snapshot: AppDaemonWorkspaceSnapshot,
  applyLaunch: (apiBaseUrl: string) => void
): ReadonlyMap<string, string> {
  const workspaceIds = new Map<string, string>()
  for (const workspace of snapshot.workspaces) {
    const apiBaseUrl = normalizeHostedApiBaseUrl(workspace.backendUrl)
    if (!apiBaseUrl) continue
    if (workspace.credential !== null) {
      bindLaunchCredential(apiBaseUrl, workspace.credential)
    } else {
      clearLaunchCredential(apiBaseUrl)
    }
    workspaceIds.set(apiBaseUrl, workspace.id)
    applyLaunch(apiBaseUrl)
  }
  return workspaceIds
}

/** Own local-daemon Workspace authority for the complete App route lifetime. */
export function AppDaemonWorkspaceOwner({ children }: { children: ReactNode }) {
  const connectionActions = useConnectionsActions()
  const controlRef = useRef<DaemonWorkspaceControl | null>(null)
  const [workspaceIds, setWorkspaceIds] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const control = createDaemonWorkspaceControl({
      baseUrl: window.location.origin,
      onSnapshot: (snapshot) => {
        const ids = applyDaemonWorkspaceSnapshot(snapshot, (apiBaseUrl) => {
          connectionActions.setState(
            applyHostedLaunchRequest(connectionActions.getState(), { apiBaseUrl })
          )
        })
        setWorkspaceIds(ids)
        setError(null)
      },
      onError: (nextError) => setError(nextError.message),
    })
    controlRef.current = control
    void control.start()
    return () => {
      controlRef.current = null
      control.stop()
    }
  }, [connectionActions])

  const openWorkspaceInBrowser = useCallback(async (workspaceId: string) => {
    const control = controlRef.current
    if (!control) throw new Error('OpenSpecUI App daemon is unavailable.')
    try {
      await control.openWorkspaceInBrowser(workspaceId)
      setError(null)
    } catch (nextError) {
      const errorMessage =
        nextError instanceof Error ? nextError.message : 'Failed to open Workspace in browser.'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  const value = useMemo<AppDaemonWorkspaceContextValue>(
    () => ({
      error,
      openWorkspaceInBrowser,
      resolveWorkspaceId(apiBaseUrl) {
        const normalized = normalizeHostedApiBaseUrl(apiBaseUrl)
        return normalized ? (workspaceIds.get(normalized) ?? null) : null
      },
    }),
    [error, openWorkspaceInBrowser, workspaceIds]
  )

  return (
    <AppDaemonWorkspaceContext.Provider value={value}>
      {children}
    </AppDaemonWorkspaceContext.Provider>
  )
}

/** Read daemon Workspace authority; isolated mounts remain objectively unsupported. */
export function useAppDaemonWorkspace(): AppDaemonWorkspaceContextValue {
  const value = useContext(AppDaemonWorkspaceContext)
  return (
    value ?? {
      error: null,
      openWorkspaceInBrowser: async () => {
        throw new Error('OpenSpecUI App daemon is unavailable.')
      },
      resolveWorkspaceId: () => null,
    }
  )
}
