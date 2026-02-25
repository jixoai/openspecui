import { Tabs, type Tab } from '@/components/tabs'
import { navController } from '@/lib/nav-controller'
import { useTerminalContext } from '@/lib/terminal-context'
import { terminalController } from '@/lib/terminal-controller'
import { useNavLayout } from '@/lib/use-nav-controller'
import '@/styles/terminal-effects.css'
import { Keyboard, PanelBottomClose, PanelTopClose, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { XtermTerminal } from './xterm-terminal'

function EditableTabLabel({
  session,
  onRename,
}: {
  session: {
    id: string
    displayTitle: string
    isExited: boolean
    exitCode: number | null
    outputActive: boolean
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
    <span
      className={[
        'inline-block h-2 w-2 shrink-0 rounded-full',
        session.isExited
          ? session.exitCode === 0
            ? 'bg-emerald-500'
            : 'bg-red-500'
          : session.outputActive
            ? 'animate-terminal-breathing'
            : 'bg-zinc-400',
      ].join(' ')}
    />
  )

  if (editing) {
    return (
      <span className="flex items-center gap-1.5">
        {statusLight}
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
          className="placeholder:text-muted-foreground w-[120px] border-b border-current bg-transparent text-sm text-inherit outline-none"
        />
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5" onDoubleClick={startEditing}>
      {statusLight}
      <span className="max-w-[150px] truncate">{session.displayTitle}</span>
    </span>
  )
}

export function TerminalPanel({ className }: { className?: string }) {
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    createSession,
    closeSession,
    setCustomTitle,
  } = useTerminalContext()

  const wrapperRef = useRef<HTMLDivElement>(null)

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

  const tabs = useMemo<Tab[]>(
    () =>
      sessions.map((session) => ({
        id: session.id,
        label: <EditableTabLabel session={session} onRename={handleRename} />,
        unmountOnHide: true,
        closable: true,
        closeButtonVisibility: 'always',
        content: (
          <div className="bg-terminal h-full">
            <XtermTerminal sessionId={session.id} />
          </div>
        ),
      })),
    [sessions, handleRename]
  )

  const navLayout = useNavLayout()
  const isInBottom = navLayout.bottomTabs.includes('/terminal')

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

  const addButton = (
    <button
      type="button"
      onClick={() => createSession()}
      className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-md p-1.5 transition"
      title="New terminal"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  )

  const areaActions = (
    <div className="ml-auto flex items-center">
      {addButton}
      <button
        type="button"
        onClick={handleOpenInputPanel}
        className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-md p-1.5 transition"
        title="Open InputPanel"
      >
        <Keyboard className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={handleSwitchArea}
        className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-md p-1.5 transition"
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
          className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-md p-1.5 transition"
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
      className={`bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${className}`}
    >
      {sessions.length === 0 ? (
        <div className="text-terminal-foreground bg-terminal flex h-full flex-wrap content-center items-center justify-center whitespace-pre p-4 text-sm">
          <span>No terminal sessions. Click</span>
          <button
            type="button"
            onClick={() => createSession()}
            className="bg-primary text-primary-foreground mx-2 px-2 text-lg font-bold"
          >
            +
          </button>{' '}
          <span>to create one.</span>
        </div>
      ) : (
        <Tabs
          tabs={tabs}
          selectedTab={activeSessionId ?? undefined}
          onTabChange={setActiveSession}
          onTabClose={closeSession}
          onTabBarDoubleClick={() => createSession()}
          actions={areaActions}
        />
      )}
    </div>
  )
}
