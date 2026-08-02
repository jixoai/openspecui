/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Edit the machine `defaultStore` through exact freeform input plus registry suggestions.
 * 2. Keep configured fallback settlement separate from CLI-effective Root Context truth.
 * 3. Lock mutation during loading, stale authority, transport failure, and pending settlement.
 * 4. Preserve explicit clear and direct stale/invalid diagnostics without requiring registry success.
 *
 * Original request (2026-08-01): adapt OpenSpec 1.7 machine `defaultStore` and show exact fallback evidence.
 */
import { AsyncAction } from '@/components/realtime'
import { trpcClient } from '@/lib/trpc'
import { useRootActionState } from '@/lib/use-root-action-state'
import { useStoreListProjection } from '@/lib/use-store-list-projection'
import type { EnvironmentGlobalConfig } from '@openspecui/core'
import { useMutation } from '@tanstack/react-query'
import { Database, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { StoreIdCombobox } from './store-id-combobox'

function configuredId(config: EnvironmentGlobalConfig | null): string {
  return config?.defaultStore.state === 'configured' ? config.defaultStore.id : ''
}

/** Machine fallback editor whose success means config settlement, never effective Root success. */
export function EnvironmentDefaultStoreSection({
  config,
  projectionLocked,
  refresh,
}: {
  config: EnvironmentGlobalConfig | null
  projectionLocked: boolean
  refresh: () => Promise<void>
}) {
  const rootAction = useRootActionState()
  const storeProjection = useStoreListProjection(config !== null)
  const [draft, setDraft] = useState(() => configuredId(config))
  const [dirty, setDirty] = useState(false)
  const [pendingValue, setPendingValue] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const authored = config?.defaultStore ?? null

  useEffect(() => {
    if (!config) return
    if (pendingValue !== undefined) {
      const settled =
        (pendingValue === null && authored?.state === 'absent') ||
        (pendingValue !== null && authored?.state === 'configured' && authored.id === pendingValue)
      if (settled) {
        setPendingValue(undefined)
        setDraft(pendingValue ?? '')
        setDirty(false)
        return
      }
      if (projectionLocked) return
      setPendingValue(undefined)
      setDraft(configuredId(config))
      setDirty(false)
      setError(
        'The configuration command completed, but the replacement projection settled with a different value. Review the current config and retry.'
      )
      return
    }
    if (!dirty) setDraft(configuredId(config))
  }, [authored, config, dirty, pendingValue, projectionLocked])

  const mutation = useMutation({
    mutationFn: async (value: string | null) => {
      const result = await trpcClient.planningConfig.writeEnvironmentDefaultStore.mutate({ value })
      await refresh()
      return result
    },
    onSuccess: (_result, value) => {
      setPendingValue(value)
      setDirty(false)
      setError(null)
    },
    onError: (reason) => {
      setError(reason instanceof Error ? reason.message : String(reason))
    },
  })

  const normalizedDraft = draft.trim()
  const authoredId = authored?.state === 'configured' ? authored.id : null
  const canSave =
    normalizedDraft.length > 0 &&
    normalizedDraft !== authoredId &&
    !projectionLocked &&
    !mutation.isPending &&
    pendingValue === undefined
  const canClear =
    authored?.state !== 'absent' &&
    !projectionLocked &&
    !mutation.isPending &&
    pendingValue === undefined
  const effective = rootAction.context
  const effectiveSource = effective?.planningRoot?.source ?? null
  const effectiveStoreId = effective?.storeId ?? null
  const effectiveMessage = useMemo(() => {
    if (pendingValue !== undefined)
      return 'Configuration saved; waiting for replacement projections.'
    if (rootAction.status === 'checking') return 'Checking the effective Root Context.'
    if (rootAction.status === 'blocked') return rootAction.message
    if (effectiveSource === 'global_default' && effectiveStoreId === authoredId) {
      return `Effective fallback: ${effectiveStoreId}`
    }
    if (authoredId) {
      return effectiveSource
        ? `Configured fallback is not selected; current Root source is ${effectiveSource}.`
        : 'Configured fallback is not currently selected.'
    }
    return effectiveSource
      ? `No machine fallback configured; current Root source is ${effectiveSource}.`
      : 'No machine fallback configured.'
  }, [authoredId, effectiveSource, effectiveStoreId, pendingValue, rootAction])
  const stores = storeProjection.data?.stores ?? []
  const suggestionsUnavailable =
    storeProjection.error !== null || storeProjection.data?.available === false
  const locked = projectionLocked || mutation.isPending || pendingValue !== undefined

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="text-muted-foreground h-4 w-4" aria-hidden />
          <div>
            <div className="text-sm font-medium">Default Store</div>
            <div className="text-muted-foreground text-xs">
              Used only when no explicit Store, local root, or project `store:` pointer resolves.
            </div>
          </div>
        </div>
        <StoreIdCombobox
          id="environment-default-store"
          ariaLabel="Default Store"
          placeholder="No machine default Store"
          value={draft}
          stores={stores}
          disabled={locked}
          onChange={(value) => {
            if (locked) return
            setDraft(value)
            setDirty(value !== (authoredId ?? ''))
            setError(null)
          }}
        />
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {stores.length > 0 ? <span>{stores.length} registered suggestions available</span> : null}
          {suggestionsUnavailable ? (
            <span
              role="status"
              title={storeProjection.error?.message ?? storeProjection.data?.error?.message}
            >
              Suggestions unavailable; exact ids remain editable.
            </span>
          ) : null}
        </div>
      </div>

      {authored?.state === 'invalid' ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs"
        >
          The authored `defaultStore` value is invalid. Set an exact Store id or clear the field;
          the original value remains available in Raw JSON.
        </div>
      ) : null}

      <div
        role={rootAction.status === 'blocked' && authoredId ? 'alert' : 'status'}
        className="border-border bg-muted/30 rounded-md border px-3 py-2 text-xs"
      >
        <div className="font-medium">Effective Root evidence</div>
        <div className="text-muted-foreground mt-1 break-words">{effectiveMessage}</div>
      </div>

      {error ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <AsyncAction
          size="sm"
          pending={mutation.isPending && mutation.variables !== null}
          settled={!dirty && pendingValue === undefined}
          disabled={!canSave}
          onClick={() => mutation.mutate(normalizedDraft)}
        >
          <Save className="h-3.5 w-3.5" />
          Set default
        </AsyncAction>
        <AsyncAction
          size="sm"
          variant="secondary"
          pending={mutation.isPending && mutation.variables === null}
          settled={authored?.state === 'absent' && pendingValue === undefined}
          disabled={!canClear}
          onClick={() => mutation.mutate(null)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </AsyncAction>
      </div>
    </div>
  )
}
