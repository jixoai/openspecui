import type { TerminalProgressState, TerminalPromptState } from '@openspecui/core/terminal-control'
import type { TerminalShellProfile } from '@openspecui/core/terminal-invocation'
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
import { isTerminalRendererEngine, terminalController } from './terminal-controller'
import { useDarkMode } from './use-dark-mode'
import { useConfigSubscription } from './use-subscription'

export interface TerminalSession {
  id: string
  serverSessionId: string | null
  label: string
  customTitle: string | null
  processTitle: string | null
  oscTitle: string | null
  cwd: string | null
  progress: { state: TerminalProgressState; value: number | null } | null
  promptState: TerminalPromptState | null
  displayTitle: string
  isDedicated: boolean
  isExited: boolean
  exitCode: number | null
  outputActive: boolean
  lastBellAt: number | null
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
    customTitle?: string | null
    command?: string
    args?: string[]
    closeTip?: string
    closeCallbackUrl?: string | Record<string, string>
    initialInput?: string
  }) => string
  createShellSession: (
    shell: TerminalShellProfile,
    opts?: { label?: string; initialInput?: string }
  ) => string
  createDedicatedSession: (
    command: string,
    args: string[],
    opts?: {
      closeTip?: string
      closeCallbackUrl?: string | Record<string, string>
      initialInput?: string
    }
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
    () => terminalController.getSnapshot(),
    () => terminalController.getSnapshot()
  )

  // Active tab is pure UI state — React state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const createSession = useCallback(
    (opts?: {
      label?: string
      customTitle?: string | null
      command?: string
      args?: string[]
      closeTip?: string
      closeCallbackUrl?: string | Record<string, string>
      initialInput?: string
    }) => {
      if (isStatic) return ''
      const id = terminalController.createSession(opts)
      setActiveSessionId(id)
      terminalController.setActiveSessionId(id)
      return id
    },
    [isStatic]
  )

  const createShellSession = useCallback(
    (shell: TerminalShellProfile, opts?: { label?: string; initialInput?: string }) => {
      if (isStatic) return ''
      const label = opts?.label ?? shell.label
      const id = terminalController.createSession({
        label,
        command: shell.command,
        args: shell.args,
        initialInput: opts?.initialInput,
      })
      setActiveSessionId(id)
      terminalController.setActiveSessionId(id)
      return id
    },
    [isStatic]
  )

  const createDedicatedSession = useCallback(
    (
      command: string,
      args: string[],
      opts?: {
        closeTip?: string
        closeCallbackUrl?: string | Record<string, string>
        initialInput?: string
      }
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
        initialInput: opts?.initialInput,
      })
      setActiveSessionId(id)
      terminalController.setActiveSessionId(id)
      return id
    },
    [isStatic]
  )

  const closeSession = useCallback((id: string) => {
    terminalController.closeSession(id)
    setActiveSessionId((prev) => (prev === id ? null : prev))
  }, [])

  const setActiveSession = useCallback((id: string) => {
    setActiveSessionId(id)
    terminalController.setActiveSessionId(id)
    terminalController.focusSession(id)
  }, [])

  useEffect(() => {
    return terminalController.subscribeActivation((id) => {
      setActiveSessionId(id)
      const schedule =
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 0)
      schedule(() => {
        terminalController.focusSession(id)
      })
    })
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

  useEffect(() => {
    if (!resolvedActiveSessionId) return
    terminalController.setActiveSessionId(resolvedActiveSessionId)
    terminalController.focusSession(resolvedActiveSessionId)
  }, [resolvedActiveSessionId])

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
  const appDarkMode = useDarkMode()

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncThemeContext = () => {
      terminalController.setThemeContext({
        appDarkMode,
        systemDarkMode: mediaQuery.matches,
      })
    }

    syncThemeContext()
    mediaQuery.addEventListener('change', syncThemeContext)
    return () => mediaQuery.removeEventListener('change', syncThemeContext)
  }, [appDarkMode])

  useEffect(() => {
    if (!config?.terminal) return
    const { rendererEngine, ...terminalConfig } = config.terminal
    if (rendererEngine && isTerminalRendererEngine(rendererEngine)) {
      void terminalController.setRendererEngine(rendererEngine).catch((error) => {
        console.error('[terminal] failed to apply renderer engine from config:', error)
      })
    } else if (rendererEngine) {
      console.error('[terminal] invalid renderer engine in config:', rendererEngine)
    }
    terminalController.applyConfig(terminalConfig)
  }, [config?.terminal])

  const value = useMemo<TerminalContextValue>(
    () => ({
      sessions,
      activeSessionId: resolvedActiveSessionId,
      createSession,
      createShellSession,
      createDedicatedSession,
      closeSession,
      setActiveSession,
      markExited,
      setCustomTitle,
    }),
    [
      sessions,
      resolvedActiveSessionId,
      createSession,
      createShellSession,
      createDedicatedSession,
      closeSession,
      setActiveSession,
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
