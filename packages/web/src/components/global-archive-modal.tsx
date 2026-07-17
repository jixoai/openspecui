/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Run one Server-owned strict-validate-then-archive stream with explicit user options.
 * 2. Keep Root Context and Store selector derivation outside the browser command payload.
 * 3. Lock execution until Root Context is ready and show failed-attempt evidence.
 * 4. Queue Archive through one typed transport without independent command evidence.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Original request (2026-07-17): "CliStreamTransport is the single execution and display truth."
 */
import { useArchiveModal } from '@/lib/archive-modal-context'
import { useCliRunner } from '@/lib/use-cli-runner'
import { useRootActionState } from '@/lib/use-root-action-state'
import { useVTHrefNavigate } from '@/lib/view-transitions/navigation'
import { Archive, CheckCircle, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { CliTerminal } from './cli-terminal'
import { Dialog } from './dialog'
import { RootActionNotice } from './root-action-notice'
import { Switch } from './switch'

export function GlobalArchiveModal() {
  const navigateByHref = useVTHrefNavigate()
  const { state, closeArchiveModal } = useArchiveModal()
  const rootAction = useRootActionState()
  const { open, changeId, changeName } = state

  const [skipSpecs, setSkipSpecs] = useState(false)
  const [noValidate, setNoValidate] = useState(false)
  const [detectedArchiveId, setDetectedArchiveId] = useState<string | null>(null)

  const runner = useCliRunner({
    onCreateProcess: (process) => {
      process.on('data', (data) => {
        const match = /Change ['"](.+?)['"] archived as ['"](.+?)['"]/.exec(String(data))
        if (match?.[2]) {
          setDetectedArchiveId(match[2])
        }
      })
    },
  })
  const { lines, status, hasStarted, commands, reset, cancel } = runner

  // 当 Modal 打开时重置状态
  useEffect(() => {
    if (open) {
      setSkipSpecs(false)
      setNoValidate(false)
      setDetectedArchiveId(null)
    }
  }, [open])

  // 关闭并重置 - 使用 useCallback 稳定引用
  const handleClose = () => {
    cancel()
    reset()
    setSkipSpecs(false)
    setNoValidate(false)
    setDetectedArchiveId(null)
    closeArchiveModal()
  }

  const buildQueue = useCallback(() => {
    if (!changeId || rootAction.disabled) return []
    return [
      {
        type: 'archive-strict' as const,
        input: { changeId, skipSpecs, noValidate },
      },
    ]
  }, [changeId, noValidate, rootAction.disabled, skipSpecs])

  const isRunning = status === 'running'
  const isArchiveSuccess = status === 'success' && !!detectedArchiveId
  const isArchiveOutputMissingId = status === 'success' && !detectedArchiveId
  const archiveStatus = isArchiveSuccess ? 'success' : isArchiveOutputMissingId ? 'error' : status
  const successArchiveId = detectedArchiveId ?? ''

  // 开始执行 archive（若之前失败则自动重置并重跑）
  const handleStartArchive = () => {
    if (!changeId || rootAction.disabled) return
    commands.runAll()
  }

  const handleReset = () => {
    reset()
    setSkipSpecs(false)
    setNoValidate(false)
    setDetectedArchiveId(null)
  }

  useEffect(() => {
    if (!open || !changeId || hasStarted || rootAction.disabled) return
    const queue = buildQueue()
    commands.replaceAll(queue)
  }, [buildQueue, changeId, commands, hasStarted, open, rootAction.disabled])

  if (!open || !changeId) return null

  const borderVariant =
    archiveStatus === 'error' ? 'error' : archiveStatus === 'success' ? 'success' : 'default'

  const footer =
    archiveStatus === 'success' && successArchiveId ? (
      <div className="flex w-full items-center justify-between gap-3">
        <div className="text-sm text-green-600">Archived as {successArchiveId}</div>
        <div className="flex items-center gap-2">
          <button onClick={handleClose} className="bg-muted hover:bg-muted/80 rounded-md px-4 py-2">
            Close
          </button>
          <button
            onClick={() => {
              handleClose()
              void navigateByHref({ href: `/archive/${encodeURIComponent(successArchiveId)}` })
            }}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!successArchiveId}
          >
            View Archive
          </button>
        </div>
      </div>
    ) : (
      <>
        <button onClick={handleReset} className="bg-muted hover:bg-muted/80 rounded-md px-4 py-2">
          {archiveStatus === 'error' ? 'Reset & Retry' : 'Reset'}
        </button>
        <button
          onClick={handleClose}
          className="bg-muted hover:bg-muted/80 rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRunning}
        >
          Close
        </button>
        <button
          onClick={archiveStatus === 'error' ? handleReset : handleStartArchive}
          disabled={isRunning || rootAction.disabled}
          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          {archiveStatus === 'error' ? 'Reset before Archive' : 'Archive'}
        </button>
      </>
    )

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      onDismissRequest={null}
      title={
        <div className="flex items-center gap-2">
          {archiveStatus === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <Archive className="h-5 w-5 text-red-500" />
          )}
          <span className="font-semibold">Archive: {changeName}</span>
        </div>
      }
      footer={footer}
      borderVariant={borderVariant}
    >
      <div className="space-y-4">
        <RootActionNotice state={rootAction} />

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-sm">Change to archive:</p>
          <p className="font-medium">{changeName}</p>
          <p className="text-muted-foreground mt-1 text-xs">ID: {changeId}</p>
          {rootAction.context?.planningRoot ? (
            <p className="text-muted-foreground mt-1 break-all text-xs">
              Root: {rootAction.context.planningRoot.path} ({rootAction.context.planningRoot.source}
              {rootAction.context.storeId ? `, Store ${rootAction.context.storeId}` : ''})
            </p>
          ) : null}
        </div>

        <CliTerminal lines={lines} maxHeight="50vh" />

        {isArchiveOutputMissingId && (
          <div className="rounded-md border border-amber-200 bg-amber-100 px-3 py-2 text-sm text-amber-900">
            Archive output did not include the archived change name. Treating archive as failed.
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm font-medium">Options</p>

          <label className="flex cursor-pointer items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Skip specs update</p>
              <p className="text-muted-foreground text-xs">
                Don't update spec files with delta changes (--skip-specs)
              </p>
            </div>
            <Switch
              checked={skipSpecs}
              onCheckedChange={setSkipSpecs}
              ariaLabel="Skip specs update"
              disabled={hasStarted || rootAction.disabled}
            />
          </label>

          <label className="flex cursor-pointer items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Skip validation</p>
              <p className="text-muted-foreground text-xs">
                Don't validate the change before archiving (--no-validate)
              </p>
            </div>
            <Switch
              checked={noValidate}
              onCheckedChange={setNoValidate}
              ariaLabel="Skip validation"
              disabled={hasStarted || rootAction.disabled}
            />
          </label>
        </div>
      </div>
    </Dialog>
  )
}
