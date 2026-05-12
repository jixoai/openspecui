import { cn } from '@/lib/utils'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Check } from 'lucide-react'
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
 * Shared boolean control for settings and command options.
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
  return (
    <BaseCheckbox.Root
      id={id}
      name={name}
      checked={checked}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      aria-label={ariaLabel}
      onCheckedChange={onCheckedChange}
      onBlur={onBlur}
      onFocus={onFocus}
      className={(state) =>
        cn(
          'bg-background border-border text-background inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border outline-none transition-colors',
          'focus-visible:ring-primary focus-visible:ring-1',
          state.checked ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted/40',
          state.disabled && 'cursor-not-allowed opacity-50',
          className
        )
      }
    >
      <BaseCheckbox.Indicator
        keepMounted
        className={(state) =>
          cn(
            'flex h-full w-full items-center justify-center transition-opacity',
            state.checked ? 'opacity-100' : 'opacity-0',
            thumbClassName
          )
        }
      >
        <Check className="h-3.5 w-3.5 stroke-[3]" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}
