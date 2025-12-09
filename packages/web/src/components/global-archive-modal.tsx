import { useArchiveModal } from '@/lib/archive-modal-context'
import { useCliRunner } from '@/lib/use-cli-runner'
import { useNavigate } from '@tanstack/react-router'
import { Archive, CheckCircle, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Dialog } from './dialog'
import { CliTerminal } from './cli-terminal'

/**
 * 全局 Archive Modal（单一对话框，点击 Archive 后直接串行 validate -> archive）
 */
export function GlobalArchiveModal() {
  const navigate = useNavigate()
  const { state, closeArchiveModal } = useArchiveModal()
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
    if (!changeId) return []
    const queue: Array<{ command: string; args?: string[] }> = []
    if (!noValidate) {
      queue.push({ command: 'openspec', args: ['validate', changeId] })
    }
    const archiveArgs = ['archive', '-y', changeId]
    if (skipSpecs) archiveArgs.push('--skip-specs')
    archiveArgs.push('--no-validate')
    queue.push({ command: 'openspec', args: archiveArgs })
    return queue
  }, [changeId, noValidate, skipSpecs])

  const isRunning = status === 'running'
  const isArchiveSuccess = status === 'success' && !!detectedArchiveId
  const isArchiveOutputMissingId = status === 'success' && !detectedArchiveId
  const archiveStatus = isArchiveSuccess ? 'success' : isArchiveOutputMissingId ? 'error' : status
  const successArchiveId = detectedArchiveId ?? ''

  // 开始执行 archive（若之前失败则自动重置并重跑）
  const handleStartArchive = () => {
    if (!changeId) return
    commands.runAll()
  }

  const handleReset = () => {
    reset()
    setSkipSpecs(false)
    setNoValidate(false)
    setDetectedArchiveId(null)
  }

  useEffect(() => {
    if (!open || !changeId || hasStarted) return
    const queue = buildQueue()
    commands.replaceAll(queue)
  }, [buildQueue, changeId, commands, hasStarted, open])

  if (!open || !changeId) return null

  const borderVariant = archiveStatus === 'error' ? 'error' : archiveStatus === 'success' ? 'success' : 'default'

  const footer = archiveStatus === 'success' && successArchiveId ? (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="text-sm text-green-600">Archived as {successArchiveId}</div>
      <div className="flex items-center gap-2">
        <button onClick={handleClose} className="bg-muted hover:bg-muted/80 rounded-md px-4 py-2">
          Close
        </button>
        <button
          onClick={() => {
            handleClose()
            navigate({ to: '/archive/$changeId', params: { changeId: successArchiveId } })
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
        disabled={isRunning}
        className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
        {archiveStatus === 'error' ? 'Reset before Archive' : 'Archive'}
      </button>
    </>
  )

  return (
    <Dialog
      open={open}
      onClose={handleClose}
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
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-sm">Change to archive:</p>
          <p className="font-medium">{changeName}</p>
          <p className="text-muted-foreground mt-1 text-xs">ID: {changeId}</p>
        </div>

        <CliTerminal
          lines={lines}
          maxHeight="50vh"
        />

        {isArchiveOutputMissingId && (
          <div className="border-amber-200 bg-amber-100 text-amber-900 rounded-md border px-3 py-2 text-sm">
            Archive output did not include the archived change name. Treating archive as failed.
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm font-medium">Options</p>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={skipSpecs}
              onChange={(e) => setSkipSpecs(e.target.checked)}
              className="border-border mt-1 h-4 w-4 rounded"
              disabled={hasStarted}
            />
            <div>
              <p className="text-sm font-medium">Skip specs update</p>
              <p className="text-muted-foreground text-xs">Don't update spec files with delta changes (--skip-specs)</p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={noValidate}
              onChange={(e) => setNoValidate(e.target.checked)}
              className="border-border mt-1 h-4 w-4 rounded"
              disabled={hasStarted}
            />
            <div>
              <p className="text-sm font-medium">Skip validation</p>
              <p className="text-muted-foreground text-xs">Don't validate the change before archiving (--no-validate)</p>
            </div>
          </label>
        </div>
      </div>
    </Dialog>
  )
}
