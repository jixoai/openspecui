/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Render a divided, searchable, filterable, selected-Environment Stores index (7.3).
 * 2. Container-responsive: one readable column when crowded, added density when spacious; no horizontal scroll (7.17).
 * 3. Render Environment selection, title actions, and retained projection lifecycle without owning data.
 * 4. Keep direct Store id/health/usage/mutation state; secondary evidence remains indirect.
 * 5. Animate Store row insertion and layout movement without changing product identity or selection.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Owner-reported defect (2026-07-31): retained Store rows must use the shared revalidation visual language.
 * Spec: hosted-app-distribution › "Scan Stores in an Environment" and the container-responsive law.
 *
 * The Stores index does NOT preserve the old Inventory table or three-tab Store Manager shell. Rows use dividers
 * and stable list geometry rather than nested cards. Mobile renders one readable column; wider containers add
 * aligned facts without introducing horizontal overflow.
 */
import { RealtimeRevalidateCue } from '@openspecui/web-src/components/realtime/realtime-cue'
import { LoaderCircle, Network, Plus, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildStoreDetailPath } from '../lib/store-route-identity'
import { useListFlowAnimation } from '../lib/use-list-flow-animation'

/** Health of one Store row, observed-only. */
export type StoreRowHealth = 'healthy' | 'unhealthy' | 'unknown'

/** Active/failed/indeterminate mutation state for one Store row. */
export type StoreRowMutationState = 'idle' | 'running' | 'succeeded' | 'failed' | 'indeterminate'

/** One Store row projected into the index. */
export interface StoreIndexRow {
  readonly storeId: string
  readonly root?: string
  readonly health: StoreRowHealth
  /** Currently observed "Root for" / "Referenced by" usage summary (observed-only). */
  readonly usage?: { rootFor: number; referencedBy: number }
  readonly mutationState: StoreRowMutationState
}

export interface StoresIndexProps {
  readonly rows: readonly StoreIndexRow[]
  /** Optional selected envUri label for the header. */
  readonly environmentLabel?: string
  /** Open one Store Detail by composite identity (envUri + storeId). */
  readonly envUri: string
  readonly onOpenDetail?: (path: string) => void
  readonly environments?: readonly { envUri: string; label?: string }[]
  readonly onSelectEnvironment?: (envUri: string) => void
  readonly onOpenEnvironments?: () => void
  readonly onNewStore?: () => void
  readonly canCreateStore?: boolean
  readonly createStoreUnavailableReason?: string | null
  readonly onRefresh?: () => void
  readonly authorityMessage?: string | null
  readonly isLoading?: boolean
  readonly isUpdating?: boolean
  readonly error?: string | null
}

function healthVariant(health: StoreRowHealth): 'healthy' | 'neutral' | 'pending' {
  if (health === 'healthy') return 'healthy'
  if (health === 'unhealthy') return 'neutral'
  return 'pending'
}

function mutationLabel(state: StoreRowMutationState): string {
  switch (state) {
    case 'running':
      return 'mutating'
    case 'succeeded':
      return 'mutation succeeded'
    case 'failed':
      return 'mutation failed'
    case 'indeterminate':
      return 'mutation indeterminate'
    default:
      return ''
  }
}

/**
 * Container-responsive Stores index. `@container` enables inline-size queries so the same viewport hosting a
 * mobile-width surface beside the desktop rail still renders one readable column there.
 */
