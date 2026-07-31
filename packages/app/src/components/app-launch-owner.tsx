/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Own browser relay launch sources for the complete App route lifetime.
 * 2. Apply credential-free launch targets through the shared connection store.
 * 3. Preserve browser-leader forwarding and best-effort source-window retirement.
 * 4. Preserve launch configuration errors for the Workspaces presentation surface.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Owner-reported defect (2026-07-26): opening B or C eventually makes older tabs lose authentication.
 * Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口。"
 * Owner direction (2026-07-29): a running daemon receives project Workspaces by default.
 * Owner correction (2026-07-31): PWA Launch Handler ownership is retired.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createHostedLaunchRelay, type HostedLaunchDispatchResult } from '../lib/launch-relay'
import { applyHostedLaunchRequest, type HostedShellLaunchRequest } from '../lib/shell-state'
import { useConnectionsActions } from '../lib/use-connections'
import { useRouterContext } from '../lib/use-router-context'

const AppLaunchErrorContext = createContext<string | null | undefined>(undefined)

/** Retire a transient source after another browser App surface acknowledges the launch. */
export function retireHostedLaunchSourceBestEffort(
  result: HostedLaunchDispatchResult,
  closeSource: () => void
): void {
  if (result === 'forwarded') {
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

/** Keep launch ownership alive across every App route, independently of the Workspaces surface. */
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
    if (fallbackLaunchRequest && connectionActions.getState().tabs.length === 0) {
      applyLaunch(fallbackLaunchRequest)
    }
    if (initialLaunchRequest && !initialLaunchHandledRef.current) {
      initialLaunchHandledRef.current = true
      void dispatchLaunch(initialLaunchRequest)
    }

    return () => {
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
