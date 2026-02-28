import { CodeEditor } from '@/components/code-editor'
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { navController } from '@/lib/nav-controller'
import { useTerminalContext } from '@/lib/terminal-context'
import { terminalController } from '@/lib/terminal-controller'
import { ArrowRight, Copy, Save, Send, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type DispatchTarget = `terminal:${string}`

const TERMINAL_TARGET_PREFIX = 'terminal:'

function parseTerminalTarget(target: DispatchTarget): string | null {
  if (!target.startsWith(TERMINAL_TARGET_PREFIX)) return null
  return target.slice(TERMINAL_TARGET_PREFIX.length)
}

export function OpsxProposeRoute() {
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const { sessions, activeSessionId } = useTerminalContext()
  const liveSessions = useMemo(() => sessions.filter((session) => !session.isExited), [sessions])
  const [draft, setDraft] = useState('')
  const [target, setTarget] = useState<DispatchTarget | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    setConfig({
      layout: {
        alignY: 'start',
        width: 'wide',
        topGap: 'comfortable',
      },
      dialogClassName: 'overflow-hidden',
      panelClassName: 'w-full',
      bodyClassName: 'p-0',
      maxHeight: 'min(86dvh,900px)',
    })
  }, [setConfig])

  const preferredTarget = useMemo<DispatchTarget | null>(() => {
    if (activeSessionId && liveSessions.some((session) => session.id === activeSessionId)) {
      return `terminal:${activeSessionId}`
    }
    return liveSessions[0] ? `terminal:${liveSessions[0].id}` : null
  }, [activeSessionId, liveSessions])

  useEffect(() => {
    setTarget((prev) => {
      if (!prev) return preferredTarget
      const sessionId = parseTerminalTarget(prev)
      if (sessionId && liveSessions.some((session) => session.id === sessionId)) {
        return prev
      }
      return preferredTarget
    })
  }, [liveSessions, preferredTarget])

  const command = useMemo(() => {
    const normalized = draft.trim()
    if (normalized.length === 0) return '/opsx:propose'
    if (normalized.startsWith('/opsx:')) return normalized
    return `/opsx:propose ${normalized}`
  }, [draft])

  const handleSend = async () => {
    if (!target) {
      setSendError('No live terminal session is available.')
      return
    }
    setSendError(null)
    setIsSending(true)
    try {
      const sessionId = parseTerminalTarget(target)
      if (!sessionId) throw new Error('Invalid terminal target.')
      const wrote = terminalController.writeToSession(sessionId, `${command}\n`)
      if (!wrote) {
        throw new Error('Terminal session is not ready. Wait a moment and retry.')
      }
      requestClose()
    } catch (error) {
      setSendError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSending(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command)
    setCopySuccess(true)
    window.setTimeout(() => setCopySuccess(false), 900)
  }

  const handleSave = async () => {
    await terminalController.addInputHistory(command)
    setSaveSuccess(true)
    window.setTimeout(() => setSaveSuccess(false), 900)
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary h-4 w-4" />
          <h2 className="font-nav text-base tracking-[0.04em]">Quick /opsx:propose</h2>
        </div>
        <button
          type="button"
          onClick={() => navController.activatePop('/opsx-new')}
          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
          title="Open advanced /opsx:new form"
        >
          Advanced
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4">
        <p className="text-muted-foreground text-sm">
          Enter your idea, then send it as a slash command to the selected terminal.
        </p>
        <CodeEditor
          value={draft}
          onChange={setDraft}
          filename="opsx-propose.md"
          placeholder="e.g. add workspace kanban support for active changes"
          editorMinHeight="180px"
        />
        <div className="bg-muted/30 border-border rounded-md border px-3 py-2 text-xs">
          <span className="text-muted-foreground mr-1">Command:</span>
          <code>{command}</code>
        </div>
        <div className="flex items-center gap-2">
          <label className="w-24 text-xs font-medium">Target</label>
          <select
            value={target ?? ''}
            onChange={(event) => setTarget((event.target.value || null) as DispatchTarget | null)}
            className="border-border bg-background min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
          >
            {target === null && (
              <option value="" disabled>
                No live terminal session
              </option>
            )}
            {liveSessions.map((session) => (
              <option key={session.id} value={`terminal:${session.id}`}>
                {session.displayTitle}
              </option>
            ))}
          </select>
        </div>
        {sendError && <div className="text-destructive text-xs">{sendError}</div>}
      </div>

      <div className="border-border flex items-center justify-between gap-2 border-t px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className={`border-border inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
              copySuccess ? 'text-emerald-600' : 'hover:bg-muted'
            }`}
          >
            <Copy className="h-3.5 w-3.5" />
            {copySuccess ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className={`border-border inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
              saveSuccess ? 'text-emerald-600' : 'hover:bg-muted'
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {saveSuccess ? 'Saved' : 'Save'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={requestClose}
            className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isSending || target === null}
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
