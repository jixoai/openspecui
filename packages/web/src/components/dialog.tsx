import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: ReactNode // can include icon / status chips etc.
  onClose: () => void
  onClosed?: () => void
  children: ReactNode
  footer?: ReactNode
  dialogClassName?: string
  contentClassName?: string
  className?: string
  bodyClassName?: string
  maxHeight?: string
  borderVariant?: 'default' | 'success' | 'error'
}

/**
 * Unified dialog component backed by the native HTMLDialogElement.
 * Preserves the previous DialogShell layout while using showModal/close
 * for proper focus trapping and ESC handling.
 */
export function Dialog({
  open,
  title,
  onClose,
  onClosed,
  children,
  footer,
  dialogClassName = '',
  contentClassName = '',
  className = '',
  bodyClassName = '',
  maxHeight = '86vh',
  borderVariant = 'default',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close-complete callback from native dialog lifecycle
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !onClosed) return

    const handleClosed = () => {
      onClosed()
    }

    dialog.addEventListener('close', handleClosed)
    return () => {
      dialog.removeEventListener('close', handleClosed)
    }
  }, [onClosed])

  // Synchronize the native dialog with the controlled `open` prop
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Close on ESC / cancel and backdrop clicks
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }

    const handleClick = (event: MouseEvent) => {
      const panel = panelRef.current
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      const isInDialog =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom

      if (!isInDialog) {
        onClose()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    dialog.addEventListener('click', handleClick)

    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      dialog.removeEventListener('click', handleClick)
    }
  }, [onClose])

  const borderClass =
    borderVariant === 'error'
      ? 'border-red-500/60'
      : borderVariant === 'success'
        ? 'border-green-500/50'
        : 'border-border'

  const styles = useMemo(() => {
    const css = String.raw
    return (
      <style>{css`
        dialog.openspec-dialog {
          opacity: 0;
          transform: translateY(8px);
          transition:
            opacity 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
            transform 180ms cubic-bezier(0.22, 0.61, 0.36, 1);
        }

        dialog.openspec-dialog[open] {
          opacity: 1;
          transform: translateY(0);
        }

        @starting-style {
          dialog.openspec-dialog[open] {
            opacity: 0;
            transform: translateY(8px);
          }
        }

        dialog.openspec-dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.5);
          backdrop-filter: grayscale(1);
        }
      `}</style>
    )
  }, [])

  return (
    <>
      {styles}
      <dialog
        ref={dialogRef}
        className={`openspec-dialog m-0 h-dvh w-screen max-w-none border-0 bg-transparent p-0 ${dialogClassName}`}
      >
        <div
          className={`flex h-full w-full items-center justify-center px-4 py-4 ${contentClassName}`}
        >
          <div
            ref={panelRef}
            className={`bg-background relative flex w-[calc(100%-0.5rem)] max-w-2xl flex-col overflow-hidden rounded-[var(--openspec-dialog-radius,0.75rem)] border shadow-xl ${borderClass} ${className}`}
            style={{ maxHeight }}
          >
            {/* Header (non-shrinking) */}
            <div className="border-border flex flex-none shrink-0 items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">{title}</div>
              <button
                onClick={onClose}
                className="hover:bg-muted rounded p-1"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className={`min-h-0 flex-1 overflow-auto px-4 py-3 ${bodyClassName}`}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="border-border flex flex-none shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
                {footer}
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}
