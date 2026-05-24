import { Tooltip } from '@/components/tooltip'
import type { ReactNode } from 'react'

export interface ButtonGroupOption<T extends string = string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
  ariaLabel?: string
  tooltip?: ReactNode
}

interface ButtonGroupProps<T extends string = string> {
  value: T
  options: readonly ButtonGroupOption<T>[]
  onChange: (value: T) => void
  className?: string
  tone?: 'default' | 'terminal'
  presentation?: 'label' | 'icon-only' | 'icon-label'
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
  presentation = 'label',
}: ButtonGroupProps<T>) {
  const containerClassName =
    tone === 'terminal'
      ? 'border-terminal-foreground/25 bg-terminal/70 text-terminal-foreground'
      : 'border-border bg-card'

  return (
    <div
      className={`inline-flex w-fit max-w-full shrink-0 self-start overflow-hidden rounded-md border ${containerClassName} ${className}`}
    >
      {options.map((option, index) => {
        const active = option.value === value
        const stateClassName = active
          ? 'bg-primary text-primary-foreground'
          : tone === 'terminal'
            ? 'text-terminal-foreground/72 hover:bg-terminal-foreground/10 hover:text-terminal-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        const accessibleLabel =
          option.ariaLabel ?? (typeof option.label === 'string' ? option.label : undefined)
        const tooltipContent = option.tooltip ?? accessibleLabel
        const content =
          presentation === 'icon-only' ? (
            (option.icon ?? option.label)
          ) : presentation === 'icon-label' && option.icon ? (
            <>
              {option.icon}
              <span>{option.label}</span>
            </>
          ) : (
            option.label
          )

        const button = (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            aria-label={presentation === 'icon-only' ? accessibleLabel : undefined}
            title={
              presentation === 'icon-only' && typeof accessibleLabel === 'string'
                ? accessibleLabel
                : undefined
            }
            className={`inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              presentation === 'icon-only' ? 'h-8 w-8 p-0' : 'px-3 py-1.5'
            } ${
              index > 0
                ? tone === 'terminal'
                  ? 'border-terminal-foreground/20 border-l'
                  : 'border-border border-l'
                : ''
            } ${stateClassName}`}
          >
            {content}
          </button>
        )

        return tooltipContent ? (
          <Tooltip key={option.value} content={tooltipContent}>
            {button}
          </Tooltip>
        ) : (
          button
        )
      })}
    </div>
  )
}
