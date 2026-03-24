import { cn } from '@/lib/utils'
import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export interface SelectOption<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

interface SelectProps<T extends string> {
  value: T
  options: readonly SelectOption<T>[]
  onValueChange: (value: T) => void
  ariaLabel?: string
  placeholder?: ReactNode
  renderTrigger?: (args: { selectedOption: SelectOption<T> | undefined }) => ReactNode
  className?: string
  popupClassName?: string
  listClassName?: string
  itemClassName?: string
  positionerClassName?: string
  sideOffset?: number
  modal?: boolean
}

export function Select<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder = 'Select…',
  renderTrigger,
  className,
  popupClassName,
  listClassName,
  itemClassName,
  positionerClassName,
  sideOffset = 8,
  modal = false,
}: SelectProps<T>) {
  const selectedOption = options.find((option) => option.value === value)

  return (
    <BaseSelect.Root
      value={value}
      modal={modal}
      onValueChange={(nextValue) => {
        if (nextValue !== null) {
          onValueChange(nextValue as T)
        }
      }}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel}
        className={(state) =>
          cn(
            'text-foreground inline-flex min-w-0 items-center gap-1.5 text-xs outline-none transition-colors',
            'focus-visible:ring-ring/60 focus-visible:ring-2',
            state.open ? 'bg-muted/40' : '',
            className
          )
        }
      >
        {renderTrigger ? (
          renderTrigger({
            selectedOption,
          })
        ) : (
          <>
            <BaseSelect.Value placeholder={placeholder} className="truncate">
              {() => selectedOption?.label ?? placeholder}
            </BaseSelect.Value>
            <BaseSelect.Icon className="text-muted-foreground flex shrink-0">
              <ChevronDown className="h-3.5 w-3.5" />
            </BaseSelect.Icon>
          </>
        )}
      </BaseSelect.Trigger>

      <BaseSelect.Portal>
        <BaseSelect.Positioner
          sideOffset={sideOffset}
          className={cn('z-50 select-none outline-none', positionerClassName)}
        >
          <BaseSelect.Popup
            className={cn(
              'bg-card text-foreground border-border w-max min-w-28 rounded-md border p-1 shadow-lg',
              'origin-(--transform-origin) transition-[transform,opacity] duration-150',
              'data-[ending-style]:translate-y-0.5 data-[ending-style]:opacity-0',
              'data-[starting-style]:translate-y-0.5 data-[starting-style]:opacity-0',
              popupClassName
            )}
          >
            <BaseSelect.List className={cn('max-h-64 overflow-y-auto py-0.5', listClassName)}>
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  label={typeof option.label === 'string' ? option.label : undefined}
                  className={(state) =>
                    cn(
                      'grid cursor-default grid-cols-[0.8rem_minmax(0,1fr)] items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs outline-none',
                      state.highlighted && 'bg-muted text-foreground',
                      state.selected && 'text-foreground',
                      state.disabled && 'opacity-50',
                      itemClassName
                    )
                  }
                >
                  <BaseSelect.ItemIndicator className="text-primary flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-3.5 w-3.5" />
                  </BaseSelect.ItemIndicator>
                  <BaseSelect.ItemText className="whitespace-nowrap">
                    {option.label}
                  </BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
