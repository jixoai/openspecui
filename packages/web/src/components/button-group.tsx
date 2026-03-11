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
  tone?: 'default' | 'terminal'
}

/**
 * Compact segmented buttons with single-select behavior.
 */
export function ButtonGroup<T extends string>({
  value,
  options,
  onChange,
  className = '',
  tone = 'default',
}: ButtonGroupProps<T>) {
  const containerClassName =
    tone === 'terminal'
      ? 'border-terminal-foreground/25 bg-terminal/70 text-terminal-foreground'
      : 'border-border bg-card'

  return (
    <div
      className={`inline-flex overflow-hidden rounded-md border ${containerClassName} ${className}`}
    >
      {options.map((option, index) => {
        const active = option.value === value
        const stateClassName = active
          ? 'bg-primary text-primary-foreground'
          : tone === 'terminal'
            ? 'text-terminal-foreground/72 hover:bg-terminal-foreground/10 hover:text-terminal-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'

        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              index > 0
                ? tone === 'terminal'
                  ? 'border-terminal-foreground/20 border-l'
                  : 'border-border border-l'
                : ''
            } ${stateClassName}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
