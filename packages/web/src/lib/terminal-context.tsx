import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import YAML from 'yaml'
import { terminalController } from './terminal-controller'
import { useOpsxProjectConfigSubscription } from './use-opsx'
import { isStaticMode } from './static-mode'

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
}

interface TerminalContextValue {
  sessions: TerminalSession[]
  activeSessionId: string | null
  createSession: (opts?: { label?: string; command?: string; args?: string[] }) => string
  createDedicatedSession: (command: string, args: string[]) => string
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
    (opts?: { label?: string; command?: string; args?: string[] }) => {
      if (isStatic) return ''
      const id = terminalController.createSession(opts)
      setActiveSessionId(id)
      return id
    },
    [isStatic]
  )

  const createDedicatedSession = useCallback(
    (command: string, args: string[]) => {
      if (isStatic) return ''
      const label = `${command} ${args.join(' ')}`.trim()
      const id = terminalController.createSession({
        label: label.length > 40 ? `${label.slice(0, 37)}...` : label,
        command,
        args,
        isDedicated: true,
      })
      setActiveSessionId(id)
      return id
    },
    [isStatic]
  )

  const closeSession = useCallback((id: string) => {
    terminalController.closeSession(id)
    setActiveSessionId((prev) => {
      if (prev !== id) return prev
      const remaining = terminalController.getSnapshot().sessions.filter((s) => s.id !== id)
      return remaining[remaining.length - 1]?.id ?? null
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

  // Sync terminal config from config.yaml (always mounted, so config changes apply immediately)
  const { data: projectConfigYaml } = useOpsxProjectConfigSubscription()
  useEffect(() => {
    if (!projectConfigYaml) return
    try {
      const parsed = YAML.parse(projectConfigYaml)
      const ui = parsed?.ui as Record<string, unknown> | undefined
      if (!ui) return
      const fontSize = typeof ui['font-size'] === 'number' ? ui['font-size'] : 13
      const fontFamily = Array.isArray(ui['font-families'])
        ? (ui['font-families'] as string[]).join(', ')
        : typeof ui['font-family'] === 'string' ? ui['font-family'] : ''
      const cursorBlink = typeof ui['cursor-blink'] === 'boolean' ? ui['cursor-blink'] : true
      const cursorStyle = (['block', 'underline', 'bar'] as const).includes(ui['cursor-style'] as 'block' | 'underline' | 'bar')
        ? (ui['cursor-style'] as 'block' | 'underline' | 'bar')
        : 'block'
      const scrollback = typeof ui['scrollback'] === 'number' ? ui['scrollback'] : 1000
      terminalController.applyConfig({ fontSize, fontFamily, cursorBlink, cursorStyle, scrollback })
    } catch {
      // Invalid YAML — ignore
    }
  }, [projectConfigYaml])

  const value = useMemo<TerminalContextValue>(
    () => ({
      sessions,
      activeSessionId,
      createSession,
      createDedicatedSession,
      closeSession,
      setActiveSession: setActiveSessionId,
      markExited,
      setCustomTitle,
    }),
    [sessions, activeSessionId, createSession, createDedicatedSession, closeSession, markExited, setCustomTitle]
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
