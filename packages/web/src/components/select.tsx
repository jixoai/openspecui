import { cn } from '@/lib/utils'
import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useState, type FocusEventHandler, type ReactNode } from 'react'

export interface SelectOption<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

export interface SelectOptionGroup<T extends string> {
  label: ReactNode
  options: readonly SelectOption<T>[]
}

interface SelectProps<T extends string> {
  value: T
  options?: readonly SelectOption<T>[]
  groups?: readonly SelectOptionGroup<T>[]
  onValueChange: (value: T) => void
  ariaLabel?: string
  id?: string
  name?: string
  required?: boolean
  disabled?: boolean
  onBlur?: FocusEventHandler<HTMLButtonElement>
  onFocus?: FocusEventHandler<HTMLButtonElement>
  'data-testid'?: string
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

function isEmptyOptionLabel<T extends string>(option: SelectOption<T> | undefined): boolean {
  return option?.value === '' && option.label === ''
}

function getOptionAccessibleLabel<T extends string>(option: SelectOption<T>): string | undefined {
  if (isEmptyOptionLabel(option)) return 'none'
  return typeof option.label === 'string' ? option.label : undefined
}

function renderOptionLabel<T extends string>(option: SelectOption<T>): ReactNode {
  if (isEmptyOptionLabel(option)) {
    return <i className="text-muted-foreground">none</i>
  }
  return option.label
}

export function Select<T extends string>({
  value,
  options = [],
  groups,
  onValueChange,
  ariaLabel,
  id,
  name,
  required,
  disabled,
  onBlur,
  onFocus,
  'data-testid': dataTestId,
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
  const optionGroups = groups ?? [{ label: null, options }]
  const selectedOption = optionGroups
    .flatMap((group) => group.options)
    .find((option) => option.value === value)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const handleTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    const nextContainer = node?.closest('dialog') ?? null
    setPortalContainer((currentContainer) =>
      currentContainer === nextContainer ? currentContainer : nextContainer
    )
  }, [])

  return (
    <BaseSelect.Root
      id={id}
      name={name}
      value={value}
      required={required}
      disabled={disabled}
      modal={modal}
      onValueChange={(nextValue) => {
        if (nextValue !== null) {
          onValueChange(nextValue as T)
        }
      }}
    >
      <BaseSelect.Trigger
        ref={handleTriggerRef}
        aria-label={ariaLabel}
        data-testid={dataTestId}
        onBlur={onBlur}
        onFocus={onFocus}
        className={(state) =>
          cn(
            'bg-background border-border text-foreground inline-flex min-w-0 items-center rounded-md border text-sm outline-none transition-colors',
            renderTrigger ? 'justify-center' : 'h-9 justify-between gap-2 px-3 py-2',
            'hover:bg-muted/30 focus-visible:ring-primary focus-visible:ring-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            state.open ? 'bg-muted/40 ring-primary ring-1' : '',
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
              {() => (selectedOption ? renderOptionLabel(selectedOption) : placeholder)}
            </BaseSelect.Value>
            <BaseSelect.Icon className="text-muted-foreground flex shrink-0">
              <ChevronDown className="h-4 w-4" />
            </BaseSelect.Icon>
          </>
        )}
      </BaseSelect.Trigger>

      <BaseSelect.Portal container={portalContainer ?? undefined}>
        <BaseSelect.Positioner
          sideOffset={sideOffset}
          className={cn('z-50 select-none outline-none', positionerClassName)}
        >
          <BaseSelect.Popup
            className={cn(
              'bg-card text-foreground border-border min-w-(--anchor-width) max-w-[min(24rem,calc(100vw-2rem))] rounded-md border p-1 shadow-lg',
              'origin-(--transform-origin) transition-[transform,opacity] duration-150',
              'data-[ending-style]:translate-y-0.5 data-[ending-style]:opacity-0',
              'data-[starting-style]:translate-y-0.5 data-[starting-style]:opacity-0',
              popupClassName
            )}
          >
            <BaseSelect.List
              className={cn(
                'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent_78%)] max-h-[min(18rem,var(--available-height))] overflow-x-auto overflow-y-auto py-0.5',
                listClassName
              )}
            >
              {optionGroups.map((group, groupIndex) => (
                <BaseSelect.Group key={groupIndex} className={cn(groupIndex > 0 && 'mt-1')}>
                  {group.label && (
                    <BaseSelect.GroupLabel className="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">
                      {group.label}
                    </BaseSelect.GroupLabel>
                  )}
                  {group.options.map((option) => (
                    <BaseSelect.Item
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      label={getOptionAccessibleLabel(option)}
                      className={(state) =>
                        cn(
                          'grid cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                          state.highlighted && 'bg-muted text-foreground',
                          state.selected && 'text-foreground',
                          state.disabled && 'opacity-50',
                          itemClassName
                        )
                      }
                    >
                      <BaseSelect.ItemIndicator className="text-primary flex h-4 w-4 items-center justify-center">
                        <Check className="h-4 w-4" />
                      </BaseSelect.ItemIndicator>
                      <BaseSelect.ItemText className="whitespace-nowrap">
                        {renderOptionLabel(option)}
                      </BaseSelect.ItemText>
                    </BaseSelect.Item>
                  ))}
                </BaseSelect.Group>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
