import { CodeEditor } from '@/components/code-editor'
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import {
  buildOpsxComposeDraft,
  buildOpsxComposeFallbackPrompt,
  parseOpsxComposeLocationSearch,
  resolveOpsxPromptSource,
} from '@/lib/opsx-compose'
import { isStaticMode } from '@/lib/static-mode'
import { useTerminalContext } from '@/lib/terminal-context'
import { terminalController } from '@/lib/terminal-controller'
import { trpcClient } from '@/lib/trpc'
import { useLocation } from '@tanstack/react-router'
import { AlertCircle, Check, Copy, Loader2, Save, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

interface CliCaptureResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

type DispatchTarget = `terminal:${string}`

const TERMINAL_TARGET_PREFIX = 'terminal:'

const ACTION_LABELS = {
  continue: 'Continue',
  ff: 'Fast-forward',
  apply: 'Apply',
  verify: 'Verify',
  archive: 'Archive',
} as const

const SHELL_PROCESS_NAMES = new Set([
  'bash',
  'zsh',
  'fish',
  'sh',
  'dash',
  'ksh',
  'cmd.exe',
  'cmd',
  'powershell.exe',
  'powershell',
  'pwsh.exe',
  'pwsh',
  'nu',
  'nushell',
])

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function stripAnsi(input: string): string {
  // CSI + OSC + 2-byte escapes
  // eslint-disable-next-line no-control-regex -- ANSI CSI sequence uses ESC control code.
  const ansiCsiRegex = /\x1B\[[0-?]*[ -/]*[@-~]/g
  // eslint-disable-next-line no-control-regex -- ANSI OSC sequence uses ESC/BEL control codes.
  const ansiOscRegex = /\x1B\][^\u0007]*(\u0007|\x1B\\)/g
  // eslint-disable-next-line no-control-regex -- ANSI 2-byte escape sequence uses ESC control code.
  const ansiTwoByteRegex = /\x1B[@-Z\\-_]/g
  return input.replace(ansiCsiRegex, '').replace(ansiOscRegex, '').replace(ansiTwoByteRegex, '')
}

function stripUnsafeControlChars(input: string): string {
  // Keep tab/newline/carriage return, remove remaining C0 + DEL.
  let output = ''
  for (const char of input) {
    const code = char.charCodeAt(0)
    const isAllowedWhitespace = code === 0x09 || code === 0x0a || code === 0x0d
    const isControl = (code >= 0x00 && code <= 0x1f) || code === 0x7f
    if (!isControl || isAllowedWhitespace) {
      output += char
    }
  }
  return output
}

function sanitizeTerminalPayload(input: string): { text: string; modified: boolean } {
  const noAnsi = stripAnsi(input)
  const noUnsafeControls = stripUnsafeControlChars(noAnsi)
  return {
    text: noUnsafeControls,
    modified: noUnsafeControls !== input,
  }
}

function captureCliOutput(
  command: string,
  args: string[],
  signal?: AbortSignal
): Promise<CliCaptureResult> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const cleanupAbortListener = () => {
      if (!signal) return
      signal.removeEventListener('abort', handleAbort)
    }

    const settleResolve = (result: CliCaptureResult) => {
      if (settled) return
      settled = true
      cleanupAbortListener()
      resolve(result)
    }

    const settleReject = (error: unknown) => {
      if (settled) return
      settled = true
      cleanupAbortListener()
      reject(error)
    }

    const handleAbort = () => {
      subscription.unsubscribe()
      settleReject(new Error('Prompt generation canceled.'))
    }

    const subscription = trpcClient.cli.runCommandStream.subscribe(
      { command, args },
      {
        onData: (event) => {
          if (event.type === 'stdout' && event.data) {
            stdout += event.data
            return
          }
          if (event.type === 'stderr' && event.data) {
            stderr += event.data
            return
          }
          if (event.type === 'exit') {
            subscription.unsubscribe()
            settleResolve({
              stdout,
              stderr,
              exitCode: event.exitCode ?? null,
            })
          }
        },
        onError: (error) => {
          subscription.unsubscribe()
          settleReject(error)
        },
      }
    )

    if (signal) {
      if (signal.aborted) {
        handleAbort()
      } else {
        signal.addEventListener('abort', handleAbort, { once: true })
      }
    }
  })
}

function parseTerminalTarget(target: DispatchTarget): string | null {
  if (!target.startsWith(TERMINAL_TARGET_PREFIX)) return null
  return target.slice(TERMINAL_TARGET_PREFIX.length)
}

function normalizeForegroundProcessTitle(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim().toLowerCase()
  if (!value) return null
  const token = value.split(/[\\/]/).pop() ?? value
  return token
}

