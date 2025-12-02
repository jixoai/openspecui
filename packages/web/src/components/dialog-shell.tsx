import type { ReactNode } from 'react'

interface DialogShellProps {
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
 * Generic dialog shell with overlay, header/body/footer layout and max-height guard.
 * Keeps body scrollable when content exceeds viewport.
 */
export function DialogShell({
  open,
  title,
  onClose,
  children,
  footer,
  className = '',
  bodyClassName = '',
  maxHeight = '86vh',
  borderVariant = 'default',
}: DialogShellProps) {
  if (!open) return null

  const borderClass =
    borderVariant === 'error'
      ? 'border-red-500/60'
      : borderVariant === 'success'
        ? 'border-green-500/50'
        : 'border-border'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog container */}
      <div
        className={`bg-background relative mx-4 flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border shadow-xl ${borderClass} ${className}`}
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              stroke="currentColor"
              fill="none"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={`min-h-0 flex-1 overflow-auto px-4 py-3 ${bodyClassName}`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-border flex flex-none shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
