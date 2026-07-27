/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Make Store Doctor evidence the primary Store Manager interaction.
 * 2. Reserve backend-owned mutation controls without inferring applicability.
 * 3. Keep Access Gate credentials outside route/component props.
 * 4. Bind form/dialog intent to its full origin identity and revalidate it at dispatch.
 * 5. Compose backend ledger evidence and terminal-driven Store/Context refreshes.
 *
 * Original request (2026-07-15): "Store Manager uses the Store Inspector as its primary interaction."
 */
import type { StoreDoctorStore } from '@openspecui/core/store-types'
import { RefreshCw, Search, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { EmptyView, ErrorView, LoadingView } from '../components/state-views'
import { StatusBadge, StatusDot, type StatusVariant } from '../components/status-badge'
import { StoreManagerShell } from '../components/store-manager-shell'
import {
  StoreMutationLifecycleEvidence,
  useStoreMutationLifecycle,
} from '../components/store-mutation-lifecycle'
import { StoreRemoveDialog } from '../components/store-remove-dialog'
import { useMutationObservations } from '../lib/mutation-observation-provider'
import {
  correlateStoreMutationAdmissions,
  isSameStoreActionAuthority,
  useStoreMutationDispatcher,
  type StoreActionAuthority,
} from '../lib/store-action'
import { deriveHealthFromDiagnostics, type StoreHealthSummary } from '../lib/store-health'
import { selectStoreMutationLocator } from '../lib/store-lifecycle-composer'
import { useActiveBackend } from '../lib/use-active-backend'
import { useStoreData } from '../lib/use-store-data'

/** Store 健康态 → 统一 StatusVariant（语义化状态徽章共用，列表/详情复用）。 */
function healthVariant(health: StoreHealthSummary): StatusVariant {
  if (health.state === 'healthy') return 'healthy'
  if (health.state === 'issue') return 'issue'
  return 'neutral'
}

interface StoreSetupRegisterDraft {
  kind: 'setup' | 'register'
  id: string
  path: string
  remote: string
  authority: StoreActionAuthority | null
}

/**
 * Store Inspector（B 视图，主交互）：selection-first master/detail。
 *
 * 职责（AGENTS.md）：Store 身份、doctor 证据、setup/register/unregister/remove 控件。
 * 投影来源：`openspec store doctor [id] --json`（客观保留上游事实，不重解释为所有权/完整性结论）。
 *
 * TODO(kernel): stores.inspect 能力决定本视图是否渲染；stores.mutate 能力决定控件是否可操作。
 */
export function StoreInspectorRoute() {
  const { active } = useActiveBackend()
  const { inspector, isInspectorLoading, isInspectorUpdating, inspectorError, canMutate, refresh } =
    useStoreData({ apiBaseUrl: active?.apiBaseUrl })
  const mutationLifecycle = useStoreMutationLifecycle(active?.apiBaseUrl, refresh)
  const mutationSnapshot = useMutationObservations()
  const stores = inspector?.stores ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [removeTarget, setRemoveTarget] = useState<{
    store: StoreDoctorStore
    authority: StoreActionAuthority
    envUri: string | undefined
  } | null>(null)
  const dispatchStoreMutation = useStoreMutationDispatcher()
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [setupRegisterDraft, setSetupRegisterDraft] = useState<StoreSetupRegisterDraft>({
    kind: 'register',
    id: '',
    path: '',
    remote: '',
    authority: null,
  })

  const visibleStores = useMemo(() => {
    const normalized = filter.trim().toLowerCase()
    if (!normalized) return stores
    return stores.filter(
      (store) =>
        (store.id ?? '').toLowerCase().includes(normalized) ||
        (store.root ?? '').toLowerCase().includes(normalized)
    )
  }, [stores, filter])

  const selected = stores.find((store) => store.id === selectedId) ?? visibleStores[0] ?? null
  const registerAdmission = mutationLifecycle.registerAdmission

  const dispatchAndCorrelate = useMemo(
    () => correlateStoreMutationAdmissions(dispatchStoreMutation, registerAdmission),
    [dispatchStoreMutation, registerAdmission]
  )

  const runMutation = useCallback(
    async (
      kind: 'setup' | 'register' | 'unregister',
      input: Record<string, unknown>,
      authority: StoreActionAuthority | null = active
    ): Promise<void> => {
      setMutationError(null)
      if (!canMutate) {
        throw new Error('Store diagnostics are not current. Wait for refresh to settle.')
      }
      const requestId = `${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
      await dispatchAndCorrelate(authority, { requestId, kind, ...input })
    },
    [active, canMutate, dispatchAndCorrelate]
  )

  let body
  if (isInspectorLoading && !inspector) {
    body = <LoadingView label="Loading store diagnostics..." />
  } else if (inspectorError && !inspector) {
    body = <ErrorView message={inspectorError.message} />
  } else if (stores.length === 0) {
    body = (
      <EmptyView title="No Stores registered">
        <div className="space-y-3">
          <p>
            Registered Stores will appear here once the backend reports them via{' '}
            <code className="bg-muted rounded px-1">openspec store doctor</code>.
          </p>
          <StoreSetupRegisterForm
            disabled={!active?.apiBaseUrl || !canMutate}
            authority={active}
            draft={setupRegisterDraft}
            onDraftChange={setSetupRegisterDraft}
            onSubmit={(authority, kind, input) => {
              runMutation(kind, input, authority).catch((err: unknown) => {
                setMutationError(err instanceof Error ? err.message : String(err))
              })
            }}
          />
        </div>
      </EmptyView>
    )
  } else {
    body = (
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className="border-border flex flex-col rounded-lg border">
          <div className="border-border flex items-center gap-2 border-b p-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter id or path"
              aria-label="Filter stores"
              className="bg-background w-full text-sm outline-none"
            />
            <span className="text-muted-foreground shrink-0 text-xs">{visibleStores.length}</span>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {visibleStores.map((store) => {
              const isSelected = selected?.id === store.id
              const health = deriveHealthFromDiagnostics(store.status)
              return (
                <li key={store.id ?? store.root}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(store.id ?? null)}
                    aria-current={isSelected}
                    className={`hover:bg-muted/50 flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm ${
                      isSelected ? 'bg-muted' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{store.id}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {store.root}
                      </span>
                    </span>
                    <StatusDot variant={healthVariant(health)} ariaLabel={health.label} />
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {selected ? (
          <StoreInspectorDetail
            store={selected}
            onRemove={() => {
              if (active && canMutate) {
                setRemoveTarget({
                  store: selected,
                  authority: active,
                  envUri: active.health?.envUri,
                })
              }
            }}
            onUnregister={() => {
              if (!selected?.id) return
              runMutation('unregister', { storeId: selected.id }).catch((err: unknown) => {
                setMutationError(err instanceof Error ? err.message : String(err))
              })
            }}
            mutationDisabled={!canMutate}
          />
        ) : (
          <EmptyView title="Select a Store to inspect" />
        )}

        {removeTarget ? (
          <StoreRemoveDialog
            store={removeTarget.store}
            envUri={removeTarget.envUri}
            authority={removeTarget.authority}
            authorityCurrent={isSameStoreActionAuthority(removeTarget.authority, active)}
            removeStore={(authority, requestId, storeId) =>
              dispatchAndCorrelate(authority, {
                requestId,
                kind: 'remove',
                storeId,
                confirmDelete: true,
              })
            }
            mutationRecords={
              selectStoreMutationLocator(mutationSnapshot, removeTarget.authority.apiBaseUrl)
                ?.records ?? []
            }
            onClose={() => setRemoveTarget(null)}
          />
        ) : null}
      </div>
    )
  }

  return (
    <StoreManagerShell>
      {isInspectorUpdating && inspector ? (
        <span
          role="status"
          aria-label="Refreshing store diagnostics"
          className="text-muted-foreground inline-flex self-start"
        >
          <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
        </span>
      ) : null}
      {inspectorError && inspector ? <ErrorView message={inspectorError.message} /> : null}
      {body}
      {mutationError ? (
        <p
          className="border-destructive/40 text-destructive bg-destructive/5 rounded-md border px-3 py-2 text-xs"
          role="alert"
        >
          {mutationError}
        </p>
      ) : null}
      <StoreMutationLifecycleEvidence lifecycle={mutationLifecycle} />
    </StoreManagerShell>
  )
}

function StoreInspectorDetail({
  store,
  onRemove,
  onUnregister,
  mutationDisabled,
}: {
  store: StoreDoctorStore
  onRemove: () => void
  onUnregister: () => void
  mutationDisabled: boolean
}) {
  const health = deriveHealthFromDiagnostics(store.status)
  return (
    <article className="border-border space-y-4 rounded-lg border p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs uppercase tracking-wide">
            Selected Store
          </div>
          <h2 className="truncate text-xl font-semibold">{store.id}</h2>
          <p className="text-muted-foreground truncate text-xs" title={store.root}>
            {store.root}
          </p>
        </div>
        <StatusBadge variant={healthVariant(health)} label={health.label} />
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Identity and location</h3>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Store id</dt>
          <dd className="font-mono">{store.id ?? '—'}</dd>
          <dt className="text-muted-foreground">Checkout root</dt>
          <dd className="font-mono">{store.root ?? '—'}</dd>
          <dt className="text-muted-foreground">Metadata</dt>
          <dd className="font-mono">{store.metadata_path ?? '—'}</dd>
          <dt className="text-muted-foreground">Git remote</dt>
          <dd className="font-mono">{store.git?.origin_url ?? '—'}</dd>
        </dl>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Doctor checks</h3>
        {/* 诊断客观保留上游 snake_case 事实；不重解释为所有权/完整性结论。 */}
        <ul className="space-y-1">
          {(store.status ?? []).map((diagnostic, index) => (
            <li
              key={`${diagnostic.code ?? ''}-${index}`}
              className="border-border text-muted-foreground rounded border px-2 py-1 text-xs"
            >
              <span className="text-foreground">{diagnostic.message ?? diagnostic.code}</span>
              {diagnostic.fix ? <span className="block">↳ {diagnostic.fix}</span> : null}
            </li>
          ))}
          {(store.status ?? []).length === 0 ? (
            <li className="text-muted-foreground text-xs">No diagnostics reported.</li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Operation boundaries</h3>
        <div className="flex flex-wrap gap-2">
          {/* unregister/remove are stores.mutate operations; the backend owns the CLI lifecycle. */}
          <button
            type="button"
            onClick={onUnregister}
            disabled={mutationDisabled}
            className="hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
          >
            Unregister (forget entry)
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={mutationDisabled}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove files
          </button>
          <span className="text-muted-foreground self-center text-xs">
            Git synchronization: manual, outside OpenSpecUI
          </span>
        </div>
      </section>
    </article>
  )
}

/** Compact setup/register form for the empty-state. Both are stores.mutate operations (backend-owned). */
function StoreSetupRegisterForm({
  disabled,
  authority,
  draft,
  onDraftChange,
  onSubmit,
}: {
  disabled: boolean
  authority: StoreActionAuthority | null
  draft: StoreSetupRegisterDraft
  onDraftChange: (draft: StoreSetupRegisterDraft) => void
  onSubmit: (
    authority: StoreActionAuthority | null,
    kind: 'setup' | 'register',
    input: Record<string, unknown>
  ) => void
}) {
  const submit = () => {
    if (!draft.path.trim()) return
    if (draft.kind === 'setup') {
      onSubmit(draft.authority ?? authority, 'setup', {
        storeId: draft.id.trim() || undefined,
        path: draft.path.trim(),
        remote: draft.remote.trim() || undefined,
      })
    } else {
      onSubmit(draft.authority ?? authority, 'register', {
        path: draft.path.trim(),
        id: draft.id.trim() || undefined,
      })
    }
  }

  return (
    <form
      aria-label="Store setup or registration"
      className="border-border space-y-2 rounded-md border p-3 text-left"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => onDraftChange({ ...draft, kind: 'register' })}
          className={`rounded-md border px-2 py-1 ${draft.kind === 'register' ? 'bg-primary text-primary-foreground' : ''}`}
        >
          Register existing
        </button>
        <button
          type="button"
          onClick={() => onDraftChange({ ...draft, kind: 'setup' })}
          className={`rounded-md border px-2 py-1 ${draft.kind === 'setup' ? 'bg-primary text-primary-foreground' : ''}`}
        >
          Setup new
        </button>
      </div>
      <input
        type="text"
        placeholder="Store id (optional override)"
        value={draft.id}
        onChange={(event) => onDraftChange({ ...draft, id: event.target.value, authority })}
        className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
      />
      <input
        type="text"
        placeholder="Path to Store root"
        value={draft.path}
        onChange={(event) => onDraftChange({ ...draft, path: event.target.value, authority })}
        className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
      />
      {draft.kind === 'setup' ? (
        <input
          type="text"
          placeholder="Git remote (optional)"
          value={draft.remote}
          onChange={(event) => onDraftChange({ ...draft, remote: event.target.value, authority })}
          className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
        />
      ) : null}
      {draft.authority && !isSameStoreActionAuthority(draft.authority, authority) ? (
        <p className="text-xs text-amber-700" role="status">
          This draft belongs to a previous environment observation. Edit a field to bind the current
          environment.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={disabled || !draft.path.trim()}
        className="bg-primary text-primary-foreground w-full rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
      >
        {draft.kind === 'setup' ? 'Setup Store' : 'Register Store'}
      </button>
    </form>
  )
}
