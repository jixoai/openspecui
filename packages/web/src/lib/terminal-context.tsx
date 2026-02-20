import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { isStaticMode } from './static-mode'
import { terminalController } from './terminal-controller'
import { useConfigSubscription } from './use-subscription'

export interface TerminalSession {
  id: string
  label: string
  customTitle: string | null
  processTitle: string | null
  displayTitle: string
  isDedicated: boolean
  isExited: boolean
  exitCode: number | null
  outputActive: boolean
  command?: string
  args?: string[]
  closeTip?: string
  closeCallbackUrl?: string | Record<string, string>
}

interface TerminalContextValue {
  sessions: TerminalSession[]
  activeSessionId: string | null
  createSession: (opts?: {
    label?: string
    command?: string
    args?: string[]
    closeTip?: string
    closeCallbackUrl?: string | Record<string, string>
  }) => string
  createDedicatedSession: (
    command: string,
    args: string[],
    opts?: { closeTip?: string; closeCallbackUrl?: string | Record<string, string> }
  ) => string
  closeSession: (id: string) => void
  setActiveSession: (id: string) => void
  markExited: (id: string, exitCode: number) => void
  setCustomTitle: (id: string, title: string | null) => void
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

export { terminalController }

export function TerminalProvider({ children }: { children: ReactNode }) {
  const isStatic = isStaticMode()

  // Subscribe to controller state via useSyncExternalStore
  const snapshot = useSyncExternalStore(
    (cb) => terminalController.subscribe(cb),
    () => terminalController.getSnapshot()
  )

  // Active tab is pure UI state — React state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const createSession = useCallback(
    (opts?: {
      label?: string
      command?: string
      args?: string[]
      closeTip?: string
      closeCallbackUrl?: string | Record<string, string>
    }) => {
      if (isStatic) return ''
      const id = terminalController.createSession(opts)
      setActiveSessionId(id)
      return id
    },
    [isStatic]
  )

  const createDedicatedSession = useCallback(
    (
      command: string,
      args: string[],
      opts?: { closeTip?: string; closeCallbackUrl?: string | Record<string, string> }
    ) => {
      if (isStatic) return ''
      const label = `${command} ${args.join(' ')}`.trim()
      const id = terminalController.createSession({
        label: label.length > 40 ? `${label.slice(0, 37)}...` : label,
        command,
        args,
        isDedicated: true,
        closeTip: opts?.closeTip,
        closeCallbackUrl: opts?.closeCallbackUrl,
      })
      setActiveSessionId(id)
      return id
    },
    [isStatic]
  )

  const closeSession = useCallback((id: string) => {
    terminalController.closeSession(id)
    setActiveSessionId((prev) => (prev === id ? null : prev))
  }, [])

  const markExited = useCallback((_id: string, _exitCode: number) => {
    // Exit is now handled by the controller via WebSocket messages.
    // Kept for API compatibility — no-op.
  }, [])

  const setCustomTitle = useCallback((id: string, title: string | null) => {
    terminalController.setCustomTitle(id, title)
  }, [])

  const sessions: TerminalSession[] = snapshot.sessions

  const resolvedActiveSessionId = useMemo(() => {
    if (activeSessionId && sessions.some((s) => s.id === activeSessionId)) {
      return activeSessionId
    }
    return sessions[sessions.length - 1]?.id ?? null
  }, [activeSessionId, sessions])

  // Restore UI state when sessions are discovered from server after reconnect/refresh
  const hasRestoredRef = useRef(false)
  useEffect(() => {
    if (hasRestoredRef.current) return
    if (sessions.length === 0) return
    // Only auto-restore if the sessions appeared without a local createSession call
    if (terminalController.discoveredSessions) {
      hasRestoredRef.current = true
      setActiveSessionId((prev) => prev ?? sessions[0].id)
    }
  }, [sessions])

  // Sync terminal config from .openspecui.json
  const { data: config } = useConfigSubscription()
  useEffect(() => {
    if (!config?.terminal) return
    terminalController.applyConfig(config.terminal)
  }, [config?.terminal])

  const value = useMemo<TerminalContextValue>(
    () => ({
      sessions,
      activeSessionId: resolvedActiveSessionId,
      createSession,
      createDedicatedSession,
      closeSession,
      setActiveSession: setActiveSessionId,
      markExited,
      setCustomTitle,
    }),
    [
      sessions,
      resolvedActiveSessionId,
      createSession,
      createDedicatedSession,
      closeSession,
      markExited,
      setCustomTitle,
    ]
  )

  return <TerminalContext value={value}>{children}</TerminalContext>
}

export function useTerminalContext(): TerminalContextValue {
  const ctx = useContext(TerminalContext)
  if (!ctx) {
    throw new Error('useTerminalContext must be used within a TerminalProvider')
  }
  return ctx
}
