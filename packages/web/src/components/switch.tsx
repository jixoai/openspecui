import { cn } from '@/lib/utils'
import type { FocusEventHandler } from 'react'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  ariaLabel?: string
  id?: string
  name?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  onBlur?: FocusEventHandler<HTMLElement>
  onFocus?: FocusEventHandler<HTMLElement>
  className?: string
  thumbClassName?: string
}

/**
 * Shared on/off control for settings and command options.
 */
export function Switch({
  checked,
  onCheckedChange,
  ariaLabel,
  id,
  name,
  required,
  disabled,
  readOnly,
  onBlur,
  onFocus,
  className,
  thumbClassName,
}: SwitchProps) {
  const toggle = () => {
    if (disabled || readOnly) {
      return
    }

    onCheckedChange(!checked)
  }

  return (
    <>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={checked ? 'on' : ''}
          required={required}
          disabled={disabled}
        />
      ) : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        aria-readonly={readOnly || undefined}
        onClick={toggle}
        onBlur={onBlur}
        onFocus={onFocus}
        className={cn(
          'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 outline-none transition-colors',
          'focus-visible:ring-primary focus-visible:ring-1',
          checked
            ? 'border-primary bg-primary'
            : 'bg-muted-foreground/30 hover:bg-muted-foreground/40',
          disabled && 'cursor-not-allowed opacity-50',
          readOnly && !disabled && 'cursor-default',
          className
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
            thumbClassName
          )}
        />
      </button>
    </>
  )
}