export function StoresIndex({
  rows,
  environmentLabel,
  envUri,
  onOpenDetail,
  environments = [],
  onSelectEnvironment,
  onOpenEnvironments,
  onNewStore,
  canCreateStore = true,
  createStoreUnavailableReason = null,
  onRefresh,
  authorityMessage = null,
  isLoading = false,
  isUpdating = false,
  error = null,
}: StoresIndexProps) {
  const [query, setQuery] = useState('')
  const [healthFilter, setHealthFilter] = useState<'all' | StoreRowHealth>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (healthFilter !== 'all' && row.health !== healthFilter) return false
      if (!q) return true
      return row.storeId.toLowerCase().includes(q) || (row.root?.toLowerCase().includes(q) ?? false)
    })
  }, [rows, query, healthFilter])
  const filteredKeys = useMemo(() => filtered.map((row) => row.storeId), [filtered])
  const listItemRef = useListFlowAnimation(filteredKeys)

  return (
    <div className="@container min-w-0 space-y-4 p-4 md:p-6">
      <div className="@lg:flex-row @lg:items-center @lg:justify-between flex flex-col gap-2">
        <h1 className="font-nav text-2xl font-bold">
          Stores
          {environmentLabel ? (
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {environmentLabel}
            </span>
          ) : null}
        </h1>
        <div className="@sm:flex-row @sm:items-center flex flex-col gap-2">
          {environments.length > 0 ? (
            <select
              value={envUri}
              onChange={(event) => onSelectEnvironment?.(event.target.value)}
              aria-label="Select Store environment"
              className="border-border bg-background text-foreground min-w-0 rounded-md border px-2 py-1.5 text-sm"
            >
              {envUri ? null : <option value="">Select Environment</option>}
              {environments.map((environment) => (
                <option key={environment.envUri} value={environment.envUri}>
                  {environment.label ?? environment.envUri}
                </option>
              ))}
            </select>
          ) : null}
          {onOpenEnvironments ? (
            <button
              type="button"
              onClick={onOpenEnvironments}
              aria-label="Open Environment evidence"
              title="Environment evidence"
              className="border-border hover:bg-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
            >
              <Network className="h-4 w-4" />
            </button>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading || isUpdating || !envUri}
              aria-label="Refresh Stores"
              title="Refresh Stores"
              className="border-border hover:bg-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
            </button>
          ) : null}
          {onNewStore ? (
            <button
              type="button"
              onClick={onNewStore}
              disabled={!envUri || !canCreateStore}
              title={createStoreUnavailableReason ?? 'Create or register a Store'}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              New Store
            </button>
          ) : null}
        </div>
      </div>

      {authorityMessage ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700">
          {authorityMessage}
        </p>
      ) : null}
      {error ? (
        <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      <div className="@sm:flex-row @sm:items-center flex flex-col gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stores"
            aria-label="Search stores"
            className="border-border bg-background focus:border-primary @sm:w-64 w-full rounded-md border py-1.5 pl-8 pr-2 text-sm outline-none"
          />
        </div>
        <select
          value={healthFilter}
          onChange={(event) => setHealthFilter(event.target.value as 'all' | StoreRowHealth)}
          aria-label="Filter stores by health"
          className="border-border bg-background text-foreground rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="all">All health</option>
          <option value="healthy">Healthy</option>
          <option value="unhealthy">Unhealthy</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <RealtimeRevalidateCue
        active={isUpdating}
        persistent
        statusLabel="Stores updating"
        className="min-h-12 rounded-lg"
      >
        {isLoading && rows.length === 0 ? (
          <div
            aria-label="Loading Stores"
            className="border-border divide-border divide-y rounded-md border"
          >
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-4">
                <LoaderCircle className="text-muted-foreground h-4 w-4 animate-spin" />
                <span className="bg-muted h-4 w-40 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground px-1 py-3 text-sm">
            {!envUri
              ? 'Select an Environment to inspect its Stores.'
              : rows.length === 0
                ? 'No stores observed in this environment.'
                : 'No stores match the filter.'}
          </p>
        ) : (
          <ul
            role="list"
            className="border-border divide-border min-w-0 divide-y overflow-hidden rounded-lg border"
          >
            {filtered.map((row) => {
              const detailPath = buildStoreDetailPath({ envUri, storeId: row.storeId })
              return (
                <li ref={listItemRef(row.storeId)} key={row.storeId} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenDetail?.(detailPath)}
                    className="hover:bg-muted/40 @lg:flex-row @lg:items-center @lg:justify-between @lg:gap-4 flex w-full min-w-0 flex-col gap-1 px-4 py-3 text-left"
                    aria-label={`Open store ${row.storeId}`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <HealthDot variant={healthVariant(row.health)} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{row.storeId}</div>
                        {row.root ? (
                          <div className="text-muted-foreground truncate text-xs">{row.root}</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-muted-foreground @lg:justify-end flex shrink-0 flex-wrap items-center gap-2 text-xs">
                      {row.usage ? (
                        <span className="bg-muted rounded px-1.5 py-0.5">
                          Root for {row.usage.rootFor} · Referenced by {row.usage.referencedBy}
                        </span>
                      ) : null}
                      {row.mutationState !== 'idle' ? (
                        <span className="bg-muted rounded px-1.5 py-0.5">
                          {mutationLabel(row.mutationState)}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </RealtimeRevalidateCue>
      <p className="text-muted-foreground/70 text-xs">
        Observed stores only. Empty results do not imply machine-wide completeness.
      </p>
    </div>
  )
}

function HealthDot({ variant }: { variant: 'healthy' | 'neutral' | 'pending' }) {
  const color =
    variant === 'healthy'
      ? 'bg-emerald-500'
      : variant === 'neutral'
        ? 'bg-muted-foreground/40'
        : 'bg-amber-500'
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
}
