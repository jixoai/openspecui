/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Bind the running-backend observer to the complete daemon ledger for the App route lifetime.
 * 2. Refresh Health evidence on focus/visibility without introducing a healthy polling timer.
 * 3. Expose one shared immutable observation snapshot to navigation and Task Manager.
 *
 * Owner correction (2026-07-31): Running status must survive closed tabs and require Health API plus WebSocket.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useAppDaemonWorkspace } from '../components/app-daemon-workspace-owner'
import {
  createRunningBackendObservationOwner,
  type RunningBackendObservationOwner,
  type RunningBackendObservationSnapshot,
} from './running-backend-observation'

const RunningBackendObservationContext = createContext<RunningBackendObservationOwner | null>(null)

/** Keep daemon-ledger backend observation alive independently from open Workspace tabs. */
export function RunningBackendObservationProvider({ children }: { children: ReactNode }) {
  const daemon = useAppDaemonWorkspace()
  const [owner] = useState(createRunningBackendObservationOwner)

  useEffect(() => {
    owner.setWorkspaces(daemon.workspaces)
  }, [daemon.workspaces, owner])

  useEffect(() => {
    const refresh = () => void owner.refresh()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      owner.setWorkspaces([])
    }
  }, [owner])

  return (
    <RunningBackendObservationContext.Provider value={owner}>
      {children}
    </RunningBackendObservationContext.Provider>
  )
}

/** Subscribe to every daemon-registered backend's Health + WebSocket evidence. */
export function useRunningBackendObservations(): RunningBackendObservationSnapshot {
  const owner = useContext(RunningBackendObservationContext)
  if (!owner) throw new Error('RunningBackendObservationProvider is required.')
  return useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot)
}
