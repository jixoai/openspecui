import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Archive, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CliTerminalModal, type SuccessConfig } from './cli-terminal-modal'

export interface ArchiveModalProps {
  /** Change ID to archive */
  changeId: string
  /** Change name for display */
  changeName: string
  /** Whether the modal is open */
  open: boolean
  /** Close handler */
  onClose: () => void
}

type Step = 'options' | 'terminal'

/**
 * Archive Modal
 *
 * Two-step modal:
 * 1. Options selection (--skip-specs, --no-validate)
 * 2. Terminal output showing CLI execution with success view
 */
export function ArchiveModal({ changeId, changeName, open, onClose }: ArchiveModalProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('options')
  const [skipSpecs, setSkipSpecs] = useState(false)
  const [noValidate, setNoValidate] = useState(false)
  const [detectedArchiveId, setDetectedArchiveId] = useState<string | null>(null)

  // Reset state when modal closes
  const handleClose = () => {
    setStep('options')
    setSkipSpecs(false)
    setNoValidate(false)
    setDetectedArchiveId(null)
    onClose()
  }

  // Start archive
  const handleStartArchive = () => {
    setStep('terminal')
  }

  // Generate archive name (same format as CLI)
  const archiveName = useMemo(() => {
    const date = new Date().toISOString().split('T')[0]
    return `${date}-${changeId}`
  }, [changeId])

  // Success configuration for terminal modal
  const successConfig: SuccessConfig = useMemo(
    () => ({
      title: 'Archive Successful',
      description: `"${changeName}" has been archived as ${detectedArchiveId ?? archiveName}`,
      actions: [
        {
          label: 'Close',
          onClick: () => {
            handleClose()
            navigate({ to: '/changes' })
          },
        },
        {
          label: 'View Archive',
          disabled: !detectedArchiveId,
          onClick: () => {
            handleClose()
            if (!detectedArchiveId) return
            navigate({ to: '/archive/$changeId', params: { changeId: detectedArchiveId } })
          },
          primary: true,
        },
      ],
    }),
    [changeName, archiveName, detectedArchiveId, navigate]
  )

  if (!open) return null

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
        onArchiveDetected={setDetectedArchiveId}
      />
    )
  }

  // Step 1: Options selection
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="bg-background border-border relative mx-4 w-full max-w-md rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-red-500" />
            <h2 className="font-semibold">Archive Change</h2>
          </div>
          <button onClick={handleClose} className="hover:bg-muted rounded p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 p-4">
          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
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
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-muted-foreground text-sm">Change to archive:</p>
            <p className="font-medium">{changeName}</p>
            <p className="text-muted-foreground mt-1 text-xs">ID: {changeId}</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Options</p>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={skipSpecs}
                onChange={(e) => setSkipSpecs(e.target.checked)}
                className="border-border mt-1 h-4 w-4 rounded"
              />
              <div>
                <p className="text-sm font-medium">Skip specs update</p>
                <p className="text-muted-foreground text-xs">
                  Don't update spec files with delta changes (--skip-specs)
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={noValidate}
                onChange={(e) => setNoValidate(e.target.checked)}
                className="border-border mt-1 h-4 w-4 rounded"
              />
              <div>
                <p className="text-sm font-medium">Skip validation</p>
                <p className="text-muted-foreground text-xs">
                  Don't validate the change before archiving (--no-validate)
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="border-border flex items-center justify-end gap-2 border-t px-4 py-3">
          <button onClick={handleClose} className="bg-muted hover:bg-muted/80 rounded-md px-4 py-2">
            Cancel
          </button>
          <button
            onClick={handleStartArchive}
            className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            <Archive className="h-4 w-4" />
            Archive
          </button>
        </div>
      </div>
    </div>
  )
}
