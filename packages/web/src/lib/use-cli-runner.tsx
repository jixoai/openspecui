/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Run ordered CLI streams with stable process and loading state.
 * 2. Preserve stdout, stderr, exit, cancellation, and multiline diagnostics verbatim.
 * 3. Route root-dependent operations through dedicated Server-owned transports.
 * 4. Derive execution and displayed command evidence from one exhaustive typed transport.
 *
 * Original request (2026-07-15): "场景丢失保护的诊断必须原样显示，不能合成重试。"
 * Original request (2026-07-17): "Remove the Web generic fallback when no production caller requires it."
 */
import '@/styles/terminal-effects.css'
import type { CliStreamEvent } from '@openspecui/core'
import { Check, Loader2, Sparkles, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { match } from 'ts-pattern'
import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'

/** Lifecycle state for one queued command. */
export type CommandRunStatus = 'idle' | 'loading' | 'running' | 'success' | 'error'
/** Aggregate lifecycle state for the current command queue. */
export type OverallStatus = 'idle' | 'running' | 'success' | 'error'
/** Terminal-renderable text or React content emitted by the runner. */
export type CliRunnerLine =
  | { id: string; kind: 'ascii'; text: string; tone?: 'success' | 'error' | 'info' }
  | { id: string; kind: 'html'; node: ReactNode }

/** Stable queued-command projection exposed to CLI surfaces. */
export interface CommandDescriptor {
  id: string
  command: string
  args: string[]
  effectiveCommand: string | null
  status: CommandRunStatus
  exitCode: number | null
  stream: CliStreamTransport
}

/** Process event names exposed by the runner facade. */
export type ProcessEvent = 'data' | 'error' | 'close' | 'exit'

/** Observable command-process facade returned for one running queue item. */
export interface CommandProcess {
  id: string
  command: string
  args: string[]
  effectiveCommand: string | null
  status: CommandRunStatus
  exitCode: number | null
  done: Promise<number | null>
  on: (event: ProcessEvent, handler: (payload: string | number | null) => void) => () => void
  cancel: () => void
}

interface ArchiveStrictStreamTransport {
  type: 'archive-strict'
  input: {
    changeId: string
    skipSpecs?: boolean
    noValidate?: boolean
  }
}

interface InitStreamTransport {
  type: 'init'
  input?: {
    tools?: string[] | 'all' | 'none'
    profile?: 'core' | 'custom'
    force?: boolean
  }
}

interface PlanningRootUpdateStreamTransport {
  type: 'planning-root-update'
  input?: { force?: boolean }
}

interface ValidateStreamTransport {
  type: 'validate'
  input: {
    type?: 'spec' | 'change'
    id?: string
    strict?: boolean
  }
}

interface InstallGlobalCliStreamTransport {
  type: 'install-global-cli'
}

/** Sole semantic descriptor for one browser-requested CLI stream. */
export type CliStreamTransport =
  | ArchiveStrictStreamTransport
  | InitStreamTransport
  | PlanningRootUpdateStreamTransport
  | ValidateStreamTransport
  | InstallGlobalCliStreamTransport

interface UseCliRunnerOptions {
  onCreateProcess?: (process: CommandProcess) => void
}

interface LogLine {
  id: string
  commandId: string
  text: string
  tone?: 'success' | 'error' | 'info'
  kind?: 'stdout' | 'stderr' | 'meta'
}

function createId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function asCommandText(command: string, args: string[]) {
  const argText = args.length > 0 ? ` ${args.join(' ')}` : ''
  return `${command}${argText}`
}

interface CliStreamHandlers {
  onData(event: CliStreamEvent): void
  onError(error: unknown): void
}

interface CliStreamPlan {
  command: string
  args: string[]
  subscribe(handlers: CliStreamHandlers): { unsubscribe(): void }
}

function planCliStream(stream: CliStreamTransport): CliStreamPlan {
  return match(stream)
    .with({ type: 'archive-strict' }, ({ input }) => {
      const args = ['archive', '-y', input.changeId]
      if (input.skipSpecs) args.push('--skip-specs')
      if (input.noValidate) args.push('--no-validate')
      return {
        command: 'openspec',
        args,
        subscribe: (handlers: CliStreamHandlers) =>
          trpcClient.cli.archiveStrictStream.subscribe(input, handlers),
      }
    })
    .with({ type: 'init' }, ({ input }) => {
      const args = ['init']
      if (input?.tools !== undefined) {
        args.push('--tools', Array.isArray(input.tools) ? input.tools.join(',') : input.tools)
      }
      if (input?.profile) args.push('--profile', input.profile)
      if (input?.force) args.push('--force')
      return {
        command: 'openspec',
        args,
        subscribe: (handlers: CliStreamHandlers) =>
          trpcClient.cli.initStream.subscribe(input, handlers),
      }
    })
    .with({ type: 'planning-root-update' }, ({ input }) => {
      const args = ['update']
      if (input?.force) args.push('--force')
      return {
        command: 'openspec',
        args,
        subscribe: (handlers: CliStreamHandlers) =>
          trpcClient.cli.updateStream.subscribe(input, handlers),
      }
    })
    .with({ type: 'validate' }, ({ input }) => {
      const args = ['validate']
      if (input.id) args.push(input.id)
      if (input.type) args.push('--type', input.type)
      if (input.strict) args.push('--strict')
      return {
        command: 'openspec',
        args,
        subscribe: (handlers: CliStreamHandlers) =>
          trpcClient.cli.validateStream.subscribe(input, handlers),
      }
    })
    .with({ type: 'install-global-cli' }, () => ({
      command: 'npm',
      args: ['install', '-g', '@fission-ai/openspec'],
      subscribe: (handlers: CliStreamHandlers) =>
        trpcClient.cli.installGlobalCliStream.subscribe(undefined, handlers),
    }))
    .exhaustive()
}

function deriveOverallStatus(commands: CommandDescriptor[]): OverallStatus {
  if (commands.some((c) => c.status === 'loading' || c.status === 'running')) return 'running'
  if (commands.some((c) => c.status === 'error')) return 'error'
  if (commands.length > 0 && commands.every((c) => c.status === 'success')) return 'success'
  return 'idle'
}

/** Create one ordered Server-stream CLI queue for a React surface. */
export function useCliRunner(options: UseCliRunnerOptions = {}) {
  const [commands, setCommands] = useState<CommandDescriptor[]>([])
  const [logs, setLogs] = useState<LogLine[]>([])
  const [lastExitCode, setLastExitCode] = useState<number | null>(null)

  const activeSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)
  const activeCommandIdRef = useRef<string | null>(null)
  const commandStateRef = useRef<CommandDescriptor[]>([])
  const optionsRef = useRef<UseCliRunnerOptions>(options)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const updateCommands = useCallback(
    (updater: (prev: CommandDescriptor[]) => CommandDescriptor[]) => {
      const next = updater(commandStateRef.current)
      commandStateRef.current = next
      setCommands(next)
    },
    []
  )

  // keep ref in sync for runAll loop
  useEffect(() => {
    commandStateRef.current = commands
  }, [commands])

  const reset = useCallback(() => {
    activeSubscriptionRef.current?.unsubscribe?.()
    activeSubscriptionRef.current = null
    activeCommandIdRef.current = null
    commandStateRef.current = []
    setCommands([])
    setLogs([])
    setLastExitCode(null)
  }, [])

  const cancel = useCallback(() => {
    activeSubscriptionRef.current?.unsubscribe?.()
    activeSubscriptionRef.current = null
    const activeId = activeCommandIdRef.current
    if (activeId) {
      updateCommands((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, status: 'error', exitCode: null } : c))
      )
      setLogs((prev) => [
        ...prev,
        {
          id: createId(),
          commandId: activeId,
          kind: 'meta',
          text: 'Process cancelled by user',
          tone: 'error',
        },
      ])
    }
    activeCommandIdRef.current = null
  }, [updateCommands])

  const remove = useCallback(
    (id: string) => {
      updateCommands((prev) => prev.filter((c) => c.id !== id))
      setLogs((prev) => prev.filter((log) => log.commandId !== id))
      if (activeCommandIdRef.current === id) {
        cancel()
      }
    },
    [cancel, updateCommands]
  )

  const replaceAll = useCallback(
    (items: CliStreamTransport[]) => {
      activeSubscriptionRef.current?.unsubscribe?.()
      activeSubscriptionRef.current = null
      activeCommandIdRef.current = null
      setLogs([])
      setLastExitCode(null)
      updateCommands(() =>
        items.map((stream) => {
          const plan = planCliStream(stream)
          return {
            id: createId(),
            command: plan.command,
            args: plan.args,
            effectiveCommand: null,
            stream,
            status: 'idle',
            exitCode: null,
          }
        })
      )
    },
    [updateCommands]
  )

  const list = useCallback(() => [...commandStateRef.current], [])

  const appendLog = useCallback((log: LogLine) => {
    setLogs((prev) => [...prev, log])
  }, [])

  const run = useCallback(
    async (id?: string): Promise<CommandProcess | null> => {
      // Don't run CLI commands in static mode
      if (isStaticMode()) {
        console.warn('CLI runner is disabled in static mode')
        return null
      }

      const targetId = id ?? commandStateRef.current.find((c) => c.status === 'idle')?.id
      const target = commandStateRef.current.find((c) => c.id === targetId)
      if (!target) return null

      activeSubscriptionRef.current?.unsubscribe?.()
      activeCommandIdRef.current = target.id

      updateCommands((prev) =>
        prev.map((c) => (c.id === target.id ? { ...c, status: 'loading', exitCode: null } : c))
      )

      let resolveDone: (code: number | null) => void = () => {}
      const done = new Promise<number | null>((resolve) => {
        resolveDone = resolve
      })

      const listeners: Record<ProcessEvent, Set<(payload: string | number | null) => void>> = {
        data: new Set(),
        error: new Set(),
        close: new Set(),
        exit: new Set(),
      }

      const emit = (event: ProcessEvent, payload: string | number | null) => {
        listeners[event].forEach((handler) => handler(payload))
      }

      const process: CommandProcess = {
        id: target.id,
        command: target.command,
        args: target.args,
        effectiveCommand: target.effectiveCommand,
        status: 'loading',
        exitCode: null,
        done,
        on: (event, handler) => {
          listeners[event].add(handler)
          return () => listeners[event].delete(handler)
        },
        cancel: () => {
          cancel()
        },
      }

      optionsRef.current.onCreateProcess?.(process)

      const handlers = {
        onData: (event: CliStreamEvent) => {
          if (event.type === 'command') {
            const effectiveCommand = event.data ?? ''
            updateCommands((prev) =>
              prev.map((c) =>
                c.id === target.id ? { ...c, status: 'running', effectiveCommand } : c
              )
            )
            process.status = 'running'
            process.effectiveCommand = effectiveCommand
            emit('data', effectiveCommand)
            return
          }

          if (event.type === 'stdout' && event.data) {
            appendLog({
              id: createId(),
              commandId: target.id,
              kind: 'stdout',
              text: event.data,
            })
            emit('data', event.data)
            return
          }

          if (event.type === 'stderr' && event.data) {
            appendLog({
              id: createId(),
              commandId: target.id,
              kind: 'stderr',
              text: event.data,
              tone: 'error',
            })
            emit('error', event.data)
            return
          }

          if (event.type === 'exit') {
            const exitCode = event.exitCode ?? null
            setLastExitCode(exitCode)
            const status: CommandRunStatus = exitCode === 0 ? 'success' : 'error'
            updateCommands((prev) =>
              prev.map((c) => (c.id === target.id ? { ...c, status, exitCode } : c))
            )
            process.status = status
            process.exitCode = exitCode
            appendLog({
              id: createId(),
              commandId: target.id,
              kind: 'meta',
              text: `Process exited with code ${exitCode ?? 'unknown'}`,
              tone: exitCode === 0 ? 'success' : 'error',
            })
            emit('close', exitCode)
            emit('exit', exitCode)
            resolveDone(exitCode)
            activeSubscriptionRef.current?.unsubscribe?.()
            activeSubscriptionRef.current = null
            activeCommandIdRef.current = null
          }
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          updateCommands((prev) =>
            prev.map((c) => (c.id === target.id ? { ...c, status: 'error', exitCode: null } : c))
          )
          process.status = 'error'
          appendLog({
            id: createId(),
            commandId: target.id,
            kind: 'meta',
            text: `Error: ${message}`,
            tone: 'error',
          })
          emit('error', message)
          resolveDone(null)
          activeSubscriptionRef.current?.unsubscribe?.()
          activeSubscriptionRef.current = null
          activeCommandIdRef.current = null
        },
      }
      const subscription = planCliStream(target.stream).subscribe(handlers)

      process.status = 'running'
      activeSubscriptionRef.current = subscription

      return process
    },
    [appendLog, cancel, updateCommands]
  )

  const runAll = useCallback(async () => {
    let next = commandStateRef.current.find((c) => c.status === 'idle')
    while (next) {
      const process = await run(next.id)
      if (!process) break
      const exitCode = await process.done
      if (exitCode !== 0) break
      next = commandStateRef.current.find((c) => c.status === 'idle')
    }
  }, [run])

  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])

  const lines: CliRunnerLine[] = useMemo(
    () =>
      commands.flatMap((cmd) => {
        const statusIcon =
          cmd.status === 'loading' ? (
            <Loader2 className="h-3 w-3 animate-spin text-sky-300" />
          ) : cmd.status === 'running' ? (
            <div className="flex items-center gap-1 text-amber-200">
              <Sparkles className="h-3 w-3 animate-pulse" />
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : cmd.status === 'success' ? (
            <Check className="h-3 w-3 text-green-400" />
          ) : cmd.status === 'error' ? (
            <XCircle className="h-3 w-3 text-red-400" />
          ) : null

        const commandText = cmd.effectiveCommand ?? asCommandText(cmd.command, cmd.args)
        const headerText = cmd.status === 'idle' ? `# ${commandText}` : `$ ${commandText}`

        const header: CliRunnerLine[] = [
          {
            id: `cmd-${cmd.id}`,
            kind: 'html',
            node: (
              <div className="flex items-center gap-2">
                <span
                  className={
                    cmd.status === 'running'
                      ? 'terminal-shimmer'
                      : cmd.status === 'loading'
                        ? 'animate-pulse text-blue-200'
                        : cmd.status === 'success'
                          ? 'text-green-300'
                          : cmd.status === 'error'
                            ? 'text-red-300'
                            : 'text-zinc-200'
                  }
                >
                  {headerText}
                </span>
                {statusIcon}
              </div>
            ),
          },
        ]

        const body: CliRunnerLine[] = logs
          .filter((log) => log.commandId === cmd.id)
          .map((log) => ({
            id: log.id,
            kind: 'ascii' as const,
            text: log.text,
            tone: log.tone,
          }))

        return [...header, ...body]
      }),
    [commands, logs]
  )

  const overallStatus = useMemo(() => deriveOverallStatus(commands), [commands])
  const hasStarted = useMemo(() => commands.some((c) => c.status !== 'idle'), [commands])

  return {
    lines,
    status: overallStatus,
    exitCode: lastExitCode,
    hasStarted,
    commands: useMemo(
      () => ({
        remove,
        list,
        replaceAll,
        run,
        runAll,
      }),
      [list, remove, replaceAll, run, runAll]
    ),
    reset,
    cancel,
  }
}
