import type { ReactNode } from 'react'

export interface ButtonGroupOption<T extends string = string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

interface ButtonGroupProps<T extends string = string> {
  value: T
  options: ButtonGroupOption<T>[]
  onChange: (value: T) => void
  className?: string
}

/**
 * Compact segmented buttons with single-select behavior.
 */
export function ButtonGroup<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: ButtonGroupProps<T>) {
  return (
    <div className={`inline-flex overflow-hidden rounded-md border border-border bg-card ${className}`}>
      {options.map((option, index) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              index > 0 ? 'border-l border-border' : ''
            } ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
