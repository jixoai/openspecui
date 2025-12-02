import { trpcClient } from '@/lib/trpc'
import { DialogShell } from './dialog-shell'
import { CliTerminal } from './cli-terminal'
import type { CliStreamEvent } from '@openspecui/core'
import { AlertTriangle, CheckCircle, Loader2, Package, Terminal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** 成功后的操作按钮 */
export interface SuccessAction {
  label: string
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}

/** 成功配置 */
export interface SuccessConfig {
  title: string
  description?: string
  actions: SuccessAction[]
}

export interface CliTerminalModalProps {
  title: string
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  successConfig?: SuccessConfig
  type: 'init' | 'archive' | 'install-global' | 'validate'
  initOptions?: { tools: string[] | 'all' | 'none' }
  archiveOptions?: { changeId: string; skipSpecs?: boolean; noValidate?: boolean }
  validateOptions?: { changeId: string }
  onArchiveDetected?: (archiveId: string) => void
}

type Status = 'idle' | 'running' | 'success' | 'error'
type Phase = 'idle' | 'validating' | 'archiving' | 'command'

export function CliTerminalModal({
  title,
  open,
  onClose,
  onSuccess,
  successConfig,
  type,
  initOptions,
  archiveOptions,
  validateOptions,
  onArchiveDetected,
}: CliTerminalModalProps) {
  const [output, setOutput] = useState<string[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const outputRef = useRef<HTMLDivElement>(null)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  const handleEvent = useCallback(
    (event: CliStreamEvent) => {
      if (event.type === 'command' && event.data) {
        setOutput((prev) => [...prev, `\x1b[34m$ ${event.data}\x1b[0m`])
      } else if (event.type === 'stdout' && event.data) {
        setOutput((prev) => [...prev, event.data!])
        const match = /Change ['"](.+?)['"] archived as ['"](.+?)['"]/.exec(event.data)
        if (match?.[2]) {
          onArchiveDetected?.(match[2])
        }
      } else if (event.type === 'stderr' && event.data) {
        setOutput((prev) => [...prev, `\x1b[31m${event.data}\x1b[0m`])
      } else if (event.type === 'exit') {
        setExitCode(event.exitCode ?? null)

        if (phase === 'validating') {
          if (event.exitCode === 0) return
          setStatus('error')
          return
        }

        setStatus(event.exitCode === 0 ? 'success' : 'error')
      }
    },
    [onArchiveDetected, phase]
  )

  const initOptionsKey = useMemo(
    () => (initOptions ? JSON.stringify(initOptions) : null),
    [initOptions?.tools]
  )
  const archiveOptionsKey = useMemo(
    () => (archiveOptions ? JSON.stringify(archiveOptions) : null),
    [archiveOptions?.changeId, archiveOptions?.skipSpecs, archiveOptions?.noValidate]
  )
  const validateOptionsKey = useMemo(
    () => (validateOptions ? JSON.stringify(validateOptions) : null),
    [validateOptions?.changeId]
  )

  // Start subscription
  useEffect(() => {
    if (!open) return

    setOutput([])
    setStatus('running')
    setExitCode(null)
    setPhase('command')

    if (type === 'init' && initOptions) {
      subscriptionRef.current = trpcClient.cli.initStream.subscribe(
        { tools: initOptions.tools },
        {
          onData: handleEvent,
          onError: (err) => {
            setOutput((prev) => [...prev, `\x1b[31mError: ${err.message}\x1b[0m`])
            setStatus('error')
          },
        }
      )
    } else if (type === 'archive' && archiveOptions) {
      const startArchive = () => {
        setPhase('archiving')
        subscriptionRef.current = trpcClient.cli.archiveStream.subscribe(
          {
            changeId: archiveOptions.changeId,
            skipSpecs: archiveOptions.skipSpecs,
            noValidate: archiveOptions.noValidate,
          },
          {
            onData: handleEvent,
            onError: (err) => {
              setOutput((prev) => [...prev, `\x1b[31mError: ${err.message}\x1b[0m`])
              setStatus('error')
            },
          }
        )
      }

      if (archiveOptions.noValidate) {
        startArchive()
      } else {
        setPhase('validating')
        subscriptionRef.current = trpcClient.cli.validateStream.subscribe(
          { id: archiveOptions.changeId },
          {
            onData: (event) => {
              if (event.type === 'exit' && event.exitCode === 0) {
                subscriptionRef.current?.unsubscribe()
                startArchive()
              } else {
                handleEvent(event)
              }
            },
            onError: (err) => {
              setOutput((prev) => [...prev, `\x1b[31mError: ${err.message}\x1b[0m`])
              setStatus('error')
            },
          }
        )
      }
    } else if (type === 'validate' && validateOptions) {
      setPhase('validating')
      subscriptionRef.current = trpcClient.cli.validateStream.subscribe(
        { id: validateOptions.changeId },
        {
          onData: handleEvent,
          onError: (err) => {
            setOutput((prev) => [...prev, `\x1b[31mError: ${err.message}\x1b[0m`])
            setStatus('error')
          },
        }
      )
    } else if (type === 'install-global') {
      subscriptionRef.current = trpcClient.cli.installGlobalCliStream.subscribe(undefined, {
        onData: handleEvent,
        onError: (err) => {
          setOutput((prev) => [...prev, `\x1b[31mError: ${err.message}\x1b[0m`])
          setStatus('error')
        },
      })
    }

    return () => {
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, initOptionsKey, archiveOptionsKey, validateOptionsKey, handleEvent])

  // legacy onSuccess
  useEffect(() => {
    if (status === 'success' && !successConfig) {
      onSuccess?.()
    }
  }, [status, onSuccess, successConfig])

  const handleClose = () => {
    subscriptionRef.current?.unsubscribe()
    subscriptionRef.current = null
    onClose()
  }

  if (!open) return null

  const isSuccess = status === 'success' && !!successConfig
  const borderVariant = status === 'error' ? 'error' : isSuccess ? 'success' : 'default'

  const titleNode = (
    <>
      {isSuccess ? (
        <CheckCircle className="h-5 w-5 text-green-500" />
      ) : (
        <Terminal className="text-muted-foreground h-5 w-5" />
      )}
      <h2 className="font-semibold">{isSuccess ? successConfig.title : title}</h2>
      {status === 'running' && <Loader2 className="text-primary h-4 w-4 animate-spin" />}
      {status === 'success' && !successConfig && <CheckCircle className="h-4 w-4 text-green-500" />}
      {status === 'error' && <AlertTriangle className="h-4 w-4 text-red-500" />}
    </>
  )

  const footer = isSuccess ? (
    successConfig.actions.map((action, i) => (
      <button
        key={i}
        onClick={action.onClick}
        disabled={action.disabled}
        className={
          action.primary
            ? `bg-primary text-primary-foreground rounded-md px-4 py-2 ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`
            : `bg-muted rounded-md px-4 py-2 ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/80'}`
        }
      >
        {action.label}
      </button>
    ))
  ) : (
    <button onClick={handleClose} className="bg-muted hover:bg-muted/80 rounded-md px-4 py-2">
      {status === 'running' ? 'Cancel' : 'Close'}
    </button>
  )

  return (
    <DialogShell
      open={open}
      onClose={handleClose}
      title={titleNode}
      footer={footer}
      borderVariant={borderVariant}
    >
      <CliTerminal
        lines={output}
        status={(status === 'success' && !successConfig ? 'success' : status) as 'running' | 'success' | 'error'}
        exitCode={exitCode}
        scrollRef={outputRef as React.RefObject<HTMLDivElement>}
        maxHeight={isSuccess ? '40vh' : '60vh'}
      />

      {isSuccess && successConfig.description && (
        <div className="border-border bg-muted/30 mt-3 rounded border px-4 py-3">
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <p className="text-muted-foreground text-sm">{successConfig.description}</p>
          </div>
        </div>
      )}
    </DialogShell>
  )
}
