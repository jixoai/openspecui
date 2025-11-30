import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { X, Terminal, CheckCircle, XCircle, Loader2, Package } from 'lucide-react'
import { trpcClient } from '@/lib/trpc'
import type { CliStreamEvent } from '@openspecui/core'

/** 成功后的操作按钮 */
export interface SuccessAction {
  label: string
  onClick: () => void
  primary?: boolean
}

/** 成功配置 */
export interface SuccessConfig {
  /** 成功标题 */
  title: string
  /** 成功描述 */
  description?: string
  /** 操作按钮 */
  actions: SuccessAction[]
}

export interface CliTerminalModalProps {
  /** Modal title */
  title: string
  /** Whether the modal is open */
  open: boolean
  /** Close handler */
  onClose: () => void
  /**
   * Success handler (called when CLI exits with code 0)
   * @deprecated Use successConfig instead for better UX
   */
  onSuccess?: () => void
  /** Success configuration - if provided, shows success view instead of auto-closing */
  successConfig?: SuccessConfig
  /** Subscription type */
  type: 'init' | 'archive' | 'install-global'
  /** Init options */
  initOptions?: {
    tools: string[] | 'all' | 'none'
  }
  /** Archive options */
  archiveOptions?: {
    changeId: string
    skipSpecs?: boolean
    noValidate?: boolean
  }
}

type Status = 'idle' | 'running' | 'success' | 'error'

/**
 * CLI Terminal Modal
 *
 * Displays real-time CLI output in a terminal-like modal.
 * Auto-scrolls to bottom as new output arrives.
 * Shows success view with actions when completed (if successConfig provided).
 */
export function CliTerminalModal({
  title,
  open,
  onClose,
  onSuccess,
  successConfig,
  type,
  initOptions,
  archiveOptions,
}: CliTerminalModalProps) {
  const [output, setOutput] = useState<string[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [exitCode, setExitCode] = useState<number | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  // Handle stream event
  const handleEvent = useCallback((event: CliStreamEvent) => {
    if (event.type === 'command' && event.data) {
      // 显示正在执行的命令（蓝色，带 $ 前缀）
      setOutput((prev) => [...prev, `\x1b[34m$ ${event.data}\x1b[0m`])
    } else if (event.type === 'stdout' && event.data) {
      setOutput((prev) => [...prev, event.data!])
    } else if (event.type === 'stderr' && event.data) {
      setOutput((prev) => [...prev, `\x1b[31m${event.data}\x1b[0m`]) // Red for stderr
    } else if (event.type === 'exit') {
      setExitCode(event.exitCode ?? null)
      setStatus(event.exitCode === 0 ? 'success' : 'error')
    }
  }, [])

  // 稳定化 options 引用，避免每次渲染都触发 useEffect
  // 使用 JSON.stringify 作为依赖 key，只有实际值变化时才会重新创建 subscription
  const initOptionsKey = useMemo(
    () => (initOptions ? JSON.stringify(initOptions) : null),
    [initOptions?.tools]
  )
  const archiveOptionsKey = useMemo(
    () => (archiveOptions ? JSON.stringify(archiveOptions) : null),
    [archiveOptions?.changeId, archiveOptions?.skipSpecs, archiveOptions?.noValidate]
  )

  // Start subscription when modal opens
  useEffect(() => {
    if (!open) return

    // Reset state
    setOutput([])
    setStatus('running')
    setExitCode(null)

    // Start subscription based on type
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
    // 使用稳定化的 key 作为依赖，而不是对象引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, initOptionsKey, archiveOptionsKey, handleEvent])

  // Call legacy onSuccess when status changes to success (only if no successConfig)
  useEffect(() => {
    if (status === 'success' && !successConfig) {
      onSuccess?.()
    }
  }, [status, onSuccess, successConfig])

  // Handle close
  const handleClose = () => {
    subscriptionRef.current?.unsubscribe()
    subscriptionRef.current = null
    onClose()
  }

  if (!open) return null

  const isSuccess = status === 'success' && successConfig

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-background border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isSuccess ? 'border-green-500/30 bg-green-500/5' : 'border-border'}`}>
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Terminal className="w-5 h-5 text-muted-foreground" />
            )}
            <h2 className="font-semibold">
              {isSuccess ? successConfig.title : title}
            </h2>
            {status === 'running' && (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
            {status === 'success' && !successConfig && (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            {status === 'error' && (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Terminal output */}
        <div
          ref={outputRef}
          className={`overflow-auto bg-zinc-900 text-zinc-100 font-mono text-sm p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700 ${
            isSuccess ? 'h-48' : 'h-80'
          }`}
        >
          {output.length === 0 && status === 'running' && (
            <span className="text-zinc-500">Starting...</span>
          )}
          {output.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {renderAnsiLine(line)}
            </div>
          ))}
          {status === 'success' && (
            <div className="mt-2 text-green-400">
              Process exited with code {exitCode}
            </div>
          )}
          {status === 'error' && exitCode !== null && (
            <div className="mt-2 text-red-400">
              Process exited with code {exitCode}
            </div>
          )}
        </div>

        {/* Success info (only when successConfig provided) */}
        {isSuccess && successConfig.description && (
          <div className="px-4 py-3 border-t border-border bg-muted/30">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                {successConfig.description}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          {isSuccess ? (
            // Success actions
            successConfig.actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={
                  action.primary
                    ? 'px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-md'
                    : 'px-4 py-2 bg-muted hover:bg-muted/80 rounded-md'
                }
              >
                {action.label}
              </button>
            ))
          ) : (
            // Default close button
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-md"
            >
              {status === 'running' ? 'Cancel' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Simple ANSI color code renderer
 * Supports basic colors: red (\x1b[31m), green (\x1b[32m), reset (\x1b[0m)
 */
function renderAnsiLine(line: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let currentIndex = 0
  let currentColor: string | null = null

  const regex = /\x1b\[(\d+)m/g
  let match

  while ((match = regex.exec(line)) !== null) {
    // Add text before this escape sequence
    if (match.index > currentIndex) {
      const text = line.slice(currentIndex, match.index)
      parts.push(
        currentColor ? (
          <span key={currentIndex} className={currentColor}>
            {text}
          </span>
        ) : (
          text
        )
      )
    }

    // Update color based on escape code
    const code = parseInt(match[1], 10)
    if (code === 0) {
      currentColor = null
    } else if (code === 31) {
      currentColor = 'text-red-400'
    } else if (code === 32) {
      currentColor = 'text-green-400'
    } else if (code === 33) {
      currentColor = 'text-yellow-400'
    } else if (code === 34) {
      currentColor = 'text-blue-400'
    }

    currentIndex = match.index + match[0].length
  }

  // Add remaining text
  if (currentIndex < line.length) {
    const text = line.slice(currentIndex)
    parts.push(
      currentColor ? (
        <span key={currentIndex} className={currentColor}>
          {text}
        </span>
      ) : (
        text
      )
    )
  }

  return parts.length > 0 ? parts : line
}
