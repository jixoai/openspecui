import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: ReactNode // can include icon / status chips etc.
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
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
  children,
  footer,
  className = '',
  bodyClassName = '',
  maxHeight = '86vh',
  borderVariant = 'default',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

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
      const rect = dialog.getBoundingClientRect()
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
        /* 1. 对话框的基础状态（关闭状态） */
        dialog.openspec-dialog {
          margin: auto;
          opacity: 0.6;
          transform: translateY(12px);
          /* 必须把 overlay 也加入过渡，否则关闭时会瞬间消失 */
          transition:
            opacity 260ms cubic-bezier(0.22, 0.61, 0.36, 1),
            transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1),
            overlay 320ms allow-discrete,
            display 260ms allow-discrete;
        }

        /* 2. 对话框的打开状态 */
        dialog.openspec-dialog[open] {
          opacity: 1;
          transform: translateY(0);
        }

        /* 3. 对话框打开瞬间的起始帧 */
        @starting-style {
          dialog.openspec-dialog[open] {
            opacity: 0.6;
            transform: translateY(12px);
          }
        }

        /* --- 下面是 Backdrop (背景遮罩) 的动画 --- */

        /* 4. 背景遮罩的基础状态 */
        dialog.openspec-dialog::backdrop {
          background-color: rgba(0, 0, 0, 0); /* 初始透明 */
          backdrop-filter: grayscale(0.5);
          transition:
            display 0.35s allow-discrete,
            overlay 0.35s allow-discrete,
            background-color 0.35s ease,
            backdrop-filter 0.35s ease;
        }

        /* 5. 背景遮罩的打开状态 */
        dialog.openspec-dialog[open]::backdrop {
          background-color: rgba(0, 0, 0, 0.5);
          backdrop-filter: grayscale(1);
        }

        /* 6. 背景遮罩的起始帧 */
        @starting-style {
          dialog.openspec-dialog[open]::backdrop {
            background-color: rgba(0, 0, 0, 0);
            backdrop-filter: grayscale(0.5);
          }
        }
      `}</style>
    )
  }, [])

  return (
    <>
      {styles}
      <dialog
        ref={dialogRef}
        className="openspec-dialog w-[calc(100%-2rem)] max-w-2xl border-0 bg-transparent p-0"
      >
        <div
          className={`bg-background relative flex w-full flex-col overflow-hidden rounded-lg border shadow-xl ${borderClass} ${className}`}
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
      </dialog>
    </>
  )
}
