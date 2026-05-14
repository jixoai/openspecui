import { cn } from '@/lib/utils'
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type MouseEventHandler,
} from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'icon-sm' | 'icon-md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  activity?: boolean
}

const variantClassNames: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border-border bg-background text-foreground border hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700',
}

const activityVariantClassNames: Record<ButtonVariant, string> = {
  primary: 'bg-primary/10 text-primary hover:bg-primary/10',
  secondary: 'border-primary/40 bg-primary/10 text-primary border hover:bg-primary/10',
  ghost: 'bg-primary/10 text-primary hover:bg-primary/10',
  destructive: 'bg-red-600/10 text-red-600 hover:bg-red-600/10 dark:text-red-400',
}

const sizeClassNames: Record<ButtonSize, string> = {
  sm: 'gap-1.5 rounded-md px-3 py-1.5 text-xs',
  md: 'gap-2 rounded-md px-4 py-2 text-sm',
  'icon-sm': 'h-7 w-7 rounded-md p-0',
  'icon-md': 'h-9 w-9 rounded-md p-0',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    activity = false,
    disabled = false,
    type = 'button',
    className,
    onClick,
    'aria-disabled': ariaDisabled,
    ...props
  },
  ref
) {
  const handleClick: MouseEventHandler<HTMLButtonElement> = (
    event: MouseEvent<HTMLButtonElement>
  ) => {
    if (activity) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    onClick?.(event)
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={ariaDisabled ?? (activity ? true : undefined)}
      data-activity={activity ? 'true' : undefined}
      onClick={handleClick}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium outline-none transition-colors',
        'focus-visible:ring-primary focus-visible:ring-1',
        disabled ? 'cursor-not-allowed opacity-50' : activity ? 'cursor-default' : 'cursor-pointer',
        activity ? activityVariantClassNames[variant] : variantClassNames[variant],
        sizeClassNames[size],
        className
      )}
      {...props}
    />
  )
})
