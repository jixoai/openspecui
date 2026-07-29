/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Render terminal tabs, lifecycle indicators, notifications, and panel actions.
 * 2. Expose explicit cwd targets only when Launch and Planning physical roots differ.
 * 3. Keep each tab's initial cwd identity visible across local creation and restore.
 * 4. Host shell and configured-command creation flows without owning PTY path resolution.
 *
 * Original request (2026-07-16): "Terminal shows selected cwd/root identity in creation controls and tab labels."
 * Owner same-root direction (2026-07-29): generic same-root creation implicitly remains Launch-owned.
 */
import { Badge, CountBadge } from '@/components/badge'
import {
  ContextMenu,
  type ContextMenuAnchor,
  type ContextMenuItem,
} from '@/components/context-menu'
import type { Tab } from '@/components/tabs'
import { navController } from '@/lib/nav-controller'
import { useNotifications } from '@/lib/notifications/context'
import { useTerminalContext } from '@/lib/terminal-context'
import { terminalController } from '@/lib/terminal-controller'
import { useNavLayout } from '@/lib/use-nav-controller'
import {
  getTerminalCwdTargetOption,
  useTerminalCwdTargetState,
} from '@/lib/use-terminal-cwd-target'
import { useTerminalInvocationConfig } from '@/lib/use-terminal-invocation-config'
import '@/styles/terminal-effects.css'
import type { TerminalCwdTarget } from '@openspecui/core/pty-protocol'
import type { TerminalSpawnCommand } from '@openspecui/core/terminal-invocation'
import {
  ChevronDown,
  Keyboard,
  PanelBottomClose,
  PanelTopClose,
  Plus,
  Rocket,
  Terminal,
  X,
} from 'lucide-react'
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { TerminalCwdTargetControl } from './terminal-cwd-target-control'
import { TerminalSpawnCommandDialog } from './terminal-spawn-command-dialog'
import { TerminalTabs } from './terminal-tabs'
import { XtermTerminal } from './xterm-terminal'

function EditableTabLabel({
  session,
  onRename,
}: {
  session: {
    id: string
    serverSessionId: string | null
    displayTitle: string
    cwdTarget: TerminalCwdTarget
    initialCwd: string | null
    isExited: boolean
    exitCode: number | null
    outputActive: boolean
    lastBellAt: number | null
  }
  onRename: (id: string, title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const startEditing = useCallback(() => {
    setDraft('')
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const commit = useCallback(() => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed) {
      onRename(session.id, trimmed)
    }
  }, [draft, session.id, onRename])

  const cancel = useCallback(() => {
    setEditing(false)
  }, [])

  const statusLight = (
    <span className="relative inline-flex h-3 w-3 shrink-0 items-center justify-center">
      {session.lastBellAt !== null && (
        <span
          key={session.lastBellAt}
          data-testid={`terminal-bell-ripple-${session.id}`}
          className="animate-terminal-bell-ripple bg-primary/45 absolute h-2 w-2 rounded-full"
        />
      )}
      <span
        className={[
          'relative inline-block h-2 w-2 rounded-full',
          session.isExited
            ? session.exitCode === 0
              ? 'bg-emerald-500'
              : 'bg-red-500'
            : session.outputActive
              ? 'animate-terminal-breathing'
              : 'bg-zinc-400',
        ].join(' ')}
      />
    </span>
  )
  const cwdLabel = session.cwdTarget === 'planning-root' ? 'Planning' : 'Launch'
  const cwdPath = session.initialCwd ?? 'Resolving cwd'
  const cwdBadge = (
    <span
      className="border-border text-muted-foreground shrink-0 rounded-sm border px-1 py-0.5 text-[9px] leading-none"
      title={`${cwdLabel}: ${cwdPath}`}
    >
      {cwdLabel}
    </span>
  )
  if (editing) {
    return (
      <span className="grid min-w-0 grid-cols-[0.75rem_auto_minmax(0,1fr)] items-center gap-1.5">
        {statusLight}
        {cwdBadge}
        <span className="min-w-0">
          <input
            ref={inputRef}
            value={draft}
            placeholder={session.displayTitle}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') cancel()
              e.stopPropagation()
            }}
            onClick={(e) => e.stopPropagation()}
            className="placeholder:text-muted-foreground block w-full min-w-0 border-b border-current bg-transparent text-xs text-inherit outline-none"
          />
          <span
            className="text-muted-foreground block min-w-0 truncate text-[9px] leading-tight"
            title={cwdPath}
          >
            {cwdPath}
          </span>
        </span>
      </span>
    )
  }

  return (
    <span
      className="grid min-w-0 grid-cols-[0.75rem_auto_minmax(0,1fr)] items-center gap-1.5"
      onDoubleClick={startEditing}
    >
      {statusLight}
      {cwdBadge}
      <span className="min-w-0">
        <span className="block min-w-0 truncate text-xs">{session.displayTitle}</span>
        <span
          className="text-muted-foreground block min-w-0 truncate text-[9px] leading-tight"
          title={cwdPath}
        >
          {cwdPath}
        </span>
      </span>
    </span>
  )
}

