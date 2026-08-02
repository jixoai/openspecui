/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Edit one exact Store id as a freeform controlled field.
 * 2. Offer read-only registered Store suggestions without making them authoritative.
 * 3. Keep Store selection keyboard accessible and bounded on narrow Config layouts.
 *
 * Original request (2026-07-29): "Store 表单需要使用 Combobox 风格的组件。"
 * Original request (2026-08-01): reuse Store suggestions for machine `defaultStore`.
 */
import { cn } from '@/lib/utils'
import { Combobox } from '@base-ui/react/combobox'
import type { StoreListEntry } from '@openspecui/core'
import { Check, ChevronDown } from 'lucide-react'

/** Controlled Store id editor with optional registry-backed suggestions. */
export function StoreIdCombobox({
  id,
  value,
  stores,
  disabled,
  ariaLabel = 'Store',
  placeholder = 'No Store selected',
  onChange,
}: {
  id?: string
  value: string
  stores: readonly StoreListEntry[]
  disabled?: boolean
  ariaLabel?: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <Combobox.Root<StoreListEntry>
      items={stores}
      filter={null}
      inputValue={value}
      itemToStringLabel={(store) => store.id}
      itemToStringValue={(store) => store.id}
      onInputValueChange={onChange}
      onValueChange={(nextValue) => {
        if (nextValue) onChange(nextValue.id)
      }}
      autoHighlight
    >
      <Combobox.InputGroup
        className={cn(
          'border-border bg-background focus-within:ring-primary flex h-10 min-w-0 items-center rounded-md border focus-within:ring-1',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <Combobox.Input
          id={id}
          aria-label={ariaLabel}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
        />
        <Combobox.Trigger
          aria-label={`Show registered ${ariaLabel} suggestions`}
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground inline-flex h-full w-9 shrink-0 items-center justify-center outline-none"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50 outline-none">
          <Combobox.Popup className="bg-popover text-popover-foreground border-border min-w-(--anchor-width) max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border p-1 shadow-lg">
            <Combobox.List className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent_78%)] max-h-56 overflow-y-auto overflow-x-hidden">
              {stores.map((store) => (
                <Combobox.Item
                  key={store.id}
                  value={store}
                  className={(state) =>
                    cn(
                      'grid min-w-0 cursor-default grid-cols-[1rem_minmax(0,1fr)] items-start gap-2 rounded-sm px-2 py-2 text-sm outline-none',
                      state.highlighted && 'bg-muted',
                      state.selected && 'text-foreground'
                    )
                  }
                >
                  <Combobox.ItemIndicator className="text-primary col-start-1 flex h-4 w-4 items-center justify-center">
                    <Check className="h-4 w-4" aria-hidden />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2 min-w-0">
                    <span className="block break-all font-mono text-xs">{store.id}</span>
                    <span className="text-muted-foreground block break-all text-[11px]">
                      {store.root}
                    </span>
                  </span>
                </Combobox.Item>
              ))}
              {stores.length === 0 ? (
                <div className="text-muted-foreground px-2 py-2 text-xs">
                  No registered Stores available. You can still enter an exact Store id.
                </div>
              ) : null}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