function isLikelyShellForegroundProcess(raw: string | null | undefined): boolean {
  const normalized = normalizeForegroundProcessTitle(raw)
  if (!normalized) return false
  return SHELL_PROCESS_NAMES.has(normalized)
}

function buildTerminalSendPayload(text: string, shellMode: boolean): string {
  const normalized = text.replace(/\r\n?/g, '\n')
  if (!shellMode) {
    return `${normalized}\n`
  }
  // Emulate terminal paste behavior for shell frontends.
  return `\x1b[200~${normalized}\x1b[201~\n`
}

export function OpsxComposeRoute() {
  const location = useLocation()
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const { sessions, activeSessionId } = useTerminalContext()

  const composeInput = useMemo(
    () => parseOpsxComposeLocationSearch(location.search),
    [location.search]
  )

  const promptSource = useMemo(
    () => (composeInput ? resolveOpsxPromptSource(composeInput) : null),
    [composeInput]
  )

  const liveSessions = useMemo(() => sessions.filter((session) => !session.isExited), [sessions])

  const preferredTarget = useMemo<DispatchTarget | null>(() => {
    if (activeSessionId && liveSessions.some((session) => session.id === activeSessionId)) {
      return `terminal:${activeSessionId}`
    }
    const firstLive = liveSessions[0]
    if (firstLive) {
      return `terminal:${firstLive.id}`
    }
    return null
  }, [activeSessionId, liveSessions])

  const [target, setTarget] = useState<DispatchTarget | null>(null)
  const [draft, setDraft] = useState('')
  const [isLoadingDraft, setIsLoadingDraft] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isSavingHistory, setIsSavingHistory] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const copySuccessTimerRef = useRef<number | null>(null)
  const saveSuccessTimerRef = useRef<number | null>(null)

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

  useEffect(() => {
    setConfig({
      layout: {
        alignY: 'start',
        width: 'wide',
        topGap: 'comfortable',
      },
      dialogClassName: 'overflow-hidden',
      panelClassName: 'w-full',
      bodyClassName: 'p-0 !overflow-hidden',
      maxHeight: 'min(86dvh,920px)',
    })
  }, [setConfig])

  useEffect(() => {
    return () => {
      if (copySuccessTimerRef.current != null) {
        window.clearTimeout(copySuccessTimerRef.current)
      }
      if (saveSuccessTimerRef.current != null) {
        window.clearTimeout(saveSuccessTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let canceled = false
    const abortController = new AbortController()

    const loadPrompt = async () => {
      if (!composeInput) {
        setDraft('')
        setDraftError('Invalid compose parameters.')
        setIsLoadingDraft(false)
        return
      }

      setSendError(null)
      setIsLoadingDraft(true)
      setDraftError(null)

      if (isStaticMode()) {
        setDraft(buildOpsxComposeFallbackPrompt(composeInput))
        setIsLoadingDraft(false)
        return
      }

      if (!promptSource) {
        setDraft(buildOpsxComposeFallbackPrompt(composeInput))
        setDraftError('Prompt source is not available for this action.')
        setIsLoadingDraft(false)
        return
      }

      try {
        const result = await captureCliOutput(
          promptSource.command,
          promptSource.args,
          abortController.signal
        )
        if (canceled) return

        const sanitized = sanitizeTerminalPayload(result.stdout)
        setDraft(buildOpsxComposeDraft(composeInput, sanitized.text))

        if (result.exitCode !== 0) {
          const errorText =
            result.stderr.trim() || `Command exited with code ${result.exitCode ?? 'unknown'}.`
          setDraftError(errorText)
        } else if (sanitized.modified) {
          setDraftError('ANSI/control characters were stripped from generated prompt for safety.')
        }
      } catch (error) {
        if (canceled) return
        setDraft(buildOpsxComposeFallbackPrompt(composeInput))
        setDraftError(toErrorMessage(error))
      } finally {
        if (!canceled) {
          setIsLoadingDraft(false)
        }
      }
    }

    void loadPrompt()

    return () => {
      canceled = true
      abortController.abort()
    }
  }, [composeInput, promptSource])

  const actionLabel = composeInput ? ACTION_LABELS[composeInput.action] : 'Compose'

  const handleSend = async () => {
    const normalized = draft.trim()
    if (normalized.length === 0) {
      setSendError('Prompt is empty.')
      return
    }
    if (!target) {
      setSendError('No live terminal session is available.')
      return
    }

    setIsSending(true)
    setSendError(null)

    try {
      const sessionId = parseTerminalTarget(target)
      if (!sessionId) {
        throw new Error('Invalid terminal target.')
      }
      const isLive = liveSessions.some((session) => session.id === sessionId)
      if (!isLive) {
        throw new Error('Selected terminal session is no longer available.')
      }
      const selectedSession = liveSessions.find((session) => session.id === sessionId) ?? null
      const sanitized = sanitizeTerminalPayload(normalized)
      if (sanitized.text.trim().length === 0) {
        throw new Error('Prompt contains only unsupported control characters after sanitization.')
      }
      const payload = buildTerminalSendPayload(
        sanitized.text,
        isLikelyShellForegroundProcess(selectedSession?.processTitle)
      )
      const wrote = terminalController.writeToSession(sessionId, payload)
      if (!wrote) {
        throw new Error('Terminal session is not ready. Wait a moment and retry.')
      }

      requestClose()
    } catch (error) {
      setSendError(toErrorMessage(error))
    } finally {
      setIsSending(false)
    }
  }

  const handleCopy = async () => {
    const normalized = draft.trim()
    if (normalized.length === 0) {
      setSendError('Prompt is empty.')
      return
    }

    setIsCopying(true)
    setSendError(null)
    setCopySuccess(false)
    try {
      await navigator.clipboard.writeText(normalized)
      setCopySuccess(true)
      if (copySuccessTimerRef.current != null) {
        window.clearTimeout(copySuccessTimerRef.current)
      }
      copySuccessTimerRef.current = window.setTimeout(() => {
        setCopySuccess(false)
      }, 1200)
    } catch (error) {
      setSendError(toErrorMessage(error))
    } finally {
      setIsCopying(false)
    }
  }

  const handleSaveToHistory = async () => {
    const normalized = draft.trim()
    if (normalized.length === 0) {
      setSendError('Prompt is empty.')
      return
    }

    setIsSavingHistory(true)
    setSendError(null)
    setSaveSuccess(false)
    try {
      await terminalController.addInputHistory(normalized)
      setSaveSuccess(true)
      if (saveSuccessTimerRef.current != null) {
        window.clearTimeout(saveSuccessTimerRef.current)
      }
      saveSuccessTimerRef.current = window.setTimeout(() => {
        setSaveSuccess(false)
      }, 1200)
    } catch (error) {
      setSendError(toErrorMessage(error))
    } finally {
      setIsSavingHistory(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-nav truncate text-base tracking-[0.04em]">{actionLabel} Prompt</h2>
          <p className="text-muted-foreground truncate text-xs">
            {composeInput ? `change: ${composeInput.changeId}` : 'missing change context'}
          </p>
        </div>
      </div>

      <div className="flex max-h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        {promptSource && (
          <div className="bg-muted/40 border-border rounded-md border p-2 text-xs">
            <span className="text-muted-foreground">Prompt source:</span>{' '}
            <code className="break-all">
              {promptSource.command} {promptSource.args.join(' ')}
            </code>
          </div>
        )}

        {isLoadingDraft && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating prompt...
          </div>
        )}

        {draftError && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              Prompt source warning
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words">{draftError}</p>
          </div>
        )}

        <label className="flex max-h-full min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
          <span className="text-sm font-medium">Prompt</span>
          <CodeEditor
            value={draft}
            onChange={setDraft}
            language="markdown"
            lineNumbers={false}
            lineWrapping
            className="scrollbar-thin scrollbar-track-transparent min-h-0 flex-1 overflow-auto border"
            editorMinHeight="0px"
            placeholder="Compose prompt..."
          />
        </label>
      </div>
      <div className="border-border mt-1 flex flex-col gap-2 border-t p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="order-2 flex items-center gap-2 sm:order-1">
          <button
            type="button"
            disabled={isCopying}
            onClick={() => {
              void handleCopy()
            }}
            className={[
              'inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50',
              copySuccess
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700'
                : 'border-border hover:bg-muted',
            ].join(' ')}
          >
            {isCopying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : copySuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copySuccess ? 'Copied' : 'Copy'}
          </button>

          <button
            type="button"
            disabled={isSavingHistory}
            onClick={() => {
              void handleSaveToHistory()
            }}
            className={[
              'inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50',
              saveSuccess
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700'
                : 'border-border hover:bg-muted',
            ].join(' ')}
          >
            {isSavingHistory ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveSuccess ? 'Saved' : 'Save'}
          </button>
        </div>

        <div className="order-1 flex min-w-0 items-end gap-2 sm:order-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium">Terminal</span>
            <select
              value={target ?? ''}
              onChange={(event) => setTarget((event.target.value || null) as DispatchTarget | null)}
              className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            >
              {liveSessions.length === 0 && <option value="">No live terminal</option>}
              {liveSessions.map((session) => (
                <option key={session.id} value={`terminal:${session.id}`}>
                  Terminal: {session.displayTitle}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={isSending || !target}
            onClick={() => {
              void handleSend()
            }}
            className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center gap-2 self-end rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>
        </div>
      </div>

      {sendError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {sendError}
        </div>
      )}
    </div>
  )
}
