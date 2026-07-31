/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Render the candidate-backed Workspace Launcher Dialog (4.3–4.9).
 * 2. Direct plane is a searchable candidate list; manual URL entry is a secondary escape flow.
 * 3. Pure presentation composed by HostedShell; callbacks stay owned by the caller.
 *
 * Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，那么弹出的Dialog就会包含Connnections列表，而不是一个URL-Input"
 * Spec: hosted-app-distribution › "Candidate-Backed Workspace Launcher".
 *
 * Row commands are exhaustive: Focus an open Workspace, Open a reachable candidate, or present the concrete
 * unavailable state directly (4.6). Connect-another-backend is a secondary nested form with back/cancel/success.
 * Forget/remove lives in the row menu and is distinct from closing an open Workspace (4.8).
 */
import { Dialog } from '@openspecui/web-src/components/dialog'
import { ArrowLeft, Loader2, MoreVertical, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  isLauncherRowLocked,
  selectLauncherRows,
  type LauncherCandidate,
  type LauncherOpenWorkspace,
  type LauncherPendingCommand,
} from '../lib/workspace-launcher-selector'

export interface WorkspaceLauncherDialogProps {
  open: boolean
  onClose: () => void
  candidates: readonly LauncherCandidate[]
  openWorkspaces: readonly LauncherOpenWorkspace[]
  pending: readonly LauncherPendingCommand[]
  /** Focus an existing exact Workspace (no new tab/session/frame). */
  onFocus: (apiBaseUrl: string) => void
  /** Open exactly one Workspace from a reachable candidate. */
  onOpen: (apiBaseUrl: string) => void
  /** Forget/remove a manual candidate (distinct from closing an open Workspace). */
  onForget: (apiBaseUrl: string) => void
  /** Submit a manual backend URL (secondary escape flow). */
  onConnect: (apiBaseUrl: string) => void
  /** Optional concrete error from the last open/connect attempt. */
  error?: string | null
}

export function WorkspaceLauncherDialog({
  open,
  onClose,
  candidates,
  openWorkspaces,
  pending,
  onFocus,
  onOpen,
  onForget,
  onConnect,
  error = null,
}: WorkspaceLauncherDialogProps) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'list' | 'connect'>('list')
  const [connectUrl, setConnectUrl] = useState('')
  const [connectError, setConnectError] = useState<string | null>(null)
  const connectPending = pending.some((command) => command.kind === 'connect')
  const anyPending = pending.length > 0

  const rows = useMemo(
    () => selectLauncherRows({ candidates, openWorkspaces, pending }),
    [candidates, openWorkspaces, pending]
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const label = row.candidate.label
      return (
        row.candidate.apiBaseUrl.toLowerCase().includes(q) ||
        (label?.title?.toLowerCase().includes(q) ?? false) ||
        (label?.detail?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [rows, query])

  const close = () => {
    if (anyPending) return
    setMode('list')
    setQuery('')
    setConnectUrl('')
    setConnectError(null)
    onClose()
  }

  const submitConnect = () => {
    const trimmed = connectUrl.trim()
    let normalized: string | null = null
    try {
      const url = new URL(trimmed)
      url.hash = ''
      normalized = url.toString().replace(/\/$/, '')
    } catch {
      normalized = null
    }
    if (!normalized) {
      setConnectError('Enter a valid backend API URL (e.g. http://localhost:3100).')
      return
    }
    onConnect(normalized)
    setConnectError(null)
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={
        mode === 'list' ? (
          <span className="text-lg font-semibold">Open Workspace</span>
        ) : (
          <button
            type="button"
            disabled={connectPending}
            onClick={() => setMode('list')}
            className="hover:bg-muted inline-flex items-center gap-1.5 rounded-md text-lg font-semibold disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Connect another backend
          </button>
        )
      }
      footer={
        mode === 'list' ? (
          <>
            <button
              type="button"
              disabled={anyPending}
              onClick={close}
              className="hover:bg-muted rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={anyPending}
              onClick={() => setMode('connect')}
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Connect another backend...
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={connectPending}
              onClick={() => setMode('list')}
              className="hover:bg-muted rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={connectPending}
              onClick={submitConnect}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-w-24 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {connectPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Connect
            </button>
          </>
        )
      }
    >
      {mode === 'list' ? (
        <div className="min-w-0 space-y-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search connections"
              aria-label="Search connections"
              autoFocus
              className="border-border bg-background focus:border-primary w-full rounded-md border py-2 pl-8 pr-2 text-sm outline-none"
            />
          </div>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-2 py-4 text-center text-sm">
              {candidates.length === 0
                ? 'No connection candidates yet. Connect another backend to start.'
                : 'No candidates match the search.'}
            </p>
          ) : (
            <ul
              role="list"
              className="border-border divide-border max-h-80 divide-y overflow-auto rounded-md border"
            >
              {filtered.map((row) => (
                <LauncherRowView
                  key={row.candidate.apiBaseUrl}
                  row={row}
                  onFocus={onFocus}
                  onOpen={onOpen}
                  onForget={onForget}
                />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="launcher-connect-url" className="text-sm font-medium">
            Backend API URL
          </label>
          <input
            id="launcher-connect-url"
            type="url"
            value={connectUrl}
            disabled={connectPending}
            onChange={(event) => {
              setConnectUrl(event.target.value)
              setConnectError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !connectPending) submitConnect()
            }}
            placeholder="http://localhost:3100"
            className="border-border bg-background focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-60"
          />
          {connectError ? <p className="text-destructive text-xs">{connectError}</p> : null}
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>
      )}
    </Dialog>
  )
}

function LauncherRowView({
  row,
  onFocus,
  onOpen,
  onForget,
}: {
  row: ReturnType<typeof selectLauncherRows>[number]
  onFocus: (apiBaseUrl: string) => void
  onOpen: (apiBaseUrl: string) => void
  onForget: (apiBaseUrl: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { candidate, command, pending } = row
  const label = candidate.label
  const locked = isLauncherRowLocked(row)
  return (
    <li className="hover:bg-muted/40 relative flex min-w-0 items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{label?.title ?? candidate.apiBaseUrl}</div>
        {label?.subtitle ? (
          <div className="text-muted-foreground truncate text-xs">{label.subtitle}</div>
        ) : null}
        <div className="text-muted-foreground/70 truncate text-xs">
          {label?.detail ?? candidate.apiBaseUrl}
        </div>
        {candidate.envUri ? (
          <div className="text-muted-foreground/60 truncate text-xs">{candidate.envUri}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {command.kind === 'unavailable' ? (
          <span className="text-muted-foreground px-2 py-1 text-xs capitalize">
            {command.reason.replace('-', ' ')}
          </span>
        ) : (
          <button
            type="button"
            disabled={locked}
            onClick={() =>
              command.kind === 'focus' ? onFocus(command.apiBaseUrl) : onOpen(command.apiBaseUrl)
            }
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-w-16 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {command.kind === 'focus' ? 'Focus' : 'Open'}
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            disabled={pending}
            aria-label={`More actions for ${candidate.apiBaseUrl}`}
            onClick={() => setMenuOpen((value) => !value)}
            className="text-muted-foreground hover:text-foreground rounded-md p-1 disabled:opacity-50"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="border-border bg-background absolute right-0 top-full z-10 mt-1 w-40 rounded-md border py-1 shadow-md">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onForget(candidate.apiBaseUrl)
                }}
                className="text-muted-foreground hover:bg-muted hover:text-destructive block w-full px-3 py-1.5 text-left text-xs"
              >
                Forget connection
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}
