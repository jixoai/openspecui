/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Own Launch Project initialization observation and one explicit-confirmation CLI stream.
 * 2. Keep automatic dismissal scoped to the mounted page runtime while exposing a reusable Config action.
 * 3. Preserve exact command, output, cancellation, failure, and settled-success evidence in one Dialog.
 *
 * Original request (2026-08-01): globally offer Initialize Project when the launch directory has no `openspec/`.
 * Original request (2026-08-01): run `openspec init --tools=none`, then expose `[Ok] [Start Guide]`.
 * Review correction (2026-08-02): cancellation remains pending until the Server confirms settlement, including cross-transport startup races.
 */
import { Button } from '@/components/button'
import { Dialog } from '@/components/dialog'
import { trpcClient } from '@/lib/trpc'
import { useRootActionState } from '@/lib/use-root-action-state'
import { CircleAlert, FolderCog, Loader2, Square } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ProjectInitializationProjection = Awaited<ReturnType<typeof trpcClient.init.get.query>>
type Phase = 'detected' | 'running' | 'cancelling' | 'cancelled' | 'failure' | 'success'

interface ProjectInitializationContextValue {
  projection: ProjectInitializationProjection | null
  open(): void
}

const ProjectInitializationContext = createContext<ProjectInitializationContextValue | null>(null)

function displayCommand(projectPath: string): string {
  return JSON.stringify(['openspec', 'init', projectPath, '--tools=none'])
}

