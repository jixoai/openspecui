/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Own browser/PWA relay and local-daemon Workspace launch sources for the complete App route lifetime.
 * 2. Apply credential-free launch targets through the shared connection store.
 * 3. Consume PWA launchQueue targets while keeping credentials in runtime memory.
 * 4. Preserve browser/PWA-leader forwarding and best-effort source-window retirement.
 * 5. Preserve launch configuration errors for the Sessions presentation surface.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Owner-reported defect (2026-07-26): opening B or C eventually makes older tabs lose authentication.
 * Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口。"
 * Owner direction (2026-07-29): a running daemon receives project Workspaces by default.
 */
import type { AppDaemonWorkspaceSnapshot } from '@openspecui/core/app-daemon-control'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { consumeHostedLaunchUrl } from '../lib/bootstrap'
import { createDaemonWorkspaceControl } from '../lib/daemon-workspace-control'
import { bindLaunchCredential } from '../lib/launch-credential'
import { createHostedLaunchRelay, type HostedLaunchDispatchResult } from '../lib/launch-relay'
import { applyHostedLaunchRequest, type HostedShellLaunchRequest } from '../lib/shell-state'
import { useConnectionsActions } from '../lib/use-connections'
import { useRouterContext } from '../lib/use-router-context'

interface LaunchQueueLike {
  setConsumer(consumer: (params: { targetURL?: URL | null }) => void): void
}

interface LaunchNavigator extends Navigator {
  launchQueue?: LaunchQueueLike
}

const AppLaunchErrorContext = createContext<string | null | undefined>(undefined)

/** Bind runtime authority before applying credential-free daemon Workspace launch targets. */
export function applyDaemonWorkspaceSnapshot(
  snapshot: AppDaemonWorkspaceSnapshot,
  applyLaunch: (request: HostedShellLaunchRequest) => void
): void {
  for (const workspace of snapshot.workspaces) {
    if (workspace.credential !== null) {
      bindLaunchCredential(workspace.backendUrl, workspace.credential)
    }
    applyLaunch({ apiBaseUrl: workspace.backendUrl })
  }
}

/** Retire a transient source after another browser/PWA App surface acknowledges the launch. */
export function retireHostedLaunchSourceBestEffort(
  result: HostedLaunchDispatchResult,
  closeSource: () => void
): void {
  if (result === 'forwarded' || result === 'forwarded-to-pwa') {
    closeSource()
  }
}

function closeCurrentWindowBestEffort(): void {
  try {
    window.close()
  } catch {
    // Regular browser tabs may reject script-driven close requests.
  }
}

/** Keep launch ownership alive across every App route, independently of the Sessions surface. */
export function AppLaunchOwner({ children }: { children: ReactNode }) {
  const { initialLaunchRequest, fallbackLaunchRequest, initialError } = useRouterContext()
  const connectionActions = useConnectionsActions()
  const initialLaunchHandledRef = useRef(false)
  const [launchError, setLaunchError] = useState<string | null>(initialError)

  useEffect(() => {
    const applyLaunch = (request: HostedShellLaunchRequest) => {
      connectionActions.setState(
        applyHostedLaunchRequest(connectionActions.getState(), {
          apiBaseUrl: request.apiBaseUrl,
        })
      )
    }
    const relay = createHostedLaunchRelay({
      storage: window.localStorage,
    })
    const dispatchLaunch = async (request: HostedShellLaunchRequest) => {
      setLaunchError(null)
      const result = await relay.dispatch(request)
      retireHostedLaunchSourceBestEffort(result, closeCurrentWindowBestEffort)
    }
    const stop = relay.start(applyLaunch)
    const daemonControl = createDaemonWorkspaceControl({
      baseUrl: window.location.origin,
      onSnapshot: (snapshot) => applyDaemonWorkspaceSnapshot(snapshot, applyLaunch),
      onError: (error) => setLaunchError(error.message),
    })
    void daemonControl.start()

    if (fallbackLaunchRequest && connectionActions.getState().tabs.length === 0) {
      applyLaunch(fallbackLaunchRequest)
    }
    if (initialLaunchRequest && !initialLaunchHandledRef.current) {
      initialLaunchHandledRef.current = true
      void dispatchLaunch(initialLaunchRequest)
    }

    const launchNavigator = navigator as LaunchNavigator
    launchNavigator.launchQueue?.setConsumer((params) => {
      const targetUrl = params.targetURL
      if (!(targetUrl instanceof URL)) return
      const launch = consumeHostedLaunchUrl(targetUrl.href)
      if (launch.error) {
        setLaunchError(launch.error)
        return
      }
      if (launch.request) void dispatchLaunch(launch.request)
    })

    return () => {
      launchNavigator.launchQueue?.setConsumer(() => {})
      daemonControl.stop()
      stop()
    }
  }, [connectionActions, fallbackLaunchRequest, initialLaunchRequest])

  return (
    <AppLaunchErrorContext.Provider value={launchError}>{children}</AppLaunchErrorContext.Provider>
  )
}

/** Read the App-lifetime launch error; undefined means no root owner is present in an isolated mount. */
export function useAppLaunchError(): string | null | undefined {
  return useContext(AppLaunchErrorContext)
}
