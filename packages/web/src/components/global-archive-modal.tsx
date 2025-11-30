import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { X, Archive, AlertTriangle } from 'lucide-react'
import { useArchiveModal } from '@/lib/archive-modal-context'
import { CliTerminalModal, type SuccessConfig } from './cli-terminal-modal'

type Step = 'options' | 'terminal'

/**
 * 全局 Archive Modal
 *
 * 渲染在 Router 内部，这样可以使用 useNavigate。
 * 使用 ArchiveModalContext 来控制显示状态。
 *
 * 两步流程：
 * 1. 选项选择（skipSpecs, noValidate）
 * 2. 终端输出和成功提示
 */
export function GlobalArchiveModal() {
  const navigate = useNavigate()
  const { state, closeArchiveModal } = useArchiveModal()
  const { open, changeId, changeName } = state

  const [step, setStep] = useState<Step>('options')
  const [skipSpecs, setSkipSpecs] = useState(false)
  const [noValidate, setNoValidate] = useState(false)

  // 当 Modal 打开时重置状态
  useEffect(() => {
    if (open) {
      setStep('options')
      setSkipSpecs(false)
      setNoValidate(false)
    }
  }, [open])

  // Generate archive name (same format as CLI)
  const archiveName = useMemo(() => {
    if (!changeId) return ''
    const date = new Date().toISOString().split('T')[0]
    return `${date}-${changeId}`
  }, [changeId])

  // 关闭并重置 - 使用 useCallback 稳定引用
  const handleClose = useCallback(() => {
    setStep('options')
    setSkipSpecs(false)
    setNoValidate(false)
    closeArchiveModal()
  }, [closeArchiveModal])

  // 开始执行 archive
  const handleStartArchive = useCallback(() => {
    setStep('terminal')
  }, [])

  // Success configuration for terminal modal
  const successConfig: SuccessConfig = useMemo(
    () => ({
      title: 'Archive Successful',
      description: `"${changeName}" has been archived as ${archiveName}`,
      actions: [
        {
          label: 'Close',
          onClick: handleClose,
        },
        {
          label: 'View Archive',
          onClick: () => {
            handleClose()
            // 跳转到刚刚 archive 的 change 详情页
            navigate({ to: '/archive/$changeId', params: { changeId: archiveName } })
          },
          primary: true,
        },
      ],
    }),
    [changeName, archiveName, navigate, handleClose]
  )

  if (!open || !changeId) return null

  // Step 2: Terminal output with success view
  if (step === 'terminal') {
    return (
      <CliTerminalModal
        title={`Archive: ${changeName}`}
        open={true}
        onClose={handleClose}
        successConfig={successConfig}
        type="archive"
        archiveOptions={{
          changeId,
          skipSpecs,
          noValidate,
        }}
      />
    )
  }

  // Step 1: Options selection
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-background border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold">Archive Change</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                This action will archive the change
              </p>
              <p className="text-muted-foreground mt-1">
                Archiving moves the change to the archive directory and updates affected specs.
              </p>
            </div>
          </div>

          {/* Change info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Change to archive:</p>
            <p className="font-medium">{changeName}</p>
            <p className="text-xs text-muted-foreground mt-1">ID: {changeId}</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Options</p>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={skipSpecs}
                onChange={(e) => setSkipSpecs(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-border"
              />
              <div>
                <p className="text-sm font-medium">Skip specs update</p>
                <p className="text-xs text-muted-foreground">
                  Don't update spec files with delta changes (--skip-specs)
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={noValidate}
                onChange={(e) => setNoValidate(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-border"
              />
              <div>
                <p className="text-sm font-medium">Skip validation</p>
                <p className="text-xs text-muted-foreground">
                  Don't validate the change before archiving (--no-validate)
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleStartArchive}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
        </div>
      </div>
    </div>
  )
}
