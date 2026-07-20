/**
 * Orthogonal intents (updated 2026-07-21 Asia/Shanghai):
 * 1. Dispatch sanitized payloads to existing or newly created terminal sessions.
 * 2. Keep Copy, Save, target selection, and Send under one external readiness lock.
 * 3. Preserve per-action loading state and terminal foreground-process behavior.
 * 4. Keep target selection available while dispatch actions are locked by stale targets.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 */
import { Select, type SelectOptionGroup } from '@/components/select'
import { useTerminalContext, type TerminalSession } from '@/lib/terminal-context'
import { terminalController } from '@/lib/terminal-controller'
import {
  buildTerminalSendPayload,
  createSpawnTarget,
  createTerminalTarget,
  isLikelyShellForegroundProcess,
  parseCreateTarget,
  parseTerminalTarget,
  sanitizeTerminalDispatchPayload,
  toErrorMessage,
  type CreateTerminalTarget,
  type ExistingTerminalTarget,
  type TerminalDispatchSelectValue,
  type TerminalDispatchTarget,
} from '@/lib/terminal-dispatch'
import { useTerminalInvocationConfig } from '@/lib/use-terminal-invocation-config'
import type { TerminalCwdTarget } from '@openspecui/core/pty-protocol'
import type {
  TerminalCommandFieldValues,
  TerminalSpawnCommand,
} from '@openspecui/core/terminal-invocation'
import { Check, Copy, Loader2, Save, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TerminalSpawnCommandDialog } from './terminal-spawn-command-dialog'

interface TerminalDispatchActionsProps {
  preparePayload: () => Promise<string>
  disabled?: boolean
  actionsDisabled?: boolean
  requiredCwdTarget?: TerminalCwdTarget
  expectedRootGeneration?: string
  disabledReason?: string
  onDispatched?: () => void
  onError?: (message: string | null) => void
  sendLabel?: string
  createLabel?: string
  size?: 'sm' | 'md'
  className?: string
  targetSelectTestId?: string
}

function getPreferredTarget(
  activeSessionId: string | null,
  liveSessions: readonly TerminalSession[],
  firstCreateTarget: TerminalDispatchTarget | null
): TerminalDispatchTarget | null {
  if (activeSessionId && liveSessions.some((session) => session.id === activeSessionId)) {
    return createTerminalTarget(activeSessionId)
  }
  if (liveSessions[0]) return createTerminalTarget(liveSessions[0].id)
  return firstCreateTarget
}

function findSelectedSpawnCommand(
  target: TerminalDispatchTarget | null,
  spawnCommands: readonly TerminalSpawnCommand[],
  fallback: TerminalSpawnCommand | null
): TerminalSpawnCommand | null {
  const commandId = parseCreateTarget(target)
  if (!commandId) return fallback
  return spawnCommands.find((command) => command.id === commandId) ?? fallback
}

function findSelectedSession(
  target: TerminalDispatchTarget | null,
  liveSessions: readonly TerminalSession[]
): TerminalSession | null {
  const sessionId = parseTerminalTarget(target)
  if (!sessionId) return null
  return liveSessions.find((session) => session.id === sessionId) ?? null
}

function useEphemeralSuccess(durationMs = 1200): [boolean, () => void] {
  const [success, setSuccess] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const showSuccess = () => {
    setSuccess(true)
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      setSuccess(false)
    }, durationMs)
  }

  return [success, showSuccess]
}

function buttonClassName(size: 'sm' | 'md', activeSuccess: boolean): string {
  const sizeClassName = size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-4 text-sm'
  const toneClassName = activeSuccess
    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700'
    : 'border-border hover:bg-muted'
  return [
    'inline-flex items-center justify-center gap-2 rounded-md border font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
    sizeClassName,
    toneClassName,
  ].join(' ')
}

function primaryButtonClassName(size: 'sm' | 'md'): string {
  return [
    'bg-primary text-primary-foreground inline-flex items-center justify-center gap-2 self-end rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
  ].join(' ')
}