function createInitializationRequestId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `init-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Access the root-layout-owned Init action without duplicating execution ownership. */
export function useProjectInitialization() {
  return useContext(ProjectInitializationContext)
}

export function ProjectInitializationProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}) {
  const [projection, setProjection] = useState<ProjectInitializationProjection | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [requested, setRequested] = useState(false)
  const [phase, setPhase] = useState<Phase>('detected')
  const [command, setCommand] = useState('')
  const [stdout, setStdout] = useState('')
  const [stderr, setStderr] = useState('')
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [terminalSucceeded, setTerminalSucceeded] = useState(false)
  const [cancelError, setCancelError] = useState<Error | null>(null)
  const streamRef = useRef<{ unsubscribe(): void } | null>(null)
  const requestIdRef = useRef<string | null>(null)
  const cancellationRequestedRef = useRef(false)
  const rootAction = useRootActionState()

  useEffect(() => {
    if (!enabled) return
    let active = true
    let pushed = false
    const subscription = trpcClient.init.subscribe.subscribe(undefined, {
      onData(next) {
        pushed = true
        if (active) {
          setProjection(next)
          setLoadError(null)
        }
      },
      onError(cause) {
        if (active) setLoadError(cause instanceof Error ? cause : new Error(String(cause)))
      },
    })
    void trpcClient.init.get
      .query()
      .then((next) => {
        if (active && !pushed) setProjection(next)
      })
      .catch((cause: unknown) => {
        if (active && !pushed)
          setLoadError(cause instanceof Error ? cause : new Error(String(cause)))
      })
    return () => {
      active = false
      subscription.unsubscribe()
      streamRef.current?.unsubscribe()
    }
  }, [enabled])

  useEffect(() => {
    if (terminalSucceeded && projection?.initialized) setPhase('success')
  }, [projection?.initialized, terminalSucceeded])

  const start = useCallback(() => {
    if (!projection || phase === 'running' || phase === 'cancelling') return
    streamRef.current?.unsubscribe()
    const requestId = createInitializationRequestId()
    requestIdRef.current = requestId
    cancellationRequestedRef.current = false
    setPhase('running')
    setCommand(displayCommand(projection.launchProjectPath))
    setStdout('')
    setStderr('')
    setExitCode(null)
    setTerminalSucceeded(false)
    setCancelError(null)
    streamRef.current = trpcClient.init.initStream.subscribe(
      { requestId },
      {
        onData(event) {
          if (event.type === 'command' && event.data) setCommand(event.data)
          if (event.type === 'stdout' && event.data) setStdout((value) => value + event.data)
          if (event.type === 'stderr' && event.data) setStderr((value) => value + event.data)
          if (event.type === 'exit') {
            setExitCode(event.exitCode ?? null)
            if (cancellationRequestedRef.current) return
            if (event.exitCode === 0) setTerminalSucceeded(true)
            else setPhase('failure')
          }
        },
        onError(cause) {
          const error = cause instanceof Error ? cause : new Error(String(cause))
          if (cancellationRequestedRef.current) {
            setCancelError(error)
            return
          }
          setStderr((value) => value + error.message)
          requestIdRef.current = null
          setPhase('failure')
        },
      }
    )
  }, [phase, projection])

  const cancel = useCallback(() => {
    const requestId = requestIdRef.current
    if (!requestId || (phase !== 'running' && phase !== 'cancelling')) return
    cancellationRequestedRef.current = true
    setCancelError(null)
    setPhase('cancelling')
    void trpcClient.init.cancel.mutate({ requestId }).then(
      (settlement) => {
        requestIdRef.current = null
        setCancelError(null)
        setExitCode(settlement.exitCode)
        if (settlement.reason === 'cancelled') {
          setPhase('cancelled')
          return
        }
        if (settlement.exitCode === 0) {
          setTerminalSucceeded(true)
          setPhase('running')
          return
        }
        setPhase('failure')
      },
      (cause: unknown) => {
        setCancelError(cause instanceof Error ? cause : new Error(String(cause)))
      }
    )
  }, [phase])

  const close = useCallback(() => {
    if (phase === 'running' || phase === 'cancelling') return
    if (phase === 'success') {
      setTerminalSucceeded(false)
      setPhase('detected')
    }
    setDismissed(true)
    setRequested(false)
  }, [phase])

  const open = useCallback(() => {
    setRequested(true)
    if (phase === 'success' && !projection?.initialized) setPhase('detected')
  }, [phase, projection?.initialized])

  const value = useMemo(() => ({ projection, open }), [open, projection])
  const dialogOpen =
    enabled &&
    projection !== null &&
    ((!projection.initialized &&
      (requested || !dismissed || phase === 'running' || phase === 'cancelling')) ||
      terminalSucceeded ||
      phase === 'success')
  const proposedCommand = projection ? displayCommand(projection.launchProjectPath) : ''
  const effectiveRoot = rootAction.context?.planningRoot ?? null

  return (
    <ProjectInitializationContext.Provider value={value}>
      {children}
      <Dialog
        open={dialogOpen}
        title={
          <span className="flex items-center gap-2">
            <FolderCog className="h-5 w-5" aria-hidden /> Initialize Project
          </span>
        }
        onClose={close}
        onDismissRequest={phase === 'running' || phase === 'cancelling' ? null : close}
        borderVariant={phase === 'failure' ? 'error' : phase === 'success' ? 'success' : 'default'}
        footer={
          phase === 'success' ? (
            <>
              <Button variant="secondary" onClick={close}>
                Ok
              </Button>
              <Button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('openspecui:start-config-guide'))
                  close()
                }}
              >
                Start Guide
              </Button>
            </>
          ) : phase === 'running' ? (
            <Button variant="secondary" onClick={cancel}>
              <Square className="h-3.5 w-3.5" aria-hidden /> Cancel
            </Button>
          ) : phase === 'cancelling' ? (
            <Button variant="secondary" disabled={!cancelError} onClick={cancel}>
              {cancelError ? null : <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {cancelError ? 'Retry Cancel' : 'Cancelling'}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                Close
              </Button>
              <Button onClick={start}>
                {phase === 'failure' || phase === 'cancelled' ? 'Retry' : 'Initialize'}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            This Launch Project has no local <code>openspec/</code> directory. Initialization is
            independent from any selected external Store Root.
          </p>
          <div className="border-border bg-muted/30 rounded-md border p-3 text-xs">
            <div className="text-muted-foreground mb-1 font-medium">Command argv</div>
            <div className="break-all font-mono">{command || proposedCommand}</div>
            <div className="text-muted-foreground mt-2 break-all">
              Launch Project: {projection?.launchProjectPath}
            </div>
            <div className="text-muted-foreground mt-1 break-all">
              Effective Root:{' '}
              {effectiveRoot?.path ??
                (rootAction.status === 'blocked' ? 'Unavailable' : 'Resolving')}
              {effectiveRoot?.source
                ? ` (${effectiveRoot.source}${rootAction.context?.storeId ? `, Store ${rootAction.context.storeId}` : ''})`
                : ''}
            </div>
          </div>
          {loadError ? (
            <div role="alert" className="text-destructive text-sm">
              {loadError.message}
            </div>
          ) : null}
          {phase === 'running' ? (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Running and waiting for local
              settlement…
            </div>
          ) : null}
          {phase === 'cancelling' ? (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cancelling and waiting for
              process settlement…
            </div>
          ) : null}
          {cancelError ? (
            <div role="alert" className="text-destructive text-sm">
              Cancellation transport failed; process settlement is still unknown.{' '}
              {cancelError.message}
            </div>
          ) : null}
          {phase === 'cancelled' ? (
            <div role="status" className="text-sm">
              Initialization was cancelled.
            </div>
          ) : null}
          {phase === 'failure' ? (
            <div role="alert" className="text-destructive flex items-start gap-2 text-sm">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Initialization failed
              with exit code {exitCode ?? 'unknown'}.
            </div>
          ) : null}
          {phase === 'success' ? (
            <div role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
              Project initialization settled successfully.
            </div>
          ) : null}
          {stdout || stderr ? (
            <pre className="border-border bg-background max-h-52 overflow-y-auto whitespace-pre-wrap break-words rounded-md border p-3 text-xs">
              {stdout}
              {stderr}
            </pre>
          ) : null}
        </div>
      </Dialog>
    </ProjectInitializationContext.Provider>
  )
}