function TerminalUnreadBadge({ unreadCount }: { unreadCount: number }) {
  if (unreadCount <= 0) return null

  const label = `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
  if (unreadCount === 1) {
    return (
      <Badge
        size="dot"
        className="-mr-0.5 -mt-0.5 ring-1 ring-[var(--terminal)]"
        title={label}
        aria-label={label}
      />
    )
  }

  return (
    <CountBadge
      count={unreadCount}
      className="ring-1 ring-[var(--terminal)]"
      title={label}
      aria-label={label}
    />
  )
}

const FOCUSED_TERMINAL_NOTIFICATION_TTL = 2000

export function TerminalPanel({ className }: { className?: string }) {
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    createShellSession,
    closeSession,
    setCustomTitle,
  } = useTerminalContext()
  const { notifications, clearTerminalSession } = useNotifications()
  const { shellProfiles, spawnCommands, defaultShellProfile } = useTerminalInvocationConfig()
  const cwdTargetState = useTerminalCwdTargetState()
  const [cwdTarget, setCwdTarget] = useState<TerminalCwdTarget>('launch-project')
  const effectiveCwdTarget = cwdTargetState.topology === 'collapsed' ? 'launch-project' : cwdTarget
  const selectedCwdTarget = getTerminalCwdTargetOption(cwdTargetState, effectiveCwdTarget)
  const [menuAnchor, setMenuAnchor] = useState<ContextMenuAnchor | null>(null)
  const [selectedSpawnCommand, setSelectedSpawnCommand] = useState<TerminalSpawnCommand | null>(
    null
  )

  const wrapperRef = useRef<HTMLDivElement>(null)
  const navLayout = useNavLayout()
  const isInBottom = navLayout.bottomTabs.includes('/terminal')
  const isTerminalVisible =
    navLayout.mainLocation.pathname === '/terminal' ||
    navLayout.mainLocation.pathname.startsWith('/terminal/') ||
    navLayout.bottomLocation.pathname === '/terminal' ||
    navLayout.bottomLocation.pathname.startsWith('/terminal/')
  const terminalSnapshot = useSyncExternalStore(
    (cb) => terminalController.subscribe(cb),
    () => terminalController.getSnapshot(),
    () => terminalController.getSnapshot()
  )

  const terminalThemeStyle = useMemo(() => {
    const resolvedTheme = terminalController.getResolvedTheme()
    return {
      '--terminal': resolvedTheme.definition.palette.background,
      '--terminal-foreground': resolvedTheme.definition.palette.foreground,
    } as CSSProperties
  }, [terminalSnapshot])

  // Set a stable mount target for the InputPanel addon panel.
  // This persists across tab switches so the singleton panel doesn't get orphaned.
  useEffect(() => {
    if (wrapperRef.current) {
      terminalController.setInputPanelMountTarget(wrapperRef.current)
    }
    return () => {
      terminalController.setInputPanelMountTarget(null)
    }
  }, [])

  const handleRename = useCallback(
    (id: string, title: string) => {
      setCustomTitle(id, title)
    },
    [setCustomTitle]
  )

  const unreadByServerSessionId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const notification of notifications) {
      if (notification.source.type !== 'terminal') continue
      counts.set(
        notification.source.sessionId,
        (counts.get(notification.source.sessionId) ?? 0) + 1
      )
    }
    return counts
  }, [notifications])

  useEffect(() => {
    if (!isTerminalVisible) return
    const activeSession = sessions.find((item) => item.id === activeSessionId)
    const serverSessionId = activeSession?.serverSessionId
    if (!serverSessionId) return
    const hasUnread = notifications.some(
      (notification) =>
        notification.source.type === 'terminal' && notification.source.sessionId === serverSessionId
    )
    if (!hasUnread) return
    const timer = window.setTimeout(() => {
      void clearTerminalSession(serverSessionId)
    }, FOCUSED_TERMINAL_NOTIFICATION_TTL)
    return () => window.clearTimeout(timer)
  }, [activeSessionId, clearTerminalSession, isTerminalVisible, notifications, sessions])

  const tabContentBySessionId = useMemo(() => {
    const content = new Map<string, ReactNode>()
    for (const session of sessions) {
      content.set(
        session.id,
        <div className="bg-terminal h-full">
          <XtermTerminal sessionId={session.id} />
        </div>
      )
    }
    return content
  }, [sessions])

  const tabs = useMemo<Tab[]>(
    () =>
      sessions.map((session) => {
        const unreadCount = session.serverSessionId
          ? (unreadByServerSessionId.get(session.serverSessionId) ?? 0)
          : 0

        return {
          id: session.id,
          title: `${session.cwdTarget === 'planning-root' ? 'Planning root' : 'Launch project'}: ${session.initialCwd ?? 'resolving'} · ${session.displayTitle}`,
          label: <EditableTabLabel session={session} onRename={handleRename} />,
          badge: unreadCount > 0 ? <TerminalUnreadBadge unreadCount={unreadCount} /> : undefined,
          unmountOnHide: true,
          closable: true,
          closeButtonVisibility: 'always',
          content: tabContentBySessionId.get(session.id),
        }
      }),
    [sessions, handleRename, tabContentBySessionId, unreadByServerSessionId]
  )

  useLayoutEffect(() => {
    terminalController.setInputPanelDefaultLayout(isInBottom ? 'floating' : 'fixed')
  }, [isInBottom])

  const handleSwitchArea = useCallback(() => {
    navController.moveTab('/terminal', isInBottom ? 'main' : 'bottom')
  }, [isInBottom])

  const handleClosePanel = useCallback(() => {
    if (isInBottom) {
      navController.closeTab('/terminal')
    }
  }, [isInBottom])

  const handleOpenInputPanel = useCallback(() => {
    terminalController.openInputPanel(activeSessionId ?? undefined)
  }, [activeSessionId])

  const handleTabChange = useCallback(
    (id: string) => {
      setActiveSession(id)
      const session = sessions.find((item) => item.id === id)
      if (session?.serverSessionId) {
        void clearTerminalSession(session.serverSessionId)
      }
    },
    [clearTerminalSession, sessions, setActiveSession]
  )

  const handleCreateDefaultShell = useCallback(() => {
    if (!selectedCwdTarget.available) return
    createShellSession(defaultShellProfile, { cwdTarget: effectiveCwdTarget })
  }, [createShellSession, defaultShellProfile, effectiveCwdTarget, selectedCwdTarget.available])

  const handleOpenCreateMenu = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const element = event.currentTarget
    setMenuAnchor((current) =>
      current?.type === 'target' && current.element === element
        ? null
        : { type: 'target', element, placement: 'bottom-end' }
    )
  }, [])

  const menuItems = useMemo<ContextMenuItem[]>(() => {
    const shellItems: ContextMenuItem[] = shellProfiles.map((shell) => ({
      id: `shell:${shell.id}`,
      label: shell.label,
      icon: <Terminal className="h-3.5 w-3.5" />,
      disabled: !selectedCwdTarget.available,
      onSelect: () => {
        createShellSession(shell, { cwdTarget: effectiveCwdTarget })
        setMenuAnchor(null)
      },
    }))
    const commandItems: ContextMenuItem[] = spawnCommands.map((command) => ({
      id: `command:${command.id}`,
      label: command.label,
      icon: <Rocket className="h-3.5 w-3.5" />,
      disabled: !selectedCwdTarget.available,
      onSelect: () => {
        setSelectedSpawnCommand(command)
        setMenuAnchor(null)
      },
    }))
    return [
      ...shellItems,
      ...(shellItems.length > 0 && commandItems.length > 0
        ? [{ id: 'separator', label: '', disabled: true, onSelect: () => {} }]
        : []),
      ...commandItems,
    ]
  }, [
    createShellSession,
    effectiveCwdTarget,
    selectedCwdTarget.available,
    shellProfiles,
    spawnCommands,
  ])

  const addButton = (
    <button
      type="button"
      onClick={handleCreateDefaultShell}
      disabled={!selectedCwdTarget.available}
      className="text-terminal-foreground/72 hover:bg-terminal-foreground/10 hover:text-terminal-foreground shrink-0 rounded-md p-1.5 transition"
      aria-label="New terminal"
      title={
        selectedCwdTarget.available
          ? 'New terminal'
          : (selectedCwdTarget.unavailableReason ?? undefined)
      }
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  )

  const createMenuButton = (
    <button
      type="button"
      onClick={handleOpenCreateMenu}
      className="text-terminal-foreground/72 hover:bg-terminal-foreground/10 hover:text-terminal-foreground shrink-0 rounded-md p-1.5 transition"
      aria-label="New terminal options"
      title="New terminal options"
    >
      <ChevronDown className="h-3.5 w-3.5" />
    </button>
  )

  const areaActions = (
    <div className="ml-auto flex min-w-0 items-center gap-1">
      <TerminalCwdTargetControl
        value={cwdTarget}
        state={cwdTargetState}
        onValueChange={setCwdTarget}
        showPath
        className="mr-1 w-32 shrink-0 sm:w-44"
      />
      {addButton}
      {createMenuButton}
      <button
        type="button"
        onClick={handleOpenInputPanel}
        className="text-terminal-foreground/72 hover:bg-terminal-foreground/10 hover:text-terminal-foreground shrink-0 rounded-md p-1.5 transition"
        title="Open InputPanel"
      >
        <Keyboard className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={handleSwitchArea}
        className="text-terminal-foreground/72 hover:bg-terminal-foreground/10 hover:text-terminal-foreground shrink-0 rounded-md p-1.5 transition"
        title={isInBottom ? 'Move to main area' : 'Move to bottom area'}
      >
        {isInBottom ? (
          <PanelTopClose className="h-3.5 w-3.5" />
        ) : (
          <PanelBottomClose className="h-3.5 w-3.5" />
        )}
      </button>
      {isInBottom && (
        <button
          type="button"
          onClick={handleClosePanel}
          className="text-terminal-foreground/72 hover:bg-terminal-foreground/10 hover:text-terminal-foreground shrink-0 rounded-md p-1.5 transition"
          title="Close panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <div
      ref={wrapperRef}
      style={terminalThemeStyle}
      className={`bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${className}`}
    >
      {sessions.length === 0 ? (
        <div className="text-terminal-foreground bg-terminal flex h-full min-w-0 items-center justify-center p-4 text-sm">
          <div className="flex w-full min-w-0 max-w-sm flex-col gap-3">
            <TerminalCwdTargetControl
              value={cwdTarget}
              state={cwdTargetState}
              onValueChange={setCwdTarget}
              showPath
              className="min-w-0"
            />
            <div className="flex min-w-0 items-center justify-center gap-2">
              <span className="truncate">No terminal sessions.</span>
              <button
                type="button"
                onClick={handleCreateDefaultShell}
                disabled={!selectedCwdTarget.available}
                className="bg-primary text-primary-foreground inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm"
                aria-label="New terminal"
                title={selectedCwdTarget.unavailableReason ?? undefined}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
              {createMenuButton}
            </div>
          </div>
        </div>
      ) : (
        <TerminalTabs
          tabs={tabs}
          selectedTab={activeSessionId ?? undefined}
          onTabChange={handleTabChange}
          onTabClose={closeSession}
          onTabBarDoubleClick={handleCreateDefaultShell}
          actions={areaActions}
        />
      )}
      <ContextMenu
        open={menuAnchor !== null}
        anchor={menuAnchor}
        items={menuItems}
        wrapperElement={wrapperRef.current}
        onClose={() => setMenuAnchor(null)}
      />
      <TerminalSpawnCommandDialog
        open={selectedSpawnCommand !== null}
        command={selectedSpawnCommand}
        initialCwdTarget={effectiveCwdTarget}
        onClose={() => setSelectedSpawnCommand(null)}
      />
    </div>
  )
}