function selectClassName(size: 'sm' | 'md'): string {
  return size === 'sm' ? 'h-8 w-full py-1.5 text-xs' : 'w-full'
}

/**
 * Shared terminal dispatch actions for OPSX prompts.
 *
 * Best practice: pages own how a prompt is produced, while this component owns
 * where that prompt is dispatched. That keeps terminal target selection,
 * copy/history behavior, shell paste safety, and create-terminal presets as one
 * platform law instead of re-implementing partial action sets per workflow.
 */
export function TerminalDispatchActions({
  preparePayload,
  disabled = false,
  actionsDisabled = false,
  requiredCwdTarget,
  expectedRootGeneration,
  disabledReason,
  onDispatched,
  onError,
  sendLabel = 'Send',
  createLabel = 'Create',
  size = 'md',
  className,
  targetSelectTestId = 'terminal-dispatch-target-select',
}: TerminalDispatchActionsProps) {
  const { sessions, activeSessionId } = useTerminalContext()
  const { spawnCommands } = useTerminalInvocationConfig()
  const liveSessions = useMemo(() => sessions.filter((session) => !session.isExited), [sessions])
  const defaultSpawnCommand = spawnCommands[0] ?? null
  const dispatchableSessions = useMemo(
    () => (requiredCwdTarget ? [] : liveSessions),
    [liveSessions, requiredCwdTarget]
  )
  const firstCreateTarget = useMemo<TerminalDispatchTarget | null>(
    () => (defaultSpawnCommand ? createSpawnTarget(defaultSpawnCommand.id) : null),
    [defaultSpawnCommand]
  )
  const preferredTarget = useMemo(
    () => getPreferredTarget(activeSessionId, dispatchableSessions, firstCreateTarget),
    [activeSessionId, dispatchableSessions, firstCreateTarget]
  )
  const targetGroups = useMemo<SelectOptionGroup<TerminalDispatchSelectValue>[]>(
    () => [
      {
        label: 'Shell Instances',
        options:
          dispatchableSessions.length > 0
            ? dispatchableSessions.map((session) => ({
                value: createTerminalTarget(session.id) as ExistingTerminalTarget,
                label: `${session.displayTitle} · ${session.cwdTarget === 'planning-root' ? 'Planning' : 'Launch'}`,
              }))
            : [{ value: '', label: 'No shell instances available', disabled: true }],
      },
      {
        label: 'Create Shell Instance',
        options:
          spawnCommands.length > 0
            ? spawnCommands.map((command) => ({
                value: createSpawnTarget(command.id) as CreateTerminalTarget,
                label: `Create ${command.label}`,
              }))
            : [{ value: '', label: 'No spawn commands configured', disabled: true }],
      },
    ],
    [dispatchableSessions, spawnCommands]
  )

  const [target, setTarget] = useState<TerminalDispatchTarget | null>(null)
  const [isCopying, setIsCopying] = useState(false)
  const [isSavingHistory, setIsSavingHistory] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [copySuccess, showCopySuccess] = useEphemeralSuccess()
  const [saveSuccess, showSaveSuccess] = useEphemeralSuccess()
  const [spawnDialogOpen, setSpawnDialogOpen] = useState(false)
  const [spawnPresetValues, setSpawnPresetValues] = useState<TerminalCommandFieldValues>({})
  const interactionDisabled = disabled || actionsDisabled

  useEffect(() => {
    setTarget((prev) => {
      if (!prev) return preferredTarget
      if (
        parseCreateTarget(prev) &&
        spawnCommands.some((command) => createSpawnTarget(command.id) === prev)
      ) {
        return prev
      }
      const sessionId = parseTerminalTarget(prev)
      if (sessionId && dispatchableSessions.some((session) => session.id === sessionId)) {
        return prev
      }
      return preferredTarget
    })
  }, [dispatchableSessions, preferredTarget, spawnCommands])

  useEffect(() => {
    if (interactionDisabled) setSpawnDialogOpen(false)
  }, [interactionDisabled])

  const selectedSpawnCommand = useMemo(
    () => findSelectedSpawnCommand(target, spawnCommands, defaultSpawnCommand),
    [defaultSpawnCommand, spawnCommands, target]
  )

  const resolvePayload = async (): Promise<string> => {
    if (interactionDisabled) {
      throw new Error(disabledReason ?? 'This action is currently unavailable.')
    }
    const sanitized = sanitizeTerminalDispatchPayload(await preparePayload())
    if (sanitized.text.trim().length === 0) {
      throw new Error('Prompt is empty.')
    }
    if (sanitized.modified) {
      onError?.('ANSI/control characters were stripped from generated prompt for safety.')
    }
    return sanitized.text
  }

  const handleError = (error: unknown) => {
    onError?.(toErrorMessage(error))
  }

  const handleCopy = async () => {
    setIsCopying(true)
    onError?.(null)
    try {
      await navigator.clipboard.writeText(await resolvePayload())
      showCopySuccess()
    } catch (error) {
      handleError(error)
    } finally {
      setIsCopying(false)
    }
  }

  const handleSave = async () => {
    setIsSavingHistory(true)
    onError?.(null)
    try {
      await terminalController.addInputHistory(await resolvePayload())
      showSaveSuccess()
    } catch (error) {
      handleError(error)
    } finally {
      setIsSavingHistory(false)
    }
  }

  const handleSend = async () => {
    if (!target) {
      onError?.('No live terminal session is available.')
      return
    }

    setIsSending(true)
    onError?.(null)
    try {
      const payload = await resolvePayload()
      const createCommandId = parseCreateTarget(target)
      if (createCommandId) {
        setSpawnPresetValues({ prompt: payload })
        setSpawnDialogOpen(true)
        return
      }

      const selectedSession = findSelectedSession(target, dispatchableSessions)
      if (!selectedSession) {
        throw new Error('Selected terminal session is no longer available.')
      }
      const wrote = terminalController.writeToSession(
        selectedSession.id,
        buildTerminalSendPayload(
          payload,
          isLikelyShellForegroundProcess(selectedSession.processTitle)
        )
      )
      if (!wrote) {
        throw new Error('Terminal session is not ready. Wait a moment and retry.')
      }
      onDispatched?.()
    } catch (error) {
      handleError(error)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <div
        className={[
          'flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between',
          className ?? '',
        ].join(' ')}
      >
        <div className="order-2 flex items-center gap-2 sm:order-1">
          <button
            type="button"
            disabled={interactionDisabled || isCopying}
            title={interactionDisabled ? disabledReason : undefined}
            onClick={() => void handleCopy()}
            className={buttonClassName(size, copySuccess)}
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
            disabled={interactionDisabled || isSavingHistory}
            title={interactionDisabled ? disabledReason : undefined}
            onClick={() => void handleSave()}
            className={buttonClassName(size, saveSuccess)}
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
          <label className="flex min-w-0 flex-1 flex-col gap-1 sm:w-56 sm:flex-none">
            <span className={size === 'sm' ? 'text-xs font-medium' : 'text-sm font-medium'}>
              Target
            </span>
            <Select
              value={target ?? ''}
              groups={targetGroups}
              onValueChange={(nextTarget) => setTarget(nextTarget || null)}
              ariaLabel="Target"
              disabled={disabled}
              data-testid={targetSelectTestId}
              className={selectClassName(size)}
            />
          </label>
          <button
            type="button"
            disabled={interactionDisabled || isSending || target === null}
            title={interactionDisabled ? disabledReason : undefined}
            onClick={() => void handleSend()}
            className={primaryButtonClassName(size)}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSending ? 'Sending...' : parseCreateTarget(target) ? createLabel : sendLabel}
          </button>
        </div>
      </div>
      <TerminalSpawnCommandDialog
        open={spawnDialogOpen}
        command={selectedSpawnCommand}
        presetValues={spawnPresetValues}
        initialCwdTarget={requiredCwdTarget}
        lockedCwdTarget={requiredCwdTarget}
        expectedRootGeneration={expectedRootGeneration}
        onClose={() => setSpawnDialogOpen(false)}
        onCreated={onDispatched}
      />
    </>
  )
}
